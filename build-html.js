const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '06-screenshots', 'main-app');
const OUTPUT_PATH = path.join(__dirname, '06-screenshots', 'MAIN_APP_SCREENS.html');

// Load all screenshot data from different runs
const mainRunData = require('./06-screenshots/main-run-data.json') || [];  // main sidebar screenshots (001-113)
const detailsData = require('./06-screenshots/details-data.json') || [];   // Profile, Back Office
const entityData = require('./06-screenshots/entity-data.json') || [];     // Patient & Caregiver detail sections

// Combine all data
let allScreenshots = [];

// Add main sidebar screenshots (001-113)
for (const s of mainRunData) {
  allScreenshots.push(s);
}

// Add Profile and Back Office from details run
for (const s of detailsData) {
  if (s.name === 'Profile' || s.name === 'Back Office') {
    allScreenshots.push(s);
  }
}

// Add all entity detail screenshots (patient sections, caregiver sections)
for (const s of entityData) {
  allScreenshots.push(s);
}

// Verify all screenshot files exist
allScreenshots = allScreenshots.filter(s => {
  const filepath = path.join(SCREENSHOT_DIR, s.filename);
  if (!fs.existsSync(filepath)) {
    console.log(`WARNING: Missing file: ${s.filename}`);
    return false;
  }
  return true;
});

// Remove debug screenshots
allScreenshots = allScreenshots.filter(s => !s.filename.includes('debug'));

console.log(`Total screenshots: ${allScreenshots.length}`);

// Define section order for nice organization
const sectionOrder = [
  'Login',
  'Dashboard',
  'Notes',
  'Patients',
  'Patient Detail',
  'Caregivers',
  'Caregiver Detail',
  'Training Center',
  'Visits',
  'Chat',
  'Comm Center',
  'Workflows',
  'EVV',
  'Payroll',
  'Billing',
  'Passport Verifier',
  'Reports',
  'HHAX Integration',
  'Compliance Document Review',
  'Admin',
  'Top Bar / Settings',
];

// Group by section
const grouped = {};
for (const s of allScreenshots) {
  if (!grouped[s.section]) grouped[s.section] = [];
  grouped[s.section].push(s);
}

// Sort sections by defined order
const sections = Object.keys(grouped).sort((a, b) => {
  const ia = sectionOrder.indexOf(a);
  const ib = sectionOrder.indexOf(b);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
});

console.log('Sections:', sections.join(', '));
sections.forEach(s => console.log(`  ${s}: ${grouped[s].length} screenshots`));

// Build HTML
let toc = '';
let body = '';

for (const section of sections) {
  const sectionId = section.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  toc += `<li><a href="#${sectionId}">${esc(section)}</a> <span class="badge">${grouped[section].length}</span></li>\n`;

  body += `<h2 id="${sectionId}">${esc(section)}</h2>\n`;

  for (const s of grouped[section]) {
    const filepath = path.join(SCREENSHOT_DIR, s.filename);
    const imgData = fs.readFileSync(filepath);
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
    .header h1 { font-size: 2rem; margin-bottom: 8px; }
    .header .subtitle { opacity: 0.9; font-size: 1.1em; }
    .header .stats { opacity: 0.8; font-size: 0.9em; margin-top: 8px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .toc {
      background: white; border-radius: 8px; padding: 20px 24px;
      margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      position: sticky; top: 0; z-index: 100;
    }
    .toc h2 {
      margin-bottom: 12px; color: #1a73e8; font-size: 1.1rem;
      border: none; margin-top: 0; padding: 0;
    }
    .toc ul { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
    .toc a {
      color: #1a73e8; text-decoration: none;
      padding: 4px 12px; border-radius: 20px; background: #e8f0fe;
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.85em;
      transition: background 0.2s;
    }
    .toc a:hover { background: #d2e3fc; }
    .badge {
      background: #1a73e8; color: white; border-radius: 10px;
      padding: 0 6px; font-size: 0.75em; min-width: 18px; text-align: center;
    }
    h2 {
      margin-top: 40px; margin-bottom: 20px; padding: 12px 0 8px;
      border-bottom: 2px solid #1a73e8; color: #1a73e8; font-size: 1.4rem;
    }
    .screenshot-card {
      background: white; border-radius: 8px; padding: 20px;
      margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .screenshot-card h3 { color: #333; margin-bottom: 6px; font-size: 1.1em; }
    .screenshot-card .url { font-size: 0.8em; color: #666; margin-bottom: 4px; }
    .screenshot-card .url code { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 0.95em; }
    .screenshot-card .desc { font-size: 0.85em; color: #999; margin-bottom: 12px; }
    .img-container { border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; }
    .img-container img { width: 100%; display: block; }
    @media (max-width: 768px) {
      .toc ul { flex-direction: column; }
      .header h1 { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Tasks Health Main App — All Screens</h1>
    <p class="subtitle">Comprehensive screenshot documentation of app.taskshealth.com</p>
    <p class="stats">${allScreenshots.length} screenshots across ${sections.length} sections — Generated ${new Date().toISOString().split('T')[0]}</p>
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

fs.writeFileSync(OUTPUT_PATH, html);
console.log(`\nHTML saved to ${OUTPUT_PATH}`);
console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1)} MB`);

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
