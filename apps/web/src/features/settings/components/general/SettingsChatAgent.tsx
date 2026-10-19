'use client';

import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import { useDefaultChatAgent } from '../../hooks/useDefaultChatAgent';

const INHERIT = 'inherit';

// The Chat block of the General page: the agent a new chat of this project
// preselects. Clearing the setting puts the team's default back in its place; each
// member's own last-used agent comes first either way. A member who cannot change the
// setting reads the value instead of the select.
export default function SettingsChatAgent({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.general');
  const form = useDefaultChatAgent(project.project.ref, project.project.teamId);

  if (!form.loaded) return null;

  return (
    <SettingsSection title={t('chat')} description={t('chatHint')}>
      <SettingsCard>
        <SettingsRow
          title={t('chatAgent')}
          description={t('chatAgentHint')}
          control={
            form.editable && form.options.length > 0 ? (
              <Select
                value={form.storedAgentId != null ? String(form.storedAgentId) : INHERIT}
                onValueChange={(value) => void form.save(value === INHERIT ? null : Number(value))}
                disabled={form.saving}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INHERIT}>{t('chatAgentInherit')}</SelectItem>
                  {form.options.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground">
                {form.resolvedAgentId != null
                  ? form.nameOf(form.resolvedAgentId)
                  : t('chatAgentNone')}
              </span>
            )
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
