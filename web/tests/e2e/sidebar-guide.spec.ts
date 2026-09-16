import { expect, test } from '@playwright/test';

import { installLangBotApiMocks } from './fixtures/langbot-api';

const guideSteps = [
  'Dashboard',
  'Bots',
  'Processors',
  'Knowledge bases',
  'Installed extensions',
  'Add extensions',
  'Model configuration',
  'API integration',
];

test('sidebar guide blocks navigation until every step is confirmed', async ({
  page,
}) => {
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_sidebar_guide_v1: '0' },
  });

  await page.goto('/home/monitoring');

  const guide = page.getByTestId('sidebar-guide');
  await expect(guide).toHaveCount(1);
  await expect(guide.getByRole('dialog')).toBeVisible();
  await expect(guide.getByText('1 of 8')).toBeVisible();

  const dashboardTarget = page.locator('[data-sidebar-guide="monitoring"]');
  const targetBox = await dashboardTarget.boundingBox();
  expect(targetBox).not.toBeNull();
  const elementAtTargetCenter = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element?.closest('[data-testid="sidebar-guide"]') !== null;
    },
    {
      x: targetBox!.x + targetBox!.width / 2,
      y: targetBox!.y + targetBox!.height / 2,
    },
  );
  expect(elementAtTargetCenter).toBe(true);

  for (const [index, title] of guideSteps.entries()) {
    await expect(
      guide.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();

    const buttonName =
      index === guideSteps.length - 1 ? 'Finish tour' : 'Got it';
    await guide.getByRole('button', { name: buttonName }).click();
  }

  await expect(guide).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('langbot_sidebar_guide_v1')),
    )
    .toBe('completed');

  await page.getByRole('button', { name: 'Add Extension' }).click();
  await expect(page).toHaveURL(/\/home\/add-extension$/);

  await page.reload();
  await expect(guide).toHaveCount(0);
});

test('sidebar guide popover stays inside a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await installLangBotApiMocks(page, {
    authenticated: true,
    storage: { langbot_sidebar_guide_v1: '0' },
  });

  await page.goto('/home/monitoring');

  const dialog = page.getByRole('dialog', { name: 'Dashboard' });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(760);
});
