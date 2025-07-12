'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';

export type DocumentFile = {
  id: string;
  name: string;
  status: string;
};

export const columns = (
  onDelete: (id: string) => void,
): ColumnDef<DocumentFile>[] => {
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
    {
      id: 'actions',
      cell: ({ row }) => {
        const document = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">
                  {t('knowledge.documentsTab.actions')}
                </span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {t('knowledge.documentsTab.actions')}
              </DropdownMenuLabel>

              <DropdownMenuItem onClick={() => onDelete(document.id)}>
                {t('knowledge.documentsTab.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};
