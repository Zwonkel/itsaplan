'use client';

import { useMemo } from 'react';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import { useProjectChatSettings } from '@/services/aiAgents.service';

// The agents of the open project, as the chat sees them: the list the picker offers
// is the agents chat is enabled for, and the defaults a fresh chat preselects from
// are the ones the chat settings resolve for this member — their last-used agent,
// then the project's default chat agent (the team's when the project sets none), then
// the first agent in the list, which is also the whole selection when nothing is set.
export function useChatAgents(projectKey: string) {
  const agentsQuery = useProjectAgents();
  const settingsQuery = useProjectChatSettings(projectKey);

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const chatAgents = useMemo(() => agents.filter((agent) => agent.chatEnabled), [agents]);

  return {
    agents,
    chatAgents,
    // Both reads settle before a fresh chat is created, so nothing opens on the
    // placeholder the list order would give while the defaults are still arriving.
    loading: agentsQuery.isPending || settingsQuery.isPending,
    chatDefaultId: settingsQuery.data?.resolvedAgentId ?? null,
    rememberedId: settingsQuery.data?.lastUsedAgentId ?? null,
  };
}
