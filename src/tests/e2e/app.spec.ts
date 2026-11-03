import { expect, test } from '@playwright/test';

test('home loads with 3 mode tabs and starts sort race', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Algo Eco Sim/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /정렬 경주/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /미로 길찾기/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /생태계/ })).toBeVisible();

  await page.getByRole('button', { name: '경주 시작하기' }).click();
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible();
  await expect(page.locator('.stat-row', { hasText: '버블 정렬' })).toBeVisible();
  await expect(page.locator('.code-list li.active')).toBeVisible();
  await expect(page.locator('.sort-canvas')).toBeVisible();
});

test('maze tab explores with A* and shows stats', async ({ page }) => {
  await page.goto('/?seed=20260501&mode=maze');
  await page.getByRole('tab', { name: /미로 길찾기/ }).click();
  await page.getByLabel('길찾기 알고리즘 선택').selectOption('astar');
  await page.getByRole('button', { name: '탐색 시작하기' }).click();
  await expect(page.getByText('방문', { exact: true })).toBeVisible();
  await expect(page.getByText('최종 경로', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.maze-canvas')).toBeVisible();
});

test('eco tab wakes up, shows events and mission', async ({ page }) => {
  await page.goto('/?seed=20260501&mode=eco');
  await page.getByRole('tab', { name: /생태계/ }).click();
  await page.getByRole('button', { name: '생태계 깨우기' }).click();
  await expect(page.getByRole('button', { name: /가뭄/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /질병/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /사냥꾼/ })).toBeVisible();
  await expect(page.locator('.mission-card', { hasText: '미션' })).toBeVisible();
  await expect(page.locator('.eco-canvas')).toBeVisible();
  await expect(page.locator('.eco-chart')).toBeVisible();
  // fire an event card — notice line must update
  await page.getByRole('button', { name: /가뭄/ }).click();
  await expect(page.getByText(/가뭄 발생/)).toBeVisible();
});

test('seed in URL is shown as shareable scenario', async ({ page }) => {
  await page.goto('/?seed=12345&mode=sort');
  await expect(page.getByText(/#12345/)).toBeVisible();
});
