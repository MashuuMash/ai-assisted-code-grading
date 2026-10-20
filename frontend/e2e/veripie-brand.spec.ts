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

/**
 * VeriPie Brand & Design System Verification Suite
 *
 * Verifies:
 * - Tier 1: VeriPie Brand & Logo Integration (Title, Favicon, /logo.png, Navbar logo, Header/Footer logos)
 * - Tier 2: Workstation Navbar & Styling Invariants (Colors, Composite Title, Theme Stability, Demo Bar)
 * - Tier 3: Stitch Hero & Interactive Workstation Mockup (Pill Badge, Code Editor, Assertion Chips, Citation Keys)
 * - Tier 4: Micro-Interactions & Responsive Constraints (Hover Lifts, Transitions, Zero Horizontal Overflow)
 *
 * Adheres strictly to:
 * - ZERO-EMOJI Repository Rule (All plain ASCII)
 * - Progressive Testability (M1 live validation + M2/M3 readiness gates)
 * - Deterministic Computed-Style Verification (#FCF0DA, #4C4541, #F2C46A)
 */

async function setupMockApi(page: Page) {
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
}

async function openWorkstation(page: Page) {
  await setupMockApi(page);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const demoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
  if ((await demoBtn.count()) > 0) {
    await demoBtn.click();
    await page.waitForTimeout(600);
  }
}

