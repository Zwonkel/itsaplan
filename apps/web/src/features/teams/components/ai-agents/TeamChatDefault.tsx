'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAgentSection } from '../../context/agentSection';
import {
  useTeam,
  useTeamChatDefaultQuery,
  useUpdateTeamChatDefault,
} from '@/services/teams.service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiAgent } from '@/lib/api/endpoints/agents';

const NONE = 'none';

// The team's default chat agent: what every project that sets none of its own starts
// a new chat with. The options are the agents the setting may name — chat is on for
// them and their runner is not restricted to one member. A member who cannot change
// it reads the value instead of the select.
export default function TeamChatDefault({ agents }: { agents: AiAgent[] }) {
  const t = useTranslations('teams.agents');
  const { teamId } = useAgentSection();
  const team = useTeam(teamId);
  const chatDefault = useTeamChatDefaultQuery(teamId);
  const update = useUpdateTeamChatDefault(teamId);

  const options = agents.filter((agent) => agent.chatEnabled && agent.runnerScope !== 'owner');
  const stored = chatDefault.data?.defaultAgentId ?? null;
  const editable = team != null && team.role !== 'member';

  const valueLabel = agents.find((agent) => agent.id === stored)?.name ?? t('chatDefaultNone');

  async function save(agentId: number | null) {
    if (agentId === stored) return;
    await update.mutateAsync(agentId);
    toast.success(t('chatDefaultSaved'));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/30 px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('chatDefaultTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('chatDefaultHint')}</p>
      </div>
      {editable && options.length > 0 ? (
        <Select
          value={stored != null ? String(stored) : NONE}
          onValueChange={(value) => void save(value === NONE ? null : Number(value))}
          disabled={update.isPending}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('chatDefaultNone')}</SelectItem>
            {options.map((agent) => (
              <SelectItem key={agent.id} value={String(agent.id)}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-sm text-muted-foreground">{valueLabel}</span>
      )}
    </div>
  );
}
