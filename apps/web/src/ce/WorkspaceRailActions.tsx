'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { workspaceTileClass } from '@/components/layout/utils/workspaceTile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import WorkspaceCreateDialog from './WorkspaceCreateDialog';

// Below the workspace tiles of a rail: the Plus button opens the dialog that creates a
// workspace.
export default function WorkspaceRailActions() {
  const t = useTranslations('teams.workspace');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t('create')}
            className={workspaceTileClass(false)}
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{t('create')}</TooltipContent>
      </Tooltip>
      <WorkspaceCreateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
