import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '@/app/infra/http/HttpClient';
import { getCurrentWorkspaceSnapshot } from '@/app/infra/http/currentWorkspaceStore';
import { migrationIssueKey } from './pipeline-migration-issues';
import type { CurrentWorkspace } from '@/app/infra/entities/workspace';
import type {
  PipelineMigrationIssue,
  PipelineMigrationItem,
  PipelineMigrationPreview,
  PipelineMigrationResult,
} from '@/app/infra/entities/api/pipeline-migration';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export function migrationWorkspaceKey(workspace: CurrentWorkspace | null) {
  return workspace
    ? `${workspace.workspace.instance_uuid}:${workspace.workspace.uuid}:${workspace.placement_generation}:${workspace.permissions.join(',')}`
    : '';
}

function safeField(field?: string | null) {
  return field && field.length <= 180 && /^[a-zA-Z0-9_.\-[\]]+$/.test(field)
    ? field
    : null;
}

const resultStates = new Set([
  'pending',
  'migrated',
  'already_current',
  'blocked',
  'stale',
  'failed',
  'activation_pending',
]);
type Status =
  | 'idle'
  | 'submitting'
  | 'running'
  | 'finished'
  | 'failed'
  | 'lost'
  | 'requestError';

export default function PipelineMigration({
  workspace,
  onComplete,
}: {
  workspace: CurrentWorkspace;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const scopeKey = migrationWorkspaceKey(workspace);
  const canManage = workspace.permissions.includes('resource.manage');
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PipelineMigrationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [valid, setValid] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<PipelineMigrationResult[]>([]);
  const active = useRef(false);
  const submitting = useRef(false);
  const previewGeneration = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isCurrent = useCallback(
    () =>
      active.current &&
      migrationWorkspaceKey(getCurrentWorkspaceSnapshot()) === scopeKey,
    [scopeKey],
  );

  const refresh = useCallback(
    async (allowSelection = true) => {
      if (!isCurrent()) return;
      const generation = ++previewGeneration.current;
      setSelected([]);
      setConfirmed(false);
      setValid(false);
      setLoading(true);
      setPreviewError(false);
      try {
        const response = await httpClient.getPipelineMigrationPreview({
          signal: controller.current?.signal,
        });
        if (!isCurrent() || generation !== previewGeneration.current) return;
        if (
          response.workspace_uuid !== workspace.workspace.uuid ||
          !Array.isArray(response.items) ||
          response.total !== response.items.length
        )
          throw new Error('Invalid preview');
        setPreview(response);
        setValid(allowSelection);
      } catch {
        if (isCurrent() && generation === previewGeneration.current) {
          setPreviewError(true);
          setPreview(null);
        }
      } finally {
        if (isCurrent() && generation === previewGeneration.current)
          setLoading(false);
      }
    },
    [isCurrent, workspace.workspace.uuid],
  );

  useEffect(() => {
    active.current = true;
    controller.current = new AbortController();
    void refresh();
    const onFocus = () => {
      if (!submitting.current) void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      active.current = false;
      controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const busy = status === 'submitting' || status === 'running';
  const eligible = (item: PipelineMigrationItem) =>
    ['ready', 'activation_pending'].includes(item.state) &&
    !!item.preview_token;
  const rows = preview?.items ?? [];
  const count = rows.filter(
    (item) => !['already_current', 'not_legacy'].includes(item.state),
  ).length;

  function renderIssue(issue: PipelineMigrationIssue, warning = false) {
    // Unknown server codes use localized fallbacks, never raw upstream messages.
    const key = migrationIssueKey(issue.code);
    const fallback = t(
      warning
        ? 'pipelineMigration.warningFallback'
        : 'pipelineMigration.blockerFallback',
    );
    const message = key
      ? t(`pipelineMigration.notices.${key}`, { defaultValue: fallback })
      : fallback;
    const field = safeField(issue.field);
    return (
      <span>
        {message}
        {field && (
          <>
            {' '}
            — <code className="text-xs">{field}</code>
          </>
        )}
      </span>
    );
  }

  async function execute() {
    if (
      submitting.current ||
      !isCurrent() ||
      !canManage ||
      !valid ||
      loading ||
      !confirmed ||
      selected.length === 0 ||
      selected.length > 50
    )
      return;
    const items = rows
      .filter((item) => selected.includes(item.pipeline_uuid) && eligible(item))
      .map((item) => ({
        pipeline_uuid: item.pipeline_uuid,
        preview_token: item.preview_token!,
      }));
    if (items.length !== selected.length) return;
    submitting.current = true;
    ++previewGeneration.current;
    setStatus('submitting');
    setValid(false);
    setConfirmed(false);
    setResults(
      items.map((item) => ({
        pipeline_uuid: item.pipeline_uuid,
        state: 'pending',
        code: null,
      })),
    );

    const loseObservation = () => {
      if (!isCurrent()) return;
      submitting.current = false;
      setStatus('lost');
      void refresh(false);
      onCompleteRef.current();
    };
    try {
      const { task_id } = await httpClient.executePipelineMigration(
        { confirmed: true, items },
        { signal: controller.current?.signal },
      );
      if (!isCurrent()) return;
      setStatus('running');
      const poll = async () => {
        if (!isCurrent()) return;
        try {
          const task = await httpClient.getAsyncTask(task_id, {
            signal: controller.current?.signal,
          });
          if (!isCurrent()) return;
          const metadata = task.task_context?.metadata;
          if (
            task.id !== task_id ||
            metadata?.kind !== 'pipeline_migration' ||
            !Array.isArray(metadata.results)
          ) {
            loseObservation();
            return;
          }
          const outcome = metadata.results as PipelineMigrationResult[];
          if (
            outcome.some(
              (item) =>
                !item ||
                !resultStates.has(item.state) ||
                !items.some(
                  (submitted) => submitted.pipeline_uuid === item.pipeline_uuid,
                ),
            ) ||
            (task.runtime.done && outcome.length !== items.length) ||
            new Set(outcome.map((item) => item.pipeline_uuid)).size !==
              outcome.length
          ) {
            loseObservation();
            return;
          }
          const scopedResults = items.map(
            (item) =>
              outcome.find(
                (result) => result.pipeline_uuid === item.pipeline_uuid,
              ) ?? {
                pipeline_uuid: item.pipeline_uuid,
                state: 'pending' as const,
                code: null,
              },
          );
          setResults(scopedResults);
          if (task.runtime.done) {
            if (
              !task.runtime.exception &&
              scopedResults.some((item) => item.state === 'pending')
            ) {
              loseObservation();
              return;
            }
            submitting.current = false;
            setStatus(task.runtime.exception ? 'failed' : 'finished');
            void refresh(false);
            onCompleteRef.current();
          } else {
            timer.current = setTimeout(() => {
              void poll();
            }, 1000);
          }
        } catch {
          loseObservation();
        }
      };
      void poll();
    } catch (error) {
      if (!isCurrent()) return;
      const code =
        typeof error === 'object' && error && 'code' in error
          ? error.code
          : undefined;
      if (code === -1 || code === -2 || code === undefined) {
        loseObservation();
        return;
      }
      submitting.current = false;
      setStatus('requestError');
      setSelected([]);
    }
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!submitting.current) {
      setSelected([]);
      setConfirmed(false);
      if (next) void refresh(status === 'idle');
    }
  }

  return (
    <>
      {(count > 0 || previewError || results.length > 0) && (
        <Alert className="mb-4 shrink-0">
          <AlertTitle>{t('pipelineMigration.title')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              {previewError
                ? t('pipelineMigration.previewError')
                : t('pipelineMigration.detected', { count })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeOpen(true)}
            >
              {t('pipelineMigration.review')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('pipelineMigration.title')}</DialogTitle>
            <DialogDescription>
              {t('pipelineMigration.description')}
            </DialogDescription>
          </DialogHeader>
          {!canManage && (
            <Alert>
              <AlertDescription>
                {t('pipelineMigration.readOnly')}
              </AlertDescription>
            </Alert>
          )}
          {previewError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('pipelineMigration.previewError')}
              </AlertDescription>
            </Alert>
          )}
          {status !== 'idle' && (
            <Alert
              variant={
                status === 'failed' || status === 'requestError'
                  ? 'destructive'
                  : 'default'
              }
            >
              <AlertDescription role="status">
                {t(`pipelineMigration.${status}`)}
              </AlertDescription>
            </Alert>
          )}
          <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 pr-3">
              {rows.map((item) => (
                <div
                  key={item.pipeline_uuid}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      aria-label={item.name}
                      checked={selected.includes(item.pipeline_uuid)}
                      disabled={
                        !canManage ||
                        busy ||
                        loading ||
                        !valid ||
                        !eligible(item) ||
                        (selected.length >= 50 &&
                          !selected.includes(item.pipeline_uuid))
                      }
                      onCheckedChange={(checked) => {
                        setConfirmed(false);
                        setSelected((current) =>
                          checked
                            ? [...current, item.pipeline_uuid]
                            : current.filter((id) => id !== item.pipeline_uuid),
                        );
                      }}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-sm break-words">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {item.legacy_runner ?? '—'} →{' '}
                        {item.target_plugin?.name ?? '—'}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {t(`pipelineMigration.states.${item.state}`)}
                    </Badge>
                  </div>
                  {item.blockers.map((issue, index) => (
                    <p className="text-sm text-destructive" key={`b-${index}`}>
                      {renderIssue(issue)}
                    </p>
                  ))}
                  {item.warnings.map((issue, index) => (
                    <p
                      className="text-sm text-muted-foreground"
                      key={`w-${index}`}
                    >
                      {renderIssue(issue, true)}
                    </p>
                  ))}
                  {item.changed_paths.filter((path) => safeField(path)).length >
                    0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('pipelineMigration.changedFields')}:{' '}
                      {item.changed_paths
                        .filter((path) => safeField(path))
                        .join(', ')}
                    </p>
                  )}
                  {item.state === 'activation_pending' && (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        item.preview_token
                          ? 'pipelineMigration.activationRetryHint'
                          : 'pipelineMigration.activationHint',
                      )}
                    </p>
                  )}
                </div>
              ))}
              {rows.some((item) => item.state === 'needs_plugin') && (
                <Alert>
                  <AlertDescription className="space-y-2">
                    <p>{t('pipelineMigration.pluginHint')}</p>
                    <Button variant="link" asChild className="h-auto p-0">
                      <a
                        href="/home/extensions"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('pipelineMigration.extensions')}
                      </a>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {results.length > 0 && (
                <div
                  className="space-y-2"
                  aria-label={t('pipelineMigration.results')}
                >
                  <h3 className="text-sm font-medium">
                    {t('pipelineMigration.results')}
                  </h3>
                  {results.map((result) => (
                    <div
                      className="rounded-md border p-3 text-sm"
                      key={result.pipeline_uuid}
                      data-testid={`migration-result-${result.pipeline_uuid}`}
                    >
                      <p>
                        {rows.find(
                          (item) => item.pipeline_uuid === result.pipeline_uuid,
                        )?.name ?? result.pipeline_uuid}{' '}
                        — {t(`pipelineMigration.states.${result.state}`)}
                      </p>
                      {result.code && (
                        <p className="text-muted-foreground">
                          {renderIssue({ code: result.code })}
                        </p>
                      )}
                      {result.state === 'activation_pending' && (
                        <p>{t('pipelineMigration.activationHint')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {t('pipelineMigration.selection', { count: selected.length })}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={
                !canManage || busy || loading || !valid || !selected.length
              }
            />
            {t('pipelineMigration.confirm')}
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => changeOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              disabled={busy || loading}
              onClick={() => {
                setStatus('idle');
                void refresh();
              }}
            >
              {t('pipelineMigration.refresh')}
            </Button>
            <Button
              disabled={
                !canManage ||
                busy ||
                loading ||
                !valid ||
                !selected.length ||
                !confirmed
              }
              onClick={() => {
                void execute();
              }}
            >
              {t('pipelineMigration.execute')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
