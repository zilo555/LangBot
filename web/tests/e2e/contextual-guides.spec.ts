import { expect, test } from '@playwright/test';

import { installLangBotApiMocks } from './fixtures/langbot-api';

const categorizedAdapters = [
  ['popular-adapter', 'Popular Adapter', 'popular', false],
  ['china-adapter', 'China Adapter', 'china', false],
  ['global-adapter', 'Global Adapter', 'global', false],
  ['protocol-adapter', 'Protocol Adapter', 'protocol', false],
  ['legacy-adapter', 'Legacy Adapter', 'protocol', true],
].map(([name, label, category, legacy]) => ({
  name,
  label: { en_US: label, zh_Hans: label },
  description: {
    en_US: `${label} description`,
    zh_Hans: `${label} description`,
  },
  spec: { categories: [category], legacy, config: [] },
}));

test('knowledge guide starts only after creation opens the detail page', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_knowledge_detail_guide_v1: 'engine' },
  });
  await page.route('**/api/v1/knowledge/engines', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          engines: [
            {
              plugin_id: 'builtin/minimal-knowledge',
              name: { en_US: 'Guided Knowledge Engine' },
              description: { en_US: 'Engine with detail-page setup.' },
              capabilities: ['text_retrieval'],
              creation_schema: [
                {
                  name: 'endpoint',
                  label: { en_US: 'Engine endpoint' },
                  type: 'text',
                  required: true,
                  default: '',
                },
              ],
              retrieval_schema: [],
            },
          ],
        },
      },
    }),
  );

  await page.goto('/home/knowledge?id=new');

  await expect(page.getByTestId('knowledge-detail-guide')).toHaveCount(0);
  await expect(
    page.locator('[data-guide="knowledge-engine-parameters"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-guide="knowledge-retrieval"]')).toHaveCount(
    0,
  );
  await page.locator('input[name="name"]').fill('Guided Knowledge');
  await page.getByRole('button', { name: /^Save$/ }).click();

  await expect(page).toHaveURL(/\/home\/knowledge\?id=knowledge-1$/);
  const guide = page.getByTestId('knowledge-detail-guide');
  await expect(
    guide.getByRole('heading', { name: 'Review the knowledge engine' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Next' })).toBeEnabled();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Configure engine parameters' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Next' })).toBeEnabled();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', {
      name: 'Save the knowledge base configuration',
    }),
  ).toBeVisible();
  await page
    .locator('[data-guide="knowledge-engine-parameters"]')
    .getByRole('textbox')
    .fill('https://example.invalid');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByRole('tab', { name: 'Retrieve' })).toBeVisible();
  await guide.getByRole('button', { name: 'Finish' }).click();
  await expect(guide).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('langbot_knowledge_detail_guide_v1'),
      ),
    )
    .toBe('completed');
});

test('bot guide starts on the detail page after adapter-only creation', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_bot_detail_guide_v1: 'connection' },
  });
  await page.route('**/api/v1/platform/adapters', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          adapters: [
            {
              name: 'dual-mode-adapter',
              label: { en_US: 'Dual Mode Adapter' },
              description: { en_US: 'Supports Webhook and socket modes.' },
              spec: {
                categories: ['testing'],
                config: [
                  {
                    id: 'enable-webhook',
                    name: 'enable-webhook',
                    label: { en_US: 'Enable Webhook Mode' },
                    type: 'boolean',
                    required: true,
                    default: false,
                  },
                  {
                    id: 'webhook-url',
                    name: 'webhook_url',
                    label: { en_US: 'Webhook URL' },
                    type: 'webhook-url',
                    required: false,
                    default: '',
                    show_if: {
                      field: 'enable-webhook',
                      operator: 'eq',
                      value: true,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }),
  );

  await page.goto('/home/bots?id=new');

  await expect(page.getByTestId('bot-detail-guide')).toHaveCount(0);
  await page
    .getByTestId('adapter-gallery')
    .getByRole('button', { name: /Dual Mode Adapter/ })
    .click();

  await page.locator('input[name="name"]').fill('Guided Bot');
  await page
    .locator('input[name="description"]')
    .fill('Created before configuration.');
  await page.getByRole('button', { name: /^Submit$/ }).click();

  await expect(page).toHaveURL(/\/home\/bots\?id=bot-1$/);
  await expect(page.getByRole('heading', { name: 'Guided Bot' })).toBeVisible();
  const guide = page.getByTestId('bot-detail-guide');
  await expect(
    guide.getByRole('heading', { name: 'Choose a connection method' }),
  ).toBeVisible();
  await expect(
    page.getByRole('radio', { name: /^Persistent connection/ }),
  ).toBeChecked();
  await page.getByRole('radio', { name: /^Webhook/ }).click();
  const adapterCard = page.locator('[data-slot="card"]').filter({
    has: page.getByText('Adapter Configuration', { exact: true }),
  });
  await expect(adapterCard.getByRole('switch')).toBeChecked();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Configure the platform' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Route incoming events' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Save the bot configuration' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Finish' }).click();
  await expect(guide).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('langbot_bot_detail_guide_v1')),
    )
    .toBe('completed');

  await page.reload();
  await expect(guide).toHaveCount(0);
});

