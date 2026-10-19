'use client';

import { useTranslations } from 'next-intl';
import { Bot, Check } from 'lucide-react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { agentModelLabel } from '../../utils/agentModelLabel';

// The project's agents to pick from, as the content of a dropdown the host opens with
// its own trigger. An external agent shows the state of its runner instead of a model:
// it answers only while that runner is connected. The project's default chat agent
// carries a badge naming it as the one a fresh chat preselects.
export function AiChatAgentMenu({
  agents,
  selectedId,
  chatDefaultId,
  providerLabel,
  onSelect,
}: {
  agents: AiAgent[];
  selectedId: number | null;
  chatDefaultId: number | null;
  providerLabel: (key: string) => string;
  onSelect: (agentId: number) => void;
}) {
  const t = useTranslations('aiChat');

  return (
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuLabel>{t('agents')}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {agents.map((agent) => (
        <DropdownMenuItem key={agent.id} onSelect={() => onSelect(agent.id)} className="gap-2">
          <Bot className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{agent.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {agent.kind === 'external' ? (
                <AgentRunnerStatus agent={agent} compact />
              ) : (
                agentModelLabel(agent, providerLabel, t('noModel'))
              )}
            </div>
          </div>
          {agent.id === chatDefaultId && (
            <span className="flex-none rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
              {t('defaultBadge')}
            </span>
          )}
          {agent.id === selectedId && <Check className="size-4 shrink-0" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}
