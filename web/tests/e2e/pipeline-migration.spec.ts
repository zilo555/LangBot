import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

const canonicalConfig = JSON.parse(
  readFileSync('../src/langbot/templates/default-pipeline-config.json', 'utf8'),
);
import type {
  PipelineMigrationItem,
  PipelineMigrationResult,
  PipelineMigrationState,
} from '../../src/app/infra/entities/api/pipeline-migration';
import {
  installLangBotApiMocks,
  makeWorkspaceEntry,
} from './fixtures/langbot-api';

const root = '/api/v1/pipelines/_/migration';
const runner = 'plugin:langbot-team/DifyAgent/default';
const row = (
  pipeline_uuid: string,
  state: PipelineMigrationState = 'ready',
): PipelineMigrationItem => ({
  pipeline_uuid,
  name: `Legacy ${pipeline_uuid}`,
  state,
  legacy_runner: 'dify-service-api',
  target_runner_id: runner,
  target_plugin: {
    author: 'langbot-team',
    name: 'DifyAgent',
    version: '1.0.0',
  },
  changed_paths: ['ai.runner.id'],
  blockers: [],
  warnings: [],
  preview_token: state === 'ready' ? `token-${pipeline_uuid}` : null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({ json: { code: 0, data } });

async function setup(
  page: Page,
  options: { viewer?: boolean; current?: boolean; cloud?: boolean } = {},
) {
  const workspace = makeWorkspaceEntry(
    'workspace-playwright',
    'Migration workspace',
    options.cloud ? 'cloud_projection' : 'local',
  );
  if (options.viewer)
    workspace.permissions = ['resource.view', 'workspace.view'];
  await installLangBotApiMocks(page, {
    authenticated: true,
    workspaces: [workspace],
  });
  await page.routeWebSocket('**/api/v1/pipelines/**/ws/connect**', (ws) => {
    ws.onMessage((raw) => {
      if (JSON.parse(String(raw)).type === 'authenticate')
        ws.send(
          JSON.stringify({
            type: 'connected',
            connection_id: 'migration-test',
            session_type: 'person',
          }),
        );
    });
  });
  const state = {
    items: [row('one'), row('two')],
    posts: [] as unknown[],
    writes: [] as unknown[],
    previews: 0,
    polls: 0,
    metadataReads: 0,
    pipelineReads: 0,
    executeStatus: 200,
    pollLost: false,
    done: true,
    taskException: false,
    results: [
      { pipeline_uuid: 'one', state: 'migrated', code: null },
    ] as PipelineMigrationResult[],
    holdExecute: null as Promise<void> | null,
    holdPreview: null as Promise<void> | null,
    holdPoll: null as Promise<void> | null,
  };
  let config = options.current
    ? {
        ai: {
          runner: { id: 'plugin:langbot-team/LocalAgent/default' },
          runner_config: {},
        },
      }
    : {
        ai: {
          runner: { runner: 'dify-service-api' },
          'dify-service-api': { 'api-key': 'fixture-not-a-secret' },
        },
      };
  await page.route(`**${root}/preview`, async (route) => {
    state.previews++;
    const items = structuredClone(state.items);
    const scope =
      route.request().headers()['x-workspace-id'] || 'workspace-playwright';
    if (state.holdPreview) await state.holdPreview;
    await reply(route, {
      planner_version: '1',
      workspace_uuid: scope,
      items,
      total: items.length,
    });
  });
  await page.route(`**${root}/execute`, async (route) => {
    state.posts.push(route.request().postDataJSON());
    if (state.holdExecute) await state.holdExecute;
    if (state.executeStatus !== 200)
      return route.fulfill({
        status: state.executeStatus,
        json: { code: state.executeStatus, msg: 'unsafe-upstream-secret' },
      });
    await reply(route, { task_id: 411 });
  });
  await page.route('**/api/v1/system/tasks/411', async (route) => {
    state.polls++;
    if (state.holdPoll) await state.holdPoll;
    if (state.pollLost)
      return route.fulfill({ status: 404, json: { code: 404 } });
    if (
      state.done &&
      state.results.some(
        (item) => item.pipeline_uuid === 'one' && item.state === 'migrated',
      )
    ) {
      config = {
        ai: {
          runner: { id: 'plugin:langbot-team/LocalAgent/default' },
          runner_config: {},
        },
      };
    }
    await reply(route, {
      id: 411,
      runtime: {
        done: state.done,
        exception: state.taskException ? 'unsafe-upstream-secret' : null,
      },
      task_context: {
        metadata: { kind: 'pipeline_migration', results: state.results },
      },
    });
  });
  await page.route('**/api/v1/pipelines/one', async (route) => {
    if (route.request().method() !== 'GET')
      state.writes.push(route.request().postDataJSON());
    state.pipelineReads++;
    await reply(route, {
      pipeline: {
        uuid: 'one',
        name: 'Legacy one',
        description: 'Preserved metadata',
        emoji: '⚙️',
        config,
        is_default: false,
      },
    });
  });
  await page.route('**/api/v1/pipelines/_/metadata', async (route) => {
    state.metadataReads++;
    await route.fallback();
  });
  return state;
}

async function open(page: Page, detail = false) {
  await page.goto(`/home/pipelines${detail ? '?id=one' : ''}`);
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  return page.getByRole('dialog', { name: 'Pipeline migration' });
}
async function selectAndConfirm(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Pipeline migration' });
  await dialog
    .getByRole('checkbox', { name: 'Legacy one', exact: true })
    .check();
  await dialog
    .getByRole('checkbox', {
      name: 'I confirm migration of the selected pipelines.',
    })
    .check();
  return dialog.getByRole('button', { name: 'Migrate selected', exact: true });
}

test('opening, refreshing and cancelling never execute; selection starts empty', async ({
  page,
}) => {
  const state = await setup(page);
  const dialog = await open(page);
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Refresh preview' }).click();
  await expect.poll(() => state.previews).toBeGreaterThan(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  expect(state.posts).toEqual([]);
  await page.screenshot({ path: 'test-results/pipeline-migration-review.png' });
});

test('explicit selection plus confirmation sends only IDs/tokens and suppresses double submit', async ({
  page,
}) => {
  const state = await setup(page);
  let release!: () => void;
  state.holdExecute = new Promise((resolve) => {
    release = resolve;
  });
  const dialog = await open(page);
  await dialog
    .getByRole('checkbox', { name: 'Legacy one', exact: true })
    .check();
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('checkbox', {
      name: 'I confirm migration of the selected pipelines.',
    })
    .check();
  await dialog
    .getByRole('button', { name: 'Migrate selected', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect.poll(() => state.posts.length).toBe(1);
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
  expect(state.posts).toEqual([
    {
      confirmed: true,
      items: [{ pipeline_uuid: 'one', preview_token: 'token-one' }],
    },
  ]);
  release();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Migrated',
  );
});

test('view-only workspace can inspect but cannot select or execute', async ({
  page,
}) => {
  const state = await setup(page, { viewer: true, cloud: true });
  const dialog = await open(page);
  await expect(
    dialog.getByText('Only workspace managers can migrate pipelines.'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
  expect(state.posts).toEqual([]);
});

test('missing plugins and blocked rows stay unselectable; existing Extensions flow and safe fields', async ({
  page,
}) => {
  const state = await setup(page);
  state.items = [
    row('one', 'needs_plugin'),
    {
      ...row('two', 'blocked'),
      blockers: [
        { code: 'unsupported_field', field: 'ai.local-agent.max-round' },
      ],
    },
  ];
  const dialog = await open(page);
  for (const name of ['Legacy one', 'Legacy two'])
    await expect(
      dialog.getByRole('checkbox', { name, exact: true }),
    ).toBeDisabled();
  await expect(dialog.getByText('ai.local-agent.max-round')).toBeVisible();
  await expect(dialog.getByText(/quota/)).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Open Extensions' }),
  ).toHaveAttribute('href', '/home/extensions');
  await expect(dialog).not.toContainText('fixture-not-a-secret');
  state.items = [row('one')];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).toBeEnabled();
  expect(state.posts).toEqual([]);
});

test('stale execute requires a fresh preview and new explicit selection', async ({
  page,
}) => {
  const state = await setup(page);
  state.executeStatus = 409;
  const dialog = await open(page);
  await (await selectAndConfirm(page)).click();
  await expect(
    dialog.getByText(
      'Request not completed. Refresh the preview before selecting again.',
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
  await expect(dialog).not.toContainText('unsafe-upstream-secret');
  await dialog.getByRole('button', { name: 'Refresh preview' }).click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  expect(state.posts).toHaveLength(1);
});

test('partial task results are shown per row without a global success claim', async ({
  page,
}) => {
  const state = await setup(page, { cloud: true });
  state.results = [
    { pipeline_uuid: 'one', state: 'migrated', code: null },
    {
      pipeline_uuid: 'two',
      state: 'failed',
      code: 'runtime_unavailable',
    },
  ];
  const dialog = await open(page);
  const submit = await selectAndConfirm(page);
  await dialog
    .getByRole('checkbox', { name: 'Legacy two', exact: true })
    .check();
  await expect(submit).toBeDisabled();
  await dialog
    .getByRole('checkbox', {
      name: 'I confirm migration of the selected pipelines.',
    })
    .check();
  await submit.click();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Migrated',
  );
  await expect(dialog.getByTestId('migration-result-two')).toContainText(
    'Failed',
  );
  await expect(
    dialog.getByText('Task finished. Check each pipeline result below.'),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/pipeline-migration-partial.png',
  });
});

test('task failure stays distinct from polling loss and never displays raw exceptions', async ({
  page,
}) => {
  const state = await setup(page);
  state.taskException = true;
  state.results = [{ pipeline_uuid: 'one', state: 'failed', code: null }];
  const dialog = await open(page);
  await (await selectAndConfirm(page)).click();
  await expect(
    dialog.getByText('Task failed. Check each pipeline result below.'),
  ).toBeVisible();
  await expect(dialog).not.toContainText('unsafe-upstream-secret');
});

test('lost polling is observation lost, refreshes read-only preview and never retries execute', async ({
  page,
}) => {
  const state = await setup(page);
  state.pollLost = true;
  const dialog = await open(page);
  const before = state.previews;
  await (await selectAndConfirm(page)).click();
  await expect(
    dialog.getByText(
      'Task observation lost. Its outcome is unknown; refresh the preview before any further action.',
    ),
  ).toBeVisible();
  await expect.poll(() => state.previews).toBeGreaterThan(before);
  expect(state.posts).toHaveLength(1);
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
});

test('legacy detail never mounts editable runner defaults or debug autosave, metadata stays available', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/home/pipelines?id=one');
  await expect(
    page.getByText(
      'Legacy configuration is read-only until migration. Save and debug are unavailable to prevent implicit conversion.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Preserved metadata')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'AI', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.posts).toEqual([]);
});

test('completion reloads detail and runner metadata; current pipeline keeps normal editor', async ({
  page,
}) => {
  const state = await setup(page);
  const dialog = await open(page, true);
  const before = state.pipelineReads;
  await (await selectAndConfirm(page)).click();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Migrated',
  );
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('tab', { name: 'AI', exact: true }),
  ).toBeVisible();
  await expect.poll(() => state.pipelineReads).toBeGreaterThan(before);
  await expect.poll(() => state.metadataReads).toBeGreaterThan(0);
  expect(state.writes).toEqual([]);
});

test('workspace change resets selection and ignores an old polling response', async ({
  page,
}) => {
  const state = await setup(page);
  let release!: () => void;
  state.holdPoll = new Promise((resolve) => {
    release = resolve;
  });
  await open(page);
  await (await selectAndConfirm(page)).click();
  await expect.poll(() => state.polls).toBe(1);
  await page.evaluate(async () => {
    const path = '/src/app/infra/http/currentWorkspaceStore.ts';
    const store = await import(path);
    const old = store.getCurrentWorkspaceSnapshot();
    store.setCurrentWorkspaceSnapshot({ ...old, placement_generation: 2 });
  });
  await expect(
    page.getByRole('dialog', { name: 'Pipeline migration' }),
  ).toHaveCount(0);
  release();
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Pipeline migration' });
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  await expect(dialog.getByTestId('migration-result-one')).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
});

test('at most fifty rows can be selected in the bounded dialog', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const state = await setup(page);
  state.items = Array.from({ length: 51 }, (_, index) => row(String(index)));
  const dialog = await open(page);
  for (let index = 0; index < 50; index++)
    await dialog
      .getByRole('checkbox', { name: `Legacy ${index}`, exact: true })
      .check();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy 50', exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByText('50 selected (maximum 50)')).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  expect(state.posts).toEqual([]);
});

