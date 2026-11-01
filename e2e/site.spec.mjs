import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// 仅拦截测试浏览器的请求；不写入主数据，也不随网站构建发布。
const item = (id, date, changes = {}) => ({
  id, title: `测试作品 ${id}`, type: 'book', history: [{ status: 'completed', date }],
  comment: '', tags: [], url: [], review_url: '', ...changes,
});
const fixtures = [
  item('a', '2026-10', { rating: 1, history: [{ status: 'completed', date: '2025', rating: 4 }, { status: 'in_progress', date: '2026-10', rating: 5 }], comment: '<b>纯文本短评</b>', tags: ['标签'], url: ['https://example.com/a'] }),
  item('b', '2025', { type: 'video' }),
  item('c', '中学时代', { history: [{ status: 'planned', date: '中学时代' }] }),
  item('d', null),
];
async function open(page, records = fixtures) {
  await page.route('**/data/records.json', route => route.fulfill({ json: records }));
  await page.goto('/');
  await expect(page.locator('#count')).toHaveText(`${records.length} / ${records.length} 条`);
}
const rows = page => page.locator('.tabulator-row');
const dates = page => rows(page).locator('[tabulator-field="updated_date"]');

test.beforeEach(async ({ page }) => {
  page.runtimeErrors = [];
  page.on('pageerror', error => page.runtimeErrors.push(error.message));
});
test.afterEach(async ({ page }) => expect(page.runtimeErrors).toEqual([]));

test('正式构建可加载全部主数据及四列表格', async ({ page }) => {
  const records = JSON.parse(await readFile(new URL('../data/records.json', import.meta.url), 'utf8'));
  await page.goto('/');
  await expect(page.locator('#count')).toHaveText(`${records.length} / ${records.length} 条`);
  await expect(rows(page)).toHaveCount(records.length);
  await expect(page.locator('.tabulator-col-title')).toHaveText(['名称', '类型', '状态', '最新更新日期']);
  await expect(page.locator('#error')).toBeHidden();
});

test('组合筛选、自定义时期、日期未记、无结果及重置', async ({ page }) => {
  await open(page);
  await page.locator('#type').selectOption('book');
  await page.locator('#status').selectOption('in_progress');
  await page.locator('#year').selectOption('2026');
  await page.locator('input[name="query"]').fill('标签');
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('#count')).toHaveText('1 / 4 条');
  await page.locator('input[name="query"]').fill('没有这个名称');
  await expect(page.locator('.tabulator-placeholder')).toHaveText('没有匹配的记录');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(rows(page)).toHaveCount(4);
  for (const [year, title] of [['custom', '测试作品 c'], ['unknown', '测试作品 d']]) {
    await page.locator('#year').selectOption(year);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).locator('.expand-button')).toContainText(title);
  }
});

test('详情评分从历史推导，历史完整展示，按钮焦点和键盘收起有效', async ({ page }) => {
  await open(page);
  const button = page.getByRole('button', { name: '测试作品 a', exact: true });
  await button.click();
  const details = page.locator('#details-a');
  await expect(details.locator('.detail-fields')).toContainText('5 / 5');
  await expect(details.locator('.history-list li')).toHaveCount(2);
  await expect(details.locator('.detail-fields b')).toHaveCount(0);
  await expect(details.getByRole('link', { name: '来源 ↗' })).toHaveAttribute('href', 'https://example.com/a');
  await expect(button).toBeFocused();
  await button.press('Enter');
  await expect(details).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('日期列默认和点击升降序保持统一的时期与空值分组', async ({ page }) => {
  await open(page);
  await expect(dates(page)).toHaveText(['2026-10', '2025', '中学时代', '—']);
  const header = page.locator('.tabulator-col[tabulator-field="updated_date"]');
  await header.click();
  await expect(dates(page)).toHaveText(['2025', '2026-10', '中学时代', '—']);
  await header.click();
  await expect(dates(page)).toHaveText(['2026-10', '2025', '中学时代', '—']);
});

test('长列表中段及底部展开收起不移动点击行或列表滚动位置', async ({ page }) => {
  await open(page, Array.from({ length: 160 }, (_, index) => item(`record-${String(index).padStart(3, '0')}`, '2026', { comment: '用于检查多行展开后的滚动位置。'.repeat(12) })));
  const holder = page.locator('.tabulator-tableholder');
  for (const position of ['middle', 'end']) {
    await holder.evaluate((element, position) => { element.scrollTop = position === 'end' ? element.scrollHeight : element.scrollHeight / 2; }, position);
    const selector = await holder.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const row = [...element.querySelectorAll('.tabulator-row')].find(row => {
        const rect = row.getBoundingClientRect();
        return rect.top > bounds.top + 20 && rect.bottom < bounds.bottom - 40;
      });
      return row.querySelector('.expand-button').getAttribute('aria-controls');
    });
    const button = page.locator(`button[aria-controls="${selector}"]`);
    const before = { top: (await button.boundingBox()).y, scroll: await holder.evaluate(element => element.scrollTop) };
    // 按屏幕坐标点击，避免 locator 自动滚动本身影响测量。
    for (const expanded of ['true', 'false']) {
      const bounds = await button.boundingBox();
      await page.mouse.click(bounds.x + 15, bounds.y + bounds.height / 2);
      await expect(button).toHaveAttribute('aria-expanded', expanded);
      await expect.poll(async () => (await button.boundingBox()).y).toBeCloseTo(before.top, 0);
      expect(await holder.evaluate(element => element.scrollTop)).toBeCloseTo(before.scroll, 0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
  }
});

test('空数据正常显示且筛选重置可用', async ({ page }) => {
  await open(page, []);
  await expect(page.locator('.tabulator-placeholder')).toHaveText('暂无记录');
  await page.locator('input[name="query"]').fill('测试');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.locator('#count')).toHaveText('0 / 0 条');
  await expect(page.locator('#error')).toBeHidden();
});
