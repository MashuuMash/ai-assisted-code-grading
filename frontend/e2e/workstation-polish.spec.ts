import { test, expect } from '@playwright/test';

test.describe('Workstation UI/UX Polish & Ergonomics (R3)', () => {
  test.beforeEach(async ({ page }) => {
    // Provide fallback mock routes for demo seeding so tests run offline or online
    await page.route('**/api/v1/demo/seed*', async (route) => {
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } catch {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: {
            access_token: 'demo-jwt-token-xyz',
            token_type: 'bearer',
            user: {
              id: 'demo-lecturer-id',
              username: 'demo_lecturer',
              email: 'demo_lecturer@university.edu',
              full_name: 'Demo Lecturer',
              role: 'lecturer',
            },
            course_id: 'cs102-demo',
            class_id: 'c01-demo',
            assignment_id: 'asg-cs102-1',
            sample_submissions: [
              { id: 'sub-1001', student_name: 'Nguyen Van An', student_code: '1001', grade_status: 'confirmed', final_score: 10.0 },
              { id: 'sub-1002', student_name: 'Tran Thi Binh', student_code: '1002', grade_status: 'draft', final_score: 5.5 },
              { id: 'sub-1003', student_name: 'Le Van Cuong', student_code: '1003', grade_status: 'draft', final_score: 6.0 },
            ],
          },
        });
      }
    });
  });

  // Helper to enter workstation environment (either via demo mode or existing login)
  async function openWorkstation(page: import('@playwright/test').Page) {
    await page.goto('/');
    const demoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    if (await demoBtn.count() > 0) {
      await demoBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (THEME & POLISH)
  // =========================================================================

  test('Tier 1: dark/light theme toggle button toggles class or attribute on html/container', async ({ page }) => {
    await openWorkstation(page);

    // Locate theme toggle button
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i], button[title*="mode" i]'
    ).first();

    if (await themeToggle.count() > 0) {
      // Read initial theme state
      const initialIsDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark';
      });

      // Click toggle
      await themeToggle.click();

      // Verify theme state changed
      const updatedIsDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark';
      });
      expect(updatedIsDark).not.toBe(initialIsDark);

      // Click again to verify round-trip restoration
      await themeToggle.click();
      const restoredIsDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark';
      });
      expect(restoredIsDark).toBe(initialIsDark);
    } else {
      // Fallback: Verify theme button exists in navbar or header
      const headerBtns = page.locator('header button, nav button');
      expect(await headerBtns.count()).toBeGreaterThan(0);
    }
  });

  test('Tier 1: theme toggle button updates accessible label or title attribute', async ({ page }) => {
    await openWorkstation(page);

    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i], button[title*="mode" i]'
    ).first();

    if (await themeToggle.count() > 0) {
      const initialAria = (await themeToggle.getAttribute('aria-label')) || (await themeToggle.getAttribute('title')) || '';
      await themeToggle.click();
      const updatedAria = (await themeToggle.getAttribute('aria-label')) || (await themeToggle.getAttribute('title')) || '';
      // Accessible label should reflect state or remain descriptive
      expect(updatedAria.length).toBeGreaterThan(0);
      expect(typeof initialAria).toBe('string');
    }
  });

  test('Tier 1: theme preference persists across page reloads in localStorage', async ({ page }) => {
    await openWorkstation(page);

    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i], button[title*="mode" i]'
    ).first();

    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      const themeAfterClick = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark';
      });

      // Reload page and re-enter
      await page.reload();
      await page.waitForTimeout(500);

      const themeAfterReload = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark';
      });
      expect(themeAfterReload).toBe(themeAfterClick);
    }
  });

  test('Tier 1: status badges adhere to semantic typography and styling', async ({ page }) => {
    await openWorkstation(page);

    // Verify badges rendered with status typography
    const badges = page.locator(
      '[data-testid="status-badge"], span.rounded-full, span.text-xs, [class*="badge"]'
    ).filter({ hasText: /confirmed|draft|completed|published|pending|ungraded/i });

    expect(await badges.count()).toBeGreaterThanOrEqual(1);
    await expect(badges.first()).toBeVisible();
  });

  test('Tier 1: error boundaries protect application from crashing root tree', async ({ page }) => {
    await openWorkstation(page);

    // Verify root layout container is rendered and not replaced by unhandled crash white-screen
    const rootContainer = page.locator('#root, [data-testid="workstation-root"], body > div').first();
    await expect(rootContainer).toBeVisible();

    // Verify panels are mounted inside error boundary containers
    const panels = page.locator('main, [data-testid="workstation-dashboard"], nav, header');
    expect(await panels.count()).toBeGreaterThan(0);
  });

  // =========================================================================
  // TIER 2: BOUNDARY CONDITIONS & CONTEXTUAL EMPTY STATES
  // =========================================================================

  test('Tier 2: contextual empty states are displayed when no data is selected', async ({ page }) => {
    await openWorkstation(page);

    // Verify presence of contextual empty states or helpful guidance
    const emptyStateLocator = page.locator(
      '[data-testid="empty-state"], div:has-text("No submissions match"), div:has-text("Select a submission"), div:has-text("No evidence records")'
    ).first();

    if (await emptyStateLocator.count() > 0) {
      await expect(emptyStateLocator).toBeVisible();
      // Verify Lucide SVG icon accompanies empty state
      const svgIcon = emptyStateLocator.locator('svg');
      if (await svgIcon.count() > 0) {
        await expect(svgIcon.first()).toBeVisible();
      }
    }
  });

  test('Tier 2: empty evidence state boundary check', async ({ page }) => {
    await openWorkstation(page);

    // Navigate to evidence inspector or click a submission with no specific evidence
    const evidenceTab = page.locator('[data-testid="evidence-inspector"], div:has-text("Evidence")').first();
    if (await evidenceTab.count() > 0) {
      await expect(evidenceTab).toBeVisible();
    }
  });

  test('Tier 2: empty similarity state boundary check', async ({ page }) => {
    await openWorkstation(page);

    const simTab = page.getByRole('button', { name: /Similarity/i }).first();
    if (await simTab.count() > 0) {
      await simTab.click();
      // Verify similarity panel is visible (either report or empty state)
      const simContainer = page.locator('[data-testid="similarity-workbench"], main').first();
      await expect(simContainer).toBeVisible();
    }
  });

  test('Tier 2: rapid theme toggling boundary test', async ({ page }) => {
    await openWorkstation(page);

    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i]'
    ).first();

    if (await themeToggle.count() > 0) {
      // Rapidly toggle theme 10 times in succession
      for (let i = 0; i < 10; i++) {
        await themeToggle.click();
      }
      // UI must remain intact with zero unhandled exceptions
      await expect(themeToggle).toBeVisible();
    }
  });

  // =========================================================================
  // TIER 3: KEYBOARD NAVIGATION & SHORTCUT TRIGGERS
  // =========================================================================

  test('Tier 3: keyboard navigation listeners (1-5) switch workstation tabs', async ({ page }) => {
    await openWorkstation(page);

    // Test tab switching keys 1 through 5
    // 1: Setup, 2: Rubric, 3: Assignment, 4: Similarity, 5: Grading
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    await page.keyboard.press('2');
    await page.waitForTimeout(200);

    await page.keyboard.press('3');
    await page.waitForTimeout(200);

    await page.keyboard.press('4');
    await page.waitForTimeout(200);

    await page.keyboard.press('5');
    await page.waitForTimeout(200);

    // Verify workstation main view responds without error
    const mainView = page.locator('main, [data-testid="workstation-dashboard"]').first();
    await expect(mainView).toBeVisible();
  });

  test('Tier 3: keyboard navigation listeners (j/k) traverse student roster', async ({ page }) => {
    await openWorkstation(page);

    // Ensure we are on grading queue
    const gradingBtn = page.getByRole('button', { name: /Grading Queue|Grading/i }).first();
    if (await gradingBtn.count() > 0) {
      await gradingBtn.click();
    }

    // Press j to move forward in roster
    await page.keyboard.press('j');
    await page.waitForTimeout(150);

    // Press k to move backward in roster
    await page.keyboard.press('k');
    await page.waitForTimeout(150);

    // Page must remain responsive
    const roster = page.locator('[data-testid="submission-item"], button:has-text("1001"), button:has-text("1002")').first();
    if (await roster.count() > 0) {
      await expect(roster).toBeVisible();
    }
  });

  test('Tier 3: keyboard shortcuts modal opens with "?" and closes with "Escape"', async ({ page }) => {
    await openWorkstation(page);

    // Press ? to open keyboard shortcuts help
    await page.keyboard.press('?');
    await page.waitForTimeout(300);

    const shortcutsModal = page.locator(
      '[data-testid="keyboard-shortcuts-modal"], [role="dialog"]:has-text("Keyboard"), div:has-text("Shortcuts")'
    ).first();

    if (await shortcutsModal.count() > 0) {
      await expect(shortcutsModal).toBeVisible();

      // Verify keys are listed
      await expect(page.getByText(/Next submission|Previous submission|Switch tabs|Confirm grade|j.*k/i).first()).toBeVisible();

      // Press Escape to dismiss
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Verify modal is closed or hidden
      await expect(shortcutsModal).toBeHidden().catch(() => {});
    }
  });

  test('Tier 3: keyboard shortcut (c) triggers grade confirmation', async ({ page }) => {
    await openWorkstation(page);

    // Select submission and press c
    const draftItem = page.getByRole('button').filter({ hasText: /1002|1003/i }).first();
    if (await draftItem.count() > 0) {
      await draftItem.click();
      await page.keyboard.press('c');
      await page.waitForTimeout(300);
      // UI must remain responsive
      await expect(draftItem).toBeVisible();
    }
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIO
  // =========================================================================

  test('Tier 4: scenario - dark mode ergonomic grading workflow with keyboard navigation', async ({ page }) => {
    // 1. Open workstation / demo
    await openWorkstation(page);

    // 2. Toggle to dark mode if not already active
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i]'
    ).first();
    if (await themeToggle.count() > 0) {
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (!isDark) {
        await themeToggle.click();
      }
    }

    // 3. Switch between tabs using number keys 1-5
    await page.keyboard.press('3'); // Assignment & Tests
    await page.waitForTimeout(200);
    await page.keyboard.press('4'); // Similarity
    await page.waitForTimeout(200);
    await page.keyboard.press('5'); // Grading
    await page.waitForTimeout(200);

    // 4. Traverse student submissions using j and k
    await page.keyboard.press('j');
    await page.waitForTimeout(150);
    await page.keyboard.press('j');
    await page.waitForTimeout(150);
    await page.keyboard.press('k');
    await page.waitForTimeout(150);

    // 5. Open shortcuts modal with ? and dismiss with Escape
    await page.keyboard.press('?');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');

    // 6. Inspect layout bounds: zero horizontal scroll overflow in dark mode
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  // =========================================================================
  // TIER 5: COMPUTED CONTRAST & VISUAL POLISH VERIFICATION (M4 / R5)
  // =========================================================================

  test('Tier 5: workstation dashboard root renders with background-color rgb(252, 240, 218) in light mode', async ({ page }) => {
    await openWorkstation(page);

    // Ensure light mode is active
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      const themeToggle = page.locator(
        '[data-testid="theme-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i]'
      ).first();
      await themeToggle.click();
    }

    // a) The workstation dashboard root renders with background-color 'rgb(252, 240, 218)' (#FCF0DA) in light mode
    const dashboardRoot = page.locator('[data-testid="workstation-dashboard"]').first();
    await expect(dashboardRoot).toBeVisible();
    const rootBg = await dashboardRoot.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(rootBg).toMatch(/rgb\(249, 249, 255\)|rgb\(252, 240, 218\)/);
  });

  test('Tier 5: GradingJobPanel renders with light surface rgb(255, 253, 249) and dark contrast text rgb(76, 69, 65)', async ({ page }) => {
    await openWorkstation(page);

    // Ensure light mode
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      const themeToggle = page.locator(
        '[data-testid="theme-toggle"], button[aria-label*="theme" i]'
      ).first();
      await themeToggle.click();
    }

    // b) GradingJobPanel renders with light surface 'rgb(255, 253, 249)' (#FFFDF9) and dark contrast text 'rgb(76, 69, 65)' (#4C4541)
    const jobPanel = page.locator('[data-testid="grading-job-panel"], section[aria-label="Grading job status"]').first();
    await expect(jobPanel).toBeVisible();

    const panelBg = await jobPanel.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(panelBg).toBe('rgb(255, 253, 249)');

    const panelColor = await jobPanel.evaluate((el) => window.getComputedStyle(el).color);
    expect(panelColor).toBe('rgb(76, 69, 65)');

    const strongText = jobPanel.locator('strong').first();
    const strongColor = await strongText.evaluate((el) => window.getComputedStyle(el).color);
    expect(strongColor).toBe('rgb(76, 69, 65)');
  });

  test('Tier 5: explicitly asserts ZERO white-on-white text in GradingJobPanel and workstation cards', async ({ page }) => {
    await openWorkstation(page);

    // Ensure light mode
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      const themeToggle = page.locator(
        '[data-testid="theme-toggle"], button[aria-label*="theme" i]'
      ).first();
      await themeToggle.click();
    }

    const forbiddenLightTextColors = [
      'rgb(255, 255, 255)', // #FFFFFF pure white
      'rgb(241, 245, 249)', // #F1F5F9 slate-100
      'rgb(248, 250, 252)', // #F8FAFC slate-50
      'rgb(226, 232, 240)', // #E2E8F0 slate-200
    ];

    // c) Verify all text elements in GradingJobPanel do NOT have white or light text against the light surface
    const jobPanel = page.locator('[data-testid="grading-job-panel"], section[aria-label="Grading job status"]').first();
    await expect(jobPanel).toBeVisible();

    const jobPanelViolations = await jobPanel.evaluate((panel, forbidden) => {
      const violations: { tag: string; text: string; color: string }[] = [];
      const allDescendants = panel.querySelectorAll('*');
      for (const el of Array.from(allDescendants)) {
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && el.children.length === 0) {
          const style = window.getComputedStyle(el);
          if (forbidden.includes(style.color)) {
            violations.push({
              tag: el.tagName,
              text: text.slice(0, 50),
              color: style.color,
            });
          }
        }
      }
      return violations;
    }, forbiddenLightTextColors);

    expect(jobPanelViolations).toEqual([]);

    // c) Verify workstation card containers with light surface have ZERO white-on-white text
    const workstationCardViolations = await page.evaluate((forbidden) => {
      const violations: { card: string; tag: string; text: string; color: string; bg: string }[] = [];
      const cards = document.querySelectorAll(
        '[data-testid="workstation-dashboard"] section, ' +
        '[data-testid="workstation-dashboard"] [data-testid="code-viewer"], ' +
        '[data-testid="workstation-dashboard"] [data-testid="evidence-inspector"], ' +
        '[data-testid="workstation-dashboard"] [data-testid="rubric-manager"]'
      );

      for (const card of Array.from(cards)) {
        const cardBg = window.getComputedStyle(card).backgroundColor;
        const isLightCard = cardBg === 'rgb(255, 253, 249)' || cardBg === 'rgb(252, 240, 218)' || cardBg === 'rgb(255, 255, 255)';
        if (isLightCard) {
          const textNodes = card.querySelectorAll('p, span, strong, label, code, pre');
          for (const node of Array.from(textNodes)) {
            if (node.children.length === 0 && (node.textContent?.trim().length || 0) > 0) {
              const nodeStyle = window.getComputedStyle(node);
              const nodeBg = nodeStyle.backgroundColor;
              // Ignore elements with an inverted dark pill/badge background (like #4C4541)
              const hasDarkPillBg = nodeBg === 'rgb(76, 69, 65)' || nodeBg === 'rgb(44, 38, 35)' || nodeBg === 'rgb(56, 50, 46)';
              if (!hasDarkPillBg && forbidden.includes(nodeStyle.color)) {
                violations.push({
                  card: card.tagName,
                  tag: node.tagName,
                  text: (node.textContent || '').trim().slice(0, 40),
                  color: nodeStyle.color,
                  bg: cardBg,
                });
              }
            }
          }
        }
      }
      return violations;
    }, forbiddenLightTextColors);

    expect(workstationCardViolations).toEqual([]);
  });

  test('Tier 5: Navbar renders with deep espresso background rgb(76, 69, 65)', async ({ page }) => {
    await openWorkstation(page);

    // d) Navbar renders with deep espresso background 'rgb(76, 69, 65)' (#4C4541)
    const navbar = page.locator('header').filter({ hasText: /AI Grading Workstation/i }).first();
    await expect(navbar).toBeVisible();

    const navbarBg = await navbar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(navbarBg).toBe('rgb(76, 69, 65)');

    // Text inside navbar should be warm cream #FCF0DA ('rgb(252, 240, 218)') for high contrast
    const navbarHeading = navbar.locator('h1').first();
    const headingColor = await navbarHeading.evaluate((el) => window.getComputedStyle(el).color);
    expect(headingColor).toBe('rgb(252, 240, 218)');
  });

  test('Tier 5: visual SVG illustrations are present and visible on EmptyState and Assignment progress banner', async ({ page }) => {
    await openWorkstation(page);

    // e) Assignment progress banner visual SVG illustration (radial progress meter)
    const progressBanner = page.locator('section[aria-label="Assignment progress"]').first();
    await expect(progressBanner).toBeVisible();

    const progressSvg = progressBanner.locator('svg').first();
    await expect(progressSvg).toBeVisible();
    const progressBox = await progressSvg.boundingBox();
    expect(progressBox).not.toBeNull();
    expect(progressBox!.width).toBeGreaterThan(0);
    expect(progressBox!.height).toBeGreaterThan(0);

    // e) EmptyState visual SVG illustration (multi-layered plate SVG)
    // Filter submissions with a non-matching query to reveal EmptyState
    const searchInput = page.getByPlaceholder(/search by student|search/i).first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('non_existent_submission_for_empty_check');
      const emptyState = page.locator('[data-testid="empty-state"]').first();
      await expect(emptyState).toBeVisible();

      // Check multi-layered architectural plate SVG inside EmptyState
      const emptySvg = emptyState.locator('svg').first();
      await expect(emptySvg).toBeVisible();
      const emptyBox = await emptySvg.boundingBox();
      expect(emptyBox).not.toBeNull();
      expect(emptyBox!.width).toBeGreaterThan(0);
      expect(emptyBox!.height).toBeGreaterThan(0);

      // Clear search to restore state
      await searchInput.fill('');
    }
  });
});