test('all non-ready preview states are unselectable and activation is not reported as migrated', async ({
  page,
}) => {
  const state = await setup(page);
  state.items = [
    row('one'),
    row('two', 'activation_pending'),
    row('three', 'already_current'),
    row('four', 'not_legacy'),
  ];
  state.results = [
    { pipeline_uuid: 'one', state: 'activation_pending', code: null },
  ];
  const dialog = await open(page);
  for (const name of ['Legacy two', 'Legacy three', 'Legacy four'])
    await expect(
      dialog.getByRole('checkbox', { name, exact: true }),
    ).toBeDisabled();
  await (await selectAndConfirm(page)).click();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Activation pending',
  );
  await expect(dialog.getByTestId('migration-result-one')).not.toContainText(
    'Migrated',
  );
});

test('stale per-item result requires refreshed selection, never silently retries', async ({
  page,
}) => {
  const state = await setup(page);
  state.results = [
    { pipeline_uuid: 'one', state: 'stale', code: 'stale_preview' },
  ];
  const dialog = await open(page);
  await (await selectAndConfirm(page)).click();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Stale preview',
  );
  await expect(
    dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Refresh preview' }).click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  expect(state.posts).toHaveLength(1);
});

test('late preview from a previous workspace cannot populate the new workspace', async ({
  page,
}) => {
  const state = await setup(page);
  const dialog = await open(page);
  let release!: () => void;
  state.holdPreview = new Promise((resolve) => {
    release = resolve;
  });
  const before = state.previews;
  await dialog.getByRole('button', { name: 'Refresh preview' }).click();
  await expect.poll(() => state.previews).toBeGreaterThan(before);
  state.items = [row('other')];
  state.holdPreview = null;
  await page.evaluate(async () => {
    const storePath = '/src/app/infra/http/currentWorkspaceStore.ts';
    const contextPath = '/src/app/infra/http/workspaceContext.ts';
    const store = await import(storePath);
    const context = await import(contextPath);
    const old = store.getCurrentWorkspaceSnapshot();
    context.setActiveWorkspaceUuid('workspace-other');
    store.setCurrentWorkspaceSnapshot({
      ...old,
      workspace: { ...old.workspace, uuid: 'workspace-other' },
    });
  });
  release();
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy other', exact: true }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).toHaveCount(0);
  expect(state.posts).toEqual([]);
});

