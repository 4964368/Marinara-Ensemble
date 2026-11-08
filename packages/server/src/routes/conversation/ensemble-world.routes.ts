import { ensembleWorldCommandSchema } from "@marinara-engine/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { applyWorldCommand, getWorldView } from "../../services/conversation/ensemble-world.service.js";
import { worldChatEligible } from "../../services/conversation/ensemble-world.storage.js";
import { createChatsStorage } from "../../services/storage/chats.storage.js";

const querySchema = z.object({ before: z.coerce.number().int().positive().optional() });

export function registerEnsembleWorldRoutes(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  app.get<{ Params: { chatId: string } }>("/ensemble-world/:chatId", async (req, reply) => {
    const query = querySchema.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid world event cursor" });
    const chat = await chats.getById(req.params.chatId);
    if (!chat) return reply.code(404).send({ error: "Chat not found" });
    return { world: worldChatEligible(chat) ? await getWorldView(app.db, chat, query.data.before) : null };
  });

  app.post<{ Params: { chatId: string } }>("/ensemble-world/:chatId", async (req, reply) => {
    const parsed = ensembleWorldCommandSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid world command" });
    const status = await applyWorldCommand(app.db, req.params.chatId, parsed.data);
    if (status !== 200) return reply.code(status).send({ error: "World command is unavailable" });
    const chat = await chats.getById(req.params.chatId);
    return { world: chat ? await getWorldView(app.db, chat) : null };
  });
}
