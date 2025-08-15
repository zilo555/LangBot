'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UploadIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export enum UploadModalStatus {
  UPLOADING = 'uploading',
  SUCCESS = 'success',
  ERROR = 'error',
}

interface PluginUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: UploadModalStatus;
  error?: string | null;
}

export default function PluginUploadDialog({
  open,
  onOpenChange,
  status,
  error,
}: PluginUploadDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[400px] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <UploadIcon className="size-6" />
            <span>{t('plugins.uploadLocalPlugin')}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {status === UploadModalStatus.UPLOADING && (
            <p className="mb-2">{t('plugins.uploadingPlugin')}</p>
          )}
          {status === UploadModalStatus.SUCCESS && (
            <p className="mb-2 text-green-600">{t('plugins.uploadSuccess')}</p>
          )}
          {status === UploadModalStatus.ERROR && (
            <>
              <p className="mb-2">{t('plugins.uploadFailed')}</p>
              <p className="mb-2 text-red-500">{error}</p>
            </>
          )}
        </div>
        <DialogFooter>
          {(status === UploadModalStatus.SUCCESS ||
            status === UploadModalStatus.ERROR) && (
            <Button variant="default" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
