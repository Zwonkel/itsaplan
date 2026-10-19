'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateWorkspace } from '@/services/workspaces.service';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The dialog to name a new workspace, opened by the Plus button below the rail's tiles.
export default function WorkspaceCreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('teams.workspace');
  const tCommon = useTranslations('common');
  const create = useCreateWorkspace();
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !create.isPending;

  async function submit() {
    await create.mutateAsync({ name: trimmed });
    setName('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="workspace-create-name">{tCommon('name')}</Label>
            <Input
              id="workspace-create-name"
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t('createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
