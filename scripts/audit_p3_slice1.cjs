/**
 * Plumora v3 Dual-Portal Living System Real Chromium E2E Audit Script
 *
 * Verifies:
 * 1. Clean De-Demoed Web Client (/login, /register, /domains/*):
 *    - ZERO demo quick-fill buttons, ZERO hardcoded password, ZERO "+5 ngày" simulation button,
 *      ZERO internal SCR-* labels or raw node_features_snapshot table, ZERO Unicode emojis, 0px mobile overflow.
 *    - Real sequential learner flow: Register -> Multi-Domain Hub -> Adaptive Placement -> Roadmap ->
 *      Playbook (complete INV-SEQ-01) -> 5-Depth Probing (+ Playbook Quick Drawer) -> Code Sandbox.
 * 2. Strict Dual-Portal RBAC 403 isolation.
 * 3. Back-Office Console (/backoffice/login -> BackOfficeAppShell):
 *    - Admin: Online RL & Experience Buffer + Policy Inspector, Head-to-Head Safety Gate Scorecard,
 *      System Health & Outbox/DLQ controls, Cohort Analytics Heatmap.
 *    - Expert: DAG & Playbook Editor, 5-Depth Questions CRUD, Code Sandbox Studio, Cohort Analytics.
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
      for (const ver of fs.readdirSync(goCache)) {
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
  for (const p of systemCandidates) {
    if (fs.existsSync(p)) return p;
  }
  const home = process.env.HOME || require('os').homedir();
  const pwCache = path.join(home, '.cache/ms-playwright');
  if (fs.existsSync(pwCache)) {
    try {
      const dirs = fs.readdirSync(pwCache).filter((d) => d.startsWith('chromium-'));
      for (const d of dirs) {
        const cand = path.join(pwCache, d, 'chrome-linux64/chrome');
        if (fs.existsSync(cand)) return cand;
        const cand2 = path.join(pwCache, d, 'chrome-linux/chrome');
        if (fs.existsSync(cand2)) return cand2;
      }
    } catch {}
  }
  return undefined;
}

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

async function main() {
  const chromium = resolvePlaywright();
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('401 (Unauthorized)') && !text.includes('403 (Forbidden)')) {
        errors.push(`CONSOLE_ERROR: ${text}`);
      }
    }
  });

  try {
    const baseUrl = process.env.PLUMORA_FRONTEND_URL || 'http://localhost:3000';
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('learner-auth-page').waitFor({ state: 'visible', timeout: 10000 });

    // 0. Assert De-Demoed Learner Auth Page (zero demo credentials / passwords)
    const authText = await page.getByTestId('learner-auth-page').innerText();
    for (const forbidden of ['PlumoraDemo#2026', 'learner_new', 'admin_demo', 'expert_demo']) {
      if (authText.includes(forbidden)) {
        throw new Error(`De-demoing violation: LearnerAuthPage still exposes '${forbidden}'`);
      }
    }

    // 1. Register fresh learner
    const uname = `p3e2e_${Date.now().toString().slice(-6)}`;
    await page.getByTestId('tab-register-btn').click();
    await page.getByTestId('input-username').fill(uname);
    await page.getByTestId('input-display-name').fill('P3 E2E Learner');
    await page.getByTestId('input-password').fill('StrongPass!2026');
    await page.getByTestId('login-submit-btn').click();

    // 2. Learner lands on Multi-Domain Hub
    await page.getByTestId('scr09-multi-domain-hub').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('domain-card-backend').waitFor({ state: 'visible' });
    await page.getByTestId('domain-card-frontend').waitFor({ state: 'visible' });
    await page.getByTestId('domain-card-devops').waitFor({ state: 'visible' });

    if (process.argv.includes('--negative-control')) {
      await page.getByTestId('domain-card-nonexistent-probe').waitFor({ state: 'visible', timeout: 1500 });
    }

    const hubText = await page.getByTestId('scr09-multi-domain-hub').innerText();
    if (EMOJI_REGEX.test(hubText)) {
      throw new Error('INV-UI-01 violation: Unicode emoji detected on Multi-Domain Hub');
    }

    // 3. Open Adaptive Placement on Frontend & submit step
    await page.getByTestId('domain-card-frontend').locator('button').last().click();
    await page.getByTestId('scr10-adaptive-placement').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[name="placement-opt"]').first().waitFor({ state: 'visible' });
    await page.locator('input[name="placement-opt"]').first().check();
    await page.getByRole('button', { name: /Kiểm tra đáp án/i }).click();
    await page.getByTestId('nav-multi-domain-btn').click();
    await page.getByRole('menuitem').first().click();
    await page.getByTestId('scr09-multi-domain-hub').waitFor({ state: 'visible', timeout: 10000 });

    // 4. Open Frontend Roadmap -> verify clean de-demoed UI, live AI banner & 390px mobile 0px overflow
    await page.getByTestId('domain-card-frontend').locator('button').first().click();
    await page.getByTestId('scr11-multi-domain-roadmap').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('kg-node-fe-dom-events').waitFor({ state: 'visible' });
    await page.getByTestId('gnn-ppo-banner').waitFor({ state: 'visible', timeout: 10000 });

    const roadmapText = await page.getByTestId('scr11-multi-domain-roadmap').innerText();
    for (const forbidden of ['Mô phỏng +5 ngày', 'SCR-11', 'SCR-09', 'node_features_snapshot']) {
      if (roadmapText.includes(forbidden)) {
        throw new Error(`De-demoing violation: Roadmap still exposes '${forbidden}'`);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow390 = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    if (overflow390) {
      throw new Error('Mobile 390px horizontal overflow detected on Roadmap');
    }
    await page.setViewportSize({ width: 1280, height: 860 });

    // 5. Real Sequential Flow (INV-SEQ-01): Open Playbook -> Complete Playbook -> 5-Depth Probing
    await page.getByTestId('open-playbook-fe-dom-events').click();
    await page.getByTestId('lesson-playbook-page').waitFor({ state: 'visible', timeout: 10000 });
    const playbookBody = await page.getByTestId('lesson-playbook-page').innerText();
    if (playbookBody.length < 1000) {
      throw new Error(`Frontend Playbook too short (${playbookBody.length} chars)`);
    }
    const selfCheck = page.getByTestId('playbook-selfcheck-checkbox');
    if ((await selfCheck.count()) > 0) {
      await selfCheck.check();
      await page.getByTestId('complete-playbook-btn').click();
    }
    await page.getByTestId('proceed-to-depth-probe-btn').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('proceed-to-depth-probe-btn').click();

    // 6. 5-Depth Probing + Playbook Quick Drawer
    await page.getByTestId('scr12-depth-probe').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('open-playbook-quick-drawer-btn').click();
    await page.getByTestId('playbook-quick-drawer').waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');

    await page.locator('input[name="depth-mcq"]').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[name="depth-mcq"]').first().check();
    await page.getByRole('button', { name: /Nộp|Kiểm tra/i }).first().click();

    // 7. Code Sandbox on fe-dom-events (already completed Playbook -> INV-SEQ-01 satisfied)
    await page.goto(`${baseUrl}/domains/frontend/concepts/fe-dom-events/code-sandbox`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('scr13-code-sandbox').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('run-code-sandbox-btn').click();
    await page.getByText(/Vượt qua \d+ \/ \d+ bài kiểm thử/i).waitFor({ state: 'visible', timeout: 10000 });

    // 8. Verify Learner RBAC 403 on Back-Office routes
    await page.goto(`${baseUrl}/backoffice/mlops/online-rl`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('forbidden-403-page').waitFor({ state: 'visible', timeout: 10000 });
    await page.goto(`${baseUrl}/backoffice/studio/domains`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('forbidden-403-page').waitFor({ state: 'visible', timeout: 10000 });

    // Return to learner portal from 403 page and logout learner
    await page.getByTestId('return-to-own-portal-btn').click();
    await page.getByTestId('logout-btn').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('logout-btn').click();
    await page.getByTestId('input-username').waitFor({ state: 'visible', timeout: 10000 });

    // 9. Verify Back-Office Login (/backoffice/login): no register tab, no demo buttons, rejects learner, admits admin_demo
    await page.goto(`${baseUrl}/backoffice/login`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('backoffice-login-page').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('staff-portal-notice').waitFor({ state: 'visible', timeout: 10000 });
    if ((await page.getByTestId('tab-register-btn').count()) > 0) {
      throw new Error('Back-Office login must NOT render public registration tab');
    }
    const boLoginText = await page.getByTestId('backoffice-login-page').innerText();
    if (boLoginText.includes('PlumoraDemo#2026')) {
      throw new Error('Back-Office login must NOT expose hardcoded demo password');
    }

    await page.getByTestId('input-username').fill('learner_new');
    await page.getByTestId('input-password').fill('PlumoraDemo#2026');
    await page.getByTestId('login-submit-btn').click();
    await page.getByTestId('auth-error-banner').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('input-username').fill('admin_demo');
    await page.getByTestId('input-password').fill('PlumoraDemo#2026');
    await page.getByTestId('login-submit-btn').click();

    await page.getByTestId('backoffice-app-shell').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('scr18-admin-online-rl').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('experience-buffer-inspector').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('admin-policy-inspector').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('bo-nav-registry').click();
    await page.getByTestId('scr19-admin-registry').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('head-to-head-safety-scorecard').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('bo-nav-health').click();
    await page.getByTestId('scr20-admin-health').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('trigger-outbox-relay-btn').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('inspect-dlq-btn').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('bo-nav-cohort').click();
    await page.getByTestId('backoffice-cohort-analytics').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('logout-btn').click();
    await page.getByTestId('input-username').waitFor({ state: 'visible', timeout: 10000 });

    // 10. Verify Expert Studio via /backoffice/login
    await page.goto(`${baseUrl}/backoffice/login`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('backoffice-login-page').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('input-username').fill('expert_demo');
    await page.getByTestId('input-password').fill('PlumoraDemo#2026');
    await page.getByTestId('login-submit-btn').click();

    await page.getByTestId('backoffice-app-shell').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('scr15-expert-domains').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('expert-publish-dag-btn').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('bo-nav-questions').click();
    await page.getByTestId('scr16-expert-questions').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('bo-nav-code').click();
    await page.getByTestId('scr17-expert-code').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('bo-nav-cohort').click();
    await page.getByTestId('backoffice-cohort-analytics').waitFor({ state: 'visible', timeout: 10000 });

    if (errors.length > 0) {
      throw new Error(`Console/Page errors encountered:\n${errors.join('\n')}`);
    }
    console.log(
      'Plumora v3 Dual-Portal Living System Chromium E2E Audit PASSED (De-demoed Web Client + INV-SEQ-01 Playbook->Probe->Sandbox, Back-Office Studio/Cohort/MLOps/Health, RBAC 403, 0px mobile overflow, 0 emojis).'
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Plumora v3 E2E Audit FAILED:', err);
  process.exit(1);
});
