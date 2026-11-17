/**
 * Plumora Product Realism Browser E2E Acceptance Audit Script
 *
 * Verifies complete realistic learner journey in a fresh, un-mocked Chromium browser context:
 * 1. Unauthenticated landing: clean registration & login screen (no seed account pickers in learner flow)
 * 2. Self-registration via UI form with Argon2id & session cookie creation
 * 3. Session persistence across F5 page reload (RFC 6265bis dev/prod cookie naming)
 * 4. Fresh learner state isolation: begins at 0/12 mastered
 * 5. DAG Locked concept inspection & prerequisite explanation
 * 6. Honest AI Recommendation & Learner Autonomy (no "tối ưu nhất", free choice notice)
 * 7. Lesson reader (rich markdown) -> MCQ Quiz execution -> Instant pass result (≥ 75%)
 * 8. Mastery progress updates to 1/12 (8%)
 * 9. Attempt History inspection via Header button & Modal (REAL-05 API)
 * 10. Logout and session termination verification
 *
 * Exit code is strictly 1 if ANY condition fails or unhandled page error occurs.
 */

const fs = require('fs');
const path = require('path');

function resolvePlaywright() {
  const candidatePackages = [
    process.env.PLAYWRIGHT_PACKAGE_PATH,
    path.join(__dirname, '../frontend/node_modules/playwright'),
    'playwright',
  ].filter(Boolean);

  const home = process.env.HOME || require('os').homedir();
  const goCache = path.join(home, '.cache/ms-playwright-go');
  if (fs.existsSync(goCache)) {
    try {
      const versions = fs.readdirSync(goCache);
      for (const ver of versions) {
        candidatePackages.push(path.join(goCache, ver, 'package'));
      }
    } catch {}
  }

  for (const pkg of candidatePackages) {
    try {
      const mod = require(pkg);
      if (mod.chromium) return mod.chromium;
    } catch {}
  }
  throw new Error('Playwright chromium could not be resolved.');
}

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }
  const systemCandidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
  for (const cand of systemCandidates) {
    if (fs.existsSync(cand)) return cand;
  }
  const home = process.env.HOME || require('os').homedir();
  const cacheDir = path.join(home, '.cache/ms-playwright');
  if (fs.existsSync(cacheDir)) {
    try {
      const entries = fs.readdirSync(cacheDir).filter((d) => d.startsWith('chromium-'));
      for (const d of entries) {
        const exe = path.join(cacheDir, d, 'chrome-linux64/chrome');
        if (fs.existsSync(exe)) return exe;
      }
    } catch {}
  }
  return undefined;
}

