'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { httpClient } from '@/app/infra/http/HttpClient';
import { KnowledgeBase } from '@/app/infra/entities/api';

interface KBDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kbId?: string;
  onFormSubmit: (value: z.infer<any>) => void;
  onFormCancel: () => void;
  onKbDeleted: () => void;
  onNewKbCreated: (kbId: string) => void;
}

export default function KBDetailDialog({
  open,
  onOpenChange,
  kbId: propKbId,
  onFormSubmit,
  onFormCancel,
  onKbDeleted,
  onNewKbCreated,
}: KBDetailDialogProps) {
  const { t } = useTranslation();
  const [kbId, setKbId] = useState<string | undefined>(propKbId);
  const [activeMenu, setActiveMenu] = useState('metadata');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setKbId(propKbId);
    setActiveMenu('metadata');
  }, [propKbId, open]);

  const menu = [
    {
      key: 'metadata',
      label: t('knowledge.metadata'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M5 7C5 6.17157 5.67157 5.5 6.5 5.5C7.32843 5.5 8 6.17157 8 7C8 7.82843 7.32843 8.5 6.5 8.5C5.67157 8.5 5 7.82843 5 7ZM6.5 3.5C4.567 3.5 3 5.067 3 7C3 8.933 4.567 10.5 6.5 10.5C8.433 10.5 10 8.933 10 7C10 5.067 8.433 3.5 6.5 3.5ZM12 8H20V6H12V8ZM16 17C16 16.1716 16.6716 15.5 17.5 15.5C18.3284 15.5 19 16.1716 19 17C19 17.8284 18.3284 18.5 17.5 18.5C16.6716 18.5 16 17.8284 16 17ZM17.5 13.5C15.567 13.5 14 15.067 14 17C14 18.933 15.567 20.5 17.5 20.5C19.433 20.5 21 18.933 21 17C21 15.067 19.433 13.5 17.5 13.5ZM4 16V18H12V16H4Z"></path>
        </svg>
      ),
    },
    {
      key: 'files',
      label: t('knowledge.files'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M21 8V20.9932C21 21.5501 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V2.9918C3 2.45531 3.4487 2 4.00221 2H14.9968L21 8ZM19 9H14V4H5V20H19V9ZM8 7H11V9H8V7ZM8 11H16V13H8V11ZM8 15H16V17H8V15Z"></path>
        </svg>
      ),
    },
  ];

  if (!kbId) {
    // new kb
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 !max-w-[40vw] max-h-[70vh] flex">
          <main className="flex flex-1 flex-col h-[70vh]">
            <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
              <DialogTitle>{t('knowledge.newKb')}</DialogTitle>
            </DialogHeader>
          </main>
        </DialogContent>
      </Dialog>
    );
  }
}
