import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const dir = mkdtempSync(join(tmpdir(), "marinara-ensemble-world-"));
Object.assign(process.env, { DATA_DIR: dir, NODE_ENV: "test", LOG_LEVEL: "silent" });
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const fastify = requireServer("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { conversationRoutes } = await import("../../packages/server/src/routes/conversation.routes.js");
const { startGroupAutonomy } =
  await import("../../packages/server/src/services/conversation/group-autonomy.service.js");
const { buildWorldDecision, executeWorldDecision } =
  await import("../../packages/server/src/services/conversation/ensemble-world.service.js");
const { readWorld, listWorldEvents } =
  await import("../../packages/server/src/services/conversation/ensemble-world.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

type Dossier = NonNullable<Awaited<ReturnType<typeof buildWorldDecision>>>["dossier"];
type Action = Record<string, unknown>;
const calls: Array<{ model: string; dossier: Dossier | null; prompt: string; maxTokens: number }> = [];
const plans = new Map<string, Array<(dossier: Dossier) => Action>>();
const privateFromPlayer = "PLAYER_SECRET_M2_SILVER_729";
const privateInStudy = "STUDY_SECRET_M2_ORCHID_619";
const partial = "The study holds a clue about an old key.";
let studyEventId = "";
let hold = false;

const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = JSON.stringify(body.messages);
  const dossier: Dossier | null = prompt.includes("Your evidence and beliefs are fallible")
    ? JSON.parse(body.messages.at(-1).content)
    : null;
  calls.push({ model: body.model, dossier, prompt, maxTokens: body.max_tokens });
  if (hold) {
    await new Promise<void>((resolve) => res.once("close", resolve));
    return;
  }
  const plan = dossier ? plans.get(dossier.characterId)?.shift() : null;
  const content = dossier ? JSON.stringify(plan?.(dossier) ?? { action: "wait" }) : "A routine player-facing reply.";
  const usage = { prompt_tokens: 400, completion_tokens: 25, total_tokens: 425 };
  res.writeHead(200, { "content-type": "application/json" }).end(
    JSON.stringify({
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage,
    }),
  );
});

async function open() {
  const db = await createFileNativeDB();
  const app = fastify();
  app.decorate("db", db);
  await app.register(generateRoutes, { prefix: "/api/generate" });
  await app.register(conversationRoutes, { prefix: "/api/conversation" });
  startGroupAutonomy(app);
  return { db, app, chats: createChatsStorage(db) };
}

