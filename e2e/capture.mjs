import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5325';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('shot', name);
}

// 1. Home (desktop): tag cloud + filter bar
await desktop.goto(BASE, { waitUntil: 'networkidle' });
await shot(desktop, '01-home');

// 2. Genre list: song table with new columns
await desktop.goto(`${BASE}/genre/Techno`, { waitUntil: 'networkidle' });
await shot(desktop, '02-genre-list');

// 3. Key filter applied (8A)
await desktop.locator('.FilterPill--inactive', { hasText: 'key' }).click();
await desktop.selectOption('.FilterPill-select', '8A');
await desktop.waitForTimeout(500);
await shot(desktop, '03-key-filter');

// 4. Year filter applied (2000 ±5)
await desktop.locator('.FilterPill--inactive', { hasText: 'year' }).click();
await desktop.locator('.FilterPill-input').fill('2000');
await desktop.waitForTimeout(400);
await shot(desktop, '04-year-filter');

// 5. Ownership: owned
await desktop.locator('.OwnershipFilter').click();
await desktop.waitForTimeout(400);
await shot(desktop, '05-ownership');

// 6. Key empty state (key select already open from step 3)
await desktop.selectOption('.FilterPill-select', 'empty');
await desktop.waitForTimeout(400);
await shot(desktop, '06-key-empty');

// Mobile
const mobile = await browser.newPage({ viewport: { width: 500, height: 850 } });
await mobile.goto(`${BASE}/genre/Techno`, { waitUntil: 'networkidle' });
await shot(mobile, '07-mobile-collapsed');
await mobile.locator('.FilterBar-collapse').click();
await mobile.waitForTimeout(400);
await shot(mobile, '08-mobile-expanded');

await browser.close();
console.log('done');
