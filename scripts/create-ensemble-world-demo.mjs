const [base = "http://127.0.0.1:7860", connectionId, firstModel, secondModel] = process.argv.slice(2);
const origin = new URL(base);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) || !["http:", "https:"].includes(origin.protocol)) {
  throw new Error("This demo script expects a local Marinara server.");
}

async function request(path, method = "GET", body) {
  const response = await fetch(new URL("/api" + path, origin), {
    method,
    headers: { origin: origin.origin, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(method + " " + path + " returned " + response.status + ": " + (await response.text()));
  return response.json();
}

const title = "M2 演示 · 翠庭的旧钥匙";
const existing = (await request("/chats")).find((chat) => chat.name === title);
if (existing) {
  const { world } = await request("/conversation/ensemble-world/" + existing.id);
  if (!world) throw new Error("A chat with the demo name exists but has no world. Check it in the app.");
  console.log(JSON.stringify({ title, chatId: existing.id, worldId: world.id, reused: true }, null, 2));
} else {
  const connections = await request("/connections");
  const connection = connectionId
    ? connections.find((entry) => entry.id === connectionId)
    : connections.find((entry) => entry.baseUrl?.startsWith("http://127.0.0.1:1234/"));
  if (!connection) throw new Error("Set up an LM Studio connection first, or supply its saved connection ID.");
  const { models } = await request("/connections/" + encodeURIComponent(connection.id) + "/models");
  const modelsById = new Set(models.map(({ id }) => id));
  const primary = firstModel ?? (modelsById.has("ensemble-coder") ? "ensemble-coder" : connection.model);
  const secondary = secondModel ?? (modelsById.has("ensemble-deepseek") ? "ensemble-deepseek" : null);
  if (!primary || !secondary || primary === secondary || !modelsById.has(primary) || !modelsById.has(secondary)) {
    throw new Error("Supply two distinct chat model IDs advertised by the selected connection.");
  }
  const actorProfiles = [
    {
      name: "林澈",
      personality: "好奇、细心，喜欢追查旧宅中的线索。独立思考，谨慎处理别人托付的秘密。用简体中文对话。",
      goal: "优先从庭院前往书房调查旧钥匙。在书房遇到许岚时私下交谈；只在适当时向别人转述一部分。",
      model: primary,
    },
    {
      name: "许岚",
      personality: "温和而务实，关心林澈的安全。亲身经历的互助会影响对人的看法。用简体中文对话。",
      goal: "观察林澈的动向。见到林澈离开庭院后，可前往书房寻找她。依据实际互动形成自己的判断。",
      model: secondary,
    },
    {
      name: "苏棠",
      personality: "重视隐私，擅长倾听，对传闻保留判断。用简体中文对话。",
      goal: "去客厅准备茶点。只从亲眼所见或他人实际转述的内容了解书房发生的事。",
      model: primary,
    },
  ];
  const persona = await request("/characters/personas", "POST", {
    name: "旅人（M2 演示）",
    description: "旧宅的访客，可以在庭院、书房和客厅之间自由走动。",
  });
  const characters = [];
  for (const { name, personality, model } of actorProfiles) {
    characters.push(
      await request("/characters", "POST", {
        data: {
          name,
          personality,
          creator: "Marinara-Ensemble M2 demo",
          extensions: { responseModel: { connectionId: connection.id, model } },
        },
      }),
    );
  }
  const chat = await request("/chats", "POST", {
    name: title,
    mode: "conversation",
    characterIds: characters.map(({ id }) => id),
    connectionId: connection.id,
    personaId: persona.id,
  });
  await request("/chats/" + chat.id + "/metadata", "PATCH", {
    groupChatMode: "individual",
    groupResponseOrder: "sequential",
    enableAgents: false,
    autonomousMessages: false,
    characterExchanges: false,
    characterSchedulesEnabled: false,
  });
  const { world } = await request("/conversation/ensemble-world/" + chat.id, "POST", {
    action: "configure",
    settings: {
      scenes: [
        { id: "courtyard", name: "庭院" },
        { id: "study", name: "书房" },
        { id: "lounge", name: "客厅" },
      ],
      goals: characters.map(({ id }, i) => ({ characterId: id, goal: actorProfiles[i].goal })),
    },
  });
  console.log(
    JSON.stringify(
      {
        title,
        chatId: chat.id,
        worldId: world.id,
        characterIds: characters.map(({ id }) => id),
        models: [primary, secondary],
        instructions: "打开该对话，在聊天设置的「服务端角色互动」中启动。",
      },
      null,
      2,
    ),
  );
}
