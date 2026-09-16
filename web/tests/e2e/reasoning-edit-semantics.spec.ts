import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const contract = JSON.parse(
  readFileSync('tests/e2e/fixtures/runner-migration-contract.json', 'utf8'),
);
import { installLangBotApiMocks } from './fixtures/langbot-api';
const canonical = JSON.parse(
  readFileSync('../src/langbot/templates/default-pipeline-config.json', 'utf8'),
);
const outputSchema = contract.output_schema;
async function setup(
  page: Page,
  plugin = 'weknora-agent',
  name = 'WeKnoraAgent',
  agentId: null | 'absent' = null,
  converted?: typeof canonical,
) {
  const schema = contract.plugins[plugin].component;
  const id = `plugin:langbot-team/${name}/default`;
  const raw: Record<string, unknown> = {
    'api-key': '  fixture credential  ',
    'base-url': '  http://localhost:8080/api/v1  ',
    'app-type': 'agent',
    'enable-all-tools': false,
    tools: ['tool-allowed'],
    'knowledge-bases': ['kb-allowed'],
    'mcp-resources': [{ server: 'private', uri: 'secret' }],
    'mcp-resource-agent-read-enabled': false,
  };
  if (agentId === null) raw['agent-id'] = null;
  if (plugin === 'LocalAgent') {
    raw['advanced-settings'] = true;
    raw.model = {
      primary: 'llm-valid',
      fallbacks: ['llm-fallback'],
      reasoning: { 'llm-valid': 'high', 'llm-fallback': 'low' },
    };
    raw['remove-think'] = true;
  }
  let config = {
    ...structuredClone(canonical),
    ai: { runner: { id }, runner_config: { [id]: raw } },
  };
  if (converted) config = structuredClone(converted);
  else config.output.misc['remove-think'] = false; // Deliberate disagreement must not synchronize on mount.
  const writes: any[] = [];
  await installLangBotApiMocks(page, { authenticated: true });
  await page.routeWebSocket('**/api/v1/pipelines/**/ws/connect**', (ws) => {
    ws.onMessage((raw) => {
      if (JSON.parse(String(raw)).type === 'authenticate')
        ws.send(
          JSON.stringify({
            type: 'connected',
            connection_id: 'fixture',
            session_type: 'person',
          }),
        );
    });
  });
  await page.route('**/api/v1/pipelines/preserve', async (route) => {
    if (route.request().method() !== 'GET') {
      const body = route.request().postDataJSON();
      writes.push(body);
      if (body.config) config = body.config;
    }
    await route.fulfill({
      json: {
        code: 0,
        data: {
          pipeline: {
            uuid: 'preserve',
            name: 'Preservation',
            description: '',
            emoji: '⚙️',
            config,
          },
        },
      },
    });
  });
  await page.route('**/api/v1/pipelines/_/metadata', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          configs: [
            {
              name: 'ai',
              label: { en_US: 'AI' },
              stages: [
                {
                  name: 'runner',
                  label: { en_US: 'Runner' },
                  config: contract.ai_schema.stages[0].config.map(
                    (field: Record<string, unknown>) =>
                      field.name === 'id'
                        ? {
                            ...field,
                            default: id,
                            options: [
                              { name: id, label: schema.metadata.label },
                            ],
                          }
                        : field,
                  ),
                },
                {
                  name: id,
                  label: schema.metadata.label,
                  config: schema.spec.config,
                },
              ],
            },
            outputSchema,
          ],
        },
      },
    }),
  );
  await page.route('**/api/v1/provider/models/llm', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          models: ['llm-valid', 'llm-fallback'].map((uuid) => ({
            uuid,
            name: uuid,
            provider_uuid: 'provider-valid',
            provider: { uuid: 'provider-valid', name: 'Mock Provider' },
            reasoning: { level: 'high' },
            reasoning_capabilities: {
              levels: ['provider_default', 'low', 'high'],
            },
          })),
        },
      },
    }),
  );
  await page.goto('/home/pipelines?id=preserve');
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  return { writes, raw, id };
}

test('reasoning edit distinguishes provider default from model inheritance and preserves fallbacks', async ({
  page,
}) => {
  const { writes, raw, id } = await setup(page, 'LocalAgent', 'LocalAgent');
  await page
    .getByRole('button', { name: 'Reasoning level: High', exact: true })
    .click();
  await page.getByRole('slider').press('Home');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].config.ai.runner_config[id]).toEqual({
    ...raw,
    model: {
      ...(raw.model as object),
      reasoning: { 'llm-valid': 'provider_default', 'llm-fallback': 'low' },
    },
  });
  await page.reload();
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Reasoning level: Provider default',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Use model setting', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].config.ai.runner_config[id]).toEqual({
    ...raw,
    model: { ...(raw.model as object), reasoning: { 'llm-fallback': 'low' } },
  });
  expect(writes[1].config.output).toEqual(writes[0].config.output);
  await page.reload();
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Reasoning level: Use model setting',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toBeDisabled();
  // The reverse transition must not require moving through another level.
  await page
    .getByRole('button', {
      name: 'Reasoning level: Use model setting',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Provider default', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].config.ai.runner_config[id]).toEqual(
    writes[0].config.ai.runner_config[id],
  );
  // Clearing a fallback override must not clear the primary override.
  await page
    .getByRole('button', { name: 'Reasoning level: Low', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Use model setting', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => writes.length).toBe(4);
  expect(writes[3].config.ai.runner_config[id]).toEqual({
    ...raw,
    model: {
      ...(raw.model as object),
      reasoning: { 'llm-valid': 'provider_default' },
    },
  });
});

test('standalone picker keeps its original levels and provider default API', async ({
  page,
}) => {
  await installLangBotApiMocks(page, { authenticated: true });
  await page.goto('/home/pipelines');
  await page.evaluate(async () => {
    // Vite serves the actual component, not a test replacement.
    const resources = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name);
    const reactPath = resources.find((url) =>
      new URL(url).pathname.endsWith('/react.js'),
    )!;
    const domPath = resources.find((url) =>
      new URL(url).pathname.endsWith('/react-dom_client.js'),
    )!;
    const pickerPath =
      '/src/app/home/components/reasoning/ReasoningLevelPicker.tsx';
    const reactModule = await import(reactPath);
    const React = reactModule.default || reactModule;
    const domModule = await import(domPath);
    const { createRoot } = domModule.default || domModule;
    const { default: Picker } = await import(pickerPath);
    const host = document.createElement('div');
    const app = document.getElementById('root');
    if (app) app.style.display = 'none';
    document.body.appendChild(host);
    function Harness() {
      const [value, setValue] = React.useState('provider_default');
      return React.createElement(Picker, {
        value,
        levels: ['provider_default', 'high'],
        onChange: (next: string) => {
          host.dataset.value = next;
          setValue(next);
        },
      });
    }
    host.id = 'standalone-reasoning';
    createRoot(host).render(React.createElement(Harness));
  });
  await page
    .getByRole('button', {
      name: 'Reasoning level: Provider default',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: 'Use model setting', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('slider').press('End');
  await expect(page.locator('#standalone-reasoning')).toHaveAttribute(
    'data-value',
    'high',
  );
  await page.getByRole('slider').press('Home');
  await expect(page.locator('#standalone-reasoning')).toHaveAttribute(
    'data-value',
    'provider_default',
  );
});
