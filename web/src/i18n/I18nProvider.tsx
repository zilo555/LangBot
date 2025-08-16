'use client';

import { ReactNode } from 'react';
import '@/i18n';
import { I18nObject } from '@/app/infra/entities/common';

interface I18nProviderProps {
  children: ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  return <>{children}</>;
}
export function extractI18nObject(i18nLabel: I18nObject): string {
  const language = localStorage.getItem('langbot_language');
  if ((language === 'zh-Hans' && i18nLabel.zh_Hans) || !i18nLabel.en_US) {
    return i18nLabel.zh_Hans;
  }
  return i18nLabel.en_US;
}
