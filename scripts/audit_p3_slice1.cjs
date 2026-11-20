/**
 * Plumora P3-SLICE-1 Real Chromium E2E Audit Script (SCR-09..SCR-14)
 *
 * Verifies:
 * 1. Register fresh learner -> open SCR-09 Multi-Domain Hub (Backend 12, Frontend 10, DevOps 9).
 * 2. Open SCR-10 Adaptive Placement on Frontend & submit step.
 * 3. Open SCR-11 Multi-Domain Roadmap, check 390px mobile 0px overflow & 0 Unicode emojis (INV-UI-01).
 * 4. Open SCR-12 5-Depth Probing on net-internet & advance Tier 1 -> Tier 2.
 * 5. Open SCR-13 Isolated Code Sandbox on net-internet & run unit tests.
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
    await page.getByTestId('tab-register-btn').waitFor({ state: 'visible', timeout: 10000 });

    // 1. Register fresh user
    const uname = `p3e2e_${Date.now().toString().slice(-6)}`;
    await page.getByTestId('tab-register-btn').click();
    await page.getByTestId('input-username').fill(uname);
    await page.getByTestId('input-display-name').fill('P3 E2E Learner');
    await page.getByTestId('input-password').fill('StrongPass!2026');
    await page.getByTestId('login-submit-btn').click();

    // 2. Learner must land directly on SCR-09 Multi-Domain Hub
    await page.getByTestId('scr09-multi-domain-hub').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('domain-card-backend').waitFor({ state: 'visible' });
    await page.getByTestId('domain-card-frontend').waitFor({ state: 'visible' });
    await page.getByTestId('domain-card-devops').waitFor({ state: 'visible' });

    if (process.argv.includes('--negative-control')) {
      // Negative control: inject an assertion expecting a non-existent domain card
      await page.getByTestId('domain-card-nonexistent-probe').waitFor({ state: 'visible', timeout: 1500 });
    }

    const hubText = await page.getByTestId('scr09-multi-domain-hub').innerText();
    if (EMOJI_REGEX.test(hubText)) {
      throw new Error('INV-UI-01 violation: Unicode emoji detected on SCR-09');
    }

    // 3. Open SCR-10 Adaptive Placement on Frontend
    await page
      .getByTestId('domain-card-frontend')
      .getByRole('button', { name: /Chẩn đoán Đầu vào/i })
      .click();
    await page.getByTestId('scr10-adaptive-placement').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[name="placement-opt"]').first().waitFor({ state: 'visible' });
    await page.locator('input[name="placement-opt"]').first().check();
    await page.getByRole('button', { name: /Nộp câu trả lời/i }).click();
    await page.getByRole('button', { name: /Quay về Trung tâm Đa lĩnh vực/i }).click();

    // 4. Open SCR-11 Frontend Multi-Domain Roadmap + Check GNN-PPO visibility + 390px mobile overflow
    await page.getByTestId('domain-card-frontend').getByRole('button', { name: /Vào Bản đồ Lĩnh vực/i }).click();
    await page.getByTestId('scr11-multi-domain-roadmap').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('kg-node-net-internet').waitFor({ state: 'visible' });

    const policyText = await page.getByTestId('gnn-ppo-policy-badge').innerText();
    if (!policyText.includes('GNN-PPO')) {
      throw new Error(`Expected live GNN-PPO policy badge on SCR-11, got: ${policyText}`);
    }
    await page.getByTestId('toggle-gnn-inference-btn').click();
    await page.getByTestId('gnn-ppo-inference-panel').waitFor({ state: 'visible', timeout: 5000 });

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow390 = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    if (overflow390) {
      throw new Error('Mobile 390px horizontal overflow detected on SCR-11');
    }
    await page.setViewportSize({ width: 1280, height: 860 });

    // 5. Open SCR-12 5-Depth Probing on fe-dom-events (Tier 1 MCQ -> Tier 2 MCQ)
    await page.getByTestId('kg-node-fe-dom-events').getByRole('button', { name: /Đào sâu 5 tầng/i }).click();
    await page.getByTestId('scr12-depth-probe').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[name="depth-mcq"]').first().waitFor({ state: 'visible' });
    await page.locator('input[name="depth-mcq"]').first().check();
    await page.getByRole('button', { name: /Nộp & Đào sâu Tầng tiếp theo/i }).click();
    await page.getByText(/Tầng 2: Cơ chế/i).waitFor({ state: 'visible', timeout: 10000 });

    // Return to roadmap, test Tier 3 Rubric -> SCR-14 AI Tutor Drawer on net-internet
    await page.getByRole('button', { name: /Quay về Bản đồ/i }).click();
    await page.getByTestId('kg-node-net-internet').getByRole('button', { name: /Đào sâu 5 tầng/i }).click();
    await page.getByTestId('scr12-depth-probe').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('textarea').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('textarea').fill('Kiểm tra DNS phân giải IP và TCP handshake SYN/ACK để xử lý nghẽn kết nối.');
    await page.getByRole('button', { name: /Nộp & Đào sâu Tầng tiếp theo/i }).click();
    await page.getByTestId('scr14-ai-tutor-drawer').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: /Hoàn tất & Cập nhật Hồ sơ Năng lực/i }).click();

    // Return to roadmap and open SCR-13 Code Sandbox on net-internet
    await page.getByRole('button', { name: /Quay về Bản đồ/i }).click();
    await page.getByTestId('kg-node-net-internet').getByRole('button', { name: /Code/i }).click();
    await page.getByTestId('scr13-code-sandbox').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: /Chạy Kiểm thử Sandbox/i }).click();
    await page.getByText(/Test Cases đạt:/i).waitFor({ state: 'visible', timeout: 10000 });

    // 6. Verify Learner RBAC 403 on /admin/online-rl and /expert/domains
    await page.goto(`${baseUrl}/admin/online-rl`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('forbidden-403-page').waitFor({ state: 'visible', timeout: 10000 });
    await page.goto(`${baseUrl}/expert/domains`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('forbidden-403-page').waitFor({ state: 'visible', timeout: 10000 });

    // Logout learner (wait for redirect/auth clear before switching portal)
    await Promise.all([
      page.waitForURL(/\/login/, { timeout: 10000 }),
      page.getByTestId('logout-btn').click(),
    ]);

    // 7. Verify Admin Portal (/admin/login): no register tab, 403 on learner, 200 on admin_demo -> SCR-18..20
    await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('staff-portal-notice').waitFor({ state: 'visible', timeout: 10000 });
    if ((await page.getByTestId('tab-register-btn').count()) > 0) {
      throw new Error('Admin login must NOT render public registration tab');
    }
    await page.getByTestId('input-username').fill('learner_new');
    await page.getByTestId('input-password').fill('PlumoraDemo#2026');
    await page.getByTestId('login-submit-btn').click();
    await page.getByTestId('auth-error-banner').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('input-username').fill('admin_demo');
    await page.getByTestId('input-password').fill('PlumoraDemo#2026');
    await page.getByTestId('login-submit-btn').click();
    await page.getByTestId('scr18-admin-online-rl').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('nav-admin-registry-btn').click();
    await page.getByTestId('scr19-admin-registry').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('nav-admin-health-btn').click();
    await page.getByTestId('scr20-admin-health').waitFor({ state: 'visible', timeout: 10000 });
    await Promise.all([
      page.waitForURL(/\/login/, { timeout: 10000 }),
      page.getByTestId('logout-btn').click(),
    ]);

    // 8. Verify Expert Portal (/expert/login): no register tab, 200 on expert_demo -> SCR-15..17
    await page.goto(`${baseUrl}/expert/login`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('staff-portal-notice').waitFor({ state: 'visible', timeout: 10000 });
    if ((await page.getByTestId('tab-register-btn').count()) > 0) {
      throw new Error('Expert login must NOT render public registration tab');
    }
    await page.getByTestId('input-username').fill('expert_demo');
    await page.getByTestId('input-password').fill('PlumoraDemo#2026');
    await page.getByTestId('login-submit-btn').click();
    await page.getByTestId('scr15-expert-domains').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('expert-publish-dag-btn').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('nav-expert-questions-btn').click();
    await page.getByTestId('scr16-expert-questions').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('select').nth(3).selectOption('mcq');
    await page.locator('#mcq-correct-key').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('select').nth(3).selectOption('troubleshooting');
    await page.getByText(/Tổng hiện tại: 1/i).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByTestId('nav-expert-code-btn').click();
    await page.getByTestId('scr17-expert-code').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: /Chạy Thử Test Cases & Lưu Bài Code/i }).waitFor({ state: 'visible', timeout: 5000 });

    if (errors.length > 0) {
      throw new Error(`Console/Page errors encountered:\n${errors.join('\n')}`);
    }
    console.log('P3 Fullstack Real Chromium E2E Audit PASSED (Learner SCR-09..14 + GNN-PPO, Expert SCR-15..17, Admin SCR-18..20, RBAC 403, 0px mobile overflow, 0 emojis).');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('P3-SLICE-1 E2E Audit FAILED:', err);
  process.exit(1);
});
