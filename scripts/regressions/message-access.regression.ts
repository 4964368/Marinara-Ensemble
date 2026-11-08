import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const restart = process.argv[2] === "--check-restart";
const dir = restart ? process.argv[3]! : mkdtempSync(join(tmpdir(), "marinara-message-access-"));
Object.assign(process.env, {
  DATA_DIR: dir,
  FILE_STORAGE_DIR: join(dir, "storage"),
  MARINARA_ENV_FILE: join(dir, "test.env"),
  NODE_ENV: "test",
  MARINARA_LITE: "false",
  LOG_LEVEL: "silent",
});

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { memoryChunks } = await import("../../packages/server/src/db/schema/index.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { conversationRoutes } = await import("../../packages/server/src/routes/conversation.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { chunkAndEmbedMessages, recallMemories } = await import("../../packages/server/src/services/memory-recall.js");
const { resolveMemoryRecallEmbeddingSource } =
  await import("../../packages/server/src/services/memory-recall-embedding.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const secret = "ACL_ALICE_UNSHARED_SECRET";
const todaySecret = "ACL_TODAY_SECRET";
const publicText = "ACL_PUBLIC_EVENT";
const retelling = "ACL_ALICE_TOLD_BOB_ONLY_THIS";
const oldSummary = "ACL_UNSAFE_PREEXISTING_SUMMARY";
const oldVector = "ACL_UNSAFE_PREEXISTING_VECTOR";
const publicVector = "ACL_SAFE_PUBLIC_VECTOR";

let responders: string[] = [];
let nextReply: string | undefined;
const requests: Array<{ kind: string; text: string }> = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const text = JSON.stringify(body.messages ?? body.input);
  if (req.url?.endsWith("/embeddings")) {
    requests.push({ kind: "embedding", text });
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: inputs.map((_: unknown, index: number) => ({ index, embedding: [1, 0] })) }));
    return;
  }
  const kind = text.includes("hidden response orchestrator") ? "selector" : body.stream ? "reply" : "helper";
  requests.push({ kind, text });
  const content =
    kind === "selector"
      ? JSON.stringify(responders)
      : kind === "helper"
        ? JSON.stringify({ summary: oldSummary, keyDetails: [oldSummary] })
        : (nextReply ?? "Synthetic reply " + requests.length + ".");
  if (kind === "reply") nextReply = undefined;
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    const frame = JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] });
    const stop = JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    res.end("data: " + frame + "\n\ndata: " + stop + "\n\ndata: [DONE]\n\n");
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});

const db = await createFileNativeDB();
let app: ReturnType<typeof Fastify> | undefined;
async function openApp() {
  const server = Fastify();
  server.decorate("db", db);
  await server.register(generateRoutes, { prefix: "/api/generate" });
  await server.register(chatsRoutes, { prefix: "/api/chats" });
  await server.register(conversationRoutes, { prefix: "/api/conversation" });
  return server;
}

