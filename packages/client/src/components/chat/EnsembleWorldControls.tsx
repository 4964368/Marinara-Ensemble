import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ENSEMBLE_PLAYER_ID, ensembleWorldSettingsSchema, type EnsembleWorldSettings } from "@marinara-engine/shared";
import { useChangeEnsembleWorld, useEnsembleWorld } from "../../hooks/use-ensemble-world";
import { useGroupAutonomy } from "../../hooks/use-group-autonomy";

const field = "mari-chrome-field min-w-0 rounded-md px-2 py-1.5";
const button = "mari-chrome-field rounded-md px-2 py-1.5 disabled:opacity-50";

export function EnsembleWorldControls({
  chatId,
  individual,
  characters,
}: {
  chatId: string;
  individual: boolean;
  characters: Array<{ id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EnsembleWorldSettings>();
  const query = useEnsembleWorld(chatId, open && individual);
  const change = useChangeEnsembleWorld(chatId);
  const autonomy = useGroupAutonomy(chatId);
  const world = query.data?.pages[0]?.world;
  const names = new Map(characters.map(({ id, name }) => [id, name]));
  const nameOf = (id: string) => (id === ENSEMBLE_PLAYER_ID ? t("ensemble.world.player") : (names.get(id) ?? id));
  const sceneOf = (id: string) => world?.scenes.find((scene) => scene.id === id)?.name ?? id;
  const canConfigure = autonomy.data?.state?.status !== "running" && !change.isPending;
  const validSettings = draft && ensembleWorldSettingsSchema.safeParse(draft).success;
  const events = [
    ...new Map(
      query.data?.pages.flatMap((page) => (page.world?.events ?? []).map((event) => [event.id, event] as const)),
    ).values(),
  ];

  return (
    <details
      className="rounded-md bg-[var(--secondary)] p-3 text-xs"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">{t("ensemble.world.title")}</summary>
      <div className="mt-3 space-y-3">
        {!individual && <p>{t("ensemble.autonomy.individualRequired")}</p>}
        {individual && query.isPending && <p role="status">{t("ensemble.world.loading")}</p>}
        {(change.isError || query.isError) && <p role="alert">{t("ensemble.world.error")}</p>}
        {individual && !world && query.isSuccess && !draft && (
          <p className="text-[var(--muted-foreground)]">{t("ensemble.world.empty")}</p>
        )}
        {individual && query.isSuccess && !draft && (
          <button
            type="button"
            className={button}
            disabled={!canConfigure}
            onClick={() => {
              change.reset();
              setDraft(
                world
                  ? { scenes: world.scenes, goals: world.goals }
                  : {
                      scenes: [{ id: crypto.randomUUID(), name: "" }],
                      goals: [],
                    },
              );
            }}
          >
            {t(world ? "ensemble.world.edit" : "ensemble.world.create")}
          </button>
        )}
        {individual && draft && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!validSettings || !canConfigure) return;
              change.mutate({ action: "configure", settings: draft }, { onSuccess: () => setDraft(undefined) });
            }}
          >
            <p>{t("ensemble.world.scenes")}</p>
            {draft.scenes.map((scene, index) => (
              <div key={scene.id} className="flex flex-wrap gap-2">
                <input
                  aria-label={t("ensemble.world.sceneName", { index: index + 1 })}
                  placeholder={t("ensemble.world.sceneName", { index: index + 1 })}
                  className={field + " flex-1"}
                  maxLength={80}
                  required
                  value={scene.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setDraft({ ...draft, scenes: draft.scenes.map((s) => (s.id === scene.id ? { ...s, name } : s)) });
                  }}
                />
                <button
                  type="button"
                  className={button}
                  disabled={draft.scenes.length <= 1}
                  aria-label={t("ensemble.world.removeScene", { index: index + 1 })}
                  onClick={() => setDraft({ ...draft, scenes: draft.scenes.filter((s) => s.id !== scene.id) })}
                >
                  {t("ensemble.world.remove")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className={button}
              disabled={draft.scenes.length >= 12}
              onClick={() => setDraft({ ...draft, scenes: [...draft.scenes, { id: crypto.randomUUID(), name: "" }] })}
            >
              {t("ensemble.world.addScene")}
            </button>
            {characters.map(({ id, name }) => (
              <label key={id} className="flex flex-col gap-1">
                {t("ensemble.world.goal", { name })}
                <input
                  className={field}
                  maxLength={400}
                  value={draft.goals.find((goal) => goal.characterId === id)?.goal ?? ""}
                  onChange={(event) => {
                    const goal = event.target.value;
                    setDraft({
                      ...draft,
                      goals: [
                        ...draft.goals.filter((entry) => entry.characterId !== id),
                        ...(goal.trim() ? [{ characterId: id, goal }] : []),
                      ],
                    });
                  }}
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={button} disabled={!validSettings || !canConfigure}>
                {t("ensemble.world.save")}
              </button>
              <button type="button" className={button} onClick={() => setDraft(undefined)}>
                {t("ensemble.world.cancel")}
              </button>
            </div>
          </form>
        )}
        {individual && world && (
          <>
            <label className="flex flex-wrap items-center gap-2">
              {t("ensemble.world.location")}
              <select
                className={field}
                value={world.playerSceneId}
                disabled={change.isPending}
                onChange={(event) => change.mutate({ action: "move", sceneId: event.target.value })}
              >
                {world.scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[var(--muted-foreground)]">{t("ensemble.world.minute", { minute: world.minute })}</p>
            <ul className="space-y-1">
              {world.characters.map((actor) => (
                <li key={actor.id} className="break-words">
                  <span className="font-medium">{nameOf(actor.id)}: </span>
                  {actor.sceneId ? sceneOf(actor.sceneId) : t("ensemble.world.unseen")}
                  {actor.activity && " · " + t("ensemble.world.event." + actor.activity)}
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-[var(--border)] pt-2">
              <p className="font-medium">{t("ensemble.world.relationships")}</p>
              {world.relationships.length ? (
                <ul className="space-y-1">
                  {world.relationships.map((relation) => (
                    <li key={JSON.stringify([relation.fromId, relation.toId])}>
                      {t("ensemble.world.interactions", {
                        from: nameOf(relation.fromId),
                        to: nameOf(relation.toId),
                        count: relation.interactions,
                      })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--muted-foreground)]">{t("ensemble.world.noRelationships")}</p>
              )}
            </div>
            <div className="space-y-1 border-t border-[var(--border)] pt-2">
              <p className="font-medium">{t("ensemble.world.events")}</p>
              {events.length ? (
                <ol className="max-h-60 space-y-2 overflow-y-auto">
                  {events.map((event) => (
                    <li key={event.id} className="break-words">
                      {t("ensemble.world.eventEntry", {
                        actor: nameOf(event.actorId),
                        event: t("ensemble.world.event." + event.type),
                        minute: event.minute,
                      })}
                      {event.destinationId && " · " + sceneOf(event.destinationId)}
                      {event.text && <p className="whitespace-pre-wrap text-[var(--muted-foreground)]">{event.text}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[var(--muted-foreground)]">{t("ensemble.world.noEvents")}</p>
              )}
              {query.hasNextPage && (
                <button
                  type="button"
                  className={button}
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {t("ensemble.world.earlier")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
