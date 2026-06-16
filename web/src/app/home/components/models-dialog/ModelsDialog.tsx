import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import ModelsPanel from './ModelsPanel';

interface ModelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Standalone Models dialog. The unified Settings dialog renders <ModelsPanel />
// directly; this wrapper is kept for places that open Models on its own
// (e.g. the model picker inside dynamic forms).
export default function ModelsDialog({
  open,
  onOpenChange,
}: ModelsDialogProps) {
  const { t } = useTranslation();
  const [blocking, setBlocking] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && blocking) return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="overflow-hidden p-0 h-[80vh] flex flex-col !max-w-[37rem]">
        <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
          <DialogTitle>{t('models.title')}</DialogTitle>
        </DialogHeader>
        <ModelsPanel active={open} onBlockingChange={setBlocking} />
      </DialogContent>
    </Dialog>
  );
}
