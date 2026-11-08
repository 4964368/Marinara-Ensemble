import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const dir = mkdtempSync(join(tmpdir(), "marinara-ensemble-"));
Object.assign(process.env, {
  DATA_DIR: dir,
  NODE_ENV: "test",
  LOG_LEVEL: process.env.ENSEMBLE_TEST_LOG_LEVEL ?? "silent",
});
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const fastify = requireServer("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { conversationRoutes } = await import("../../packages/server/src/routes/conversation.routes.js");
const { startGroupAutonomy } =
  await import("../../packages/server/src/services/conversation/group-autonomy.service.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

type Call = { model: string; prompt: string; path: string; maxTokens: number };
const calls: Call[] = [];
let repeat: string | null = null;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  calls.push({ model: body.model, prompt: JSON.stringify(body.messages), path: req.url!, maxTokens: body.max_tokens });
  if (body.model === "missing") {
    res.writeHead(404, { "content-type": "application/json" }).end('{"error":{"message":"No such model"}}');
    return;
  }
  const content = repeat ?? "I have a new suggestion for the group: option " + calls.length + ".";
  const usage = { prompt_tokens: 60, completion_tokens: 15, total_tokens: 75 };
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      "data: " +
        JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }], usage }) +
        "\n\ndata: [DONE]\n\n",
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage,
      }),
    );
  }
});

const db = await createFileNativeDB();
const app = fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(conversationRoutes, { prefix: "/api/conversation" });
startGroupAutonomy(app);
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const connections = createConnectionsStorage(db);

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  async function connection(name: string) {
    return (await connections.create({
      name,
      provider: "custom",
      baseUrl: "http://127.0.0.1:" + address!.port + "/" + name + "/v1",
      apiKey: "test",
      model: name,
      maxContext: 16384,
      maxTokensOverride: 512,
    }))!;
  }
  const main = await connection("default");
  await connections.update(main.id, { fallbackForMain: true });
  const red = await connection("red");
  const blue = await connection("blue");
  const roster = await Promise.all(
    ["Ada", "Bert", "Cleo"].map(
      async (name, i) =>
        (await characters.create(
          characterDataSchema.parse({
            name,
            personality: "PERSONALITY_" + name,
            extensions: { responseModel: { connectionId: i === 1 ? blue.id : red.id, model: "model-" + name } },
          }),
        ))!,
    ),
  );
  const ids = roster.map(({ id }) => id);
  const chat = (await chats.create({
    name: "Ensemble fixture",
    mode: "conversation",
    characterIds: ids,
    connectionId: main.id,
  }))!;
  await chats.patchMetadata(chat.id, {
    groupChatMode: "individual",
    groupResponseOrder: "sequential",
    enableAgents: false,
    characterSchedulesEnabled: false,
  });
  const generate = (payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/generate",
      payload: { chatId: chat.id, streaming: false, skipPresenceDelay: true, ...payload },
    });
  const publicReply = await generate({ userMessage: "Decide where to meet tomorrow." });
  assert.match(publicReply.body, /"type":"message_saved".*"role":"assistant"/);
  assert.deepEqual(
    calls.map(({ model, path }) => [model, path]),
    [
      ["model-Ada", "/red/v1/chat/completions"],
      ["model-Bert", "/blue/v1/chat/completions"],
      ["model-Cleo", "/red/v1/chat/completions"],
    ],
  );
  for (const [index, name] of ["Ada", "Bert", "Cleo"].entries()) {
    assert.match(calls[index]!.prompt, new RegExp("PERSONALITY_" + name));
  }

  const secret = "M1_SECRET_COBALT_931";
  const secretReply = await generate({
    userMessage: secret,
    messageVisibility: { type: "characters", characterIds: [ids[0]] },
  });
  assert.match(secretReply.body, /"type":"message_saved".*"role":"assistant"/);
  assert.equal(calls.length, 4);
  assert.match(calls[3]!.prompt, new RegExp(secret));
  const privateReply = (await chats.listMessages(chat.id)).at(-1)!;
  assert.deepEqual(JSON.parse(privateReply.extra).visibleToCharacterIds, [ids[0]]);

  await generate({ userMessage: "What is everyone's plan now?" });
  assert.equal(calls.length, 7);
  assert.ok(calls.slice(5).every(({ prompt }) => !prompt.includes(secret) && !prompt.includes(privateReply.content)));

  const route = "/api/conversation/group-autonomy/" + chat.id;
  const control = async (action: string, limits?: { intervalSeconds: number; maxCalls: number; maxTokens: number }) => {
    const response = await app.inject({
      method: "POST",
      url: route,
      payload: { action, ...(limits ? { limits } : {}) },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json().state;
  };
  const status = async () => (await app.inject(route)).json().state;
  const waitFor = async (predicate: () => Promise<boolean>) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await predicate()) return;
      await delay(300);
    }
    assert.fail(
      "The server did not finish the scheduled exchange: " + JSON.stringify(await status()) + ", calls=" + calls.length,
    );
  };
  await connections.update(red.id, { embeddingModel: "embedding-fixture" });
  await chats.patchMetadata(chat.id, { enableMemoryRecall: true, autoTranslate: true });
  await control("start", { intervalSeconds: 5, maxCalls: 2, maxTokens: 60000 });
  const legacy = await app.inject({
    method: "POST",
    url: "/api/conversation/autonomous/exchange",
    payload: { chatId: chat.id, lastSpeakerCharId: ids[2] },
  });
  assert.equal(legacy.json().shouldTrigger, false);
  assert.equal((await generate({ autonomous: true, forCharacterId: ids[0] })).statusCode, 409);
  await waitFor(async () => !!(await status()).lastMessageId);
  assert.equal(calls.length, 8);
  assert.equal(calls[7]!.model, "model-Ada");
  assert.doesNotMatch(calls[7]!.prompt, new RegExp(secret));
  assert.ok(calls[7]!.maxTokens <= 512);
  const paused = await control("pause");
  assert.equal(paused.callsUsed, 1);
  assert.equal(paused.tokensUsed, 75);
  const saved = await chats.getMessage(paused.lastMessageId);
  assert.equal(saved?.characterId, ids[0]);
  await delay(6_000);
  assert.equal(calls.length, 8);
  repeat = saved!.content;
  await control("resume");
  await waitFor(async () => (await status()).reason === "duplicate");
  assert.equal(calls.length, 9);
  assert.equal((await status()).lastMessageId, saved!.id);
  assert.equal((await chats.listMessages(chat.id)).at(-1)!.id, saved!.id);
  await control("stop");
  assert.equal((await status()).status, "stopped");

  // Even with optional AI features enabled, a turn that cannot fit the
  // budget must not make a character request or an auxiliary request.
  await control("start", { intervalSeconds: 5, maxCalls: 1, maxTokens: 1000 });
  await waitFor(async () => (await status()).reason === "budget");
  assert.equal((await status()).callsUsed, 0);
  assert.equal(calls.length, 9);
  await control("stop");
  await chats.patchMetadata(chat.id, { enableMemoryRecall: false, autoTranslate: false });

  await characters.update(ids[1]!, { extensions: { responseModel: { connectionId: blue.id, model: "missing" } } });
  const failure = await generate({ forCharacterId: ids[1], userMessage: "Bert, is your model online?" });
  assert.match(failure.body, /No such model|404/);
  assert.equal(calls.length, 10);
  assert.equal(calls[9]!.model, "missing");
  console.log(
    "Ensemble response routing, ACL, server exchanges, pause, token accounting and duplicate control passed.",
  );
} finally {
  await app.close();
  await db._fileStore.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
}
