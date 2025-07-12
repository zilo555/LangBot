'use client';

import { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

export type DocumentFile = {
  id: string;
  name: string;
  status: string;
};

export const columns = (): ColumnDef<DocumentFile>[] => {
  const { t } = useTranslation();
  return [
    {
      accessorKey: 'name',
      header: t('knowledge.documentsTab.name'),
    },
    {
      accessorKey: 'status',
      header: t('knowledge.documentsTab.status'),
    },
  ];
};
