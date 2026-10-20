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

// Gate Challenger 2: Responsive layout, breakpoint collapsing, SVG rendering & console error probing

test.describe('Gate Challenger 2: Responsive Probing & Breakpoint Stress', () => {
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

    // Mock API routes to avoid unhandled backend network refusals
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/v1/demo/seed')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: demoSeedResponse });
      } else if (url.includes('/api/v1/demo/reset')) {
        await route.fulfill({ status: 200, contentType: 'application/json', json: { status: 'success', message: 'Demo reset.' } });
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

  async function assertZeroHorizontalOverflow(page: Page, label: string) {
    const overflow = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const innerW = window.innerWidth;
      const scrollW = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
      const isOverflowing = scrollW > innerW;

      const violators: string[] = [];
      if (isOverflowing) {
        document.querySelectorAll('*').forEach((node) => {
          const el = node as HTMLElement;
          const rect = el.getBoundingClientRect();
          if (rect.right > innerW + 1) {
            violators.push(
              `<${el.tagName.toLowerCase()} class="${(el.className || '').toString().slice(0, 50)}" id="${el.id}"> right=${Math.round(rect.right)} > innerW=${innerW}`
            );
          }
        });
      }
      return { isOverflowing, scrollW, innerW, violators: violators.slice(0, 5) };
    });

    expect(
      overflow.isOverflowing,
      `[${label}] Horizontal overflow detected: scrollWidth=${overflow.scrollW}px > innerWidth=${overflow.innerW}px. Violators: ${overflow.violators.join('; ')}`
    ).toBe(false);
  }

  const TARGET_VIEWPORTS = [
    { name: 'Mobile (390x844)', width: 390, height: 844 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    { name: 'Large (1920x1080)', width: 1920, height: 1080 },
  ];

  for (const vp of TARGET_VIEWPORTS) {
    test(`Responsive probing at ${vp.name}: Landing Page Hero, Bento Grid, Pipeline & SVGs`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // 1. Verify zero horizontal overflow on root landing page
      await assertZeroHorizontalOverflow(page, `Landing Page @ ${vp.name}`);

      // 2. Verify asymmetric hero layout collapse
      const heroSection = page.locator('#hero');
      await expect(heroSection).toBeVisible();
      const heroHeading = page.locator('[data-testid="showcase-title"]');
      await expect(heroHeading).toBeVisible();
      const loginCard = page.locator('#login-card');
      await expect(loginCard).toBeVisible();

      const heroBox = await heroSection.boundingBox();
      const loginBox = await loginCard.boundingBox();
      expect(heroBox).toBeTruthy();
      expect(loginBox).toBeTruthy();
      if (heroBox && loginBox) {
        expect(loginBox.x).toBeGreaterThanOrEqual(0);
        expect(loginBox.x + loginBox.width).toBeLessThanOrEqual(vp.width + 2);
      }

      // 3. Verify 12-column Bento Grid collapse and cards bounding
      const pillarsSection = page.locator('#pillars');
      await expect(pillarsSection).toBeVisible();
      const pillarBadges = page.locator('[data-testid="pillar-badge"]');
      const badgeCount = await pillarBadges.count();
      expect(badgeCount).toBe(4);

      // Verify each pillar card stays within viewport bounds
      const pillarCards = pillarsSection.locator('> div > div.grid > div');
      const cardCount = await pillarCards.count();
      expect(cardCount).toBe(4);
      for (let i = 0; i < cardCount; i++) {
        const cardBox = await pillarCards.nth(i).boundingBox();
        expect(cardBox).toBeTruthy();
        if (cardBox) {
          expect(cardBox.x).toBeGreaterThanOrEqual(0);
          expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(vp.width + 2);
        }
      }

      // 4. Verify SVG visual illustrations maintain correct viewBox and aspect ratio
      const illustrations = page.locator('[data-testid="pillar-illustration"] svg');
      const illustrationCount = await illustrations.count();
      expect(illustrationCount).toBe(4);

      for (let i = 0; i < illustrationCount; i++) {
        const svg = illustrations.nth(i);
        await expect(svg).toBeVisible();
        const viewBox = await svg.getAttribute('viewBox');
        expect(viewBox).toBe('0 0 540 240');

        const box = await svg.boundingBox();
        expect(box).toBeTruthy();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
          expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 2);
          // Verify aspect ratio: 540/240 is 2.25. Floating point rendered ratio should be close to 2.25 (between 2.1 and 2.4)
          const aspectRatio = box.width / box.height;
          expect(aspectRatio).toBeGreaterThan(2.0);
          expect(aspectRatio).toBeLessThan(2.5);
        }
      }

      // 5. Interactive 5-stage lifecycle pipeline diagram and step details render correctly
      const lifecycleSection = page.locator('[data-testid="interactive-lifecycle-diagram"]');
      await expect(lifecycleSection).toBeVisible();

      const stepButtons = page.locator('[data-testid="lifecycle-step"]');
      expect(await stepButtons.count()).toBe(5);

      const detailsPanel = page.locator('[data-testid="step-details"]');
      await expect(detailsPanel).toBeVisible();

      // Click each of the 5 stages and verify active details and diagram SVG
      for (let stageId = 1; stageId <= 5; stageId++) {
        const stepBtn = page.locator(`[data-testid="lifecycle-step"][data-step="${stageId}"]`);
        await stepBtn.click();
        await expect(stepBtn).toHaveAttribute('data-active', 'true');

        // Verify active diagram SVG
        const pipelineSvg = detailsPanel.locator('[data-testid="pipeline-diagram-svg"]');
        await expect(pipelineSvg).toBeVisible();
        const pipelineViewBox = await pipelineSvg.getAttribute('viewBox');
        expect(pipelineViewBox).toBe('0 0 680 160');

        const svgBox = await pipelineSvg.boundingBox();
        expect(svgBox).toBeTruthy();
        if (svgBox) {
          expect(svgBox.width).toBeGreaterThan(0);
          expect(svgBox.height).toBeGreaterThan(0);
          expect(svgBox.x + svgBox.width).toBeLessThanOrEqual(vp.width + 2);
          // 680 / 160 is 4.25 aspect ratio
          const ratio = svgBox.width / svgBox.height;
          expect(ratio).toBeGreaterThan(3.8);
          expect(ratio).toBeLessThan(4.6);
        }

        // Verify detail text and artifacts render
        await expect(detailsPanel.getByText(`Stage ${stageId}:`)).toBeVisible();
      }

      // Zero uncaught console / page errors on landing page
      expect(pageErrors, `Unhandled page errors at ${vp.name}`).toEqual([]);
      expect(consoleErrors, `Console errors at ${vp.name}`).toEqual([]);
    });

    test(`Responsive probing at ${vp.name}: Demo Walkthrough with Zero Console Errors`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

      const workstation = page.locator('[data-testid="workstation-dashboard"]');
      await expect(workstation).toBeVisible({ timeout: 10_000 });

      // Verify walkthrough bar is visible and within viewport
      const demoBar = page.locator('[data-testid="demo-walkthrough-bar"]');
      await expect(demoBar).toBeVisible();
      const demoBarBox = await demoBar.boundingBox();
      expect(demoBarBox).toBeTruthy();
      if (demoBarBox) {
        expect(demoBarBox.x + demoBarBox.width).toBeLessThanOrEqual(vp.width + 2);
      }

      // Verify zero horizontal overflow on default tab
      await assertZeroHorizontalOverflow(page, `Workstation default @ ${vp.name}`);

      // Select each student in roster and check console errors
      const student1 = page.getByRole('button').filter({ hasText: /Nguyen Van An|1001/i }).first();
      if (await student1.count() > 0) {
        await student1.click();
      }
      await page.waitForTimeout(100);

      const student2 = page.getByRole('button').filter({ hasText: /Tran Thi Binh|1002/i }).first();
      if (await student2.count() > 0) {
        await student2.click();
      }
      await page.waitForTimeout(100);

      // Verify Reset Demo button works without errors
      const resetBtn = page.getByRole('button', { name: /Reset Demo/i });
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();
      await page.waitForTimeout(200);

      // Verify zero uncaught exceptions in console
      expect(pageErrors, `Unhandled page errors during walkthrough @ ${vp.name}`).toEqual([]);
      expect(consoleErrors, `Console errors during walkthrough @ ${vp.name}`).toEqual([]);
    });
  }
});
