import { test, expect } from '@playwright/test';

// 共用小工具：按钮文本匹配优先，找不到时兜底点第一个可用按钮
// （RESOLVE_REQUEST 的应对/拒绝按钮文案是数据驱动的动态文本，不在固定列表里）
async function clickByLabel(page, labels, allowFallback = false) {
  for (const label of labels) {
    const btn = page.locator(`#actions button:has-text("${label}")`).first();
    if (await btn.count() > 0 && !(await btn.isDisabled())) {
      await btn.click();
      return label;
    }
  }
  if (allowFallback) {
    const anyBtn = page.locator('#actions button').first();
    if (await anyBtn.count() > 0 && !(await anyBtn.isDisabled())) {
      await anyBtn.click();
      return '(fallback)';
    }
  }
  return null;
}

async function clickStepperPlus(page, ingredientOrDishName, times) {
  const row = page.locator('.item-row').filter({ hasText: ingredientOrDishName }).first();
  const plus = row.locator('button').nth(1);
  for (let i = 0; i < times; i++) {
    if (await plus.isDisabled()) break;
    await plus.click();
  }
}

async function phaseTag(page) {
  return (await page.locator('.phase-tag').first().innerText().catch(() => '')) || '';
}

const SERVICE_LABELS = ['出餐', '正常价', '下一位客人', '收档结算', '推荐替代菜', '道歉送客', '好啦算你', '良心价', '斩客价'];

// 走完一整天的营业环节（不含 morning/prep/settle/shop），直到离开 service 阶段
async function runServiceLoop(page, maxSteps = 60) {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.locator('button:has-text("再来一局")').count() > 0) return;
    const tag = await phaseTag(page);
    const inService = tag.includes('营业中') || tag.includes('报价') || tag.includes('砍价') || tag === '结果';
    if (!inService) return;
    const clicked = await clickByLabel(page, SERVICE_LABELS, true);
    if (!clicked) return;
  }
}

// 「合理策略」跑完一整天：采购包菜+猪肉→备炒包菜+咕噜肉→开档→全程正常价→收档→打烊
async function playOneDaySensibly(page) {
  await clickStepperPlus(page, '包菜', 8);
  await clickStepperPlus(page, '猪肉', 8);
  await clickByLabel(page, ['去备菜']);
  await clickStepperPlus(page, '炒包菜', 8);
  await clickStepperPlus(page, '咕噜肉', 8);
  await clickByLabel(page, ['开档营业']);
  await runServiceLoop(page);
  if (await page.locator('button:has-text("再来一局")').count() > 0) return;
  await clickByLabel(page, ['看看这七天的成绩', '继续']);
  if (await page.locator('button:has-text("再来一局")').count() > 0) return;
  await clickByLabel(page, ['开始新的一天']);
}

// 「躺平策略」：不采购不备菜，直接开档，全程道歉送客
async function playOneDayLazily(page) {
  await clickByLabel(page, ['去备菜']);
  await clickByLabel(page, ['开档营业']);
  await runServiceLoop(page);
  if (await page.locator('button:has-text("再来一局")').count() > 0) return;
  await clickByLabel(page, ['看看这七天的成绩', '继续']);
  if (await page.locator('button:has-text("再来一局")').count() > 0) return;
  await clickByLabel(page, ['开始新的一天']);
}

