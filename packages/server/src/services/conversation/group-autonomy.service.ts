import { randomUUID } from "node:crypto";
import { groupAutonomyActionSchema, groupAutonomyStateSchema, type GroupAutonomyState } from "@marinara-engine/shared";
import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import type { GenerationRunner } from "../../routes/generate.routes.js";
import { createGenerationEventSink } from "../../routes/generate/sse.js";
import { isSharedCharacterMessage } from "../generation/message-access.js";
import { parseExtra } from "../generation/prompt-attachments.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { getEffectiveCurrentStatus } from "./schedule.service.js";
import { hasNewWorldInput } from "./ensemble-world.service.js";
import { readWorld, syncWorldActors, worldActorPresent } from "./ensemble-world.storage.js";

const POLL_MS = 2_000;
export const GROUP_AUTONOMY_MAX_OUTPUT = 512;
type Chats = ReturnType<typeof createChatsStorage>;
type Chat = NonNullable<Awaited<ReturnType<Chats["getById"]>>>;
export type GroupAutonomyTurn = {
  chatId: string;
  characterId: string;
  anchorId: string;
  worldSessionId?: string;
  worldEventId?: string;
  signal: AbortSignal;
  reserve: (tokens: number) => Promise<boolean>;
  duplicate: (text: string) => boolean;
  usage?: number;
  halt?: GroupAutonomyState["reason"];
};

// Reuse the in-process generation runner. There is no public request field
// for a caller to impersonate a scheduled turn.
const runners = new WeakMap<object, GenerationRunner>();
export function registerGroupAutonomyRunner(db: object, run: GenerationRunner) {
  runners.set(db, run);
}

const runningTurns = new WeakMap<object, Map<string, AbortController>>();
function turnsFor(db: object) {
  let turns = runningTurns.get(db);
  if (!turns) runningTurns.set(db, (turns = new Map()));
  return turns;
}

export function readGroupAutonomy(chatId: string, metadata: unknown): GroupAutonomyState | null {
  const parsed = groupAutonomyStateSchema.safeParse(parseExtra(metadata).groupAutonomy);
  return parsed.success && parsed.data.id.startsWith(chatId + ":") ? parsed.data : null;
}

function roster(chat: Pick<Chat, "characterIds">): string[] {
  return typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;
}

function isEligible(chat: Chat, metadata: Record<string, unknown>) {
  return (
    chat.mode === "conversation" &&
    metadata.groupChatMode === "individual" &&
    !metadata.multiplayer &&
    !metadata.multiplayerSetup &&
    !metadata.internalAssistant &&
    roster(chat).length > 1
  );
}

export function registerGroupAutonomyRoutes(app: FastifyInstance, chats: Chats) {
  app.get<{ Params: { chatId: string } }>("/group-autonomy/:chatId", async (req, reply) => {
    const chat = await chats.getById(req.params.chatId);
    if (!chat) return reply.code(404).send({ error: "Chat not found" });
    return { state: readGroupAutonomy(chat.id, chat.metadata) };
  });

  app.post<{ Params: { chatId: string } }>("/group-autonomy/:chatId", async (req, reply) => {
    const parsed = groupAutonomyActionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid group autonomy action or limits" });
    const action = parsed.data;
    const chat = await chats.getById(req.params.chatId);
    if (!chat) return reply.code(404).send({ error: "Chat not found" });
    let result: GroupAutonomyState | null = null;
    let conflict = false;
    await chats.patchMetadata(
      chat.id,
      (meta) => {
        const current = readGroupAutonomy(chat.id, meta);
        if (action.action === "start" && current?.status !== "running" && isEligible(chat, meta)) {
          result = {
            id: chat.id + ":" + randomUUID(),
            status: "running",
            reason: null,
            limits: action.limits,
            callsUsed: 0,
            tokensUsed: 0,
            lastAttemptAt: Date.now(),
            lastSpeakerId: null,
            lastMessageId: current?.lastMessageId ?? null,
          };
        } else if (
          action.action === "resume" &&
          current?.status === "paused" &&
          current.reason !== "budget" &&
          isEligible(chat, meta)
        ) {
          result = { ...current, status: "running", reason: null, lastAttemptAt: Date.now() };
        } else if (current && (action.action === "pause" || action.action === "stop")) {
          result = {
            ...current,
            status: action.action === "stop" ? "stopped" : current.status === "running" ? "paused" : current.status,
            reason: null,
          };
        } else {
          conflict = true;
          return meta;
        }
        return { ...meta, groupAutonomy: result };
      },
      { touchUpdatedAt: false },
    );
    if (conflict || !result)
      return reply.code(409).send({ error: "Group autonomy action is unavailable for this chat" });
    if (action.action === "pause" || action.action === "stop") turnsFor(app.db).get(chat.id)?.abort();
    return { state: result };
  });
}

