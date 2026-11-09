import type { EnsembleWorldCommand, EnsembleWorldView } from "@marinara-engine/shared";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

const worldKey = (chatId: string) => ["ensemble-world", chatId] as const;
const worldPath = (chatId: string) => "/conversation/ensemble-world/" + encodeURIComponent(chatId);
type WorldResponse = { world: EnsembleWorldView | null };

export function useEnsembleWorld(chatId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: worldKey(chatId),
    enabled,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => api.get<WorldResponse>(worldPath(chatId) + (pageParam ? "?before=" + pageParam : "")),
    getNextPageParam: (last) => last.world?.nextBefore ?? undefined,
    refetchInterval: (query) => (query.state.data?.pages[0]?.world ? 3000 : false),
  });
}

export function useChangeEnsembleWorld(chatId: string) {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (command: EnsembleWorldCommand) => api.post<WorldResponse>(worldPath(chatId), command),
    onSuccess: () => query.invalidateQueries({ queryKey: worldKey(chatId) }),
  });
}
