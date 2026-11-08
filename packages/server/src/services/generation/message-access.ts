import type { MessageVisibilityInput } from "@marinara-engine/shared";
import { inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { chats, messages } from "../../db/schema/index.js";
import { parseExtra } from "./prompt-attachments.js";

type MessageAccessSource = { id?: string; extra?: unknown };

function characterIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
}

export function messageCharacterAccess(message: MessageAccessSource) {
  const extra = parseExtra(message.extra);
  return {
    hiddenFromAICharacterIds: characterIds(extra.hiddenFromAICharacterIds),
    // An empty or malformed saved allowlist grants access to nobody.
    visibleToCharacterIds: Object.hasOwn(extra, "visibleToCharacterIds")
      ? characterIds(extra.visibleToCharacterIds)
      : undefined,
  };
}

export function canReadCharacterMessage(
  access: Partial<ReturnType<typeof messageCharacterAccess>>,
  audience: readonly string[],
): boolean {
  const { visibleToCharacterIds, hiddenFromAICharacterIds } = access;
  if (audience.length === 0) return visibleToCharacterIds === undefined && !hiddenFromAICharacterIds?.length;
  return audience.every(
    (id) => (!visibleToCharacterIds || visibleToCharacterIds.includes(id)) && !hiddenFromAICharacterIds?.includes(id),
  );
}

export function isSharedCharacterMessage(message: MessageAccessSource): boolean {
  return canReadCharacterMessage(messageCharacterAccess(message), []);
}

export function hasExplicitMessageAudience(metadata: unknown, messages: readonly MessageAccessSource[]): boolean {
  return (
    parseExtra(metadata).hasExplicitMessageAudience === true ||
    messages.some((message) => Object.hasOwn(parseExtra(message.extra), "visibleToCharacterIds"))
  );
}

export function hasRestrictedMessageHistory(metadata: unknown, messages: readonly MessageAccessSource[]): boolean {
  const meta = parseExtra(metadata);
  if (meta.hasRestrictedMessageHistory === true || meta.hasExplicitMessageAudience === true) return true;
  const covered = new Set(
    Array.isArray(meta.summaryEntries)
      ? meta.summaryEntries.flatMap((entry) => characterIds(parseExtra(entry).hiddenMessageIds))
      : [],
  );
  return messages.some((message) => {
    const extra = parseExtra(message.extra);
    return (
      !isSharedCharacterMessage(message) ||
      (extra.hiddenFromAI === true &&
        extra.commandOnly !== true &&
        (extra.visibilityManual === true || !message.id || !covered.has(message.id)))
    );
  });
}

/** Old derived records do not prove that their source transcript was public. */
export async function readRestrictedChatIds(db: DB, chatIds?: string[]): Promise<Set<string>> {
  if (chatIds?.length === 0) return new Set();
  const sources = await db
    .select({ id: chats.id, metadata: chats.metadata })
    .from(chats)
    .where(chatIds ? inArray(chats.id, chatIds) : undefined);
  const found = new Set(sources.map((chat) => chat.id));
  const restricted = new Set(chatIds?.filter((id) => !found.has(id)));
  for (const chat of sources) {
    if (hasRestrictedMessageHistory(chat.metadata, [])) restricted.add(chat.id);
  }
  const remaining = [...found].filter((id) => !restricted.has(id));
  if (remaining.length === 0) return restricted;
  const rows = await db
    .select({ id: messages.id, chatId: messages.chatId, extra: messages.extra })
    .from(messages)
    .where(inArray(messages.chatId, remaining));
  const byChat = new Map<string, MessageAccessSource[]>();
  for (const row of rows) {
    const source = byChat.get(row.chatId);
    if (source) source.push(row);
    else byChat.set(row.chatId, [row]);
  }
  for (const chat of sources) {
    if (hasRestrictedMessageHistory(chat.metadata, byChat.get(chat.id) ?? [])) restricted.add(chat.id);
  }
  return restricted;
}

/** Save presence as it was when the message was sent. */
export function resolveMessageVisibility(
  visibility: MessageVisibilityInput,
  chat: { characterIds?: unknown; metadata?: unknown },
): string[] | undefined {
  if (visibility.type === "public") return undefined;
  const roster = characterIds(
    typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds,
  );
  if (visibility.type === "present") {
    const inactive = characterIds(parseExtra(chat.metadata).inactiveCharacterIds);
    return roster.filter((id) => !inactive.includes(id));
  }
  if (visibility.characterIds.some((id) => !roster.includes(id))) {
    throw new Error("Message recipients must be characters attached to this chat");
  }
  return [...new Set(visibility.characterIds)];
}
