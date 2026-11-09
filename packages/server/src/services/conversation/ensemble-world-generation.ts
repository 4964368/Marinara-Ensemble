import { ENSEMBLE_PLAYER_ID, estimateTextTokens, type CharacterData } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { withConnectionAdmissionProvider } from "../generation/connection-admission.js";
import { resolveModelAccessPolicy } from "../generation/model-access-policy.js";
import { withLlmRequestTimeout, type ChatMessage, type LLMUsage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { buildWorldDecision, executeWorldDecision, WORLD_ACTION_PROMPT } from "./ensemble-world.service.js";
import type { WorldChat } from "./ensemble-world.storage.js";
import type { GroupAutonomyTurn } from "./group-autonomy.service.js";

export async function runWorldGeneration(args: {
  db: DB;
  chat: WorldChat;
  cards: Map<string, Partial<CharacterData>>;
  playerName?: string;
  turn: GroupAutonomyTurn;
  conn: {
    id: string;
    provider: string;
    model: string;
    apiKey: string;
    maxContext?: number | null;
    maxTokensOverride?: number | null;
    openrouterProvider?: string | null;
    claudeFastMode?: string | null;
    treatAsLocalEndpoint?: string | null;
  };
  baseUrl: string;
  signal: AbortSignal;
  outputCap: number;
  timeoutMs: number;
  debug: boolean;
}) {
  const { db, chat, turn, cards, conn, baseUrl, signal } = args;
  const actorId = turn.characterId;
  const card = cards.get(actorId);
  if (!card?.name || !turn.worldSessionId) return { status: 409, error: "World actor is unavailable" } as const;
  const bounded = (value: unknown, limit: number) => (typeof value === "string" ? value.slice(0, limit) : undefined);
  const decision = await buildWorldDecision(
    db,
    chat,
    actorId,
    new Map([
      ...[...cards].map(([id, data]) => [id, data.name ?? id] as const),
      [ENSEMBLE_PLAYER_ID, args.playerName ?? "Player"],
    ]),
    {
      name: card.name,
      description: bounded(card.description, 1300),
      personality: bounded(card.personality, 1300),
      scenario: bounded(card.scenario, 800),
      backstory: bounded(card.backstory, 800),
      systemPrompt: bounded(card.systemPrompt, 800),
    },
  );
  if (!decision) return { status: 409, error: "World actor is unavailable" } as const;
  const policy = resolveModelAccessPolicy(conn);
  if (policy.suppressModelParameters) {
    return { status: 400, error: "This model cannot enforce the world turn token limit" } as const;
  }
  const outputLimit = Math.min(conn.maxTokensOverride || args.outputCap, args.outputCap);
  const maxContext = policy.effectiveMaxContext ?? 8192;
  const dossier = decision.dossier;
  let body = JSON.stringify(dossier);
  while (estimateTextTokens(WORLD_ACTION_PROMPT + body) + outputLimit + 64 > maxContext) {
    if (dossier.memories.length > 2) dossier.memories.pop();
    else if (dossier.recentEvidence.length > 2) dossier.recentEvidence.pop();
    else if (dossier.relationships.length) dossier.relationships.pop();
    else if (dossier.memories.length) dossier.memories.pop();
    else if (dossier.recentEvidence.length) dossier.recentEvidence.pop();
    else return { status: 400, error: "World turn cannot fit in this model's context" } as const;
    body = JSON.stringify(dossier);
  }
  const supplied = new Set([
    ...dossier.recentEvidence.map(({ id }) => id),
    ...dossier.memories.flatMap(({ evidence }) => evidence.map(({ id }) => id)),
    ...dossier.relationships.flatMap(({ evidence }) => evidence.map(({ id }) => id)),
  ]);
  for (const id of decision.evidence.keys()) if (!supplied.has(id)) decision.evidence.delete(id);
  const messages: ChatMessage[] = [
    { role: "system", content: WORLD_ACTION_PROMPT },
    { role: "user", content: body },
  ];
  const reserve = Buffer.byteLength(JSON.stringify(messages), "utf8") + outputLimit;
  if (!(await turn.reserve(reserve)) || signal.aborted) return { status: 200 } as const;
  // Keep admission and shared GPU gating; do not retry a provider request outside the turn budget.
  const provider = withConnectionAdmissionProvider(
    createLLMProvider(
      conn.provider,
      baseUrl,
      conn.apiKey,
      maxContext,
      conn.openrouterProvider,
      outputLimit,
      conn.claudeFastMode === "true",
      conn.treatAsLocalEndpoint === "true",
    ),
    conn.id,
  );
  logDebugOverride(args.debug, "[ensemble-world] Prompt sent to %s (%s): %j", conn.model, conn.provider, messages);
  const stream = provider.chat(messages, {
    model: conn.model,
    maxContext,
    maxTokens: outputLimit,
    stream: false,
    enableThinking: false,
    enabledParameters: { maxTokens: true },
    signal,
  });
  let response = "";
  let usage: LLMUsage | void;
  try {
    let part = await withLlmRequestTimeout(args.timeoutMs, () => stream.next());
    while (!part.done) {
      if (signal.aborted) return { status: 200 } as const;
      response += part.value;
      if (response.length > 8192) throw new Error("World decision exceeds response limit");
      part = await withLlmRequestTimeout(args.timeoutMs, () => stream.next());
    }
    usage = part.value;
  } finally {
    await stream.return(undefined);
  }
  const total = usage?.totalTokens ?? (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0);
  if (Number.isSafeInteger(total) && total > 0) turn.usage = total;
  if (signal.aborted) return { status: 200 } as const;
  const applied = await executeWorldDecision(db, {
    chatId: chat.id,
    actorId,
    sessionId: turn.worldSessionId,
    decision,
    response,
    signal,
  });
  if (!applied) return { status: 409, error: "World changed before this action could be saved" } as const;
  turn.worldEventId = applied.event.id;
  return { status: 200, message: applied.message } as const;
}