if (restart) {
  const restarted = await openApp();
  try {
    const response = await restarted.inject({
      method: "POST",
      url: "/api/generate",
      payload: { chatId: process.argv[4], forCharacterId: process.argv[5], userMessage: "Reopen the conversation." },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.match(response.body, /"type":"message_saved".*"role":"assistant"/, response.body);
  } finally {
    await restarted.close();
    await db._fileStore.close();
  }
  process.exit(0);
}

try {
  app = await openApp();
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Message ACL fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:" + address.port + "/v1",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
    embeddingModel: "fixture-embedding",
  });
  const characters = createCharactersStorage(db);
  const alice = (await characters.create(characterDataSchema.parse({ name: "Alice" })))!;
  const bob = (await characters.create(characterDataSchema.parse({ name: "Bob" })))!;
  const carol = (await characters.create(characterDataSchema.parse({ name: "Carol" })))!;
  const roster = [alice.id, bob.id, carol.id];
  const persona = (await characters.createPersona("Player", "Synthetic persona."))!;
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "ACL fixture", parameters: { maxContext: 32768 }, wrapFormat: "xml" });
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Speak as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });

  async function makeChat(mode: "conversation" | "roleplay", meta: Record<string, unknown> = {}) {
    const chats = createChatsStorage(db);
    const row = (await chats.create({
      name: "ACL fixture",
      mode,
      characterIds: roster,
      personaId: persona.id,
      connectionId: connection.id,
      promptPresetId: mode === "roleplay" ? preset.id : null,
    }))!;
    await chats.patchMetadata(row.id, {
      groupChatMode: "individual",
      groupResponseOrder: "manual",
      enableAgents: false,
      enableTools: false,
      enableMemoryRecall: true,
      semanticSummaryRetrievalEnabled: true,
      conversationTimeZone: "UTC",
      ...meta,
    });
    return row.id;
  }

  async function send(chatId: string, payload: Record<string, unknown>) {
    const response = await app!.inject({
      method: "POST",
      url: "/api/chats/" + chatId + "/messages",
      payload: { role: "user", ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  }

  async function generate(chatId: string, payload: Record<string, unknown>) {
    const start = requests.length;
    const response = await app!.inject({ method: "POST", url: "/api/generate", payload: { chatId, ...payload } });
    assert.equal(response.statusCode, 200, response.body);
    assert.match(response.body, /"type":"message_saved".*"role":"assistant"/, response.body);
    return requests.slice(start);
  }

  const conversation = await makeChat("conversation", { characterExchanges: true });
  const older = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const oldDay = older.slice(0, 10);
  const aliceOnly = { type: "characters", characterIds: [alice.id] };
  const privateMessage = await send(conversation, { content: secret, createdAt: older, messageVisibility: aliceOnly });
  await send(conversation, { content: publicText, createdAt: older, messageVisibility: { type: "public" } });
  await createChatsStorage(db).patchMetadata(conversation, {
    daySummaries: { [oldDay]: { summary: oldSummary, keyDetails: [oldSummary] } },
  });
  const direct = await generate(conversation, {
    userMessage: todaySecret,
    messageVisibility: aliceOnly,
    forCharacterId: alice.id,
  });
  assert.ok(direct.some(({ kind, text }) => kind === "reply" && text.includes(secret) && text.includes(todaySecret)));
  const privateReply = (await createChatsStorage(db).listMessages(conversation)).at(-1)!;
  assert.deepEqual(JSON.parse(privateReply.extra!).visibleToCharacterIds, [alice.id]);

  const originalRandom = Math.random;
  try {
    Math.random = () => 0.001;
    const exchange = await app.inject({
      method: "POST",
      url: "/api/conversation/autonomous/exchange",
      payload: { chatId: conversation, lastSpeakerCharId: alice.id },
    });
    assert.equal(exchange.statusCode, 200, exchange.body);
    assert.equal(exchange.json().shouldTrigger, false);
  } finally {
    Math.random = originalRandom;
  }

  const fromBob = await generate(conversation, {
    userMessage: "What was publicly discussed today?",
    forCharacterId: bob.id,
    replyTo: { messageId: privateMessage.id, name: "Player", content: secret },
  });
  assert.ok(fromBob.some(({ kind, text }) => kind === "reply" && text.includes(publicText)));
  for (const { text } of fromBob) {
    assert.ok(!text.includes(secret) && !text.includes(todaySecret) && !text.includes(oldSummary));
  }
  nextReply = retelling;
  const alicePublic = await generate(conversation, {
    userMessage: "Tell the group what you choose to share.",
    forCharacterId: alice.id,
  });
  assert.ok(alicePublic.some(({ kind, text }) => kind === "reply" && text.includes(secret)));
  for (const id of [bob.id, carol.id]) {
    const turns = await generate(conversation, { userMessage: "What did Alice actually share?", forCharacterId: id });
    assert.ok(turns.some(({ kind, text }) => kind === "reply" && text.includes(retelling)));
    assert.ok(turns.every(({ text }) => !text.includes(secret) && !text.includes(todaySecret)));
  }

  const directedRetelling = "ACL_ALICE_TOLD_BOB_PRIVATELY";
  await send(conversation, {
    role: "assistant",
    characterId: alice.id,
    content: directedRetelling,
    messageVisibility: { type: "characters", characterIds: [alice.id, bob.id] },
  });
  const bobKnows = await generate(conversation, { userMessage: "What was I told directly?", forCharacterId: bob.id });
  assert.ok(bobKnows.some(({ kind, text }) => kind === "reply" && text.includes(directedRetelling)));
  assert.ok(bobKnows.every(({ text }) => !text.includes(secret)));
  const carolDoesNotKnow = await generate(conversation, {
    userMessage: "What was I told directly?",
    forCharacterId: carol.id,
  });
  assert.ok(carolDoesNotKnow.every(({ text }) => !text.includes(directedRetelling) && !text.includes(secret)));

  const sibling = await makeChat("conversation");
  const crossChat = await generate(sibling, { userMessage: "What did we talk about today?", forCharacterId: bob.id });
  assert.ok(crossChat.every(({ text }) => !text.includes(todaySecret)));
  assert.ok(crossChat.some(({ kind, text }) => kind === "reply" && text.includes(retelling)));

  const summary = await app.inject({
    method: "POST",
    url: "/api/chats/" + conversation + "/generate-summary",
    payload: {},
  });
  assert.equal(summary.statusCode, 409);

  const embeddingInputs: string[] = [];
  const embeddingSource = {
    spaceId: "fixture:acl",
    label: "ACL fixture",
    async embed(texts: string[]) {
      embeddingInputs.push(...texts);
      return texts.map(() => [1, 0]);
    },
  };
  await chunkAndEmbedMessages(db, conversation, { userName: "Player", characterNames: {} }, { embeddingSource });
  assert.deepEqual(embeddingInputs, []);
  await db.insert(memoryChunks).values({
    id: "legacy-acl-vector",
    chatId: sibling,
    sourceChatId: conversation,
    content: oldVector,
    embedding: JSON.stringify([1, 0]),
    embeddingSpaceId: embeddingSource.spaceId,
    firstMessageAt: older,
    lastMessageAt: older,
    messageCount: 5,
  });
  assert.deepEqual(await recallMemories(db, "Anything?", [sibling], { embeddingSource }), []);
  const nativeSource = await resolveMemoryRecallEmbeddingSource(db, { connectionId: connection.id });
  assert.ok(nativeSource?.spaceId);
  await db.insert(memoryChunks).values([
    {
      id: "legacy-acl-vector-matching-space",
      chatId: sibling,
      sourceChatId: conversation,
      content: oldVector,
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId: nativeSource.spaceId,
      firstMessageAt: older,
      lastMessageAt: older,
      messageCount: 5,
    },
    {
      id: "public-vector",
      chatId: sibling,
      content: publicVector,
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId: nativeSource.spaceId,
      firstMessageAt: older,
      lastMessageAt: older,
      messageCount: 5,
    },
  ]);
  const recalled = await generate(sibling, { userMessage: "What else do you remember?", forCharacterId: bob.id });
  assert.ok(recalled.some(({ kind }) => kind === "embedding"));
  assert.ok(recalled.some(({ kind, text }) => kind === "reply" && text.includes(publicVector)));
  assert.ok(recalled.every(({ text }) => !text.includes(oldVector)));

  const exchanges = await makeChat("conversation", { characterExchanges: true, autonomousDailyCapOverride: 4 });
  await send(exchanges, { content: "Player is away.", createdAt: older });
  const exchangeChats = createChatsStorage(db);
  const pair = { type: "characters" as const, characterIds: [alice.id, bob.id] };
  await exchangeChats.createMessage(
    {
      chatId: exchanges,
      role: "assistant",
      characterId: alice.id,
      content: "ACL_EXCHANGE_PAIR",
      messageVisibility: pair,
    },
    { createdAt: new Date(Date.parse(older) + 1_000).toISOString() },
  );
  try {
    Math.random = () => 0.001;
    const exchange = await app.inject({
      method: "POST",
      url: "/api/conversation/autonomous/exchange",
      payload: { chatId: exchanges, lastSpeakerCharId: alice.id },
    });
    assert.equal(exchange.statusCode, 200, exchange.body);
    assert.deepEqual(exchange.json().characterIds, [bob.id]);
    const exchangeTurn = await generate(exchanges, { autonomous: true, forCharacterId: bob.id });
    assert.ok(exchangeTurn.some(({ kind, text }) => kind === "reply" && text.includes("ACL_EXCHANGE_PAIR")));
    const answer = (await exchangeChats.listMessages(exchanges)).at(-1)!;
    assert.deepEqual(JSON.parse(answer.extra).visibleToCharacterIds, [alice.id, bob.id]);
  } finally {
    Math.random = originalRandom;
  }

  const roleplay = await makeChat("roleplay", { groupResponseOrder: "smart", inactiveCharacterIds: [carol.id] });
  const present = await send(roleplay, { content: "ACL_PRESENT_AT_SEND", messageVisibility: { type: "present" } });
  assert.deepEqual(JSON.parse(present.extra).visibleToCharacterIds, [alice.id, bob.id]);
  await createChatsStorage(db).patchMetadata(roleplay, { inactiveCharacterIds: [] });
  await send(roleplay, { content: "ACL_SMART_SECRET", messageVisibility: aliceOnly });
  responders = [alice.id, bob.id, carol.id];
  const smart = await generate(roleplay, { userMessage: publicText, smartResponse: true });
  const selector = smart.find(({ kind }) => kind === "selector");
  assert.ok(selector?.text.includes(publicText));
  assert.ok(!selector.text.includes("ACL_SMART_SECRET") && !selector.text.includes("ACL_PRESENT_AT_SEND"));
  const replies = smart.filter(({ kind }) => kind === "reply");
  assert.equal(replies.length, 3);
  assert.match(replies[0]!.text, /ACL_SMART_SECRET/);
  assert.doesNotMatch(replies[1]!.text, /ACL_SMART_SECRET/);
  assert.match(replies[1]!.text, /ACL_PRESENT_AT_SEND/);
  assert.doesNotMatch(replies[2]!.text, /ACL_SMART_SECRET|ACL_PRESENT_AT_SEND/);

  const branchResponse = await app.inject({
    method: "POST",
    url: "/api/chats/" + roleplay + "/branch",
    payload: {},
  });
  assert.ok(branchResponse.statusCode >= 200 && branchResponse.statusCode < 300, branchResponse.body);
  const branchId = branchResponse.json().id;
  const branchRows = await createChatsStorage(db).listMessages(branchId);
  const copiedSecret = branchRows.find((row) => row.content.includes("ACL_SMART_SECRET"));
  assert.ok(copiedSecret);
  assert.deepEqual(JSON.parse(copiedSecret.extra).visibleToCharacterIds, [alice.id]);
  const branched = await generate(branchId, { userMessage: "What did everyone hear?", forCharacterId: carol.id });
  assert.ok(branched.every(({ text }) => !text.includes("ACL_SMART_SECRET") && !text.includes("ACL_PRESENT_AT_SEND")));

  await app.close();
  app = undefined;
  await db._fileStore.close();
  const beforeRestart = requests.length;
  await promisify(execFile)(
    process.execPath,
    [requireServer.resolve("tsx/cli"), process.argv[1]!, "--check-restart", dir, conversation, bob.id],
    { windowsHide: true, timeout: 30_000 },
  );
  const restarted = requests.slice(beforeRestart);
  assert.ok(
    restarted.every(({ text }) => !text.includes(secret) && !text.includes(todaySecret) && !text.includes(oldSummary)),
  );
  assert.ok(restarted.some(({ kind, text }) => kind === "reply" && text.includes(publicText)));
  console.log("Message ACL provider-context regression passed");
} finally {
  await app?.close();
  await db._fileStore.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
}

process.exit(0);
