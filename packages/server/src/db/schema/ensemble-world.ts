import { fileTable, integer, text } from "../file-schema.js";
import { chats } from "./chats.js";

export const ensembleWorlds = fileTable("ensemble_worlds", {
  chatId: text("chat_id")
    .primaryKey()
    .references(() => chats.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
});

export const ensembleWorldEvents = fileTable("ensemble_world_events", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  minute: integer("minute").notNull(),
  playerVisible: integer("player_visible").notNull(),
  data: text("data").notNull(),
});
