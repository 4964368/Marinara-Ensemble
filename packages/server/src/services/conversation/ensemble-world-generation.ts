import {
  ENSEMBLE_PLAYER_ID,
  estimateTextTokens,
  sliceTextToTokenBudget,
  type CharacterData,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { withConnectionAdmissionProvider } from "../generation/connection-admission.js";
import {
  resolveLorebookGenerationTriggers,
  resolveLorebookTokenBudget,
} from "../generation/lorebook-generation-runtime.js";
import { resolveModelAccessPolicy } from "../generation/model-access-policy.js";
import { parseExtra } from "../generation/prompt-attachments.js";
import { withLlmRequestTimeout, type ChatMessage, type LLMUsage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { processLorebooks } from "../lorebook/index.js";
import { resolveLorebookScopeExclusions } from "../lorebook/game-lorebook-scope.js";
import { buildWorldDecision, executeWorldDecision, WORLD_ACTION_PROMPT } from "./ensemble-world.service.js";
import { actorCanReadMessage, type WorldChat } from "./ensemble-world.storage.js";
import type { GroupAutonomyTurn } from "./group-autonomy.service.js";

const WORLD_LOREBOOK_TOKEN_CAP = 1024;

export async function runWorldGeneration(args: {
  db: DB;
  chat: WorldChat;
  cards: Map<string, Partial<CharacterData>>;
  player?: { name: string; aboutMe: string };
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
  const { db, chat, turn, cards, player, conn, baseUrl, signal } = args;
  const actorId = turn.characterId;
  const card = cards.get(actorId);
  if (!card?.name || !turn.worldSessionId) return { status: 409, error: "World actor is unavailable" } as const;
  const bounded = (field: string, value: unknown, tokenLimit: number) => {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const prefix = sliceTextToTokenBudget(value, tokenLimit);
    if (prefix.length === value.length) return prefix;
    logDebugOverride(args.debug, "[ensemble-world] Truncated %s for actor %s at %d tokens", field, actorId, tokenLimit);
    return sliceTextToTokenBudget(value, tokenLimit - 1) + "…";
  };
  const decision = await buildWorldDecision(
    db,
    chat,
    actorId,
    new Map([
      ...[...cards].map(([id, data]) => [id, data.name ?? id] as const),
      [ENSEMBLE_PLAYER_ID, player?.name ?? "Player"],
    ]),
    {
      name: card.name,
      description: bounded("description", card.description, 350),
      personality: bounded("personality", card.personality, 350),
      scenario: bounded("scenario", card.scenario, 220),
      backstory: bounded("backstory", card.extensions?.backstory ?? card.backstory, 400),
      appearance: bounded("appearance", card.extensions?.appearance ?? card.appearance, 180),
      systemPrompt: bounded("system_prompt", card.system_prompt ?? card.systemPrompt, 320),
    },
    player ? { name: player.name, aboutMe: bounded("player.aboutMe", player.aboutMe, 300) } : undefined,
  );
  if (!decision) return { status: 409, error: "World actor is unavailable" } as const;
  const policy = resolveModelAccessPolicy(conn);
  if (policy.suppressModelParameters) {
    return { status: 400, error: "This model cannot enforce the world turn token limit" } as const;
  }
  const outputLimit = Math.min(conn.maxTokensOverride || args.outputCap, args.outputCap);
  const maxContext = policy.effectiveMaxContext ?? 8192;
  const dossier = { ...decision.dossier, lorebook: [] as string[] };
  const fits = (body: string) => estimateTextTokens(WORLD_ACTION_PROMPT + body) + outputLimit + 64 <= maxContext;
  let body = JSON.stringify(dossier);
  while (!fits(body)) {
    if (dossier.memories.length > 2) dossier.memories.pop();
    else if (dossier.recentEvidence.length > 2) dossier.recentEvidence.pop();
    else if (dossier.relationships.length) dossier.relationships.pop();
    else if (dossier.memories.length) dossier.memories.pop();
    else if (dossier.recentEvidence.length) dossier.recentEvidence.pop();
    else return { status: 400, error: "World turn cannot fit in this model's context" } as const;
    body = JSON.stringify(dossier);
  }
  const meta = parseExtra(chat.metadata);
  const loreBudget = Math.min(
    WORLD_LOREBOOK_TOKEN_CAP,
    resolveLorebookTokenBudget(meta) || WORLD_LOREBOOK_TOKEN_CAP,
    maxContext - outputLimit - 64 - estimateTextTokens(WORLD_ACTION_PROMPT + body),
  );
  if (loreBudget > 0 && !signal.aborted) {
    const scanMessages = [...dossier.recentEvidence]
      .sort((a, b) => a.time.localeCompare(b.time))
      .flatMap(({ text, actorId: sourceActor }) =>
        text
          ? [{ role: sourceActor === ENSEMBLE_PLAYER_ID ? ("user" as const) : ("assistant" as const), content: text }]
          : [],
      );
    const lore = await processLorebooks(db, scanMessages, null, {
      chatId: chat.id,
      activeLorebookIds: Array.isArray(meta.activeLorebookIds) ? meta.activeLorebookIds : [],
      ...resolveLorebookScopeExclusions(chat.mode, meta),
      entryStateOverrides: parseExtra(meta.entryStateOverrides ?? meta.lorebookEntryStateOverrides) as Record<
        string,
        { enabled?: boolean; ephemeral?: number | null }
      >,
      generationTriggers: resolveLorebookGenerationTriggers({}, chat.mode),
      isolatedActor: { id: actorId, canReadSource: (message) => actorCanReadMessage(message, actorId) },
      tokenBudget: loreBudget,
    });
    // Account for JSON escaping and array overhead as well as the scanner's text budget.
    // Keep constants first, then use the scanner's authored injection order.
    const entries = lore.activatedEntries.sort(
      (a, b) => Number(b.matchType === "constant") - Number(a.matchType === "constant"),
    );
    const skipped = lore.budgetSkippedEntries.map(({ id }) => id);
    for (const entry of entries) {
      if (!entry.content.trim()) continue;
      dossier.lorebook.push(entry.content);
      const candidate = JSON.stringify(dossier);
      if (fits(candidate) && estimateTextTokens(JSON.stringify(dossier.lorebook)) <= loreBudget) {
        body = candidate;
      } else {
        dossier.lorebook.pop();
        skipped.push(entry.id);
      }
    }
    if (skipped.length)
      logDebugOverride(
        args.debug,
        "[ensemble-world] Lorebook budget %d for actor %s skipped entries %j",
        loreBudget,
        actorId,
        skipped,
      );
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
