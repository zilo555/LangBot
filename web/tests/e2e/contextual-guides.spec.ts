import { expect, test } from '@playwright/test';

import { installLangBotApiMocks } from './fixtures/langbot-api';

test('knowledge setup guide advances only after required state is complete', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_knowledge_create_guide_v1: 'basic' },
  });

  await page.goto('/home/knowledge?id=new');

  const guide = page.getByTestId('knowledge-create-guide');
  await expect(
    guide.getByRole('heading', { name: 'Describe the knowledge base' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Next' })).toBeDisabled();

  await page.locator('input[name="name"]').fill('Guided Knowledge');
  await expect(guide.getByRole('button', { name: 'Next' })).toBeEnabled();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Choose or install an engine' }),
  ).toBeVisible();
  await expect(
    guide.getByRole('link', { name: /Marketplace/ }),
  ).toHaveAttribute('target', '_blank');
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Create the knowledge base' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Finish' }).click();
  await expect(guide).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('langbot_knowledge_create_guide_v1'),
      ),
    )
    .toBe('completed');
});

test('bot setup guide chooses the adapter before its connection method', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_bot_create_guide_v4: 'basic' },
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

  const guide = page.getByTestId('bot-create-guide');
  await expect(
    guide.getByRole('heading', { name: 'Name this bot' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.locator('input[name="name"]').fill('Guided Bot');
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Choose a platform adapter' }),
  ).toBeVisible();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Dual Mode Adapter' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Choose a connection method' }),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Webhook/ })).not.toBeChecked();
  await page.getByRole('radio', { name: /^Webhook/ }).click();

  await expect(
    guide.getByRole('heading', { name: 'Configure the platform' }),
  ).toBeVisible();
  await expect(page.getByRole('switch')).toBeChecked();
  await page.getByRole('radio', { name: /^Persistent connection/ }).click();
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('radio', { name: /^Webhook/ }).click();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Route incoming events' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();
  await expect(
    guide.getByRole('heading', { name: 'Create the bot' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Finish' }).click();
  await expect(guide).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('langbot_bot_create_guide_v4')),
    )
    .toBe('completed');
  await page.waitForTimeout(500);
  await expect(guide).toHaveCount(0);
  await expect(page.locator('input[name="name"]')).toHaveValue('Guided Bot');

  await page.reload();
  await expect(guide).toHaveCount(0);
});

test('bot setup guide restores missing basic info before a saved adapter step', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1645, height: 478 });
  await installLangBotApiMocks(page, {
    authenticated: true,
    language: 'zh-Hans',
    storage: { langbot_bot_create_guide_v4: 'adapter' },
  });

  await page.goto('/home/bots?id=new');

  const guide = page.getByTestId('bot-create-guide');
  await expect(guide).toHaveAttribute('data-active-step', 'basic');
  await expect(guide).toHaveAttribute('data-step-complete', 'false');
  await page.locator('input[name="name"]').fill('test');
  await expect(guide).toHaveAttribute('data-step-complete', 'true');

  const nextButton = guide.getByRole('button', { name: '下一步' });
  await nextButton.evaluate((button) => {
    button.replaceWith(button.cloneNode(true));
  });
  const buttonBox = await nextButton.boundingBox();
  expect(buttonBox).not.toBeNull();
  await page.mouse.click(
    buttonBox!.x + buttonBox!.width / 2,
    buttonBox!.y + buttonBox!.height / 2,
  );

  await expect(guide).toHaveAttribute('data-active-step', 'adapter');
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('langbot_bot_create_guide_v4')),
    )
    .toBe('adapter');
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
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Configure Runner parameters' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Set events and tools' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Finish' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Events & tools' }).click();
  await expect(guide.getByRole('button', { name: 'Finish' })).toBeEnabled();
  await guide.getByRole('button', { name: 'Finish' }).click();
  await expect(guide).toHaveCount(0);
});

test('processor creation guide explains the type before required details', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_processor_create_guide_v1: 'type' },
  });

  await page.goto('/home/agents?id=new');

  const guide = page.getByTestId('processor-create-guide');
  await expect(
    guide.getByRole('heading', { name: 'Choose a processor type' }),
  ).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Name the processor' }),
  ).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.locator('input[name="name"]').fill('Guided Processor');
  await expect(guide.getByRole('button', { name: 'Next' })).toBeEnabled();
  await guide.getByRole('button', { name: 'Next' }).click();

  await expect(
    guide.getByRole('heading', { name: 'Create and continue setup' }),
  ).toBeVisible();
});
