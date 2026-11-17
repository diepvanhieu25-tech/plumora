/**
 * Plumora MVP Quality Hardening Independent End-to-End Audit Script (H1, H4, H5, H6).
 *
 * Verifies in real headless Chromium:
 * 1. Unauthenticated Route Guard (SCR-01)
 * 2. Fresh User State Isolation (0/12, never fake 4/12)
 * 3. Pedagogical Quiz Integrity (All-A exploit prevented; 25% < 75%)
 * 4. Monotonic Mastery & State Persistence
 * 5. Interleaved Operations (A -> B -> Replay A preserves original version & newly_unlocked)
 * 6. Cross-Concept submission_id Collision Rejection (409 Conflict)
 * 7. Truthful Recommendation Banner (H4: fallback_rule never claims DQN or optimal; degraded flag)
 * 8. Mobile Responsiveness & Element Clipping at 390px (H6: no element right > 395px, checkpoint wraps/truncates)
 * 9. WAI-ARIA Dialog Accessibility & Focus Trap / Restore (H6: focus enters modal/drawer on open, restores on close)
 * 10. API Network Failure Resilience (F1: clear error banner + retry button)
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
  throw new Error('Playwright chromium could not be resolved. Set PLAYWRIGHT_PACKAGE_PATH.');
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

const isNegativeControl = process.argv.includes('--negative-control');

(async () => {
  const out = {
    timestamp: new Date().toISOString(),
    isNegativeControl,
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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => out.errors.push(e.message));

    // 1. Unauthenticated Route Guard Check (SCR-01)
    await page.goto(targetBaseUrl);
    await page.getByTestId('scr01-auth-section').waitFor({ timeout: 10000 });
    out.checks.unauthRoadmapAbsent = (await page.getByTestId('global-mastery-counter').count()) === 0;

    // 2. Register Isolated Test Account
    const username = `audit_h_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const reg = await ctx.request.post(`${apiBaseUrl}/api/v1/auth/register`, {
      data: {
        username,
        display_name: 'Plumora Audit Learner',
        password: 'ValidAuditPass#2026',
      },
    });
    out.registrationStatus = reg.status();
    const account = await reg.json();
    if (reg.status() !== 201) throw new Error(`Registration failed: ${JSON.stringify(account)}`);

    const headers = { Authorization: `Bearer ${account.access_token}` };
    await ctx.setExtraHTTPHeaders(headers);
    await page.reload();

    // 3. Fresh Account Mastery Isolation (F1: 0/12, never fake 4/12)
    await page.getByTestId('global-mastery-counter').waitFor({ timeout: 10000 });
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="global-mastery-counter"]')?.textContent.includes('0 / 12'),
    );
    out.checks.freshAccountMastery = await page.getByTestId('global-mastery-counter').innerText();

    // 4. Recommendation Check
    const recResp = await ctx.request.post(`${apiBaseUrl}/api/v1/recommendations`, { headers });
    const rec = await recResp.json();
    out.checks.initialRecommendation = {
      status: rec.status,
      policy_source: rec.policy_source,
      state_source: rec.state_source,
      concept: rec.recommended_concept?.slug,
    };

    // 5. Navigate to recommended lesson (SCR-03) -> Quiz (SCR-04)
    await page.getByTestId('start-recommended-lesson-btn').click();
    await page.getByTestId('lesson-markdown-body').waitFor({ timeout: 10000 });
    await page.getByTestId('start-quiz-btn').click();

    // 6. Test F2: All-A exploit is impossible (os-basics correct keys: C, D, A, B)
    for (let i = 1; i <= 4; i++) {
      await page.getByTestId(`quiz-q${i}-opt-A`).locator('..').click();
    }
    const responsePromiseFail = page.waitForResponse(
      (r) => r.url().endsWith('/attempts') && r.request().method() === 'POST',
    );
    await page.getByTestId('submit-quiz-btn').click();
    const failResp = await responsePromiseFail;
    const failAttempt = await failResp.json();
    out.checks.allAAttemptResult = {
      correct_count: failAttempt.correct_count,
      attempt_score: failAttempt.attempt_score,
      passed: failAttempt.passed,
    };

    // 7. Test Passing Concept A (os-basics: C, D, A, B)
    await page.getByTestId('retry-quiz-btn').click();
    await page.getByTestId('quiz-q1-opt-C').locator('..').click();
    await page.getByTestId('quiz-q2-opt-D').locator('..').click();
    await page.getByTestId('quiz-q3-opt-A').locator('..').click();
    await page.getByTestId('quiz-q4-opt-B').locator('..').click();

    const responsePromisePass = page.waitForResponse(
      (r) => r.url().endsWith('/attempts') && r.request().method() === 'POST',
    );
    await page.getByTestId('submit-quiz-btn').click();
    const passResp = await responsePromisePass;
    const passRequestData = passResp.request().postDataJSON();
    const passAttempt = await passResp.json();
    out.checks.passAttemptResult = {
      correct_count: passAttempt.correct_count,
      attempt_score: passAttempt.attempt_score,
      passed: passAttempt.passed,
      state_version: passAttempt.state_version,
      newly_unlocked_slugs: passAttempt.newly_unlocked_slugs,
    };

    await page.getByTestId('quiz-result-card').waitFor({ timeout: 10000 });

    // 8. Verify Page Reload Preserves 1/12
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="global-mastery-counter"]')?.textContent.includes('1 / 12'),
    );
    out.checks.persistedMastery = await page.getByTestId('global-mastery-counter').innerText();

    // 9. Interleaved Operation (H2/H5): Take Concept B (net-internet)
    // Pass net-internet to increment state_version beyond Concept A's version
    const netInternetQuestionsResp = await ctx.request.get(`${apiBaseUrl}/api/v1/concepts/net-internet`, { headers });
    const netInternetData = await netInternetQuestionsResp.json();
    const cryptoMod = require('crypto');
    const conceptBSubId = cryptoMod.randomUUID();
    // Correct answers for net-internet: B, A, D, C
    const conceptBAnswers = [
      { question_id: netInternetData.questions[0].id, selected_option: 'B' },
      { question_id: netInternetData.questions[1].id, selected_option: 'A' },
      { question_id: netInternetData.questions[2].id, selected_option: 'D' },
      { question_id: netInternetData.questions[3].id, selected_option: 'C' },
    ];
    const conceptBResp = await ctx.request.post(`${apiBaseUrl}/api/v1/concepts/net-internet/attempts`, {
      headers,
      data: { submission_id: conceptBSubId, answers: conceptBAnswers },
    });
    if (conceptBResp.status() !== 200) {
      throw new Error(`Interleaved attempt failed with status ${conceptBResp.status()}: ${await conceptBResp.text()}`);
    }
    const conceptBResult = await conceptBResp.json();
    out.checks.interleavedAttemptResult = {
      status: conceptBResp.status(),
      passed: conceptBResult.passed,
      state_version: conceptBResult.state_version,
      higherThanA: conceptBResult.state_version > passAttempt.state_version,
    };

    // 10. Replay Concept A with original submission_id AFTER interleaved operation (H2/H5)
    const replayResp = await ctx.request.post(passResp.url(), { headers, data: passRequestData });
    const replayed = await replayResp.json();
    out.checks.idempotencyReplay = {
      idempotent_replay: replayed.idempotent_replay,
      state_version: replayed.state_version,
      original_state_version: passAttempt.state_version,
      state_version_preserved: replayed.state_version === passAttempt.state_version,
      newly_unlocked_slugs: replayed.newly_unlocked_slugs,
      original_unlocked_slugs: passAttempt.newly_unlocked_slugs,
      unlocked_preserved: JSON.stringify(replayed.newly_unlocked_slugs) === JSON.stringify(passAttempt.newly_unlocked_slugs),
    };

    // 11. Cross-Concept submission_id Collision (409 Conflict)
    const conflictData = {
      ...passRequestData,
      concept_action_id: 2, // web-http
    };
    const conflictResp = await ctx.request.post(
      `${apiBaseUrl}/api/v1/concepts/web-http/attempts`,
      { headers, data: conflictData },
    );
    out.checks.submissionIdReuseStatus = conflictResp.status(); // Must be 409

    // 12. Truthful Recommendation Banner probe (H4)
    // Inject fallback_rule response with degraded=true and checkpoint=null
    const fallbackRec = {
      ...rec,
      policy_source: 'fallback_rule',
      degraded: true,
      checkpoint_sha256: null,
      recommended_concept: {
        action_id: 3,
        slug: 'db-relational',
        title: isNegativeControl
          ? 'CSDL Quan hệ (DQN POLICY: Khuyến nghị tối ưu nhất)'
          : 'CSDL Quan hệ & SQL cơ bản',
        tier: 2,
      },
    };
    await page.route('**/api/v1/recommendations', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fallbackRec),
      }),
    );
    await page.reload();
    await page.getByTestId('ai-recommendation-banner').waitFor({ timeout: 10000 });

    const fallbackBannerText = await page.getByTestId('ai-recommendation-banner').innerText();
    out.checks.fallbackBannerText = fallbackBannerText;
    out.checks.fallbackLabelValid =
      fallbackBannerText.includes('KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ (TOPO FALLBACK)') &&
      !fallbackBannerText.includes('DQN POLICY') &&
      !fallbackBannerText.includes('tối ưu nhất') &&
      fallbackBannerText.includes('Quy tắc thứ tự Topo') &&
      fallbackBannerText.includes('Chế độ dự phòng');

    const fallbackScreenshotPath = path.join(__dirname, '../docs/verification/artifacts/audit_fallback_probe.png');
    await page.screenshot({ path: fallbackScreenshotPath, fullPage: true });

    // 13. Mobile Responsiveness & Clipping Probe at 390px (H6)
    await page.unroute('**/api/v1/recommendations');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByTestId('ai-recommendation-banner').waitFor({ timeout: 10000 });

    out.checks.mobileOverflow = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    }));

    out.checks.mobileClipping = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('button, span, p, h2, h3, a, input, [role="button"]')];
      const clipped = candidates
        .filter((e) => {
          const r = e.getBoundingClientRect();
          // Element must be visible with dimensions and protruding beyond viewport boundaries
          return r.width > 0 && r.height > 0 && (r.right > innerWidth + 5 || r.left < -5);
        })
        .slice(0, 10)
        .map((e) => ({
          text: (e.textContent || '').trim().slice(0, 80),
          right: e.getBoundingClientRect().right,
          width: e.getBoundingClientRect().width,
        }));
      return {
        clippedCount: clipped.length,
        clipped,
      };
    });

    out.checks.mobileDrawerButtonVisible = await page.getByTestId('open-provenance-drawer-btn').isVisible();
    const mobileScreenshotPath = path.join(__dirname, '../docs/verification/artifacts/audit_mobile_probe.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });

    // 14. Accessibility: Focus Trap and Restore on Dialogs (H6)
    await page.setViewportSize({ width: 1440, height: 1000 });

    // 14.1 Provenance Drawer focus check & restore
    const openDrawerBtn = page.getByTestId('open-provenance-drawer-btn');
    await openDrawerBtn.focus();
    await openDrawerBtn.click();
    await page.getByTestId('scr06-provenance-drawer').waitFor({ timeout: 5000 });
    out.checks.drawerInitialFocusInside = await page.evaluate(() => {
      const drawer = document.querySelector('[data-testid="scr06-provenance-drawer"]');
      return drawer ? drawer.contains(document.activeElement) : false;
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-testid="scr06-provenance-drawer"]'));
    out.checks.drawerFocusRestored = await page.evaluate(() => {
      return document.activeElement?.getAttribute('data-testid') === 'open-provenance-drawer-btn';
    });

    // 14.2 Preset Modal focus check, Tab loop & restore
    const openPresetBtn = page.getByTestId('preset-btn-foundation_ready');
    await openPresetBtn.focus();
    await openPresetBtn.click();
    await page.getByTestId('scr05-preset-modal').waitFor({ timeout: 5000 });
    out.checks.modalInitialFocusInside = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="scr05-preset-modal"]');
      return modal ? modal.contains(document.activeElement) : false;
    });

    await page.keyboard.press('Tab');
    const tab1Inside = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="scr05-preset-modal"]');
      return modal ? modal.contains(document.activeElement) : false;
    });
    await page.keyboard.press('Tab');
    const tab2Inside = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="scr05-preset-modal"]');
      return modal ? modal.contains(document.activeElement) : false;
    });
    out.checks.modalTabTrapped = tab1Inside && tab2Inside;

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-testid="scr05-preset-modal"]'));
    out.checks.modalFocusRestored = await page.evaluate(() => {
      return document.activeElement?.getAttribute('data-testid') === 'preset-btn-foundation_ready';
    });

    // 15. API Network Failure Resilience (F1)
    await page.route('**/api/v1/roadmap', (r) => r.abort());
    await page.route('**/api/v1/recommendations', (r) => r.abort());
    await page.reload();
    await page.getByTestId('global-mastery-counter').waitFor({ timeout: 10000 });

    const errorBannerText = await page.getByTestId('ai-recommendation-banner').innerText();
    out.checks.apiFailureSafe =
      !errorBannerText.includes('DQN Policy v1.0.0') &&
      errorBannerText.includes('Không thể tải') &&
      (await page.getByTestId('retry-roadmap-btn').isVisible());

    out.username = username;

    // Verdict computation (H5)
    out.allChecksPassed =
      out.errors.length === 0 &&
      out.checks.unauthRoadmapAbsent === true &&
      out.checks.allAAttemptResult.passed === false &&
      out.checks.allAAttemptResult.attempt_score === 0.25 &&
      out.checks.passAttemptResult.passed === true &&
      out.checks.interleavedAttemptResult.passed === true &&
      out.checks.interleavedAttemptResult.higherThanA === true &&
      out.checks.idempotencyReplay.state_version_preserved === true &&
      out.checks.idempotencyReplay.unlocked_preserved === true &&
      out.checks.submissionIdReuseStatus === 409 &&
      out.checks.fallbackLabelValid === true &&
      out.checks.mobileOverflow.noOverflow === true &&
      out.checks.mobileClipping.clippedCount === 0 &&
      out.checks.mobileDrawerButtonVisible === true &&
      out.checks.drawerInitialFocusInside === true &&
      out.checks.drawerFocusRestored === true &&
      out.checks.modalInitialFocusInside === true &&
      out.checks.modalTabTrapped === true &&
      out.checks.modalFocusRestored === true &&
      out.checks.apiFailureSafe === true;

    if (!out.allChecksPassed || out.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    out.failure = err.stack || String(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    const artifactJsonPath = path.join(__dirname, '../docs/verification/artifacts/audit_mvp_hardening_results.json');
    fs.writeFileSync(artifactJsonPath, JSON.stringify(out, null, 2), 'utf-8');
    fs.writeFileSync('/tmp/plumora-mvp-audit-verified.json', JSON.stringify(out, null, 2), 'utf-8');
    console.log(JSON.stringify(out, null, 2));
  }
})();
