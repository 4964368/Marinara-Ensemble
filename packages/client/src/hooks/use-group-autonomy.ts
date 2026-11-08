import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupAutonomyAction, GroupAutonomyState } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { chatKeys } from "./use-chats";

type Status = { state: GroupAutonomyState | null };
const statusKey = (chatId: string) => ["group-autonomy", chatId] as const;
const statusPath = (chatId: string) => "/conversation/group-autonomy/" + encodeURIComponent(chatId);

export function useGroupAutonomy(chatId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: statusKey(chatId ?? ""),
    enabled: !!chatId,
    refetchInterval: 3_000,
    queryFn: async () => {
      const previous = qc.getQueryData<Status>(statusKey(chatId!));
      const next = await api.get<Status>(statusPath(chatId!));
      if (next.state?.lastMessageId && next.state.lastMessageId !== previous?.state?.lastMessageId) {
        void qc.invalidateQueries({ queryKey: chatKeys.messages(chatId!) });
        void qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId!) });
      }
      return next;
    },
  });
  return query;
}

export function useChangeGroupAutonomy(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: GroupAutonomyAction) => api.post<Status>(statusPath(chatId), action),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: statusKey(chatId) }),
        qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
      ]),
  });
}
