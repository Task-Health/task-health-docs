const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '06-screenshots', 'webapp');
const screenshots = []; // { name, filePath, url, description, section }
let screenshotCounter = 0;

async function takeScreenshot(page, name, description, section) {
  screenshotCounter++;
  const prefix = String(screenshotCounter).padStart(2, '0');
  const safeName = `${prefix}-${name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(SCREENSHOT_DIR, `${safeName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  const url = page.url();
  screenshots.push({ name: `${prefix}. ${description}`, filePath: `webapp/${safeName}.png`, url, description, section });
  console.log(`  [${prefix}] ${section} > ${description}`);
}

async function waitForLoad(page, timeout = 10000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {}
  await page.waitForTimeout(1500);
}

async function isNotFoundPage(page) {
  const bodyText = await page.evaluate(() => document.body.innerText.trim());
  return bodyText.includes('Not Found') && bodyText.length < 200;
}

async function login(page) {
  await page.goto('https://go.task-health.com/login/email', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin+platinum@medflyt.com');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  const pinDigits = '34567';
  for (let i = 0; i < pinDigits.length; i++) {
    const pinInput = await page.$(`input[id$=":${i}"][type="tel"]`);
    if (pinInput) {
      await pinInput.fill(pinDigits[i]);
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(8000);
}

(async () => {
  // Clean screenshot dir
  if (fs.existsSync(SCREENSHOT_DIR)) fs.rmSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ============================================================
  // 1. LOGIN FLOW
  // ============================================================
  console.log('\n=== 1. LOGIN FLOW ===');

  await page.goto('https://go.task-health.com/login/email', { waitUntil: 'networkidle', timeout: 30000 });
  await takeScreenshot(page, 'login-email', 'Login page — email entry', 'Authentication');

  await page.fill('input[type="email"]', 'admin+platinum@medflyt.com');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await takeScreenshot(page, 'login-pin', 'Login page — PIN code entry', 'Authentication');

  // Enter PIN
  const pinDigits = '34567';
  for (let i = 0; i < pinDigits.length; i++) {
    const pinInput = await page.$(`input[id$=":${i}"][type="tel"]`);
    if (pinInput) { await pinInput.fill(pinDigits[i]); await page.waitForTimeout(200); }
  }
  await page.waitForTimeout(8000);
  console.log('  Logged in:', page.url());

  // ============================================================
  // 2. DASHBOARD / NURSING VISITS
  // ============================================================
  console.log('\n=== 2. DASHBOARD ===');

  await waitForLoad(page);
  await takeScreenshot(page, 'dashboard', 'Nursing Visits dashboard — main task list', 'Dashboard');

  // Status filter dropdown
  const statusBtn = await page.$('button:has-text("In Progress, Completed")');
  if (statusBtn) {
    await statusBtn.click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'dashboard-status-filter', 'Status filter dropdown (In Progress, Completed, Needs Attention, Cancelled)', 'Dashboard');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Review status filter
  const reviewBtn = await page.$('button:has-text("review status")');
  if (reviewBtn) {
    await reviewBtn.click();
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'dashboard-review-filter', 'Review status filter dropdown (Pending RN changes, Resolved, Approved)', 'Dashboard');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ============================================================
  // 3. USER MENU (avatar popover)
  // ============================================================
  console.log('\n=== 3. USER MENU ===');

  const avatarBtn = await page.$('button[aria-haspopup="dialog"]');
  if (avatarBtn) {
    await avatarBtn.click();
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'user-menu', 'User menu popover — showing Settings and Logout', 'User Menu');

    // Click "Settings" to expand sub-links
    const settingsBtn = await page.$('[data-state="open"] button:has-text("Settings")');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'user-menu-settings-expanded', 'Settings expanded — Agency info, Contracts, Billing, Email preferences, POC Code Mapping', 'User Menu');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ============================================================
  // 4. ADD ASSESSMENT MENU (hamburger)
  // ============================================================
  console.log('\n=== 4. ADD ASSESSMENT MENU ===');

  const menuBtn = await page.$('button[aria-haspopup="menu"]');
  if (menuBtn) {
    await menuBtn.click();
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'add-assessment-menu', 'Add Assessment dropdown — Manual and HHAeXchange options', 'Add Assessment');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ============================================================
  // 5. ADD ASSESSMENT FORM (3-step wizard)
  // ============================================================
  console.log('\n=== 5. ADD ASSESSMENT FORM ===');

  const addBtn = await page.$('button:has-text("Add Assessment")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(2000);
    await waitForLoad(page);
    await takeScreenshot(page, 'add-assessment-step1', 'Broadcast New Assessment — Step 1: Patient Information (name, phone, gender, DOB, language, documents)', 'Add Assessment');

    // Navigate to Step 2: Address & Location
    const step2Link = await page.$('text=Address & Location');
    const continueBtn = await page.$('button:has-text("Continue to Address")');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'add-assessment-step2', 'Broadcast New Assessment — Step 2: Address & Location', 'Add Assessment');

      // Navigate to Step 3: Visit Details
      const continueBtn2 = await page.$('button:has-text("Continue to Visit")');
      if (continueBtn2) {
        await continueBtn2.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, 'add-assessment-step3', 'Broadcast New Assessment — Step 3: Visit Details (assessment schedule)', 'Add Assessment');
      }
    } else if (step2Link) {
      await step2Link.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'add-assessment-step2', 'Broadcast New Assessment — Step 2: Address & Location', 'Add Assessment');

      const step3Link = await page.$('text=Visit Details');
      if (step3Link) {
        await step3Link.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, 'add-assessment-step3', 'Broadcast New Assessment — Step 3: Visit Details', 'Add Assessment');
      }
    }

    // Go back to dashboard
    await page.goto('https://go.task-health.com/app', { waitUntil: 'networkidle', timeout: 30000 });
    await waitForLoad(page);
  }

  // ============================================================
  // 6. TASK DETAIL — NEEDS ATTENTION
  // ============================================================
  console.log('\n=== 6. TASK DETAIL (NEEDS ATTENTION) ===');

  const needsAttentionRow = await page.$('tr:has-text("Needs Attention") a[href*="taskId="]');
  if (needsAttentionRow) {
    await needsAttentionRow.click();
    await page.waitForTimeout(3000);
    await waitForLoad(page);

    // Click each tab in the task detail drawer
    const tabNames = ['General', 'Documents', 'Communications'];
    for (const tabName of tabNames) {
      const tab = await page.$(`[role="tab"]:has-text("${tabName}")`);
      if (tab) {
        await tab.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, `task-needs-attention-${tabName.toLowerCase()}`, `Task Detail (Needs Attention) — ${tabName} tab`, 'Task Detail');
      }
    }

    // Close task detail
    const closeBtn = await page.$('button[aria-label="Close"], svg[data-testid="CloseIcon"]');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.goto('https://go.task-health.com/app', { waitUntil: 'networkidle', timeout: 30000 });
      await waitForLoad(page);
    }
  }

  // ============================================================
  // 7. TASK DETAIL — IN PROGRESS
  // ============================================================
  console.log('\n=== 7. TASK DETAIL (IN PROGRESS) ===');

  await page.goto('https://go.task-health.com/app', { waitUntil: 'networkidle', timeout: 30000 });
  await waitForLoad(page);

  const inProgressRow = await page.$('tr:has-text("In Progress") a[href*="taskId="]');
  if (inProgressRow) {
    await inProgressRow.click();
    await page.waitForTimeout(3000);
    await waitForLoad(page);

    // General tab (should be selected by default)
    await takeScreenshot(page, 'task-in-progress-general', 'Task Detail (In Progress) — General tab with patient info', 'Task Detail');

    // Documents tab
    const docsTab = await page.$('[role="tab"]:has-text("Documents")');
    if (docsTab) {
      await docsTab.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'task-in-progress-documents', 'Task Detail (In Progress) — Documents tab', 'Task Detail');
    }

    // Communications tab
    const commsTab = await page.$('[role="tab"]:has-text("Communications")');
    if (commsTab) {
      await commsTab.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'task-in-progress-communications', 'Task Detail (In Progress) — Communications tab', 'Task Detail');
    }

    // Check for Chat tab
    const chatTab = await page.$('[role="tab"]:has-text("Chat")');
    if (chatTab) {
      await chatTab.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'task-in-progress-chat', 'Task Detail (In Progress) — Chat tab', 'Task Detail');
    }

    await page.goto('https://go.task-health.com/app', { waitUntil: 'networkidle', timeout: 30000 });
    await waitForLoad(page);
  }

  // ============================================================
  // 8. TASK DETAIL — COMPLETED
  // ============================================================
  console.log('\n=== 8. TASK DETAIL (COMPLETED) ===');

  const completedRow = await page.$('tr:has-text("Completed") a[href*="taskId="]');
  if (completedRow) {
    await completedRow.click();
    await page.waitForTimeout(3000);
    await waitForLoad(page);

    const allTabs = ['General', 'Documents', 'Communications', 'Chat'];
    for (const tabName of allTabs) {
      const tab = await page.$(`[role="tab"]:has-text("${tabName}")`);
      if (tab) {
        await tab.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, `task-completed-${tabName.toLowerCase()}`, `Task Detail (Completed) — ${tabName} tab`, 'Task Detail');
      }
    }

    await page.goto('https://go.task-health.com/app', { waitUntil: 'networkidle', timeout: 30000 });
    await waitForLoad(page);
  }

  // ============================================================
  // 9. ASSESSMENT QUEUE
  // ============================================================
  console.log('\n=== 9. ASSESSMENT QUEUE ===');

  await page.goto('https://go.task-health.com/app/assessment-queue', { waitUntil: 'networkidle', timeout: 30000 });
  await waitForLoad(page);
  if (!(await isNotFoundPage(page))) {
    await takeScreenshot(page, 'assessment-queue', 'Assessment Queue — import jobs list with status tracking', 'Assessment Queue');
  }

  // ============================================================
  // 10. BILLING PAGES
  // ============================================================
  console.log('\n=== 10. BILLING ===');

  // Main billing page (invoices)
  await page.goto('https://go.task-health.com/app/billing', { waitUntil: 'networkidle', timeout: 30000 });
  await waitForLoad(page);
  if (!(await isNotFoundPage(page))) {
    await takeScreenshot(page, 'billing-invoices', 'Billing Information — invoices list with credits, amounts, and status', 'Billing');
  }

  // Purchase Credits page
  await page.goto('https://go.task-health.com/app/billing/payment-method', { waitUntil: 'networkidle', timeout: 30000 });
  await waitForLoad(page);
  if (!(await isNotFoundPage(page))) {
    await takeScreenshot(page, 'billing-purchase-credits', 'Purchase Credits — credit packages with volume discounts', 'Billing');
  }

  // ============================================================
  // 11. SETTINGS PAGES (from user menu)
  // ============================================================
  console.log('\n=== 11. SETTINGS PAGES ===');

  const settingsPages = [
    { path: '/app/agency-info', desc: 'Agency Information — agency details and configuration' },
    { path: '/app/contracts', desc: 'Contracts — agency contract management' },
    { path: '/app/email-preferences', desc: 'Email Preferences — notification email settings' },
    { path: '/app/poc-code-mapping', desc: 'POC Code Mapping — plan of care code configuration' },
  ];

  for (const sp of settingsPages) {
    await page.goto(`https://go.task-health.com${sp.path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForLoad(page);

    // Check we're not redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log(`  [REDIRECT TO LOGIN] ${sp.path} — re-logging in...`);
      await login(page);
      await page.goto(`https://go.task-health.com${sp.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await waitForLoad(page);
    }

    if (!(await isNotFoundPage(page)) && !page.url().includes('/login')) {
      const safeName = sp.path.replace(/^\/app\//, '').replace(/\//g, '-');
      await takeScreenshot(page, `settings-${safeName}`, sp.desc, 'Settings');
    } else {
      console.log(`  [SKIP] ${sp.path} — Not Found or redirected`);
    }
  }

  // ============================================================
  // 12. UNREAD MESSAGES SECTION
  // ============================================================
  console.log('\n=== 12. UNREAD MESSAGES ===');

  await page.goto('https://go.task-health.com/app', { waitUntil: 'networkidle', timeout: 30000 });
  await waitForLoad(page);

  const unreadBtn = await page.$('button:has-text("Unread Messages")');
  if (unreadBtn) {
    await unreadBtn.click();
    await page.waitForTimeout(2000);
    // Check if something opened
    const hasPopover = await page.$('[data-state="open"]');
    if (hasPopover) {
      await takeScreenshot(page, 'unread-messages', 'Unread Messages panel', 'Dashboard');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // ============================================================
  // GENERATE HTML
  // ============================================================
  console.log('\n=== GENERATING HTML ===');
  console.log(`Total screenshots captured: ${screenshots.length}`);

  // Group by section
  const sections = new Map();
  screenshots.forEach(s => {
    if (!sections.has(s.section)) sections.set(s.section, []);
    sections.get(s.section).push(s);
  });

  let tocHtml = '';
  let contentHtml = '';
  let sectionIdx = 0;

  for (const [sectionName, items] of sections) {
    sectionIdx++;
    const sectionId = `section-${sectionIdx}`;
    tocHtml += `<li><a href="#${sectionId}">${sectionName}</a> <span class="count">(${items.length})</span><ul>`;

    contentHtml += `<div class="section" id="${sectionId}"><h2>${sectionName}</h2>`;

    items.forEach((item, idx) => {
      const itemId = `${sectionId}-${idx}`;
      tocHtml += `<li><a href="#${itemId}">${item.description}</a></li>`;

      const imgPath = path.join(__dirname, '06-screenshots', item.filePath);
      const imgBase64 = fs.readFileSync(imgPath).toString('base64');

      contentHtml += `
        <div class="screenshot" id="${itemId}">
          <h3>${item.description}</h3>
          <div class="meta">
            <span class="url">${item.url}</span>
          </div>
          <img src="data:image/png;base64,${imgBase64}" alt="${item.description}" loading="lazy" />
        </div>`;
    });

    tocHtml += '</ul></li>';
    contentHtml += '</div>';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Health Webapp — All Screens</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
      max-width: 1600px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 { font-size: 2em; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 1.1em; }
    .header .stats {
      margin-top: 16px;
      display: flex;
      justify-content: center;
      gap: 32px;
    }
    .header .stat { text-align: center; }
    .header .stat-value { font-size: 1.8em; font-weight: bold; }
    .header .stat-label { font-size: 0.85em; opacity: 0.8; }
    .toc {
      background: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .toc h2 { margin-bottom: 16px; color: #1a1a1a; }
    .toc ul { padding-left: 20px; }
    .toc li { margin: 4px 0; }
    .toc a { color: #2563eb; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .toc .count { color: #999; font-size: 0.85em; }
    .section { margin-bottom: 40px; }
    .section > h2 {
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      font-size: 1.5em;
      color: #1a1a1a;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 10;
      border-left: 4px solid #2563eb;
    }
    .screenshot {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .screenshot h3 {
      font-size: 1.1em;
      margin-bottom: 8px;
      color: #1a1a1a;
    }
    .meta { margin-bottom: 16px; }
    .url {
      display: inline-block;
      background: #f0f4f8;
      padding: 4px 12px;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.8em;
      color: #666;
    }
    .screenshot img {
      width: 100%;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    .back-to-top {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      font-size: 20px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
    }
    .back-to-top:hover { background: #1d4ed8; }
    .timestamp {
      text-align: center;
      color: #999;
      margin-top: 40px;
      font-size: 0.85em;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="header" id="top">
    <h1>Task Health Webapp — All Screens</h1>
    <p>Comprehensive screenshot documentation of the Task Health web portal</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${screenshots.length}</div>
        <div class="stat-label">Screenshots</div>
      </div>
      <div class="stat">
        <div class="stat-value">${sections.size}</div>
        <div class="stat-label">Sections</div>
      </div>
      <div class="stat">
        <div class="stat-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div class="stat-label">Captured</div>
      </div>
    </div>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>${tocHtml}</ul>
  </div>

  ${contentHtml}

  <a href="#top" class="back-to-top" title="Back to top">↑</a>

  <div class="timestamp">
    Generated on ${new Date().toISOString()} using Playwright automated browser<br>
    URL: https://go.task-health.com/app
  </div>
</body>
</html>`;

  const outputPath = path.join(__dirname, '06-screenshots', 'WEBAPP_SCREENS.html');
  fs.writeFileSync(outputPath, html);
  console.log(`\nHTML saved to: ${outputPath}`);
  console.log(`Total: ${screenshots.length} screenshots across ${sections.size} sections`);

  await browser.close();
})();