test.describe('杂菜饭 Uncle · 手机端完整流程', () => {
  test('1. 开局流程：封面只有一个按钮，完成第 1 天进入第 2 天', async ({ page }) => {
    await page.goto('/?seed=1');
    await expect(page.locator('button:has-text("开始经营")')).toBeVisible();
    await expect(page.locator('button:has-text("继续游戏")')).toHaveCount(0);

    await page.locator('button:has-text("开始经营")').first().click();
    await expect(page.locator('main')).toContainText(/预计.*约.*位客人/);

    await playOneDaySensibly(page);

    await expect(page.locator('#hud-day')).toContainText('第 2/7 天');
  });

  test('2. 刷新前弹确认：游戏进行中拦截 beforeunload，封面阶段不拦截', async ({ page }) => {
    // 真实浏览器对「取消导航」的处理在 headless webkit/chromium 下不一致
    // （已知 headless 特性差异，类似 04-test-plan §6 提到的 iOS Safari 差异），
    // 所以不依赖 dialog/reload 的实际拦截效果，直接验证 app.js 注册的监听器本身的行为
    // ——这是我们代码能控制、也应该稳定验证的部分。
    await page.goto('/?seed=1');

    // 封面阶段（phase==='title'）：不应拦截
    const preventedAtTitle = await page.evaluate(() => {
      const ev = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(preventedAtTitle).toBe(false);

    // 进入游戏后（phase==='morning'）：应拦截
    await page.locator('button:has-text("开始经营")').first().click();
    const preventedInGame = await page.evaluate(() => {
      const ev = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(preventedInGame).toBe(true);
  });

  test('3. 报价交互：出餐后出现三档报价按钮，点击后展示结果与金钱变化', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.locator('button:has-text("开始经营")').first().click();
    await clickStepperPlus(page, '包菜', 8);
    await clickStepperPlus(page, '猪肉', 8);
    await clickByLabel(page, ['去备菜']);
    await clickStepperPlus(page, '炒包菜', 8);
    await clickStepperPlus(page, '咕噜肉', 8);
    await clickByLabel(page, ['开档营业']);

    for (let i = 0; i < 10; i++) {
      if (await page.locator('#actions button:has-text("正常价")').count() > 0) break;
      await clickByLabel(page, ['出餐', '推荐替代菜', '道歉送客'], true);
    }
    await expect(page.locator('#actions button:has-text("良心价")')).toBeVisible();
    await expect(page.locator('#actions button:has-text("正常价")')).toBeVisible();
    await expect(page.locator('#actions button:has-text("斩客价")')).toBeVisible();

    await page.locator('#actions button:has-text("正常价")').first().click();
    await expect(page.locator('.phase-tag')).toContainText('结果');
  });

  test('4. 缺菜路径：只备一种菜，后面顾客缺菜时出现替代/道歉选项', async ({ page }) => {
    await page.goto('/?seed=7');
    await page.locator('button:has-text("开始经营")').first().click();
    await clickStepperPlus(page, '包菜', 1);
    await clickByLabel(page, ['去备菜']);
    await clickStepperPlus(page, '炒包菜', 1);
    await clickByLabel(page, ['开档营业']);

    let sawMissingChoice = false;
    for (let i = 0; i < 30; i++) {
      if (await page.locator('button:has-text("再来一局")').count() > 0) break;
      const tag = await phaseTag(page);
      if (!(tag.includes('营业中') || tag.includes('报价') || tag.includes('砍价') || tag === '结果')) break;
      const hasSub = await page.locator('#actions button:has-text("推荐替代菜")').count();
      const hasApology = await page.locator('#actions button:has-text("道歉送客")').count();
      if (hasSub > 0 || hasApology > 0) sawMissingChoice = true;
      const clicked = await clickByLabel(page, SERVICE_LABELS, true);
      if (!clicked) break;
    }
    expect(sawMissingChoice).toBe(true);
  });

  test('5. 移动端体检：无横向滚动，所有按钮触控高度 ≥44px', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.locator('button:has-text("开始经营")').first().click();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    const heights = await page.locator('.btn, .stepper button').evaluateAll(
      (els) => els.map((el) => el.getBoundingClientRect().height)
    );
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test('6. 7 天完整通关到存活结局，评分/人设标签展示正确，历史最高分写入', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.locator('button:has-text("开始经营")').first().click();

    for (let day = 1; day <= 7; day++) {
      if (await page.locator('button:has-text("再来一局")').count() > 0) break;
      await playOneDaySensibly(page);
    }

    await expect(page.locator('.persona-card')).toBeVisible();
    await expect(page.locator('.en')).toContainText(/级 · \d+ 分 · 撑满 7 天/);

    const hsRaw = await page.evaluate(() => localStorage.getItem('caipng.highscore'));
    expect(hsRaw).not.toBeNull();
    const hs = JSON.parse(hsRaw);
    expect(typeof hs.score).toBe('number');

    // 再来一局：应回到全新封面，且展示历史最佳
    await page.locator('button:has-text("再来一局")').first().click();
    await expect(page.locator('button:has-text("开始经营")')).toBeVisible();
  });

  test('7. 破产走向墓志铭结局，历史最高分不受影响', async ({ page }) => {
    // seed=1 的存活局（用例 6）会先写入历史最高分；这里验证破产局不会覆盖/清空它
    await page.goto('/?seed=1');
    await page.locator('button:has-text("开始经营")').first().click();
    for (let day = 1; day <= 7; day++) {
      if (await page.locator('button:has-text("再来一局")').count() > 0) break;
      await playOneDaySensibly(page);
    }
    const hsBefore = await page.evaluate(() => localStorage.getItem('caipng.highscore'));
    expect(hsBefore).not.toBeNull();

    await page.goto('/?seed=42');
    await page.locator('button:has-text("开始经营")').first().click();
    for (let day = 1; day <= 8; day++) {
      if (await page.locator('button:has-text("再来一局")').count() > 0) break;
      await playOneDayLazily(page);
    }

    await expect(page.locator('.persona-card .en')).toContainText('摊子倒了');
    await expect(page.locator('.persona-card')).not.toContainText(/级 · \d+ 分/);

    const hsAfter = await page.evaluate(() => localStorage.getItem('caipng.highscore'));
    expect(hsAfter).toBe(hsBefore); // 破产局不写历史最高分
  });

  test('8. 截图存证：关键阶段各截一张', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.screenshot({ path: 'e2e/screenshots/1-title.png' });

    await page.locator('button:has-text("开始经营")').first().click();
    await page.screenshot({ path: 'e2e/screenshots/2-morning.png' });

    await clickStepperPlus(page, '包菜', 8);
    await clickStepperPlus(page, '猪肉', 8);
    await clickByLabel(page, ['去备菜']);
    await page.screenshot({ path: 'e2e/screenshots/3-prep.png' });

    await clickStepperPlus(page, '炒包菜', 8);
    await clickStepperPlus(page, '咕噜肉', 8);
    await clickByLabel(page, ['开档营业']);
    await page.screenshot({ path: 'e2e/screenshots/4-service.png' });

    for (let day = 1; day <= 7; day++) {
      if (await page.locator('button:has-text("再来一局")').count() > 0) break;
      if (day === 1) {
        await runServiceLoop(page);
        await page.screenshot({ path: 'e2e/screenshots/5-settle.png' });
        await clickByLabel(page, ['看看这七天的成绩', '继续']);
        await page.screenshot({ path: 'e2e/screenshots/6-shop.png' });
        await clickByLabel(page, ['开始新的一天']);
        continue;
      }
      await playOneDaySensibly(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/7-ending.png' });
  });
});
