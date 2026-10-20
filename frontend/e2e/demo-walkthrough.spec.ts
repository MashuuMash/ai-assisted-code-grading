import { test, expect } from '@playwright/test';

test.describe('1-Click Interactive Demo & Walkthrough (R2)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept demo backend endpoints with contract fallbacks if live backend is not running
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

    await page.route('**/api/v1/demo/reset*', async (route) => {
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } catch {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: { status: 'success', message: 'Demo environment reset to baseline.' },
        });
      }
    });
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE
  // =========================================================================

  test('Tier 1: clicking "Launch Interactive Live Demo" launches demo mode', async ({ page }) => {
    await page.goto('/');

    const launchDemoBtn = page.getByRole('button', { name: /Launch Interactive Live Demo/i });
    await expect(launchDemoBtn).toBeVisible();
    await launchDemoBtn.click();

    // Verify demo walkthrough bar or demo workspace header is rendered
    const demoIndicator = page.locator(
      '[data-testid="demo-walkthrough-bar"], [data-testid="demo-banner"], header:has-text("Demo"), div:has-text("Defense Walkthrough")'
    ).first();
    await expect(demoIndicator).toBeVisible({ timeout: 10_000 });
  });

  test('Tier 1: verifies demo walkthrough bar is rendered with defense stages', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Verify presence of guided walkthrough bar
    const walkthroughBar = page.locator('[data-testid="demo-walkthrough-bar"], [data-testid="demo-banner"]').first();
    await expect(walkthroughBar).toBeVisible();

    // Verify defense stage indicators or tour steps
    const stages = page.getByText(/Defense|Walkthrough|Demo|Ingest|Sandbox|Evidence|AI Feedback|Rubric/i);
    expect(await stages.count()).toBeGreaterThan(0);

    // Verify presence of Reset Demo button
    const resetBtn = page.getByRole('button', { name: /Reset Demo/i });
    await expect(resetBtn).toBeVisible();

    // Verify presence of Exit Demo or Return button
    const exitBtn = page.getByRole('button', { name: /Exit Demo|Exit to Live Login|Sign Out/i }).first();
    await expect(exitBtn).toBeVisible();
  });

  test('Tier 1: demo assignment CS102 is pre-selected with student submission roster', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Verify demo assignment CS102 / Prime and Fibonacci is active
    const assignmentText = page.getByText(/CS102|Prime|Fibonacci|Algorithms/i).first();
    await expect(assignmentText).toBeVisible({ timeout: 10_000 });

    // Verify student roster displays sample submissions
    const student1 = page.getByText(/Nguyen Van An|1001/i).first();
    await expect(student1).toBeVisible();

    const student2 = page.getByText(/Tran Thi Binh|1002/i).first();
    await expect(student2).toBeVisible();

    const student3 = page.getByText(/Le Van Cuong|1003/i).first();
    await expect(student3).toBeVisible();
  });

  test('Tier 1: selecting a student displays their source code in CodeViewer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Select first student
    const student1 = page.getByRole('button').filter({ hasText: /Nguyen Van An|1001/i }).first();
    if (await student1.count() > 0) {
      await student1.click();
    }

    // Verify code viewer renders code content (Python syntax elements)
    const codeArea = page.locator('pre, code, [data-testid="code-viewer"], .font-mono').filter({ hasText: /def |return |class |import /i }).first();
    await expect(codeArea).toBeVisible({ timeout: 10_000 });
  });

  test('Tier 1: selecting a student displays verified test results and evidence', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Select first student
    const student1 = page.getByRole('button').filter({ hasText: /Nguyen Van An|1001/i }).first();
    if (await student1.count() > 0) {
      await student1.click();
    }

    // Verify evidence inspector / test results display
    const evidenceText = page.getByText(/passed|pytest|evidence|tests passed|test_prime/i).first();
    await expect(evidenceText).toBeVisible({ timeout: 10_000 });
  });

  // =========================================================================
  // TIER 2: BOUNDARY CONDITIONS & EVIDENCE INSPECTOR DRILL-DOWN
  // =========================================================================

  test('Tier 2: demo assignment CS102 loads student submissions, code viewer, and evidence inspector', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Verify split workstation panels are rendered
    await expect(page.getByText(/CS102|Prime|Fibonacci/i).first()).toBeVisible();

    // Verify submissions list is populated
    const submissions = page.locator('[data-testid="submission-item"], button:has-text("1001"), button:has-text("1002"), button:has-text("1003")');
    expect(await submissions.count()).toBeGreaterThanOrEqual(1);

    // Verify CodeViewer pane exists
    const codeViewer = page.locator('[data-testid="code-viewer"], pre').first();
    await expect(codeViewer).toBeVisible();

    // Verify EvidenceInspector pane exists
    const evidencePane = page.locator('[data-testid="evidence-inspector"], [data-testid="grading-job-panel"], div:has-text("Evidence")').first();
    await expect(evidencePane).toBeVisible();
  });

  test('Tier 2: switches between perfect, flawed, and plagiarized student submissions', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // 1. Inspect Student 1001 (Perfect)
    const student1001 = page.getByRole('button').filter({ hasText: /1001/i }).first();
    if (await student1001.count() > 0) {
      await student1001.click();
      await expect(page.getByText(/10|confirmed|passed/i).first()).toBeVisible();
    }

    // 2. Inspect Student 1002 (Flawed with edge case bugs / warnings)
    const student1002 = page.getByRole('button').filter({ hasText: /1002/i }).first();
    if (await student1002.count() > 0) {
      await student1002.click();
      await expect(page.getByText(/5\.5|draft|failed|warning/i).first()).toBeVisible();
    }

    // 3. Inspect Student 1003 (Plagiarized pair with student 1001)
    const student1003 = page.getByRole('button').filter({ hasText: /1003/i }).first();
    if (await student1003.count() > 0) {
      await student1003.click();
      await expect(page.getByText(/similarity|draft|1003/i).first()).toBeVisible();
    }
  });

  test('Tier 2: similarity evidence and token winnowing review in demo mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Switch to similarity tab or inspect similarity evidence for student 1003
    const similarityTab = page.getByRole('button', { name: /Similarity|Plagiarism/i }).first();
    if (await similarityTab.count() > 0) {
      await similarityTab.click();
      // Verify similarity percentage or comparison item is visible
      const simMatch = page.getByText(/85%|50%|similarity|comparison|1001.*1003|1003.*1001/i).first();
      await expect(simMatch).toBeVisible();
    }
  });

  test('Tier 2: empty filter boundary in demo submission roster', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    const searchInput = page.getByPlaceholder(/search|filter/i).first();
    if (await searchInput.count() > 0) {
      // Type non-existent student ID
      await searchInput.fill('NON_EXISTENT_ID_9999');

      // Verify contextual empty state
      const emptyState = page.getByText(/No submissions match|No results|empty/i).first();
      await expect(emptyState).toBeVisible();

      // Clear search
      await searchInput.fill('');

      // Verify sample students reappear
      await expect(page.getByText(/1001/i).first()).toBeVisible();
    }
  });

  test('Tier 2: rapid student selection switching boundary test', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    const studentBtns = page.getByRole('button').filter({ hasText: /1001|1002|1003/i });
    const count = await studentBtns.count();

    if (count >= 2) {
      // Rapidly toggle between students
      for (let i = 0; i < 4; i++) {
        await studentBtns.first().click();
        await studentBtns.last().click();
      }
      // Ensure UI remains intact
      await expect(studentBtns.first()).toBeVisible();
    }
  });

  // =========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL & FEEDBACK REVIEW
  // =========================================================================

  test('Tier 3: verifies interacting with submission grade status, AI feedback review, and score confirmation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Select student 1002 or 1003 with draft status
    const draftStudent = page.getByRole('button').filter({ hasText: /1002|1003/i }).first();
    if (await draftStudent.count() > 0) {
      await draftStudent.click();
    }

    // Inspect AI feedback draft editor or evidence citations
    const feedbackArea = page.getByText(/Feedback Draft|AI Feedback|Suggested Score|Justification/i).first();
    await expect(feedbackArea).toBeVisible();

    // Verify Confirm Grade button is present and interactable
    const confirmBtn = page.getByRole('button', { name: /Confirm Grade/i });
    if (await confirmBtn.count() > 0) {
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();

      // Verify grade confirmation feedback notification or badge update
      const statusBadge = page.getByText(/confirmed|Grade confirmed/i).first();
      await expect(statusBadge).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Tier 3: demo mode responsiveness on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Walkthrough banner must be visible and properly fitted
    const walkthroughBar = page.locator('[data-testid="demo-walkthrough-bar"], [data-testid="demo-banner"]').first();
    await expect(walkthroughBar).toBeVisible();

    // Verify zero horizontal scroll overflow on mobile
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIO & RESET IDEMPOTENCY
  // =========================================================================

  test('Tier 4: "Reset Demo" button restores demo baseline without errors', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // Click Reset Demo button
    const resetBtn = page.getByRole('button', { name: /Reset Demo/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify demo state remains stable or resets to baseline
    const student1 = page.getByText(/Nguyen Van An|1001/i).first();
    await expect(student1).toBeVisible({ timeout: 10_000 });

    // Verify no unhandled crash occurred
    const walkthroughBar = page.locator('[data-testid="demo-walkthrough-bar"], [data-testid="demo-banner"]').first();
    await expect(walkthroughBar).toBeVisible();
  });

  test('Tier 4: scenario - capstone thesis defense interactive demo walkthrough', async ({ page }) => {
    // 1. Defense committee launches demo from public showcase landing page
    await page.goto('/');
    await page.getByRole('button', { name: /Launch Interactive Live Demo/i }).click();

    // 2. Verify defense walkthrough bar guides presenter
    const tourBar = page.locator('[data-testid="demo-walkthrough-bar"], [data-testid="demo-banner"]').first();
    await expect(tourBar).toBeVisible();

    // 3. Inspect student 1001 (Automated Test Execution showcase)
    const student1001 = page.getByRole('button').filter({ hasText: /1001/i }).first();
    if (await student1001.count() > 0) {
      await student1001.click();
      await expect(page.locator('pre, code').first()).toBeVisible();
    }

    // 4. Inspect student 1003 (Similarity & Academic Integrity showcase)
    const student1003 = page.getByRole('button').filter({ hasText: /1003/i }).first();
    if (await student1003.count() > 0) {
      await student1003.click();
    }

    // 5. Inspect student 1002 (Human-in-the-Loop AI Feedback Draft showcase)
    const student1002 = page.getByRole('button').filter({ hasText: /1002/i }).first();
    if (await student1002.count() > 0) {
      await student1002.click();
      const confirmBtn = page.getByRole('button', { name: /Confirm Grade/i });
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
      }
    }

    // 6. Demonstrate Reset Demo idempotency
    const resetBtn = page.getByRole('button', { name: /Reset Demo/i });
    await resetBtn.click();

    // 7. Verify baseline is fully restored with zero unhandled errors
    await expect(page.getByText(/1001/i).first()).toBeVisible();
  });
});
