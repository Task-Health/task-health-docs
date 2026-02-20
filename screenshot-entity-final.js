const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '06-screenshots', 'main-app');

let screenshots = [];
let screenshotIndex = 127;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('=== LOGGING IN ===');
  await page.goto('https://app.taskshealth.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"], input[name="email"]', 'omer+main@medflyt.com');
  await page.fill('input[type="password"]', 'Demo1!Demo');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  await waitForPageLoad(page);

  // ====== Patient Detail - All Sections ======
  console.log('\n=== Patient Detail Sections ===');

  await clickSidebarByText(page, 'Patients');
  await page.waitForTimeout(800);
  await clickSidebarByText(page, 'Patients list');
  await page.waitForTimeout(3000);
  await waitForPageLoad(page);

  // Click first patient row
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#page-wrapper table tbody tr');
    if (rows.length > 0) rows[0].click();
  });
  await page.waitForTimeout(3000);
  await waitForPageLoad(page);

  // Patient sections: Calendar, Profile, Medical, Billing, Administrative, Recent activity
  const patientSections = ['Calendar', 'Profile', 'Medical', 'Billing', 'Administrative', 'Recent activity'];

  for (const sectionName of patientSections) {
    try {
      console.log(`  Clicking section: ${sectionName}`);
      await page.evaluate((sectionName) => {
        const modal = document.querySelector('.patient-modal.in, .modal.in');
        if (!modal) return;
        const items = modal.querySelectorAll('li[ng-click*="handleClickSectionMenu"]');
        for (const item of items) {
          if (item.textContent.trim() === sectionName) {
            item.click();
            return;
          }
        }
      }, sectionName);

      await page.waitForTimeout(2000);
      await waitForPageLoad(page);

      await takeScreenshot(page, 'Patient Detail', `Patient - ${sectionName}`, `Patient detail - ${sectionName} section`);

      // If Calendar section, check for subsections
      if (sectionName === 'Calendar') {
        const subSections = ['List view', 'Weekly template', 'Caregivers'];
        for (const sub of subSections) {
          try {
            await page.evaluate((sub) => {
              const modal = document.querySelector('.patient-modal.in, .modal.in');
              if (!modal) return;
              const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
              for (const item of items) {
                if (item.textContent.trim() === sub) {
                  item.click();
                  return;
                }
              }
            }, sub);
            await page.waitForTimeout(2000);
            await waitForPageLoad(page);
            await takeScreenshot(page, 'Patient Detail', `Patient - Calendar - ${sub}`, `Patient Calendar > ${sub}`);
          } catch (err) {
            console.log(`    Sub error (${sub}): ${err.message.substring(0, 60)}`);
          }
        }
      }

      // If Profile section, check for subsections
      if (sectionName === 'Profile') {
        const profileSubs = await page.evaluate(() => {
          const modal = document.querySelector('.patient-modal.in, .modal.in');
          if (!modal) return [];
          const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
          return Array.from(items).map(i => i.textContent.trim()).filter(t => t.length > 1 && t.length < 50);
        });
        console.log(`    Profile subsections: ${profileSubs.join(', ')}`);

        for (const sub of profileSubs) {
          try {
            await page.evaluate((sub) => {
              const modal = document.querySelector('.patient-modal.in, .modal.in');
              if (!modal) return;
              const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
              for (const item of items) {
                if (item.textContent.trim() === sub) {
                  item.click();
                  return;
                }
              }
            }, sub);
            await page.waitForTimeout(2000);
            await waitForPageLoad(page);
            await takeScreenshot(page, 'Patient Detail', `Patient - Profile - ${sub}`, `Patient Profile > ${sub}`);
          } catch (err) {
            console.log(`    Sub error (${sub}): ${err.message.substring(0, 60)}`);
          }
        }
      }

      // For Medical, Billing, Administrative - also check for subsections
      if (['Medical', 'Billing', 'Administrative'].includes(sectionName)) {
        const subs = await page.evaluate(() => {
          const modal = document.querySelector('.patient-modal.in, .modal.in');
          if (!modal) return [];
          const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
          return Array.from(items).map(i => i.textContent.trim()).filter(t => t.length > 1 && t.length < 50);
        });
        console.log(`    ${sectionName} subsections: ${subs.join(', ')}`);

        for (let i = 0; i < subs.length; i++) {
          const sub = subs[i];
          // Skip the first one if it's already shown (active)
          try {
            await page.evaluate((sub) => {
              const modal = document.querySelector('.patient-modal.in, .modal.in');
              if (!modal) return;
              const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
              for (const item of items) {
                if (item.textContent.trim() === sub) {
                  item.click();
                  return;
                }
              }
            }, sub);
            await page.waitForTimeout(2000);
            await waitForPageLoad(page);
            // Only screenshot if it's not the first (default) subsection
            if (i > 0) {
              await takeScreenshot(page, 'Patient Detail', `Patient - ${sectionName} - ${sub}`, `Patient ${sectionName} > ${sub}`);
            }
          } catch (err) {
            console.log(`    Sub error: ${err.message.substring(0, 60)}`);
          }
        }
      }
    } catch (err) {
      console.log(`  Section error (${sectionName}): ${err.message.substring(0, 80)}`);
    }
  }

  // ====== Caregiver Detail ======
  console.log('\n=== Caregiver Detail ===');

  // Close patient modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  await clickSidebarByText(page, 'Caregivers');
  await page.waitForTimeout(800);
  await clickSidebarByText(page, 'Caregivers list');
  await page.waitForTimeout(3000);
  await waitForPageLoad(page);

  // Click first caregiver row
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#page-wrapper table tbody tr');
    if (rows.length > 0) rows[0].click();
  });
  await page.waitForTimeout(3000);
  await waitForPageLoad(page);

  await takeScreenshot(page, 'Caregiver Detail', 'Caregiver Calendar', 'Caregiver detail - calendar view');

  // Check for caregiver sections
  const cgSections = await page.evaluate(() => {
    const modal = document.querySelector('.caregiver-modal.in, .modal.in');
    if (!modal) return [];
    const items = modal.querySelectorAll('li[ng-click*="handleClickSectionMenu"]');
    return Array.from(items).map(i => i.textContent.trim()).filter(t => t.length > 1 && t.length < 50);
  });

  console.log('Caregiver sections:', cgSections.join(', '));

  for (const sectionName of cgSections) {
    try {
      await page.evaluate((sectionName) => {
        const modal = document.querySelector('.caregiver-modal.in, .modal.in');
        if (!modal) return;
        const items = modal.querySelectorAll('li[ng-click*="handleClickSectionMenu"]');
        for (const item of items) {
          if (item.textContent.trim() === sectionName) {
            item.click();
            return;
          }
        }
      }, sectionName);

      await page.waitForTimeout(2000);
      await waitForPageLoad(page);
      await takeScreenshot(page, 'Caregiver Detail', `Caregiver - ${sectionName}`, `Caregiver detail - ${sectionName} section`);

      // Check for subsections
      const subs = await page.evaluate(() => {
        const modal = document.querySelector('.caregiver-modal.in, .modal.in');
        if (!modal) return [];
        const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
        return Array.from(items).map(i => i.textContent.trim()).filter(t => t.length > 1 && t.length < 50);
      });

      if (subs.length > 1) {
        console.log(`  ${sectionName} subsections: ${subs.join(', ')}`);
        for (let i = 1; i < subs.length; i++) {
          try {
            await page.evaluate((sub) => {
              const modal = document.querySelector('.caregiver-modal.in, .modal.in');
              if (!modal) return;
              const items = modal.querySelectorAll('li[ng-click*="handleClickSubsectionMenu"]');
              for (const item of items) {
                if (item.textContent.trim() === sub) {
                  item.click();
                  return;
                }
              }
            }, subs[i]);
            await page.waitForTimeout(2000);
            await waitForPageLoad(page);
            await takeScreenshot(page, 'Caregiver Detail', `Caregiver - ${sectionName} - ${subs[i]}`, `Caregiver ${sectionName} > ${subs[i]}`);
          } catch (err) {
            console.log(`    Sub error: ${err.message.substring(0, 60)}`);
          }
        }
      }
    } catch (err) {
      console.log(`  Section error: ${err.message.substring(0, 60)}`);
    }
  }

  await browser.close();

  // Save the entity detail screenshots data
  fs.writeFileSync(
    path.join(__dirname, '06-screenshots', 'entity-data.json'),
    JSON.stringify(screenshots, null, 2)
  );
  console.log(`\nSaved ${screenshots.length} entity detail screenshots`);
  console.log('DONE!');
})();

async function clickSidebarByText(page, text) {
  return page.evaluate((text) => {
    const sidebar = document.querySelector('nav.navbar-default.navbar-static-side');
    if (!sidebar) return false;
    const links = Array.from(sidebar.querySelectorAll('a'));
    for (const link of links) {
      const linkText = link.textContent.trim().replace(/\s+/g, ' ').replace(/NEW!?/g, '').trim();
      if (linkText === text) {
        link.scrollIntoView({ block: 'center' });
        link.click();
        return true;
      }
    }
    return false;
  }, text);
}

async function waitForPageLoad(page) {
  try {
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
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
    console.log(`  [${idx}] ${name} -> ${url}`);
  } catch (err) {
    console.log(`  Screenshot error: ${err.message.substring(0, 60)}`);
  }
}
