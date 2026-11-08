import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_GROUP_AUTONOMY_LIMITS, groupAutonomyLimitsSchema } from "@marinara-engine/shared";
import { useChangeGroupAutonomy, useGroupAutonomy } from "../../hooks/use-group-autonomy";

export function GroupAutonomyControls({ chatId, individual }: { chatId: string; individual: boolean }) {
  const { t } = useTranslation();
  const query = useGroupAutonomy(chatId);
  const change = useChangeGroupAutonomy(chatId);
  const state = query.data?.state;
  const [draft, setDraft] = useState<typeof DEFAULT_GROUP_AUTONOMY_LIMITS>();
  const limits = draft ?? state?.limits ?? DEFAULT_GROUP_AUTONOMY_LIMITS;
  const running = state?.status === "running";
  const paused = state?.status === "paused";
  const blocked = change.isPending || query.isPending;
  const fields = [
    ["intervalSeconds", "ensemble.autonomy.interval", 5, 3600],
    ["maxCalls", "ensemble.autonomy.maxCalls", 1, 100],
    ["maxTokens", "ensemble.autonomy.maxTokens", 1000, 1000000],
  ] as const;

  return (
    <div className="space-y-2 rounded-md bg-[var(--secondary)] p-3 text-xs">
      <div className="font-medium">{t("ensemble.autonomy.title")}</div>
      <p className="text-[var(--muted-foreground)]">{t("ensemble.autonomy.help")}</p>
      <p role="status">
        {running
          ? t("ensemble.autonomy.running")
          : paused
            ? t("ensemble.autonomy.paused")
            : t("ensemble.autonomy.stopped")}
        {state &&
          " · " +
            t("ensemble.autonomy.usage", {
              calls: state.callsUsed,
              maxCalls: state.limits.maxCalls,
              tokens: state.tokensUsed,
              maxTokens: state.limits.maxTokens,
            })}
      </p>
      {!individual && <p>{t("ensemble.autonomy.individualRequired")}</p>}
      {state?.reason && <p role="alert">{t(`ensemble.autonomy.reason.${state.reason}`)}</p>}
      {(change.isError || query.isError) && <p role="alert">{t("ensemble.autonomy.controlError")}</p>}
      <div className="flex flex-wrap gap-2">
        {fields.map(([key, label, min, max]) => (
          <label key={key} className="flex flex-col gap-1">
            {t(label)}
            <input
              type="number"
              min={min}
              max={max}
              value={Number.isNaN(limits[key]) ? "" : limits[key]}
              disabled={running || paused || blocked}
              onChange={(event) => setDraft({ ...limits, [key]: event.currentTarget.valueAsNumber })}
              className="mari-chrome-field w-24 rounded-md p-1.5"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {!running && !paused && (
          <button
            type="button"
            className="mari-chrome-field rounded-md px-2 py-1"
            disabled={blocked || !individual || !groupAutonomyLimitsSchema.safeParse(limits).success}
            onClick={() => change.mutate({ action: "start", limits })}
          >
            {t("ensemble.autonomy.start")}
          </button>
        )}
        {running && (
          <button
            type="button"
            className="mari-chrome-field rounded-md px-2 py-1"
            disabled={blocked}
            onClick={() => change.mutate({ action: "pause" })}
          >
            {t("ensemble.autonomy.pause")}
          </button>
        )}
        {paused && state.reason !== "budget" && (
          <button
            type="button"
            className="mari-chrome-field rounded-md px-2 py-1"
            disabled={blocked || !individual}
            onClick={() => change.mutate({ action: "resume" })}
          >
            {t("ensemble.autonomy.resume")}
          </button>
        )}
        {(running || paused) && (
          <button
            type="button"
            className="mari-chrome-field rounded-md px-2 py-1"
            disabled={blocked}
            onClick={() => change.mutate({ action: "stop" })}
          >
            {t("ensemble.autonomy.stop")}
          </button>
        )}
      </div>
    </div>
  );
}
