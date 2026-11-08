import { createHash, randomUUID } from "node:crypto";
import {
  ENSEMBLE_PLAYER_ID,
  type EnsembleBeliefStatus,
  type EnsembleEventType,
  type EnsembleMemoryKind,
  type EnsembleRelationshipSignal,
  type EnsembleWorldEventView,
  type EnsembleWorldSettings,
  type MessageVisibilityInput,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { and, desc, eq, lt } from "../../db/file-query.js";
import { ensembleWorldEvents, ensembleWorlds } from "../../db/schema/ensemble-world.js";
import {
  canReadCharacterMessage,
  messageCharacterAccess,
  resolveMessageVisibility,
} from "../generation/message-access.js";
import { parseExtra } from "../generation/prompt-attachments.js";
import { createChatsStorage } from "../storage/chats.storage.js";

export type WorldChat = NonNullable<Awaited<ReturnType<ReturnType<typeof createChatsStorage>["getById"]>>>;
export type EvidenceRef = { id: string; fingerprint?: string };

export type WorldMemory = {
  kind: EnsembleMemoryKind;
  topic: string;
  text?: string;
  confidence: number;
  status: EnsembleBeliefStatus;
  sources: EvidenceRef[];
  minute: number;
};

export type WorldRelationship = {
  targetId: string;
  signal: EnsembleRelationshipSignal;
  source: EvidenceRef;
};

export type WorldActor = {
  id: string;
  sceneId: string | null;
  activity: EnsembleEventType | null;
  activityEventId?: string;
  restUntil: number;
  noProgress: number;
  recent: Array<{ signature: string; at: number }>;
  memories: WorldMemory[];
  relationships: WorldRelationship[];
};

export type WorldState = {
  id: string;
  createdAt: string;
  minute: number;
  settings: EnsembleWorldSettings;
  playerSceneId: string;
  actors: WorldActor[];
  lastActorId?: string;
};

export type WorldEvent = EnsembleWorldEventView & {
  audience: string[];
  playerVisible: boolean;
  source?: EvidenceRef;
  disclosedFrom?: EvidenceRef;
};

export const newWorldActor = (id: string, sceneId: string): WorldActor => ({
  id,
  sceneId,
  activity: null,
  restUntil: 0,
  noProgress: 0,
  recent: [],
  memories: [],
  relationships: [],
});

export function worldRoster(chat: WorldChat): string[] {
  const ids: unknown = typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string" && id !== ENSEMBLE_PLAYER_ID)
    : [];
}

export function worldChatEligible(chat: WorldChat): boolean {
  const meta = parseExtra(chat.metadata);
  return (
    chat.mode === "conversation" &&
    meta.groupChatMode === "individual" &&
    !meta.multiplayer &&
    !meta.multiplayerSetup &&
    !meta.internalAssistant &&
    worldRoster(chat).length > 1
  );
}

// Legacy idle polling must not hydrate a chat's lazy transcript shard just to
// discover that it has no world. The marker is bound to the owning chat ID so
// copied/imported metadata cannot opt another conversation in.
export const WORLD_CHAT_MARKER = "ensembleWorldChatId";
export function hasEnsembleWorld(chatId: string, metadata: unknown): boolean {
  return parseExtra(metadata)[WORLD_CHAT_MARKER] === chatId;
}

export function preserveEnsembleWorldMarker(chatId: string, previous: unknown, next: Record<string, unknown>) {
  return hasEnsembleWorld(chatId, previous) ? { ...next, [WORLD_CHAT_MARKER]: chatId } : next;
}

export function worldActorPresent(chat: WorldChat, actor: WorldActor): boolean {
  const inactive = parseExtra(chat.metadata).inactiveCharacterIds;
  return worldRoster(chat).includes(actor.id) && !(Array.isArray(inactive) && inactive.includes(actor.id));
}

export function initWorld(chat: WorldChat, settings: EnsembleWorldSettings): WorldState {
  const sceneId = settings.scenes[0]!.id;
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    minute: 0,
    settings,
    playerSceneId: sceneId,
    actors: worldRoster(chat).map((id) => newWorldActor(id, sceneId)),
  };
}

export function syncWorldActors(world: WorldState, chat: WorldChat): void {
  world.actors = worldRoster(chat).map(
    (id) => world.actors.find((actor) => actor.id === id) ?? newWorldActor(id, world.settings.scenes[0]!.id),
  );
}

export async function readWorld(db: DB, chatId: string): Promise<WorldState | null> {
  const [row] = await db.select().from(ensembleWorlds).where(eq(ensembleWorlds.chatId, chatId)).limit(1);
  return row ? (JSON.parse(row.data) as WorldState) : null;
}

export async function resolveWorldMessageVisibility(db: DB, visibility: MessageVisibilityInput, chat: WorldChat) {
  if (visibility.type === "present" && chat.mode === "conversation" && hasEnsembleWorld(chat.id, chat.metadata)) {
    const world = await readWorld(db, chat.id);
    if (world && worldChatEligible(chat)) {
      syncWorldActors(world, chat);
      return world.actors
        .filter((actor) => worldActorPresent(chat, actor) && actor.sceneId === world.playerSceneId)
        .map(({ id }) => id);
    }
  }
  return resolveMessageVisibility(visibility, chat);
}

