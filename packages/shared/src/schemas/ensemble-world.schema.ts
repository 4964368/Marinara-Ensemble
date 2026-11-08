import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const text = (max: number) => z.string().trim().min(1).max(max);

export const ensembleWorldSettingsSchema = z
  .object({
    scenes: z
      .array(z.object({ id, name: text(80) }).strict())
      .min(1)
      .max(12),
    goals: z
      .array(z.object({ characterId: id, goal: text(400) }).strict())
      .max(24)
      .default([]),
  })
  .strict()
  .refine(
    ({ scenes, goals }) =>
      new Set(scenes.map((scene) => scene.id)).size === scenes.length &&
      new Set(goals.map((goal) => goal.characterId)).size === goals.length,
  );

export const ensembleWorldCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure"), settings: ensembleWorldSettingsSchema }).strict(),
  z.object({ action: z.literal("move"), sceneId: id }).strict(),
]);

export const ensembleMemoryKindSchema = z.enum(["episodic", "semantic", "private", "belief"]);
export const ensembleBeliefStatusSchema = z.enum(["tentative", "believed", "disputed", "corrected"]);
export const ensembleRelationshipSignalSchema = z.enum(["support", "confidence", "affection", "conflict", "neutral"]);
export const ensembleWorldActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("move"), sceneId: id }).strict(),
  z.object({ action: z.literal("leave") }).strict(),
  z.object({ action: z.literal("observe") }).strict(),
  z.object({ action: z.literal("wait") }).strict(),
  z.object({ action: z.literal("speak"), text: text(1200) }).strict(),
  z.object({ action: z.literal("whisper"), targetId: id, text: text(1200) }).strict(),
  z.object({ action: z.literal("disclose"), targetId: id, sourceId: id, text: text(1200) }).strict(),
  z
    .object({
      action: z.literal("remember"),
      sourceIds: z.array(id).min(1).max(2),
      kind: ensembleMemoryKindSchema,
      topic: text(80),
      text: text(360),
      confidence: z.number().min(0).max(1),
      status: ensembleBeliefStatusSchema,
    })
    .strict(),
  z
    .object({ action: z.literal("appraise"), targetId: id, sourceId: id, signal: ensembleRelationshipSignalSchema })
    .strict(),
]);

export const ENSEMBLE_PLAYER_ID = "player";
export type EnsembleWorldSettings = z.infer<typeof ensembleWorldSettingsSchema>;
export type EnsembleWorldCommand = z.infer<typeof ensembleWorldCommandSchema>;
export type EnsembleWorldAction = z.infer<typeof ensembleWorldActionSchema>;
export type EnsembleMemoryKind = z.infer<typeof ensembleMemoryKindSchema>;
export type EnsembleBeliefStatus = z.infer<typeof ensembleBeliefStatusSchema>;
export type EnsembleRelationshipSignal = z.infer<typeof ensembleRelationshipSignalSchema>;
export type EnsembleEventType = EnsembleWorldAction["action"] | "rejected";
export type EnsembleEventResult =
  "ok" | "invalid_action" | "invalid_scene" | "invalid_target" | "no_audience" | "unknown_source" | "duplicate";

export interface EnsembleWorldEventView {
  id: string;
  type: EnsembleEventType;
  time: string;
  minute: number;
  actorId: string;
  participantIds: string[];
  sceneId: string | null;
  destinationId?: string;
  result: EnsembleEventResult;
  text?: string;
  messageId?: string;
}

export interface EnsembleWorldView {
  id: string;
  minute: number;
  scenes: EnsembleWorldSettings["scenes"];
  goals: EnsembleWorldSettings["goals"];
  playerSceneId: string;
  characters: Array<{
    id: string;
    sceneId: string | null;
    activity: EnsembleEventType | null;
    present: boolean;
  }>;
  relationships: Array<{
    fromId: string;
    toId: string;
    interactions: number;
    lastEventId: string;
  }>;
  events: EnsembleWorldEventView[];
  nextBefore: number | null;
}
