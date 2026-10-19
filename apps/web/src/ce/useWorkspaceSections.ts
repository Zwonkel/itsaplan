'use client';

import { UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import type { WorkspaceSection } from '@/features/teams/types/workspaceSection';
import WorkspaceScimSection from '@/features/teams/components/workspace/scim/WorkspaceScimSection';

// The core's workspace settings sections, with SCIM provisioning added last in the
// settings group: the page /workspaces/:id/scim opens through `Component`.
export default function useWorkspaceSections(
  _workspace: WorkspaceSummary,
  core: WorkspaceSection[],
): WorkspaceSection[] {
  const t = useTranslations('teams.workspace');
  return [
    ...core,
    {
      id: 'scim',
      label: t('scim.title'),
      icon: UsersRound,
      group: 'settings',
      Component: WorkspaceScimSection,
    },
  ];
}