let runtime = await open();
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const addr = provider.address();
  assert.ok(addr && typeof addr !== "string");
  const connections = createConnectionsStorage(runtime.db);
  const connection = (await connections.create({
    name: "World test",
    provider: "custom",
    baseUrl: "http://127.0.0.1:" + addr.port + "/v1",
    apiKey: "test",
    model: "red",
    maxContext: 16384,
    maxTokensOverride: 512,
  }))!;
  const storage = createCharactersStorage(runtime.db);
  const [a, b, c] = await Promise.all(
    ["Ada", "Bert", "Cleo"].map(
      async (name, i) =>
        (await storage.create(
          characterDataSchema.parse({
            name,
            personality: "PERSONALITY_" + name,
            extensions: { responseModel: { connectionId: connection.id, model: i === 1 ? "blue" : "red" } },
          }),
        ))!.id,
    ),
  );
  const labels = new Map([
    [a!, "Ada"],
    [b!, "Bert"],
    [c!, "Cleo"],
  ]);
  const chat = (await runtime.chats.create({
    name: "World fixture",
    mode: "conversation",
    characterIds: [a!, b!, c!],
    connectionId: connection.id,
  }))!;
  await runtime.chats.patchMetadata(chat.id, {
    groupChatMode: "individual",
    groupResponseOrder: "sequential",
    enableAgents: false,
    characterSchedulesEnabled: false,
  });
  const api = "/api/conversation/";
  const worldUrl = api + "ensemble-world/" + chat.id;
  const runUrl = api + "group-autonomy/" + chat.id;
  const post = (url: string, payload: Record<string, unknown>) => runtime.app.inject({ method: "POST", url, payload });
  const state = async () => (await runtime.app.inject(runUrl)).json().state;
  const world = async () => (await readWorld(runtime.db, chat.id))!;
  const events = () => listWorldEvents(runtime.db, chat.id, 100);
  const getPlayerView = async () => (await runtime.app.inject(worldUrl)).json().world;
  const control = async (action: string, limits?: { intervalSeconds: number; maxCalls: number; maxTokens: number }) => {
    const result = await post(runUrl, { action, ...(limits ? { limits } : {}) });
    assert.equal(result.statusCode, 200, result.body);
    return result.json().state;
  };
  const waitFor = async (pred: () => Promise<boolean> | boolean) => {
    for (let i = 0; i < 85; i++) {
      if (await pred()) return;
      await delay(200);
    }
    assert.fail("Timed out at " + JSON.stringify(await state()) + ", calls=" + calls.length);
  };
  const advance = async (minute: number) => {
    await runtime.chats.patchMetadata(chat.id, (meta) => ({
      ...meta,
      groupAutonomy: { ...(meta.groupAutonomy as Record<string, unknown>), lastAttemptAt: 0 },
    }));
    await waitFor(async () => (await world()).minute >= minute);
  };
  const configure = await post(worldUrl, {
    action: "configure",
    settings: {
      scenes: [
        { id: "court", name: "Courtyard" },
        { id: "study", name: "Study" },
        { id: "lounge", name: "Lounge" },
      ],
      goals: [{ characterId: a, goal: "Investigate the old key" }],
    },
  });
  assert.equal(configure.statusCode, 200, configure.body);
  assert.equal(await runtime.chats.listMessages(chat.id).then((rows) => rows.length), 0);
  const send = (payload: Record<string, unknown>) =>
    post("/api/generate", {
      chatId: chat.id,
      streaming: false,
      skipPresenceDelay: true,
      ...payload,
    });
  assert.equal((await send({ autonomous: true, forCharacterId: a })).statusCode, 409);
  const citation = (dossier: Dossier, text: string) => {
    const found = [...dossier.recentEvidence, ...dossier.memories.flatMap((m) => m.evidence)].find((item) =>
      item.text?.includes(text),
    );
    assert.ok(found, "Expected evidence: " + text);
    return found.id;
  };
  plans.set(a!, [
    () => ({ action: "move", sceneId: "study" }),
    () => ({ action: "whisper", targetId: b, text: privateInStudy }),
    (dossier) => ({ action: "disclose", targetId: c, sourceId: citation(dossier, privateInStudy), text: partial }),
    (dossier) => ({
      action: "remember",
      sourceIds: [citation(dossier, privateFromPlayer)],
      kind: "belief",
      topic: "the key",
      confidence: 0.45,
      status: "tentative",
      text: "I suspect the key belongs to the host.",
    }),
  ]);
  plans.set(b!, [
    () => ({ action: "move", sceneId: "study" }),
    (dossier) => ({
      action: "appraise",
      targetId: a,
      sourceId: citation(dossier, privateInStudy),
      signal: "confidence",
    }),
    () => ({ action: "move", sceneId: "study" }), // Same movement inside the cooldown.
    () => ({ action: "observe" }),
  ]);
  plans.set(c!, [
    () => ({ action: "move", sceneId: "lounge" }),
    () => ({ action: "disclose", targetId: "player", sourceId: studyEventId, text: "Forged source." }),
    (dossier) => ({
      action: "remember",
      sourceIds: [citation(dossier, partial)],
      kind: "semantic",
      topic: "the key",
      confidence: 0.5,
      status: "tentative",
      text: "Ada mentioned an old key.",
    }),
    () => ({ action: "wait" }),
  ]);

  const limits = { intervalSeconds: 5, maxCalls: 20, maxTokens: 90000 };
  await control("start", limits);
  await delay(250);
  assert.equal(calls.length, 0, "The first turn obeys the interval");
  await waitFor(async () => (await world()).minute === 1); // No player message was necessary.
  assert.equal((await world()).actors.find((actor) => actor.id === a)?.sceneId, "study");
  const privateMsg = (await runtime.chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: privateFromPlayer,
    messageVisibility: { type: "characters", characterIds: [a!] },
  }))!;
  await advance(2);
  await advance(3);
  await advance(4);
  const whisper = (await events()).find((event) => event.type === "whisper");
  assert.ok(whisper);
  studyEventId = whisper.id;
  assert.equal(whisper.playerVisible, false);
  assert.deepEqual(whisper.audience, [a, b]);
  assert.equal(
    (await runtime.chats.listMessages(chat.id)).length,
    1,
    "Offstage speech never enters the shared transcript",
  );
  for (let minute = 5; minute <= 12; minute++) await advance(minute);
  await control("pause");
  assert.equal((await state()).callsUsed, 12);
  assert.equal((await state()).tokensUsed, 12 * 425);
  assert.equal(calls[1]!.model, "blue");
  assert.ok(calls.every((call) => call.maxTokens <= 512));
  assert.ok(
    calls.every((call) => call.dossier && call.prompt.includes("PERSONALITY_" + labels.get(call.dossier.characterId))),
  );
  assert.ok(
    calls
      .filter(({ dossier }) => dossier?.characterId !== a)
      .every(({ prompt }) => !prompt.includes(privateFromPlayer)),
  );
  assert.ok(
    calls
      .filter(({ dossier }) => dossier?.characterId === c)
      .every(({ prompt }) => !prompt.includes(privateInStudy) && !prompt.includes(studyEventId)),
  );
  assert.ok(calls.some(({ dossier, prompt }) => dossier?.characterId === c && prompt.includes(partial)));
  const log = await events();
  assert.ok(log.some((event) => event.actorId === c && event.result === "unknown_source"));
  assert.ok(log.some((event) => event.actorId === b && event.result === "duplicate"));
  assert.equal(log.find((event) => event.type === "disclose")?.disclosedFrom?.id, studyEventId);
  assert.ok(
    (await world()).actors
      .find((actor) => actor.id === b)
      ?.relationships.some((r) => r.targetId === a && r.signal === "confidence"),
  );
  assert.equal((await world()).actors.find((actor) => actor.id === a)?.relationships.length, 0);
  assert.doesNotMatch(JSON.stringify(await getPlayerView()), /STUDY_SECRET|PLAYER_SECRET|holds a clue|Forged source/);
  assert.deepEqual(
    (await getPlayerView()).characters.map((actor: { sceneId: string | null }) => actor.sceneId),
    [null, null, null],
  );
  await delay(5400);
  assert.equal(calls.length, 12, "Paused without a browser: no inference");

  // A real store reopen preserves the world, memories, relationships and scheduler pause.
  await runtime.app.close();
  await runtime.db._fileStore.close();
  runtime = await open();
  assert.equal((await state()).status, "paused");
  assert.equal((await world()).minute, 12);
  assert.equal((await world()).actors.find((actor) => actor.id === b)?.relationships[0]?.source.id, studyEventId);
  assert.ok(
    (await world()).actors.find((actor) => actor.id === a)?.memories.some((memory) => memory.kind === "belief"),
  );

  // Push the original out of the ordinary recent transcript; only sourced recall can retrieve it.
  await runtime.chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 40 }, (_, i) => ({
      role: "user" as const,
      content: "Unrelated background for Cleo " + i,
      extra: { visibleToCharacterIds: [c] },
    })),
  );
  await post(worldUrl, { action: "move", sceneId: "study" });
  assert.deepEqual(
    (await getPlayerView()).characters.map((actor: { sceneId: string | null }) => actor.sceneId),
    ["study", "study", null],
  );
  assert.equal((await world()).minute, 13);
  const currentChat = (await runtime.chats.getById(chat.id))!;
  const decision = (await buildWorldDecision(runtime.db, currentChat, a!, labels, { name: "Ada" }))!;
  assert.match(JSON.stringify(decision.dossier.memories), /PLAYER_SECRET_M2_SILVER_729/);
  await runtime.chats.updateMessageExtra(privateMsg.id, { hiddenFromAICharacterIds: [a] });
  const revoked = await buildWorldDecision(runtime.db, currentChat, a!, labels, { name: "Ada" });
  assert.doesNotMatch(JSON.stringify(revoked?.dossier), /PLAYER_SECRET_M2_SILVER_729|belongs to the host/);

  // Scene-scoped player speech uses the existing P0 audience and never calls Cleo's model.
  const beforeManual = calls.length;
  const manual = await send({ userMessage: "Who is in the study?", messageVisibility: { type: "present" } });
  assert.match(manual.body, /"type":"message_saved".*"role":"assistant"/);
  const localMsg = (await runtime.chats.listMessages(chat.id)).find((row) => row.content === "Who is in the study?")!;
  assert.deepEqual(JSON.parse(localMsg.extra).visibleToCharacterIds, [a, b]);
  assert.equal(calls.length - beforeManual, 2);
  assert.ok(calls.slice(beforeManual).every(({ prompt }) => !prompt.includes(privateInStudy)));

  // World speech seen by the player is saved once in the existing transcript, with the scene audience.
  const visibleText = "Let's check the shelves together.";
  plans.set(b!, [() => ({ action: "speak", text: visibleText })]);
  await control("resume");
  await advance(14);
  await control("pause");
  const visible = (await events())[0]!;
  assert.equal(visible.type, "speak");
  assert.ok(visible.playerVisible && visible.messageId);
  const linkedMessage = (await runtime.chats.getMessage(visible.messageId))!;
  assert.equal(linkedMessage.content, visibleText);
  assert.deepEqual(JSON.parse(linkedMessage.extra).visibleToCharacterIds, [b, a]);
  assert.match(JSON.stringify(await getPlayerView()), /check the shelves/);
  assert.equal((await runtime.chats.listMessages(chat.id)).filter(({ content }) => content === visibleText).length, 1);

  // Resume after a restart, cancel a provider already in flight, and reject stale proposals.
  const beforeHold = calls.length;
  hold = true;
  const resumed = await control("resume");
  await runtime.chats.patchMetadata(chat.id, (meta) => ({
    groupAutonomy: { ...(meta.groupAutonomy as Record<string, unknown>), lastAttemptAt: 0 },
  }));
  await waitFor(() => calls.length > beforeHold);
  assert.equal(
    await executeWorldDecision(runtime.db, {
      chatId: chat.id,
      actorId: a!,
      sessionId: resumed.id,
      decision,
      response: '{"action":"move","sceneId":"lounge"}',
      signal: new AbortController().signal,
    }),
    null,
  );
  await control("pause");
  await delay(100);
  assert.equal((await world()).minute, 14);
  await control("stop");
  console.log(
    "Ensemble world: two model routes, background moves, ACL, disclosure, memory, relationships, restart and cancellation passed.",
  );
} finally {
  await runtime.app.close();
  await runtime.db._fileStore.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
}
