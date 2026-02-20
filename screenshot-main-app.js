const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '06-screenshots', 'main-app');

let screenshots = []; // {section, name, filename, url, description}
let screenshotIndex = 0;

// The sidebar uses custom Angular directives. We need to click items by their
// text content within the sidebar. The sidebar is an accordion - we must first
// expand the parent section, then click the child.
//
// Strategy: Click each item via JavaScript (force), then wait for the URL to change.
// We'll record each resulting URL.

(async () => {
  if (fs.existsSync(SCREENSHOT_DIR)) {
    fs.rmSync(SCREENSHOT_DIR, { recursive: true });
  }
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ====== LOGIN ======
  console.log('=== LOGGING IN ===');
  await page.goto('https://app.taskshealth.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  await takeScreenshot(page, 'Login', 'Login Page', 'The login page of Tasks Health');

  await page.fill('input[type="email"], input[name="email"]', 'omer+main@medflyt.com');
  await page.fill('input[type="password"]', 'Demo1!Demo');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  await waitForPageLoad(page);
  console.log('Logged in at:', page.url());

  // ====== PHASE 1: Map all sidebar URLs by clicking each item ======
  console.log('\n=== PHASE 1: Discovering sidebar URLs ===');

  // The sidebar has this structure:
  // Section headers are top-level items that expand/collapse sub-menus
  // Sub-items appear beneath their section when expanded
  // All are <a> tags inside the sidebar nav

  const sidebarStructure = [
    {
      section: 'Dashboard',
      headerText: 'Dashboard',
      children: [
        'Caregivers', 'Online', 'Installations', 'Tutorials',
        'Visit Statistics', 'Coordinator Activity'
      ]
    },
    { section: 'Notes', headerText: 'Notes', children: [] },
    {
      section: 'Patients',
      headerText: 'Patients',
      children: [
        'Patients list', 'Care & Task management', 'Patient Alerts',
        'Quality Of Care', 'Eligibility Checks', 'Prompt Testing',
        'Intake', 'Authorized Patients Without Visits',
        'Patients Compliance', 'Patient Issues'
      ]
    },
    {
      section: 'Caregivers',
      headerText: 'Caregivers',
      children: [
        'Caregivers list', 'Pending Acceptance', 'Onboarding',
        'Compliance Tracking', 'Caregivers Passport', 'Exclusions',
        'Prioritized caregivers', 'Supplies Shipments',
        'AI Review Manual Check', 'HCR State Compliance',
        'CHRC State Compliance', 'State Compliance Issues'
      ]
    },
    {
      section: 'Training Center',
      headerText: 'Training Center',
      children: [
        'In-Service Overview', 'Enrollments Requests', 'Active Bundles',
        'Orientation', 'Bulk Exempts'
      ]
    },
    {
      section: 'Visits',
      headerText: 'Visits',
      children: [
        'Broadcasting activity', 'Visit instances', 'Upload visit',
        'Duty Sheets', 'Time Sheets Approval', 'Staffing Issues',
        'Hours Usage', 'Assignments'
      ]
    },
    { section: 'Chat', headerText: 'Chat', children: [] },
    {
      section: 'Comm Center',
      headerText: 'Comm Center',
      children: ['Comm Center', 'Fax Dashboard']
    },
    {
      section: 'Workflows',
      headerText: 'Workflows',
      children: ['Tasks', 'Task Viewer', 'Skills']
    },
    {
      section: 'EVV',
      headerText: 'EVV',
      children: ['Clock in & out', 'Calls']
    },
    {
      section: 'Payroll',
      headerText: 'Payroll',
      children: ['Payroll Batches', 'PTO Approvals']
    },
    {
      section: 'Billing',
      headerText: 'Billing',
      children: [
        'Visits with issues', 'Billable visits', 'Claims',
        'Administrative Payments', 'Adjustment Approvals',
        'Visits to export', 'Invoices to export', 'Exports',
        'Checks', 'AR', 'Surplus', '837 EDI Comparison'
      ]
    },
    { section: 'Passport Verifier', headerText: 'Passport Verifier', children: [] },
    {
      section: 'Reports',
      headerText: 'Reports',
      children: ['Standard', 'Advanced', 'COVID-19 Reports', 'CICO Reports']
    },
    {
      section: 'HHAX Integration',
      headerText: 'HHAX Integration',
      children: ['Billing Rejections', 'Non-Billing Records', 'Unlinked Patients']
    },
    {
      section: 'Compliance Document Review',
      headerText: 'Compliance Document Review',
      children: ['Compliance Document Review']
    },
    {
      section: 'Admin',
      headerText: 'Admin',
      children: [
        'Visit Settings', 'HR Settings', 'Notes Settings',
        'Training Center Settings', 'Clinical & Care settings',
        'Team Members', 'Flyers', 'Billing Info', 'Analytics'
      ]
    },
  ];

  // For each section, expand it and click each child to discover URLs
  const discoveredUrls = {};

  for (const sec of sidebarStructure) {
    console.log(`\nSection: ${sec.section}`);

    // First expand the section by clicking the header
    const headerClicked = await clickSidebarByText(page, sec.headerText, true);
    if (!headerClicked) {
      console.log(`  Could not find header: ${sec.headerText}`);
      continue;
    }
    await page.waitForTimeout(800);

    if (sec.children.length === 0) {
      // This is a standalone page (no sub-items)
      await page.waitForTimeout(2000);
      await waitForPageLoad(page);
      const url = page.url();
      discoveredUrls[sec.section] = url;
      console.log(`  ${sec.section} -> ${url}`);
      await takeScreenshot(page, sec.section, sec.section, `${sec.section} main page`);
      await screenshotPageTabs(page, sec.section, sec.section);
    } else {
      // Click each child
      for (const child of sec.children) {
        const prevUrl = page.url();
        const clicked = await clickSidebarByText(page, child, false);
        if (!clicked) {
          console.log(`  Could not find: ${child}`);
          continue;
        }
        await page.waitForTimeout(2500);
        await waitForPageLoad(page);
        const url = page.url();
        discoveredUrls[`${sec.section} > ${child}`] = url;
        console.log(`  ${child} -> ${url}`);

        if (url !== prevUrl || sec.children.indexOf(child) === 0) {
          await takeScreenshot(page, sec.section, child, `${sec.section} > ${child}`);
          await screenshotPageTabs(page, sec.section, child);
        } else {
          console.log(`  URL unchanged, skipping screenshot`);
        }
      }
    }
  }

  // ====== PHASE 2: Top bar / settings pages ======
  console.log('\n=== PHASE 2: Top Bar / Settings Pages ===');
  const topBarPages = [
    { name: 'Profile', url: '/app/profile' },
    { name: 'Back Office', url: '/app/back-office' },
    { name: 'Settings', url: '/app/settings' },
    { name: 'HR Settings (Top Bar)', url: '/app/hr-settings' },
    { name: 'Notes Settings (Top Bar)', url: '/app/notes-settings' },
    { name: 'Training Center Settings (Top Bar)', url: '/app/training-center-settings' },
    { name: 'Clinical Settings (Top Bar)', url: '/app/patient-document-settings' },
    { name: 'Team Members (Top Bar)', url: '/app/invite' },
    { name: 'Payment / Billing', url: '/app/payment' },
  ];

  for (const pg of topBarPages) {
    try {
      console.log(`  ${pg.name}: ${pg.url}`);
      await page.goto(`https://app.taskshealth.com${pg.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await waitForPageLoad(page);
      await takeScreenshot(page, 'Top Bar / Settings', pg.name, pg.name);
      await screenshotPageTabs(page, 'Top Bar / Settings', pg.name);
    } catch (err) {
      console.log(`  ERROR: ${err.message.substring(0, 80)}`);
    }
  }

  // ====== PHASE 3: Patient detail (one patient) ======
  console.log('\n=== PHASE 3: Patient Detail ===');
  await screenshotEntityDetail(page, 'Patient');

  // ====== PHASE 4: Caregiver detail (one caregiver) ======
  console.log('\n=== PHASE 4: Caregiver Detail ===');
  await screenshotEntityDetail(page, 'Caregiver');

  await browser.close();

  // ====== BUILD HTML ======
  console.log(`\n=== BUILDING HTML (${screenshots.length} screenshots) ===`);
  buildHTML();

  console.log('\nDONE! Total screenshots:', screenshots.length);
})();


// ====== HELPER FUNCTIONS ======

async function clickSidebarByText(page, text, isHeader) {
  // Find the link by text content within the sidebar
  // Use evaluate to click it programmatically (bypasses visibility)
  const clicked = await page.evaluate(({ text, isHeader }) => {
    const sidebar = document.querySelector('nav.navbar-default.navbar-static-side');
    if (!sidebar) return false;

    const links = Array.from(sidebar.querySelectorAll('a'));

    // Find the best match
    for (const link of links) {
      const linkText = link.textContent.trim().replace(/\s+/g, ' ').replace(/NEW!?/g, '').trim();

      // For headers like "Caregivers" that also have a child "Caregivers list",
      // we need to match precisely
      if (linkText === text) {
        link.scrollIntoView({ block: 'center' });
        link.click();
        return true;
      }
    }

    // Try partial match if exact didn't work
    for (const link of links) {
      const linkText = link.textContent.trim().replace(/\s+/g, ' ').replace(/NEW!?/g, '').trim();
      if (linkText.startsWith(text) || linkText.includes(text)) {
        link.scrollIntoView({ block: 'center' });
        link.click();
        return true;
      }
    }

    return false;
  }, { text, isHeader });

  return clicked;
}

async function waitForPageLoad(page) {
  try {
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // Extra wait for Angular digest
    await page.waitForTimeout(500);
  } catch (e) {}
}

async function takeScreenshot(page, section, name, description) {
  screenshotIndex++;
  const idx = String(screenshotIndex).padStart(3, '0');
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 50);
  const safeSection = section.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 25);
  const filename = `${idx}_${safeSection}__${safeName}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);

  try {
    await page.screenshot({ path: filepath, fullPage: true });
    const url = page.url();
    screenshots.push({ section, name, filename, url, description });
    console.log(`    [${idx}] ${name} -> ${url}`);
  } catch (err) {
    console.log(`    Screenshot error: ${err.message.substring(0, 60)}`);
  }
}

async function screenshotPageTabs(page, section, parentName) {
  try {
    // Find tabs - but ONLY in the main content area, NOT the sidebar
    const tabInfo = await page.evaluate(() => {
      // Find tab containers that are NOT inside the sidebar nav
      const sidebar = document.querySelector('nav.navbar-default.navbar-static-side');
      const topNav = document.querySelector('nav.navbar-fixed-top');

      const allTabContainers = document.querySelectorAll('.nav-tabs, [role="tablist"]');
      const tabs = [];

      allTabContainers.forEach(container => {
        // Skip if this container is inside the sidebar or top nav
        if (sidebar && sidebar.contains(container)) return;
        if (topNav && topNav.contains(container)) return;

        const tabEls = container.querySelectorAll('a, [role="tab"], li');
        tabEls.forEach(tab => {
          const anchor = tab.tagName === 'LI' ? tab.querySelector('a') : tab;
          if (!anchor) return;
          const text = anchor.textContent.trim();
          if (text && text.length > 0 && text.length < 50 &&
              !text.match(/^[\d«»\-\.]+$/) && text !== '---' && text !== 'empty') {
            const isActive = anchor.classList.contains('active') ||
              anchor.getAttribute('aria-selected') === 'true' ||
              anchor.parentElement?.classList.contains('active');
            tabs.push({ text, isActive });
          }
        });
      });

      // Deduplicate
      const seen = new Set();
      return tabs.filter(t => {
        if (seen.has(t.text)) return false;
        seen.add(t.text);
        return true;
      });
    });

    if (tabInfo.length <= 1) return;

    const inactiveTabs = tabInfo.filter(t => !t.isActive);
    if (inactiveTabs.length === 0) return;

    console.log(`    Tabs: ${tabInfo.map(t => `${t.text}${t.isActive ? '*' : ''}`).join(', ')}`);

    for (const tab of inactiveTabs) {
      try {
        await page.evaluate((tabText) => {
          const sidebar = document.querySelector('nav.navbar-default.navbar-static-side');
          const topNav = document.querySelector('nav.navbar-fixed-top');
          const containers = document.querySelectorAll('.nav-tabs, [role="tablist"]');

          for (const container of containers) {
            if (sidebar && sidebar.contains(container)) continue;
            if (topNav && topNav.contains(container)) continue;

            const tabs = container.querySelectorAll('a, [role="tab"]');
            for (const t of tabs) {
              if (t.textContent.trim() === tabText) {
                t.click();
                return;
              }
            }
          }
        }, tab.text);

        await page.waitForTimeout(2000);
        await waitForPageLoad(page);

        await takeScreenshot(
          page, section,
          `${parentName} - ${tab.text} tab`,
          `${parentName} > ${tab.text} tab`
        );
      } catch (err) {
        console.log(`    Tab error (${tab.text}): ${err.message.substring(0, 60)}`);
      }
    }
  } catch (err) {}
}

async function screenshotEntityDetail(page, entityType) {
  try {
    // Navigate to the list page
    const listUrl = entityType === 'Patient'
      ? 'https://app.taskshealth.com/app/patients/dashboard'
      : 'https://app.taskshealth.com/app/caregivers/caregivers';

    await page.goto(listUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    await waitForPageLoad(page);

    // Try to click the first entity in a table or list
    const opened = await page.evaluate(() => {
      // Try table row with a link
      const link = document.querySelector('#page-wrapper table tbody tr a[href], #page-wrapper .table tbody tr a[href]');
      if (link) {
        link.click();
        return 'link';
      }
      // Try clicking a table row
      const row = document.querySelector('#page-wrapper table tbody tr, #page-wrapper .table tbody tr');
      if (row) {
        row.click();
        return 'row';
      }
      // Try any clickable item in the main content
      const item = document.querySelector('#page-wrapper [ng-click]');
      if (item) {
        item.click();
        return 'ng-click';
      }
      return null;
    });

    console.log(`  Clicked ${entityType}: ${opened}`);
    await page.waitForTimeout(3000);
    await waitForPageLoad(page);

    const detailUrl = page.url();
    console.log(`  Detail URL: ${detailUrl}`);

    await takeScreenshot(page, `${entityType} Detail`, `${entityType} Overview`, `${entityType} detail - main view`);

    // Find tabs in the MAIN CONTENT area only (not sidebar)
    const tabs = await page.evaluate(() => {
      const sidebar = document.querySelector('nav.navbar-default.navbar-static-side');
      const topNav = document.querySelector('nav.navbar-fixed-top');

      // Look for tab-like elements in the page wrapper (main content area)
      const pageWrapper = document.querySelector('#page-wrapper') || document.querySelector('.main-content') || document.body;

      const tabContainers = pageWrapper.querySelectorAll('.nav-tabs, [role="tablist"], .tab-content + .nav, ul.nav:not(.navbar-nav):not(.metismenu)');
      const result = [];

      tabContainers.forEach(container => {
        if (sidebar && sidebar.contains(container)) return;
        if (topNav && topNav.contains(container)) return;

        const tabEls = container.querySelectorAll('a');
        tabEls.forEach(tab => {
          const text = tab.textContent.trim();
          if (text && text.length > 1 && text.length < 50) {
            result.push(text);
          }
        });
      });

      return [...new Set(result)];
    });

    console.log(`  ${entityType} tabs: ${tabs.join(', ') || 'none found'}`);

    for (const tabText of tabs) {
      try {
        await page.evaluate(({ tabText }) => {
          const sidebar = document.querySelector('nav.navbar-default.navbar-static-side');
          const topNav = document.querySelector('nav.navbar-fixed-top');
          const pageWrapper = document.querySelector('#page-wrapper') || document.body;

          const containers = pageWrapper.querySelectorAll('.nav-tabs, [role="tablist"], ul.nav:not(.navbar-nav):not(.metismenu)');
          for (const container of containers) {
            if (sidebar && sidebar.contains(container)) continue;
            if (topNav && topNav.contains(container)) continue;

            const tabs = container.querySelectorAll('a');
            for (const t of tabs) {
              if (t.textContent.trim() === tabText) {
                t.click();
                return;
              }
            }
          }
        }, { tabText });

        await page.waitForTimeout(2000);
        await waitForPageLoad(page);

        await takeScreenshot(
          page, `${entityType} Detail`,
          `${entityType} - ${tabText}`,
          `${entityType} detail - ${tabText}`
        );
      } catch (err) {
        console.log(`  Tab error: ${err.message.substring(0, 60)}`);
      }
    }

  } catch (err) {
    console.log(`  ${entityType} error: ${err.message.substring(0, 100)}`);
  }
}

function buildHTML() {
  const grouped = {};
  for (const s of screenshots) {
    if (!grouped[s.section]) grouped[s.section] = [];
    grouped[s.section].push(s);
  }

  const sections = Object.keys(grouped);
  let toc = '';
  let body = '';

  for (const section of sections) {
    const sectionId = section.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    toc += `<li><a href="#${sectionId}">${esc(section)}</a> <span class="badge">${grouped[section].length}</span></li>\n`;

    body += `<h2 id="${sectionId}">${esc(section)}</h2>\n`;

    for (const s of grouped[section]) {
      const imgData = fs.readFileSync(path.join(SCREENSHOT_DIR, s.filename));
      const base64 = imgData.toString('base64');

      body += `
      <div class="screenshot-card">
        <h3>${esc(s.name)}</h3>
        <p class="url"><code>${esc(s.url)}</code></p>
        <p class="desc">${esc(s.description)}</p>
        <div class="img-container">
          <img src="data:image/png;base64,${base64}" alt="${esc(s.name)}" loading="lazy" />
        </div>
      </div>\n`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tasks Health Main App — All Screens</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5; color: #333; line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #1a73e8, #0d47a1);
      color: white; padding: 40px 20px; text-align: center;
    }
    .header h1 { font-size: 2rem; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .toc {
      background: white; border-radius: 8px; padding: 20px 30px;
      margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      position: sticky; top: 0; z-index: 100;
    }
    .toc h2 { margin-bottom: 10px; color: #1a73e8; font-size: 1.2rem; border: none; margin-top: 0; padding: 0; }
    .toc ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
    .toc a {
      color: #1a73e8; text-decoration: none;
      padding: 4px 12px; border-radius: 20px; background: #e8f0fe;
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.9em;
    }
    .toc a:hover { background: #d2e3fc; }
    .badge {
      background: #1a73e8; color: white; border-radius: 10px;
      padding: 0 6px; font-size: 0.75em;
    }
    h2 {
      margin-top: 40px; margin-bottom: 20px; padding-bottom: 10px;
      border-bottom: 2px solid #1a73e8; color: #1a73e8; font-size: 1.5rem;
    }
    .screenshot-card {
      background: white; border-radius: 8px; padding: 20px;
      margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .screenshot-card h3 { color: #333; margin-bottom: 8px; }
    .screenshot-card .url { font-size: 0.85em; color: #666; margin-bottom: 4px; }
    .screenshot-card .url code { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; }
    .screenshot-card .desc { font-size: 0.9em; color: #888; margin-bottom: 12px; }
    .img-container { border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; }
    .img-container img { width: 100%; display: block; }
    .stats { text-align: center; padding: 10px; color: rgba(255,255,255,0.85); font-size: 0.9em; }
    @media (max-width: 768px) { .toc ul { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Tasks Health Main App — All Screens</h1>
    <p>Comprehensive screenshot documentation of app.taskshealth.com</p>
    <p class="stats">${screenshots.length} screenshots across ${sections.length} sections — Generated ${new Date().toISOString().split('T')[0]}</p>
  </div>
  <div class="container">
    <div class="toc">
      <h2>Table of Contents</h2>
      <ul>${toc}</ul>
    </div>
    ${body}
  </div>
</body>
</html>`;

  const outputPath = path.join(__dirname, '06-screenshots', 'MAIN_APP_SCREENS.html');
  fs.writeFileSync(outputPath, html);
  console.log(`HTML saved to ${outputPath}`);
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