test('bot creation page never renders a contextual guide', async ({ page }) => {
  await page.setViewportSize({ width: 1645, height: 478 });
  await installLangBotApiMocks(page, {
    authenticated: true,
    language: 'zh-Hans',
    storage: { langbot_bot_detail_guide_v1: 'connection' },
  });
  await page.route('**/api/v1/platform/adapters', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          adapters: categorizedAdapters,
        },
      },
    }),
  );

  await page.goto('/home/bots?id=new');

  await expect(page.getByTestId('bot-detail-guide')).toHaveCount(0);
  await expect(page.locator('[data-guide="bot-adapter"]')).toBeVisible();
  await expect(page.locator('[data-guide="bot-basic"]')).toBeVisible();
  for (const category of ['popular', 'china', 'global', 'protocol', 'legacy']) {
    await expect(
      page.locator(`[data-adapter-category="${category}"]`),
    ).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^提交$/ })).toHaveCount(0);
});

test('bot adapter gallery keeps categories and fits desktop and mobile', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
  });
  await page.route('**/api/v1/platform/adapters', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: { adapters: categorizedAdapters },
      },
    }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/home/bots?id=new');

  const gallery = page.getByTestId('adapter-gallery');
  const basicInfo = page.locator('[data-guide="bot-basic"]');
  await expect(gallery).toBeVisible();
  await expect(basicInfo).toBeVisible();
  for (const category of ['popular', 'global', 'china', 'protocol', 'legacy']) {
    await expect(
      gallery.locator(`[data-adapter-category="${category}"]`),
    ).toBeVisible();
  }
  await expect(
    gallery.getByRole('button', { name: /Legacy Adapter/ }),
  ).toHaveCount(0);
  const desktopBasicBox = await basicInfo.boundingBox();
  const desktopGalleryBox = await gallery.boundingBox();
  expect(desktopBasicBox).not.toBeNull();
  expect(desktopGalleryBox).not.toBeNull();
  expect(desktopBasicBox!.x + desktopBasicBox!.width).toBeLessThan(
    desktopGalleryBox!.x,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBasicBox = await basicInfo.boundingBox();
  const mobileGalleryBox = await gallery.boundingBox();
  expect(mobileBasicBox).not.toBeNull();
  expect(mobileGalleryBox).not.toBeNull();
  expect(mobileBasicBox!.y + mobileBasicBox!.height).toBeLessThanOrEqual(
    mobileGalleryBox!.y,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);

  await gallery.getByRole('button', { name: /Legacy adapters/ }).click();
  await expect(
    gallery.getByRole('button', { name: /Legacy Adapter/ }),
  ).toBeVisible();
  await gallery.getByRole('button', { name: /Popular Adapter/ }).click();

  await expect(gallery).toBeVisible();
  await expect(
    gallery.getByRole('button', { name: /Popular Adapter/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Submit$/ })).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});

test('runner guide covers selection, parameters, and event tools', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_runner_setup_guide_v1: 'runner' },
  });

  await page.goto('/home/agents?id=agent-guide');

  const guide = page.getByTestId('runner-setup-guide');
  await expect(
    guide.getByRole('heading', { name: 'Choose or install a Runner' }),
  ).toBeVisible();
  await expect(
    guide.getByRole('link', { name: /Runner Marketplace/ }),
  ).toHaveAttribute('target', '_blank');

  await page
    .locator('[data-guide="runner-selector"]')
    .getByRole('combobox')
    .click();
  const runnerOptions = page.locator('[data-slot="select-content"]');
  await expect(runnerOptions).toBeVisible();
  await expect
    .poll(() =>
      runnerOptions.evaluate((element) =>
        Number.parseInt(getComputedStyle(element).zIndex, 10),
      ),
    )
    .toBeGreaterThan(61);
  const runnerOptionsZIndex = await runnerOptions.evaluate((element) =>
    Number.parseInt(getComputedStyle(element).zIndex, 10),
  );
  await expect
    .poll(() =>
      guide.evaluate((element) => {
        const popover = element.querySelector('[role="dialog"]');
        return popover
          ? Number.parseInt(getComputedStyle(popover).zIndex, 10)
          : 0;
      }),
    )
    .toBeGreaterThan(runnerOptionsZIndex);
  await page.keyboard.press('Escape');

  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Configure Runner parameters' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Set events and tools' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Finish' })).toBeEnabled();
  await guide.getByRole('button', { name: 'Finish' }).click();
  await expect(guide).toHaveCount(0);
});

test('detail guide can be skipped from the popover corner', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_runner_setup_guide_v1: 'runner' },
  });

  await page.goto('/home/agents?id=agent-guide');

  const guide = page.getByTestId('runner-setup-guide');
  await expect(guide.getByRole('button', { name: 'Skip' })).toBeVisible();
  await guide.getByRole('button', { name: 'Skip' }).click();
  await expect(guide).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('langbot_runner_setup_guide_v1'),
      ),
    )
    .toBe('completed');

  await page.reload();
  await expect(guide).toHaveCount(0);
});

test('processor creation page does not render the runner detail guide', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_runner_setup_guide_v1: 'runner' },
  });

  await page.goto('/home/agents?id=new');

  await expect(page.getByTestId('runner-setup-guide')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Submit$/ })).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeVisible();
});
