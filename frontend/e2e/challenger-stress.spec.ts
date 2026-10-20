import { test, expect, Page } from '@playwright/test';
import {
  demoCourse,
  demoClass,
  demoAssignment,
  demoRubric,
  demoSubmissions,
  demoEvidence1001,
  demoGrade1001,
  demoSimilarityReport,
  demoSeedResponse,
  CODE_1001,
} from '../src/data/demoFixtures';

// Empirical Challenger Stress Test Suite
// Verifies extreme viewport boundaries, rapid interaction bursts, and console error-freedom.

test.describe('Challenger Stress Test Harness', () => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    consoleErrors.length = 0;

    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Comprehensive mock routes for all workstation endpoints
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/api/v1/demo/seed')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: demoSeedResponse });
      } else if (url.includes('/api/v1/demo/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: { status: 'success', message: 'Demo environment reset to baseline.' },
        });
      } else if (url.includes('/similarity/reports')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: [demoSimilarityReport] });
      } else if (url.includes('/test-cases')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: [] });
      } else if (url.includes('/rubric')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: demoRubric });
      } else if (url.includes('/source')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: { code: CODE_1001 } });
      } else if (url.includes('/evidence')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: demoEvidence1001 });
      } else if (url.includes('/grade')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: demoGrade1001 });
      } else if (url.includes('/jobs')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: [] });
      } else if (url.includes('/submissions')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: demoSubmissions });
      } else if (url.includes('/assignments')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: [demoAssignment] });
      } else if (url.includes('/classes')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: [demoClass] });
      } else if (url.includes('/courses')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: [demoCourse] });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', json: {} });
      }
    });
  });

  async function checkZeroHorizontalOverflow(page: Page, contextName: string) {
    const overflowInfo = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const innerW = window.innerWidth;
      const scrollW = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
      const isOverflowing = scrollW > innerW;

      let overflowingElements: string[] = [];
      if (isOverflowing) {
        const allElements = document.querySelectorAll('*');
        for (const el of Array.from(allElements)) {
          const rect = el.getBoundingClientRect();
          if (rect.right > innerW + 1) {
            overflowingElements.push(
              `<${el.tagName.toLowerCase()} class="${el.className}" id="${el.id}"> right=${rect.right} > innerWidth=${innerW}`
            );
            if (overflowingElements.length >= 5) break;
          }
        }
      }

      return {
        innerW,
        scrollW,
        isOverflowing,
        overflowingElements,
      };
    });

    expect(
      overflowInfo.isOverflowing,
      `Horizontal scroll overflow detected in [${contextName}]: scrollWidth (${overflowInfo.scrollW}px) > innerWidth (${overflowInfo.innerW}px). Culprits: ${overflowInfo.overflowingElements.join('; ')}`
    ).toBe(false);
  }

  // =========================================================================
  // 1. EXTREME VIEWPORT BOUNDARIES (Mobile 390x844, Tablet 768x1024, Desktop 1920x1080)
  // =========================================================================

  const viewports = [
    { name: 'Mobile (390x844)', width: 390, height: 844 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Desktop (1920x1080)', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`Viewport boundary: Showcase Landing Page at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await checkZeroHorizontalOverflow(page, `Landing Page @ ${vp.name}`);
      expect(pageErrors, 'Unhandled page errors on Landing Page').toEqual([]);
      expect(consoleErrors, 'Console errors on Landing Page').toEqual([]);
    });

    test(`Viewport boundary: Workstation Dashboard in Demo Mode across all tabs at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      const launchDemoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
      await expect(launchDemoBtn).toBeVisible();
      await launchDemoBtn.click();

      const workstation = page.locator('[data-testid="workstation-dashboard"]');
      await expect(workstation).toBeVisible({ timeout: 10_000 });

      // Verify zero overflow on default view (Grading tab)
      await checkZeroHorizontalOverflow(page, `Workstation Tab default (Grading) @ ${vp.name}`);

      // Verify all 5 tabs individually
      const tabs = [
        { key: '1', name: 'Setup', indicator: /Course & Cohort Setup|Workspace Setup|Class Management/i },
        { key: '2', name: 'Rubric', indicator: /Rubric & Formulas|Grading Formula|Rubric Configuration/i },
        { key: '3', name: 'Assignment', indicator: /Assignment & Tests|Automated Tests|Assignment Overview/i },
        { key: '4', name: 'Similarity', indicator: /Similarity Workbench|Plagiarism Analysis|Code Similarity/i },
        { key: '5', name: 'Grading', indicator: /Evidence Inspector|Submissions Roster|Code Viewer/i },
      ];

      for (const t of tabs) {
        await page.keyboard.press(t.key);
        await page.waitForTimeout(250);
        await checkZeroHorizontalOverflow(page, `Workstation Tab ${t.key} (${t.name}) @ ${vp.name}`);
      }

      expect(pageErrors, `Unhandled page errors in Workstation @ ${vp.name}`).toEqual([]);
      expect(consoleErrors, `Console errors in Workstation @ ${vp.name}`).toEqual([]);
    });
  }

  // =========================================================================
  // 2. RAPID USER INTERACTIONS STRESS TESTS
  // =========================================================================

  test('Rapid theme toggling: click theme toggle 20 times in rapid burst', async ({ page }) => {
    await page.goto('/');
    const launchDemoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await launchDemoBtn.click();
    await expect(page.locator('[data-testid="workstation-dashboard"]')).toBeVisible();

    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    await expect(themeToggle).toBeVisible();

    // Capture initial html dark class state
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Perform 20 rapid clicks
    const CLICK_COUNT = 20;
    for (let i = 0; i < CLICK_COUNT; i++) {
      await themeToggle.click({ delay: 10 });
    }

    // Because CLICK_COUNT is even, the final state should match initial state
    const finalIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(finalIsDark, 'Theme state after even number of toggles should return to initial state').toBe(initialIsDark);

    // Verify toggle still responds after rapid burst
    await themeToggle.click();
    const toggledIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(toggledIsDark, 'Theme toggle responds properly after stress burst').toBe(!initialIsDark);

    expect(pageErrors, 'Unhandled page errors during rapid theme toggling').toEqual([]);
    expect(consoleErrors, 'Console errors during rapid theme toggling').toEqual([]);
  });

  test('Rapid tab switching: cycle tabs 1 through 5 rapidly via keyboard shortcuts', async ({ page }) => {
    await page.goto('/');
    const launchDemoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await launchDemoBtn.click();
    await expect(page.locator('[data-testid="workstation-dashboard"]')).toBeVisible();

    // Rapidly switch tabs 1-5 for 5 cycles (25 rapid keystrokes)
    const sequence = ['1', '2', '3', '4', '5', '1', '3', '5', '2', '4', '1', '2', '3', '4', '5', '5', '4', '3', '2', '1', '5', '2', '4', '1', '5'];
    for (const key of sequence) {
      await page.keyboard.press(key);
      await page.waitForTimeout(40);
    }

    // Give UI a moment to settle
    await page.waitForTimeout(300);

    // Verify final tab (tab 5 is Grading) is active and intact
    await expect(page.locator('[data-testid="workstation-dashboard"]')).toBeVisible();

    expect(pageErrors, 'Unhandled page errors during rapid tab switching').toEqual([]);
    expect(consoleErrors, 'Console errors during rapid tab switching').toEqual([]);
  });

  test('Rapid roster traversal: traverse submission roster using j and k keys', async ({ page }) => {
    await page.goto('/');
    const launchDemoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await launchDemoBtn.click();
    await expect(page.locator('[data-testid="workstation-dashboard"]')).toBeVisible();

    // Ensure we are on grading tab (key 5)
    await page.keyboard.press('5');
    await page.waitForTimeout(200);

    // Rapidly traverse roster downwards (j) 10 times, upwards (k) 10 times, then alternate 10 times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('j');
      await page.waitForTimeout(30);
    }

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('k');
      await page.waitForTimeout(30);
    }

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(i % 2 === 0 ? 'j' : 'k');
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(300);

    // Verify submission selection is still valid and not null
    const selectedBadge = page.locator('button[aria-pressed="true"][data-testid="submission-item"], button.border-\\[\\#F2C46A\\]').first();
    await expect(selectedBadge).toBeVisible();

    expect(pageErrors, 'Unhandled page errors during rapid roster traversal').toEqual([]);
    expect(consoleErrors, 'Console errors during rapid roster traversal').toEqual([]);
  });

  test('Reset Demo idempotency: repeatedly click Reset Demo button consecutively', async ({ page }) => {
    await page.goto('/');
    const launchDemoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await launchDemoBtn.click();
    await expect(page.locator('[data-testid="workstation-dashboard"]')).toBeVisible();

    const resetBtn = page.getByTestId('reset-demo-button');
    await expect(resetBtn).toBeVisible();

    // Click Reset Demo 5 times consecutively in rapid succession
    for (let i = 0; i < 5; i++) {
      await resetBtn.click({ force: true });
      await page.waitForTimeout(100);
    }

    // Wait for any async reset promises to resolve
    await page.waitForTimeout(1000);

    // Verify the workstation remains fully functional and in valid state
    await expect(page.locator('[data-testid="workstation-dashboard"]')).toBeVisible();
    await expect(page.getByText('Nguyen Van An').first()).toBeVisible();

    expect(pageErrors, 'Unhandled page errors during repeated Reset Demo').toEqual([]);
    expect(consoleErrors, 'Console errors during repeated Reset Demo').toEqual([]);
  });

  // =========================================================================
  // 3. ZERO UNHANDLED JAVASCRIPT EXCEPTIONS ACROSS ENTIRE DEMO WALKTHROUGH
  // =========================================================================

  test('Global stability: zero unhandled JS exceptions across full interactive demo walkthrough', async ({ page }) => {
    await page.goto('/');

    // 1. Landing page check
    await expect(page.getByText(/Evidence First/i)).toBeVisible();

    // 2. Launch demo
    const launchBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await launchBtn.click();

    const workstation = page.locator('[data-testid="workstation-dashboard"]');
    await expect(workstation).toBeVisible();

    // 3. Cycle walkthrough stages in DemoWalkthroughBar
    for (let stage = 1; stage <= 5; stage++) {
      const stageBtn = page.locator(`button:has-text("${stage}.")`).first();
      if (await stageBtn.count() > 0) {
        await stageBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // 4. Open shortcuts modal with '?' and close with Escape
    await page.keyboard.press('?');
    await page.waitForTimeout(150);
    const shortcutsModal = page.getByRole('dialog');
    if (await shortcutsModal.count() > 0) {
      await expect(shortcutsModal).toBeVisible();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // 5. Exit Demo
    const exitBtn = page.getByTestId('exit-demo-button');
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    // Verify return to Showcase Landing Page
    await expect(page.getByText(/Evidence First/i)).toBeVisible();

    // Verify zero unhandled exceptions
    expect(pageErrors, 'Unhandled page errors during full walkthrough').toEqual([]);
    expect(consoleErrors, 'Console errors during full walkthrough').toEqual([]);
  });
});