test('late execute admission after a workspace switch never polls in the new scope', async ({
  page,
}) => {
  const state = await setup(page);
  let release!: () => void;
  state.holdExecute = new Promise((resolve) => {
    release = resolve;
  });
  await open(page);
  await (await selectAndConfirm(page)).click();
  await expect.poll(() => state.posts.length).toBe(1);
  await page.evaluate(async () => {
    const path = '/src/app/infra/http/currentWorkspaceStore.ts';
    const store = await import(path);
    const old = store.getCurrentWorkspaceSnapshot();
    store.setCurrentWorkspaceSnapshot({ ...old, placement_generation: 2 });
  });
  release();
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  await expect(
    page.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  expect(state.polls).toBe(0);
});

test('network loss during execute is an unknown outcome with read-only refresh', async ({
  page,
}) => {
  const state = await setup(page);
  await page.route(`**${root}/execute`, (route) => {
    state.posts.push(route.request().postDataJSON());
    return route.abort('connectionreset');
  });
  const dialog = await open(page);
  const before = state.previews;
  await (await selectAndConfirm(page)).click();
  await expect(
    dialog.getByText(
      'Task observation lost. Its outcome is unknown; refresh the preview before any further action.',
    ),
  ).toBeVisible();
  await expect.poll(() => state.previews).toBeGreaterThan(before);
  expect(state.posts).toHaveLength(1);
});

test('legacy data returned on the editor second read cannot hydrate defaults or autosave', async ({
  page,
}) => {
  const state = await setup(page, { current: true });
  let reads = 0;
  await page.route('**/api/v1/pipelines/one', async (route) => {
    if (route.request().method() !== 'GET')
      state.writes.push(route.request().postDataJSON());
    reads++;
    await reply(route, {
      pipeline: {
        uuid: 'one',
        name: 'Legacy one',
        description: '',
        emoji: '⚙️',
        config:
          reads <= 2
            ? {
                ai: {
                  runner: { id: 'plugin:langbot-team/LocalAgent/default' },
                },
              }
            : { ai: { runner: { runner: 'local-agent' } } },
      },
    });
  });
  await page.goto('/home/pipelines?id=one');
  await expect(
    page.getByText(
      'Legacy configuration is read-only until migration. Save and debug are unavailable to prevent implicit conversion.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'AI', exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});

async function actualAgentRoute(page: Page) {
  const state = await setup(page);
  const agent = {
    uuid: 'one',
    name: 'Legacy one',
    description: 'Preserved metadata',
    emoji: '⚙️',
    kind: 'pipeline',
    config: canonicalConfig,
  };
  let listReads = 0;
  await page.route('**/api/v1/agents', async (route) => {
    listReads++;
    await reply(route, { agents: [agent] });
  });
  await page.route('**/api/v1/agents/one', (route) => reply(route, { agent }));
  return { state, listReads: () => listReads };
}

async function clickSidebarPipeline(page: Page) {
  const sidebar = page.locator('[data-slot="sidebar"]');
  const entry = sidebar.getByText('Legacy one', { exact: true });
  if (!(await entry.isVisible())) {
    await sidebar.getByText('Processors', { exact: true }).click();
  }
  await entry.click();
  await expect(page).toHaveURL(/\/home\/agents\?id=one$/);
}

test('SPEC sidebar navigation discovers migration and completion refreshes the actual detail', async ({
  page,
}) => {
  const { state, listReads } = await actualAgentRoute(page);
  await page.goto('/home');
  await clickSidebarPipeline(page);
  await expect(
    page.getByText(
      'Legacy configuration is read-only until migration. Save and debug are unavailable to prevent implicit conversion.',
    ),
  ).toBeVisible();
  const review = page.getByRole('button', {
    name: 'Review migration',
    exact: true,
  });
  await expect(review).toHaveCount(1);
  await review.click();
  const dialog = page.getByRole('dialog', { name: 'Pipeline migration' });
  const before = listReads();
  await (await selectAndConfirm(page)).click();
  await expect(
    dialog.getByText('Task finished. Check each pipeline result below.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('tab', { name: 'AI', exact: true }),
  ).toBeVisible();
  await expect.poll(listReads).toBeGreaterThan(before);
  expect(state.polls).toBe(1);
  expect(state.posts).toHaveLength(1);
});

test('SPEC agents list exposes one assistant that survives list to detail navigation', async ({
  page,
}) => {
  const { state } = await actualAgentRoute(page);
  await page.goto('/home/agents');
  const review = page.getByRole('button', {
    name: 'Review migration',
    exact: true,
  });
  await expect(review).toHaveCount(1);
  await review.click();
  await (await selectAndConfirm(page)).click();
  const dialog = page.getByRole('dialog', { name: 'Pipeline migration' });
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Migrated',
  );
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await clickSidebarPipeline(page);
  await review.click();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Migrated',
  );
  expect(state.polls).toBe(1);
  expect(state.posts).toHaveLength(1);
});

test('SPEC canonical empty current detail allows selecting and saving a runner', async ({
  page,
}) => {
  const { state } = await actualAgentRoute(page);
  await page.route('**/api/v1/pipelines/one', async (route) => {
    if (route.request().method() !== 'GET')
      state.writes.push(route.request().postDataJSON());
    await reply(route, {
      pipeline: {
        uuid: 'one',
        name: 'Legacy one',
        description: 'Preserved metadata',
        emoji: '⚙️',
        config: canonicalConfig,
        is_default: false,
      },
    });
  });
  await page.goto('/home/agents?id=one');
  await expect(
    page.getByRole('tab', { name: 'AI', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  const selector = page.getByRole('combobox', { name: 'Runner', exact: true });
  await selector.click();
  await page.getByRole('option', { name: /Local Agent/ }).click();
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect
    .poll(() => state.writes)
    .toMatchObject([
      {
        config: {
          ai: {
            runner: { id: 'plugin:langbot-team/LocalAgent/default' },
          },
        },
      },
    ]);
  expect(state.posts).toEqual([]);
});

test('SPEC actual legacy on second read remains guarded on the sidebar route', async ({
  page,
}) => {
  const { state } = await actualAgentRoute(page);
  let reads = 0;
  await page.route('**/api/v1/pipelines/one', async (route) => {
    if (route.request().method() !== 'GET')
      state.writes.push(route.request().postDataJSON());
    reads++;
    await reply(route, {
      pipeline: {
        uuid: 'one',
        name: 'Legacy one',
        description: 'Preserved metadata',
        emoji: '⚙️',
        config:
          reads === 1
            ? canonicalConfig
            : { ai: { runner: { runner: 'local-agent' } } },
      },
    });
  });
  await page.goto('/home');
  await clickSidebarPipeline(page);
  await expect.poll(() => reads).toBeGreaterThan(1);
  await expect(
    page.getByText(
      'Legacy configuration is read-only until migration. Save and debug are unavailable to prevent implicit conversion.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'AI', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

for (const defect of [
  'extra',
  'wrong-result',
  'missing',
  'duplicate',
  'wrong-task',
  'wrong-kind',
  'missing-failed',
  'extra-running',
] as const) {
  test(`SPEC task identity mismatch ${defect} loses observation without subset success or retry`, async ({
    page,
  }) => {
    const state = await setup(page);
    const migrated = { pipeline_uuid: 'one', state: 'migrated', code: null };
    const outcomes =
      defect === 'missing' || defect === 'missing-failed'
        ? []
        : defect === 'wrong-result'
          ? [{ ...migrated, pipeline_uuid: 'other' }]
          : defect === 'duplicate'
            ? [migrated, migrated]
            : defect === 'extra' || defect === 'extra-running'
              ? [
                  migrated,
                  { ...migrated, pipeline_uuid: 'other', state: 'failed' },
                ]
              : [migrated];
    await page.route('**/api/v1/system/tasks/411', async (route) => {
      state.polls++;
      await reply(route, {
        id: defect === 'wrong-task' ? 999 : 411,
        runtime: {
          done: defect !== 'extra-running',
          exception: defect === 'missing-failed' ? 'failure' : null,
        },
        task_context: {
          metadata: {
            kind:
              defect === 'wrong-kind' ? 'plugin_install' : 'pipeline_migration',
            results: outcomes,
          },
        },
      });
    });
    const dialog = await open(page);
    await (await selectAndConfirm(page)).click();
    await expect(
      dialog.getByText(
        'Task observation lost. Its outcome is unknown; refresh the preview before any further action.',
      ),
    ).toBeVisible();
    await expect(
      dialog.getByText('Task finished. Check each pipeline result below.'),
    ).toHaveCount(0);
    await expect(dialog.getByTestId('migration-result-one')).not.toContainText(
      'Migrated',
    );
    await expect(
      dialog.getByRole('button', { name: 'Migrate selected', exact: true }),
    ).toBeDisabled();
    await page.waitForTimeout(1100);
    expect(state.posts).toHaveLength(1);
    expect(state.polls).toBe(1);
  });
}

test('SPEC actual agents workspace change discards old polling and selection', async ({
  page,
}) => {
  const { state } = await actualAgentRoute(page);
  let release!: () => void;
  state.holdPoll = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto('/home/agents');
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  await (await selectAndConfirm(page)).click();
  await expect.poll(() => state.polls).toBe(1);
  await page.evaluate(async () => {
    const path = '/src/app/infra/http/currentWorkspaceStore.ts';
    const store = await import(path);
    const old = store.getCurrentWorkspaceSnapshot();
    store.setCurrentWorkspaceSnapshot({ ...old, placement_generation: 2 });
  });
  const dialog = page.getByRole('dialog', { name: 'Pipeline migration' });
  await expect(dialog).toHaveCount(0);
  release();
  await page
    .getByRole('button', { name: 'Review migration', exact: true })
    .click();
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).not.toBeChecked();
  await expect(dialog.getByTestId('migration-result-one')).toHaveCount(0);
  await page.waitForTimeout(1100);
  expect(state.polls).toBe(1);
  expect(state.posts).toHaveLength(1);
});

test('completion specific migration warnings explain changed defaults without upstream text', async ({
  page,
}) => {
  const state = await setup(page);
  state.items[0].warnings = [
    { code: 'local.context_defaults', field: 'ai.local-agent.max-round' },
    { code: 'dify.timeout_default' },
    { code: 'secret-upstream-text' },
  ];
  const dialog = await open(page);
  await expect(dialog).toContainText(
    'new context budget and summarization defaults',
  );
  await expect(dialog).toContainText('30-second request timeout');
  await expect(dialog).toContainText('Review this setting before migration.');
  await expect(dialog).not.toContainText('secret-upstream-text');
  expect(state.posts).toHaveLength(0);
});

test('completion activation retry requires a fresh token, selection and explicit confirmation', async ({
  page,
}) => {
  const state = await setup(page);
  state.items = [
    { ...row('one', 'activation_pending'), preview_token: 'activation-one' },
  ];
  const dialog = await open(page);
  expect(state.posts).toHaveLength(0);
  await expect(
    dialog.getByRole('checkbox', { name: 'Legacy one', exact: true }),
  ).toBeEnabled();
  const submit = await selectAndConfirm(page);
  await submit.click();
  await expect(dialog.getByTestId('migration-result-one')).toContainText(
    'Migrated',
  );
  expect(state.posts).toEqual([
    {
      confirmed: true,
      items: [{ pipeline_uuid: 'one', preview_token: 'activation-one' }],
    },
  ]);
  await page.waitForTimeout(1100);
  expect(state.posts).toHaveLength(1);
  expect(state.writes).toHaveLength(0);
});

for (const [language, title, review] of [
  ['zh-Hans', '流水线迁移', '检查迁移'],
  ['ja-JP', 'パイプライン移行', '移行を確認'],
]) {
  test(`localized migration dialog (${language})`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(
      (locale) => localStorage.setItem('langbot_language', locale),
      language,
    );
    await page.goto('/home/pipelines');
    await page.getByRole('button', { name: review, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText('pipelineMigration.');
    await expect(dialog).not.toContainText('Migrate selected');
    await page.screenshot({
      path: `test-results/pipeline-migration-${language}.png`,
    });
  });
}
