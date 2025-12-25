'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { httpClient } from '@/app/infra/http/HttpClient';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import langbotIcon from '@/app/assets/langbot-logo.webp';

export default function SpaceOAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleOAuthCallback = useCallback(
    async (code: string) => {
      try {
        const response = await httpClient.exchangeSpaceOAuthCode(code);

        // Store token and user info
        localStorage.setItem('token', response.token);
        if (response.user) {
          localStorage.setItem('userEmail', response.user);
        }

        setStatus('success');
        toast.success(t('common.spaceLoginSuccess'));

        // Redirect to home after a brief delay to show success state
        setTimeout(() => {
          router.push('/home');
        }, 1000);
      } catch {
        setStatus('error');
        setErrorMessage(t('common.spaceLoginFailed'));
      }
    },
    [router, t],
  );

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(
        errorDescription || error || t('common.spaceLoginFailed'),
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage(t('common.spaceLoginNoCode'));
      return;
    }

    // Exchange code for token
    handleOAuthCallback(code);
  }, [searchParams, handleOAuthCallback, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900">
      <Card className="w-[375px] shadow-lg dark:shadow-white/10">
        <CardHeader className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={langbotIcon.src}
            alt="LangBot"
            className="w-16 h-16 mb-4 mx-auto"
          />
          <CardTitle className="text-xl">
            {status === 'loading' && t('common.spaceLoginProcessing')}
            {status === 'success' && t('common.spaceLoginSuccess')}
            {status === 'error' && t('common.spaceLoginError')}
          </CardTitle>
          <CardDescription>
            {status === 'loading' &&
              t('common.spaceLoginProcessingDescription')}
            {status === 'success' && t('common.spaceLoginSuccessDescription')}
            {status === 'error' && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'loading' && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          {status === 'error' && (
            <>
              <AlertCircle className="h-12 w-12 text-red-500" />
              <Button
                onClick={() => router.push('/login')}
                className="w-full mt-4"
              >
                {t('common.backToLogin')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