export async function writeWorld(db: DB, chatId: string, world: WorldState, create = false): Promise<void> {
  const data = JSON.stringify(world);
  if (create) await db.insert(ensembleWorlds).values({ chatId, data });
  else await db.update(ensembleWorlds).set({ data }).where(eq(ensembleWorlds.chatId, chatId));
}

export async function readWorldEvent(db: DB, chatId: string, id: string): Promise<WorldEvent | null> {
  // An event ID supplied by a model never crosses the chat boundary.
  const [row] = await db
    .select()
    .from(ensembleWorldEvents)
    .where(and(eq(ensembleWorldEvents.chatId, chatId), eq(ensembleWorldEvents.id, id)))
    .limit(1);
  return row ? (JSON.parse(row.data) as WorldEvent) : null;
}

export async function listWorldEvents(
  db: DB,
  chatId: string,
  limit: number,
  options: { playerOnly?: boolean; before?: number } = {},
): Promise<WorldEvent[]> {
  const rows = await db
    .select()
    .from(ensembleWorldEvents)
    .where(
      and(
        eq(ensembleWorldEvents.chatId, chatId),
        options.playerOnly ? eq(ensembleWorldEvents.playerVisible, 1) : undefined,
        options.before === undefined ? undefined : lt(ensembleWorldEvents.minute, options.before),
      ),
    )
    .orderBy(desc(ensembleWorldEvents.minute))
    .limit(limit);
  return rows.map((row) => JSON.parse(row.data) as WorldEvent);
}

export async function appendWorldEvent(db: DB, chatId: string, world: WorldState, event: WorldEvent): Promise<void> {
  await db.insert(ensembleWorldEvents).values({
    id: event.id,
    chatId,
    minute: event.minute,
    playerVisible: Number(event.playerVisible),
    data: JSON.stringify(event),
  });
  await writeWorld(db, chatId, world);
}

type Message = NonNullable<Awaited<ReturnType<ReturnType<typeof createChatsStorage>["getMessage"]>>>;
export const messageRef = (message: Message): EvidenceRef => ({
  id: "m:" + message.id,
  fingerprint: createHash("sha256").update(message.content).digest("hex"),
});

export function actorCanReadMessage(message: Message, actorId: string): boolean {
  const extra = parseExtra(message.extra);
  return (
    (message.role === "user" || message.role === "assistant") &&
    extra.hiddenFromAI !== true &&
    extra.commandOnly !== true &&
    canReadCharacterMessage(messageCharacterAccess(message), [actorId]) &&
    Boolean(message.content.trim())
  );
}

export function canReadWorldEvent(event: WorldEvent, actorId: string): boolean {
  return canReadCharacterMessage({ visibleToCharacterIds: event.audience }, [actorId]);
}

export type WorldEvidence = {
  ref: EvidenceRef;
  time: string;
  type: EnsembleEventType | "message";
  actorId: string;
  participantIds: string[];
  sceneId?: string | null;
  destinationId?: string;
  result?: EnsembleWorldEventView["result"];
  text?: string;
  restricted?: boolean;
};

export async function readWorldEvidence(
  db: DB,
  chatId: string,
  actorId: string,
  ref: EvidenceRef,
): Promise<WorldEvidence | null> {
  const storage = createChatsStorage(db);
  if (ref.id.startsWith("m:")) {
    const message = await storage.getMessage(ref.id.slice(2));
    if (!message || message.chatId !== chatId || !actorCanReadMessage(message, actorId)) return null;
    const current = messageRef(message);
    if (ref.fingerprint && ref.fingerprint !== current.fingerprint) return null;
    const access = messageCharacterAccess(message);
    return {
      ref: current,
      time: message.createdAt,
      type: "message",
      actorId: message.characterId ?? ENSEMBLE_PLAYER_ID,
      participantIds: [actorId],
      text: message.content.slice(0, 1000),
      restricted: access.visibleToCharacterIds !== undefined || access.hiddenFromAICharacterIds.length > 0,
    };
  }
  const event = await readWorldEvent(db, chatId, ref.id);
  if (!event || !canReadWorldEvent(event, actorId)) return null;
  const message = event.messageId ? await storage.getMessage(event.messageId) : null;
  if (
    event.messageId &&
    (!message ||
      message.chatId !== chatId ||
      !actorCanReadMessage(message, actorId) ||
      (event.source?.fingerprint && messageRef(message).fingerprint !== event.source.fingerprint))
  )
    return null;
  return {
    ref: { id: event.id },
    time: event.time,
    type: event.type,
    actorId: event.actorId,
    participantIds: event.participantIds,
    sceneId: event.sceneId,
    destinationId: event.destinationId,
    result: event.result,
    text: (message?.content ?? event.text)?.slice(0, 1000),
    restricted: true,
  };
}