function normalizedReply(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, "");
}

export function startGroupAutonomy(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const turns = turnsFor(app.db);
  const shutdown = new AbortController();
  let pending: Promise<void> | undefined;

  const evaluate = async (chat: Chat, state: GroupAutonomyState) => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, shutdown.signal]);
    const update = async (fn: (current: GroupAutonomyState) => GroupAutonomyState) => {
      await chats.patchMetadata(
        chat.id,
        (meta) => {
          const current = readGroupAutonomy(chat.id, meta);
          if (current?.id !== state.id) return meta;
          return { ...meta, groupAutonomy: fn(current) };
        },
        { touchUpdatedAt: false },
      );
    };
    const halt = async (reason: NonNullable<GroupAutonomyState["reason"]>) =>
      update((current) => (current.status === "running" ? { ...current, status: "paused", reason } : current));
    if (state.callsUsed >= state.limits.maxCalls || state.tokensUsed >= state.limits.maxTokens) {
      await halt("budget");
      return;
    }
    const meta = parseExtra(chat.metadata);
    if (!isEligible(chat, meta)) {
      await halt("unavailable");
      return;
    }
    if (meta.sceneStatus === "active") return;
    const active = (app as unknown as { activeGenerations?: Map<string, unknown> }).activeGenerations;
    if (active?.has(chat.id)) return;
    const world = await readWorld(app.db, chat.id);
    if (world) syncWorldActors(world, chat);
    const transcript = world ? [] : await chats.listMessagesPaginated(chat.id, 30);
    const publicMessages = transcript.filter((message) => {
      const extra = parseExtra(message.extra);
      return (
        (message.role === "assistant" || message.role === "user") &&
        extra.hiddenFromAI !== true &&
        isSharedCharacterMessage(message) &&
        message.content.trim()
      );
    });
    const anchor = publicMessages.at(-1);
    const newestUser = [...transcript].reverse().find((message) => message.role === "user");
    const lastActivityAt = Math.max(
      Date.parse(anchor?.createdAt ?? "") || 0,
      Date.parse(newestUser?.createdAt ?? "") || 0,
    );
    if (!world && (!anchor || Date.now() - lastActivityAt < state.limits.intervalSeconds * 1000)) return;

    const ids = roster(chat);
    const { schedules, statusOverrides } = await chats.resolveConversationPresenceState(chat.id);
    const previous = ids.indexOf(world?.lastActorId ?? anchor?.characterId ?? state.lastSpeakerId ?? "");
    const candidates = Array.from(
      { length: ids.length },
      (_, offset) => ids[(previous + offset + 1) % ids.length]!,
    ).filter((id) => {
      if (
        (!world && id === anchor?.characterId) ||
        (Array.isArray(meta.inactiveCharacterIds) && meta.inactiveCharacterIds.includes(id))
      )
        return false;
      const { status } = getEffectiveCurrentStatus(schedules[id] ?? null, statusOverrides[id], new Date(), "");
      return status !== "offline" && status !== "dnd";
    });
    let characterId: string | undefined;
    for (const id of candidates) {
      if (world) {
        const actor = world.actors.find((entry) => entry.id === id);
        if (!actor || !worldActorPresent(chat, actor)) continue;
        if (actor.restUntil > Date.now() && !(await hasNewWorldInput(app.db, chat, actor))) continue;
      }
      characterId = id;
      break;
    }
    if (!characterId) return;

    let reservation = 0;
    const recent = new Set(publicMessages.filter((m) => m.role === "assistant").map((m) => normalizedReply(m.content)));
    const turn: GroupAutonomyTurn = {
      chatId: chat.id,
      characterId,
      anchorId: anchor?.id ?? "",
      worldSessionId: world ? state.id : undefined,
      signal,
      duplicate: (text) => recent.has(normalizedReply(text)),
      reserve: async (tokens) => {
        if (reservation || signal.aborted) return false;
        await update((current) => {
          if (current.status !== "running" || signal.aborted) return current;
          if (current.callsUsed >= current.limits.maxCalls || tokens + current.tokensUsed > current.limits.maxTokens) {
            return { ...current, status: "paused", reason: "budget" };
          }
          reservation = tokens;
          return {
            ...current,
            callsUsed: current.callsUsed + 1,
            tokensUsed: current.tokensUsed + tokens,
            lastAttemptAt: Date.now(),
          };
        });
        return reservation > 0 && !signal.aborted;
      },
    };
    if (shutdown.signal.aborted) return;
    turns.set(chat.id, controller);
    try {
      const fresh = await chats.getById(chat.id);
      const current = readGroupAutonomy(chat.id, fresh?.metadata);
      if (current?.id !== state.id || current.status !== "running" || signal.aborted) return;
      if (!fresh || !isEligible(fresh, parseExtra(fresh.metadata))) {
        await halt("unavailable");
        return;
      }
      const run = runners.get(app.db);
      if (!run) return;
      let statusCode = 200;
      let saved: string | null = null;
      let failed = false;
      const output = createGenerationEventSink({
        onEvent(event) {
          if (event.type === "error") failed = true;
          if (event.type !== "message_saved") return;
          const row = event.data as { role?: string; id?: string } | undefined;
          if (row?.role === "assistant" && row.id) saved = row.id;
        },
        onFinish(result) {
          statusCode = result.statusCode;
        },
      });
      await run(
        { chatId: chat.id, forCharacterId: characterId, autonomous: true, streaming: false, skipPresenceDelay: true },
        output,
        undefined,
        turn,
      );
      if (reservation || saved) {
        await update((latest) => ({
          ...latest,
          tokensUsed: latest.tokensUsed - reservation + (turn.usage ?? reservation),
          ...(saved ? { lastMessageId: saved, ...(world ? {} : { lastSpeakerId: characterId }) } : {}),
        }));
      }
      if (saved) {
        await chats.markAutonomousUnread(chat.id, { characterId });
      } else if (!turn.worldEventId && !signal.aborted && statusCode !== 409) {
        await halt(turn.halt ?? (statusCode >= 400 || reservation || failed ? "failure" : "unavailable"));
      }
    } catch (error) {
      if (!signal.aborted) {
        logger.warn(error, "[group-autonomy] Turn failed for chat %s", chat.id);
        await halt("failure");
      }
    } finally {
      turns.delete(chat.id);
    }
  };

  const timer = setInterval(() => {
    if (pending || shutdown.signal.aborted) return;
    pending = (async () => {
      // One autonomous model turn at a time across all managed group chats.
      const ready = (await chats.list())
        .flatMap((chat) => {
          const state = readGroupAutonomy(chat.id, chat.metadata);
          return state?.status === "running" && Date.now() - state.lastAttemptAt >= state.limits.intervalSeconds * 1000
            ? [{ chat, state }]
            : [];
        })
        .sort((a, b) => a.state.lastAttemptAt - b.state.lastAttemptAt);
      for (const { chat, state } of ready) {
        if (shutdown.signal.aborted) break;
        await evaluate(chat, state);
      }
    })()
      .catch((error) => logger.warn(error, "[group-autonomy] Scheduler sweep failed"))
      .finally(() => {
        pending = undefined;
      });
  }, POLL_MS);
  timer.unref();
  app.addHook("preClose", async () => {
    shutdown.abort();
    clearInterval(timer);
    await pending;
  });
}
