const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8080/screentests.html';
const SCREENSHOT_DIR = path.join(__dirname, '06-screenshots', 'mobile');
const OUTPUT_HTML = path.join(__dirname, '06-screenshots', 'MOBILE_SCREENS.html');

(async () => {
  // Clean up
  if (fs.existsSync(SCREENSHOT_DIR)) fs.rmSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone form factor
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // Step 1: Navigate to index to get all screen names
  console.log('Loading screentests index...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Wait for the console log that signals the index is loaded
  const screenNames = await page.evaluate(() => {
    const links = document.querySelectorAll('ol a');
    return Array.from(links).map(a => {
      const href = a.getAttribute('href') || '';
      // href looks like #!/ScreenName
      const name = href.replace('#!/', '');
      return name;
    }).filter(n => n.length > 0);
  });

  console.log(`Found ${screenNames.length} screens`);
  if (screenNames.length === 0) {
    console.error('No screens found!');
    await browser.close();
    process.exit(1);
  }

  // Step 2: Screenshot each screen
  const screenshots = []; // { name, file, section }
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < screenNames.length; i++) {
    const screenName = screenNames[i];
    const idx = String(i + 1).padStart(3, '0');
    const safeFileName = `${idx}-${screenName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    const filePath = path.join(SCREENSHOT_DIR, safeFileName);

    try {
      // Navigate to the screen
      await page.goto(`${BASE_URL}#!/${screenName}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});

      // Wait for render - listen for [SCREENTESTS] [RENDERED] console log
      await page.waitForTimeout(1500);

      // Check if there's an error
      const hasError = await page.evaluate(() => {
        const body = document.body.innerText;
        return body.includes('Error') && body.length < 100;
      });

      if (hasError) {
        console.log(`  [${idx}] ERROR: ${screenName}`);
        errorCount++;
        continue;
      }

      // Take screenshot
      await page.screenshot({ path: filePath, fullPage: false }); // Use viewport size, not full page

      // Derive section from screen name
      const section = deriveSection(screenName);
      screenshots.push({ name: screenName, file: `mobile/${safeFileName}`, section });
      successCount++;

      if (i % 10 === 0 || i === screenNames.length - 1) {
        console.log(`  [${idx}/${screenNames.length}] ${screenName}`);
      }
    } catch (err) {
      console.log(`  [${idx}] FAILED: ${screenName} — ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nDone: ${successCount} captured, ${errorCount} errors`);

  // Step 3: Generate HTML
  console.log('Generating HTML...');

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

    contentHtml += `<div class="section" id="${sectionId}"><h2>${sectionName}</h2><div class="screen-grid">`;

    items.forEach((item, idx) => {
      const itemId = `${sectionId}-${idx}`;
      tocHtml += `<li><a href="#${itemId}">${item.name}</a></li>`;

      const imgPath = path.join(__dirname, '06-screenshots', item.file);
      const imgBase64 = fs.readFileSync(imgPath).toString('base64');

      contentHtml += `
        <div class="screenshot" id="${itemId}">
          <h3>${item.name}</h3>
          <div class="phone-frame">
            <img src="data:image/png;base64,${imgBase64}" alt="${item.name}" loading="lazy" />
          </div>
        </div>`;
    });

    tocHtml += '</ul></li>';
    contentHtml += '</div></div>';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Health Mobile App — All Screens</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
      max-width: 1800px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #0B2D4D, #1FB6A6);
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
      padding: 24px 24px 24px 32px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      columns: 2;
    }
    .toc h2 { margin-bottom: 16px; color: #1a1a1a; column-span: all; }
    .toc > ul { padding-left: 0; list-style: none; }
    .toc > ul > li { margin-bottom: 12px; break-inside: avoid; }
    .toc > ul > li > a { font-weight: 600; font-size: 1.05em; }
    .toc ul ul { padding-left: 20px; margin-top: 4px; }
    .toc li { margin: 2px 0; font-size: 0.9em; }
    .toc a { color: #0B2D4D; text-decoration: none; }
    .toc a:hover { text-decoration: underline; color: #1FB6A6; }
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
      border-left: 4px solid #1FB6A6;
    }
    .screen-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .screenshot {
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .screenshot h3 {
      font-size: 0.9em;
      margin-bottom: 12px;
      color: #1a1a1a;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .phone-frame {
      background: #000;
      border-radius: 24px;
      padding: 8px;
      aspect-ratio: 375 / 812;
      overflow: hidden;
    }
    .phone-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 16px;
    }
    .back-to-top {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0B2D4D;
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
    .back-to-top:hover { background: #1FB6A6; }
    .timestamp {
      text-align: center;
      color: #999;
      margin-top: 40px;
      font-size: 0.85em;
      padding: 20px;
    }
    @media (max-width: 768px) {
      .screen-grid { grid-template-columns: repeat(2, 1fr); }
      .toc { columns: 1; }
    }
    @media print {
      .back-to-top { display: none; }
      .section > h2 { position: static; }
      .screenshot { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header" id="top">
    <h1>Task Health Mobile App — All Screens</h1>
    <p>Comprehensive screenshot documentation of the Task Health mobile application</p>
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

  <a href="#top" class="back-to-top" title="Back to top">&uarr;</a>

  <div class="timestamp">
    Generated on ${new Date().toISOString()} using Playwright + screentests framework<br>
    Source: taskhealth-mobile2/screentests
  </div>
</body>
</html>`;

  fs.writeFileSync(OUTPUT_HTML, html);
  const fileSize = fs.statSync(OUTPUT_HTML).size;
  console.log(`\nHTML saved to: ${OUTPUT_HTML}`);
  console.log(`${screenshots.length} screenshots, ${sections.size} sections, ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

  await browser.close();
})();

// Categorize screens into sections based on name patterns
function deriveSection(name) {
  const n = name.toLowerCase();

  if (n.includes('intro') || n.includes('setup') || n.includes('pin') || n.includes('outdated')) return 'Onboarding & Auth';
  if (n.includes('setting')) return 'Settings';
  if (n.includes('profile')) return 'Profile & Identity';
  if (n.includes('agencies') || n.includes('agency')) return 'Agencies';
  if (n.includes('availablevisit') || n.includes('available') && n.includes('visit')) return 'Available Visits';
  if (n.includes('availabletask') || n.includes('scheduletask')) return 'Available Tasks';
  if (n.includes('visitpending') || n.includes('convertimported')) return 'Visit Confirmation';
  if (n.includes('reschedule') || n.includes('cancel-visit')) return 'Reschedule & Cancel';
  if (n.includes('training')) return 'Training Center';
  if (n.includes('medflytchallenge')) return 'Challenges';
  if (n.includes('notification')) return 'Notifications';
  if (n.includes('referral')) return 'Referral';
  if (n.includes('casesettings') || n.includes('case')) return 'Case Settings';
  if (n.includes('instapay') || n.includes('bank')) return 'InstaPay & Banking';
  if (n.includes('passport')) return 'Medflyt Passport';
  if (n.includes('onboarding')) return 'Onboarding';
  if (n.includes('chat')) return 'Chat';
  if (n.includes('sidebar')) return 'Navigation';
  if (n.includes('main')) return 'Main Screen';
  if (n.includes('medication') || n.includes('medicationcard')) return 'Medications';
  if (n.includes('patient') && !n.includes('medication')) return 'Patients';
  if (n.includes('diagnosis')) return 'Diagnosis Codes';
  if (n.includes('compliance') || n.includes('requireddoc')) return 'Compliance';
  if (n.includes('timesheet')) return 'Timesheets';
  if (n.includes('scheduledvisit') || n.includes('doc') || n.includes('document')) return 'Documents';
  if (n.includes('calendar') || n.includes('datepicker') || n.includes('monthpicker')) return 'Date & Time';
  if (n.includes('caremoment')) return 'Care Moments';
  if (n.includes('raffle')) return 'Raffle';
  if (n.includes('selfie') || n.includes('countdown') || n.includes('clock') || n.includes('prompt') || n.includes('watch')) return 'Clock In/Out';
  if (n.includes('modal') || n.includes('bottomsheet') || n.includes('overlay') || n.includes('dimmer') || n.includes('error')) return 'Modals & Sheets';
  if (n.includes('section')) return 'Clinical Sections';
  if (n.includes('button') || n.includes('input') || n.includes('radio') || n.includes('badge') || n.includes('card') || n.includes('icon') || n.includes('spinner') || n.includes('loading') || n.includes('placeholder') || n.includes('scaffold') || n.includes('categorized') || n.includes('fab') || n.includes('speech') || n.includes('slide') || n.includes('async') || n.includes('signature') || n.includes('pandown') || n.includes('upload') || n.includes('info')) return 'UI Components';
  if (n.includes('covid')) return 'COVID';
  if (n.includes('contact')) return 'Contact';
  if (n.includes('taskavatarscreen') || n.includes('taskavatar')) return 'Tasks';
  if (n.includes('visit')) return 'Visits';
  if (n.includes('banner')) return 'Banners';

  return 'Other';
}