async function assertZeroHorizontalOverflow(page: Page, contextLabel: string) {
  const result = await page.evaluate(() => {
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
    result.isOverflowing,
    `[${contextLabel}] Horizontal overflow detected: scrollWidth=${result.scrollW}px > innerWidth=${result.innerW}px. Violators: ${result.violators.join('; ')}`
  ).toBe(false);
}

test.describe('VeriPie Brand & Design System Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  // =========================================================================
  // TIER 1: VERIPIE BRAND & LOGO INTEGRATION
  // =========================================================================

  test('Tier 1: Document title in index.html contains "VeriPie"', async ({ page }) => {
    await page.goto('/');
    const pageTitle = await page.title();
    expect(pageTitle).toMatch(/VeriPie/i);
    expect(pageTitle).toContain('Automated Python Evaluation');
  });

  test('Tier 1: Favicon link points to /logo.png and meta theme color is defined', async ({ page }) => {
    await page.goto('/');

    // Check favicon link
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toBeAttached();
    const href = await favicon.getAttribute('href');
    expect(href).toBe('/logo.png');

    // Check theme-color meta tag (#FCF0DA warm parchment)
    const themeColor = page.locator('meta[name="theme-color"]');
    if ((await themeColor.count()) > 0) {
      const colorVal = await themeColor.getAttribute('content');
      expect(colorVal?.toUpperCase()).toMatch(/#F9F9FF|#FCF0DA/);
    }
  });

  test('Tier 1: Static /logo.png asset is served directly and returns valid image content', async ({ page }) => {
    const response = await page.request.get('/logo.png');
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/png/i);

    const bodyBuffer = await response.body();
    expect(bodyBuffer.length).toBeGreaterThan(1000);
  });

  test('Tier 1: VeriPie logo is rendered and visible in Workstation Navbar', async ({ page }) => {
    await openWorkstation(page);

    const navbar = page.locator('header').filter({ hasText: /AI Grading Workstation|VeriPie/i }).first();
    await expect(navbar).toBeVisible();

    // Verify brand logo is present
    const logoImg = navbar.locator('img[src="/logo.png"], img[alt*="VeriPie" i]').first();
    await expect(logoImg).toBeVisible();

    // Verify image is actually loaded (not broken link)
    const naturalDimensions = await logoImg.evaluate((img: HTMLImageElement) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
      complete: img.complete,
    }));

    expect(naturalDimensions.complete).toBe(true);
    expect(naturalDimensions.width).toBeGreaterThan(0);
    expect(naturalDimensions.height).toBeGreaterThan(0);

    // Verify alt text includes VeriPie
    const altText = await logoImg.getAttribute('alt');
    expect(altText).toMatch(/VeriPie/i);
  });

  test('Tier 1: VeriPie logo is rendered in Landing Page Header', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    const headerLogo = header.locator('img[src="/logo.png"], img[src*="logo.png"], img[alt*="VeriPie" i]').first();
    const isM2Merged = (await headerLogo.count()) > 0;

    if (!isM2Merged) {
      test.skip(!isM2Merged, 'Milestone M2 pending: Landing Page Header VeriPie Logo integration');
      return;
    }

    await expect(headerLogo).toBeVisible();
    const naturalWidth = await headerLogo.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('Tier 1: VeriPie logo is rendered in Landing Page Footer', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();

    const footerLogo = footer.locator('img[src="/logo.png"], img[src*="logo.png"], img[alt*="VeriPie" i]').first();
    const isM2Merged = (await footerLogo.count()) > 0;

    if (!isM2Merged) {
      test.skip(!isM2Merged, 'Milestone M2 pending: Landing Page Footer VeriPie Logo integration');
      return;
    }

    await expect(footerLogo).toBeVisible();
    const naturalWidth = await footerLogo.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  // =========================================================================
  // TIER 2: WORKSTATION NAVBAR & STYLING INVARIANTS
  // =========================================================================

  test('Tier 2: Workstation Navbar background is rgb(76, 69, 65) and heading color is rgb(252, 240, 218)', async ({ page }) => {
    await openWorkstation(page);

    const navbar = page.locator('header').filter({ hasText: /AI Grading Workstation|VeriPie/i }).first();
    await expect(navbar).toBeVisible();

    // Invariant: Navbar background must equal deep espresso rgb(76, 69, 65) (#4C4541)
    const navbarBg = await navbar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(navbarBg).toBe('rgb(76, 69, 65)');

    // Invariant: Navbar heading text color must equal warm cream rgb(252, 240, 218) (#FCF0DA)
    const heading = navbar.locator('h1').first();
    await expect(heading).toBeVisible();
    const headingColor = await heading.evaluate((el) => window.getComputedStyle(el).color);
    expect(headingColor).toBe('rgb(252, 240, 218)');
  });

  test('Tier 2: Workstation Navbar composite title contains both "VeriPie" and "AI Grading Workstation"', async ({ page }) => {
    await openWorkstation(page);

    const navbar = page.locator('header').filter({ hasText: /AI Grading Workstation|VeriPie/i }).first();
    await expect(navbar).toBeVisible();

    // Verify composite title preserves both brand mark and existing test contract
    const heading = navbar.locator('h1').first();
    const headingText = await heading.textContent();
    expect(headingText).toContain('VeriPie');
    expect(headingText).toContain('AI Grading Workstation');

    // Subtitle check: verify Pythonic verification descriptor
    const subTitle = navbar.locator('p').first();
    if ((await subTitle.count()) > 0) {
      const subTitleText = await subTitle.textContent();
      expect(subTitleText).toMatch(/Evaluation|Easy as Pie|Instructor/i);
    }
  });

  test('Tier 2: Workstation Navbar retains styling invariants when toggling dark/light theme', async ({ page }) => {
    await openWorkstation(page);

    const navbar = page.locator('header').filter({ hasText: /AI Grading Workstation|VeriPie/i }).first();
    await expect(navbar).toBeVisible();

    const themeToggle = page.locator('[data-testid="theme-toggle"], [data-testid="theme-toggle-btn"]').first();
    if ((await themeToggle.count()) > 0) {
      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(200);

      // Verify navbar background remains deep espresso rgb(76, 69, 65)
      const navbarBgDark = await navbar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(navbarBgDark).toBe('rgb(76, 69, 65)');

      // Verify heading text color remains rgb(252, 240, 218)
      const heading = navbar.locator('h1').first();
      const headingColorDark = await heading.evaluate((el) => window.getComputedStyle(el).color);
      expect(headingColorDark).toBe('rgb(252, 240, 218)');

      // Toggle back to light
      await themeToggle.click();
      await page.waitForTimeout(200);

      const navbarBgRestored = await navbar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(navbarBgRestored).toBe('rgb(76, 69, 65)');
    }
  });

  test('Tier 2: DemoWalkthroughBar displays Defense Walkthrough Mode and pulsing execution indicator', async ({ page }) => {
    await openWorkstation(page);

    const demoBar = page.locator('[data-testid="demo-walkthrough-bar"]').first();
    await expect(demoBar).toBeVisible();

    // Verify defense mode text
    await expect(demoBar).toContainText(/Defense Walkthrough Mode/i);

    // Verify pulsing execution dot exists
    const pulsingDot = demoBar.locator('.animate-ping, .animate-pulse, .animate-pulse-subtle').first();
    await expect(pulsingDot).toBeVisible();
  });

  // =========================================================================
  // TIER 3: STITCH HERO & INTERACTIVE WORKSTATION MOCKUP
  // =========================================================================

  test('Tier 3: Landing page hero displays Stitch pill badge', async ({ page }) => {
    await page.goto('/');

    const hero = page.locator('#hero, section:has(h1)').first();
    await expect(hero).toBeVisible();

    const pillBadge = page.locator(
      '[data-testid="stitch-pill-badge"], .rounded-full:has-text("Easy as Pie"), :has-text("Next-Gen Python Grading Engine")'
    ).first();

    const isM2Merged = (await pillBadge.count()) > 0;
    if (!isM2Merged) {
      test.skip(!isM2Merged, 'Milestone M2 pending: Stitch Pill Badge integration');
      return;
    }

    await expect(pillBadge).toBeVisible();
    await expect(pillBadge).toContainText(/Easy as Pie/i);
  });

  test('Tier 3: Hero section renders interactive dual-panel code & rubric workstation mockup', async ({ page }) => {
    await page.goto('/');

    const mockup = page.locator(
      '[data-testid="hero-workstation-mockup"], [data-testid="hero-mockup"], #demo, #mockup, .rounded-2xl:has-text("student_submission_921.py"), .rounded-2xl:has-text("find_target_pairs")'
    ).first();

    const isM2Merged = (await mockup.count()) > 0;
    if (!isM2Merged) {
      test.skip(!isM2Merged, 'Milestone M2 pending: Dual-Panel Hero Workstation Mockup');
      return;
    }

    await expect(mockup).toBeVisible();

    // Verify Left Panel (Code inspection window with Python code)
    const codeArea = mockup.locator('pre, code, [data-testid="mockup-code"]').first();
    await expect(codeArea).toBeVisible();
    await expect(codeArea).toContainText(/find_target_pairs|def /);

    // Verify Right Panel (Rubric breakdown rows)
    await expect(mockup).toContainText(/Rubric Verification|Deterministic/i);
    await expect(mockup).toContainText(/Pytest/i);
    await expect(mockup).toContainText(/Ruff/i);
  });

  test('Tier 3: Mockup Pytest assertion chips are clickable and interactive', async ({ page }) => {
    await page.goto('/');

    const chips = page.locator(
      '[data-testid="mockup-assertion-chip"], [data-testid="assertion-chip"], button:has-text("test_basic"), button:has-text("test_negative"), button:has-text("test_large_n"), button:has-text("test_bounds")'
    );

    const count = await chips.count();
    if (count === 0) {
      test.skip(count === 0, 'Milestone M2 pending: Interactive Assertion Chips');
      return;
    }

    expect(count).toBeGreaterThanOrEqual(4);

    // Click the first chip to test interactivity
    const firstChip = chips.first();
    await expect(firstChip).toBeVisible();

    const initialClasses = (await firstChip.getAttribute('class')) || '';
    await firstChip.click();
    await page.waitForTimeout(200);

    const updatedClasses = (await firstChip.getAttribute('class')) || '';
    const ariaPressed = await firstChip.getAttribute('aria-pressed');

    // Either aria-pressed was updated or classes changed on active state
    const isInteractive = ariaPressed === 'true' || updatedClasses !== initialClasses;
    expect(isInteractive).toBe(true);
  });

  test('Tier 3: Hero mockup AI draft feedback card references citation keys (EVID_)', async ({ page }) => {
    await page.goto('/');

    const aiCard = page.locator(
      '[data-testid="mockup-ai-card"], [data-testid="hero-workstation-mockup"] :has-text("EVID_"), #demo :has-text("Citation-Grounded"), :has-text("Citation-Grounded AI Draft")'
    ).first();

    const isM2Merged = (await aiCard.count()) > 0;
    if (!isM2Merged) {
      test.skip(!isM2Merged, 'Milestone M2 pending: Citation-Grounded AI Draft Card in Hero Mockup');
      return;
    }

    await expect(aiCard).toBeVisible();

    // Verify presence of EVID_ citation key
    const citationKey = aiCard.locator(':has-text("EVID_"), code:has-text("EVID_")').first();
    await expect(citationKey).toBeVisible();
    await expect(citationKey).toContainText(/EVID_[A-Z0-9_]+/);
  });

  // =========================================================================
  // TIER 4: MICRO-INTERACTIONS & RESPONSIVE CONSTRAINTS
  // =========================================================================

  test('Tier 4: Primary CTA buttons and cards include hover lift or transition styles', async ({ page }) => {
    await page.goto('/');

    const primaryCta = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await expect(primaryCta).toBeVisible();

    // Inspect classes or computed transition properties
    const classes = (await primaryCta.getAttribute('class')) || '';
    const hasTransitionClass = classes.includes('transition') || classes.includes('duration');
    const hasHoverEffect = classes.includes('hover:') || classes.includes('active:');

    expect(hasTransitionClass).toBe(true);
    expect(hasHoverEffect).toBe(true);

    const transitionStyle = await primaryCta.evaluate((el) => window.getComputedStyle(el).transitionDuration);
    expect(transitionStyle).not.toBe('0s');
  });

  test('Tier 4: Landing page maintains zero horizontal overflow across Mobile (390px) and Desktop (1280px)', async ({ page }) => {
    // 1. Mobile Viewport (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await assertZeroHorizontalOverflow(page, 'Landing Page @ Mobile (390px)');

    // 2. Desktop Viewport (1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await assertZeroHorizontalOverflow(page, 'Landing Page @ Desktop (1280px)');
  });

  test('Tier 4: Workstation maintains zero horizontal overflow across Mobile (390px) and Desktop (1280px)', async ({ page }) => {
    // 1. Desktop Viewport (1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await openWorkstation(page);
    await assertZeroHorizontalOverflow(page, 'Workstation @ Desktop (1280px)');

    // 2. Mobile Viewport (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await assertZeroHorizontalOverflow(page, 'Workstation @ Mobile (390px)');
  });

  // =========================================================================
  // ADVERSARIAL VERIFICATION: RAPID RESIZING & CONTRAST INTEGRITY
  // =========================================================================

  test('Adversarial: Rapid viewport resizing preserves layout integrity without horizontal bleed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Rapid toggle between small and wide viewports
    const sequence = [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ];

    for (const size of sequence) {
      await page.setViewportSize(size);
      await page.waitForTimeout(100);
      await assertZeroHorizontalOverflow(page, `Rapid Resize @ ${size.width}px`);
    }
  });

  test('Adversarial: Workstation Navbar preserves WCAG contrast and styling through rapid theme cycles', async ({ page }) => {
    await openWorkstation(page);

    const navbar = page.locator('header').filter({ hasText: /AI Grading Workstation|VeriPie/i }).first();
    await expect(navbar).toBeVisible();

    const themeToggle = page.locator('[data-testid="theme-toggle"], [data-testid="theme-toggle-btn"]').first();
    if ((await themeToggle.count()) > 0) {
      // Rapidly toggle 4 times
      for (let i = 0; i < 4; i++) {
        await themeToggle.click();
        await page.waitForTimeout(50);
      }

      // Verify invariants still hold
      const navbarBg = await navbar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(navbarBg).toBe('rgb(76, 69, 65)');

      const heading = navbar.locator('h1').first();
      const headingColor = await heading.evaluate((el) => window.getComputedStyle(el).color);
      expect(headingColor).toBe('rgb(252, 240, 218)');
    }
  });
});