(async () => {
  const out = {
    timestamp: new Date().toISOString(),
    errors: [],
    checks: {},
  };

  const chromium = resolvePlaywright();
  const executablePath = resolveChromiumExecutable();

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await chromium.launch(launchOptions);
  const targetBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
  const apiBaseUrl = process.env.BACKEND_BASE_URL || targetBaseUrl;

  try {
    // 1. Start with completely fresh, isolated browser context (no pre-injected tokens or cookies)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => out.errors.push(e.message));

    await page.goto(targetBaseUrl);
    await page.getByTestId('scr01-auth-section').waitFor({ timeout: 10000 });
    out.checks.unauthenticatedLanding = true;

    // 2. Switch to Self-Registration Tab
    await page.getByTestId('tab-register-btn').click();
    await page.getByTestId('input-display-name').waitFor({ timeout: 3000 });

    const username = `real_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const displayName = 'Học viên Thực nghiệm Kỹ thuật';
    const password = 'RealPassword#2026';

    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-display-name').fill(displayName);
    await page.getByTestId('input-password').fill(password);

    // Submit registration form via UI
    await page.getByTestId('login-submit-btn').click();

    // 3. Confirm transition into Authenticated Roadmap
    await page.getByTestId('global-mastery-counter').waitFor({ timeout: 10000 });
    const initialMasteryText = await page.getByTestId('global-mastery-counter').innerText();
    out.checks.initialFreshMastery = initialMasteryText;
    out.checks.freshStateIsZero = initialMasteryText.includes('0 / 12');

    const activeUserText = await page.getByTestId('active-username').innerText();
    out.checks.activeUsernameMatches = activeUserText === username;

    // 4. Test Session Persistence Across Page Reload (R1 RFC 6265bis fix)
    await page.reload();
    await page.getByTestId('global-mastery-counter').waitFor({ timeout: 10000 });
    const reloadedUserText = await page.getByTestId('active-username').innerText();
    out.checks.sessionPersistedAcrossReload = reloadedUserText === username;

    // 5. Test Locked Concept & Prerequisite Reason (SCR-02 -> SCR-Locked)
    // Click on locked 'sec-authn'
    const lockedNodeBtn = page.getByTestId('open-lesson-sec-authn');
    await lockedNodeBtn.click();
    await page.getByTestId('scr08-locked-view').waitFor({ timeout: 5000 });
    const lockedAlertText = await page.getByTestId('scr08-locked-view').innerText();
    out.checks.lockedReasonExplained =
      lockedAlertText.includes('đang khóa') &&
      lockedAlertText.includes('tiên quyết');

    // Return to Roadmap
    await page.getByTestId('back-to-roadmap-btn').click();
    await page.getByTestId('ai-recommendation-banner').waitFor({ timeout: 5000 });

    // 6. Test AI Recommendation Banner & Learner Autonomy
    const recBannerText = await page.getByTestId('ai-recommendation-banner').innerText();
    out.checks.recommendationGrounded =
      !recBannerText.includes('tối ưu nhất') &&
      !recBannerText.includes('hoàn hảo tuyệt đối') &&
      recBannerText.includes('Gợi ý mang tính định hướng. Bạn có thể tự do chọn bất kỳ bài học nào đã mở khóa');

    // 7. Proceed to Recommended Lesson (SCR-03)
    await page.getByTestId('start-recommended-lesson-btn').click();
    await page.getByTestId('lesson-markdown-body').waitFor({ timeout: 10000 });
    const lessonTitle = await page.getByRole('heading', { level: 1 }).innerText();
    out.checks.lessonRendered = lessonTitle.length > 0;

    // 8. Proceed to Quiz (SCR-04)
    await page.getByTestId('start-quiz-btn').click();
    await page.getByTestId('scr04-quiz-section').waitFor({ timeout: 5000 });

    // Answer questions to pass dynamically based on recommended concept
    const isNet = lessonTitle.toLowerCase().includes('internet');
    const answers = isNet ? ['B', 'A', 'D', 'C'] : ['C', 'D', 'A', 'B'];
    for (let i = 0; i < 4; i++) {
      await page.getByTestId(`quiz-q${i + 1}-opt-${answers[i]}`).locator('..').click();
    }

    await page.getByTestId('submit-quiz-btn').click();

    // 9. Verify Pass Result in QuizResultCard
    await page.getByTestId('quiz-result-card').waitFor({ timeout: 10000 });
    const resultText = await page.getByTestId('quiz-result-card').innerText();
    out.checks.quizPassed =
      resultText.includes('ĐẠT CHUẨN THÔNG THẠO KHÁI NIỆM') &&
      resultText.includes('4 / 4 câu đúng');

    // Return to Roadmap and verify mastery incremented to 1/12 (8%)
    await page.getByTestId('back-to-roadmap-after-quiz-btn').click();
    await page.getByTestId('global-mastery-counter').waitFor({ timeout: 5000 });
    const updatedMasteryText = await page.getByTestId('global-mastery-counter').innerText();
    out.checks.updatedMastery = updatedMasteryText;
    out.checks.masteryIncremented = updatedMasteryText.includes('1 / 12');

    // 10. Check Attempt History Modal (REAL-05)
    await page.getByTestId('open-history-modal-btn').click();
    await page.getByTestId('attempt-history-modal').waitFor({ timeout: 5000 });
    const historyModalText = await page.getByTestId('attempt-history-modal').innerText();
    out.checks.historyModalRecorded =
      historyModalText.includes('100%') &&
      historyModalText.includes('ĐẠT (PASSED)');

    // Close History Modal
    await page.getByTestId('close-history-modal-btn').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="attempt-history-modal"]'));

    // 11. Test Safe Logout
    await page.getByTestId('logout-btn').click();
    await page.getByTestId('scr01-auth-section').waitFor({ timeout: 5000 });

    // Verify session terminated after logout: reload should stay on auth page
    await page.reload();
    await page.getByTestId('scr01-auth-section').waitFor({ timeout: 5000 });
    out.checks.logoutTerminatedSession = (await page.getByTestId('global-mastery-counter').count()) === 0;

    out.username = username;
    out.allChecksPassed =
      out.errors.length === 0 &&
      out.checks.unauthenticatedLanding === true &&
      out.checks.freshStateIsZero === true &&
      out.checks.activeUsernameMatches === true &&
      out.checks.sessionPersistedAcrossReload === true &&
      out.checks.lockedReasonExplained === true &&
      out.checks.recommendationGrounded === true &&
      out.checks.lessonRendered === true &&
      out.checks.quizPassed === true &&
      out.checks.masteryIncremented === true &&
      out.checks.historyModalRecorded === true &&
      out.checks.logoutTerminatedSession === true;

    if (!out.allChecksPassed) {
      process.exitCode = 1;
    }
  } catch (err) {
    out.failure = err.stack || String(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    const resultPath = path.join(__dirname, '../docs/verification/artifacts/audit_product_realism_results.json');
    fs.writeFileSync(resultPath, JSON.stringify(out, null, 2), 'utf-8');
    console.log(JSON.stringify(out, null, 2));
  }
})();
