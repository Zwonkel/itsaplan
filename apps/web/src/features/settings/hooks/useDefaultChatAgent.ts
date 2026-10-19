'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectChatSettings, useUpdateChatSettings } from '@/services/aiAgents.service';
import { useTeamChatDefaultQuery } from '@/services/teams.service';

// The project's default chat agent, as the General page edits it. `options` lists the
// agents the setting may name: chat is on for them and their runner is not restricted
// to one member, and the API refuses a default outside that set. Nothing until both
// reads have settled.
export function useDefaultChatAgent(projectKey: string, teamId: number) {
  const t = useTranslations('settings.general');
  const { isAdmin } = usePermissions();
  const agentsQuery = useProjectAgents();
  const settings = useProjectChatSettings(projectKey);
  const teamDefault = useTeamChatDefaultQuery(teamId);
  const update = useUpdateChatSettings(projectKey);

  const agents = agentsQuery.data ?? [];
  const options = agents.filter((agent) => agent.chatEnabled && agent.runnerScope !== 'owner');

  const nameOf = (agentId: number) => agents.find((agent) => agent.id === agentId)?.name ?? null;

  const storedAgentId = settings.data?.defaultAgentId ?? null;

  async function save(agentId: number | null) {
    if (agentId === storedAgentId) return;
    await update.mutateAsync(agentId);
    toast.success(t('chatAgentSaved'));
  }

  return {
    loaded: settings.isSuccess,
    storedAgentId,
    resolvedAgentId: settings.data?.resolvedAgentId ?? null,
    teamDefaultAgentId: teamDefault.data?.defaultAgentId ?? null,
    options,
    nameOf,
    editable: isAdmin,
    saving: update.isPending,
    save,
  };
}

export type DefaultChatAgent = ReturnType<typeof useDefaultChatAgent>;
