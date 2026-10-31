import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5325';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('shot', name);
}

// 1. Home: tag cloud + full filter bar
await page.goto(BASE, { waitUntil: 'networkidle' });
await shot('01-home');

// 2. Genre detail: song table
await page.goto(`${BASE}/genre/Techno`, { waitUntil: 'networkidle' });
await shot('02-genre-list');

// 3. Key filter open (click the key pill)
await page.locator('.FilterPill--inactive', { hasText: 'key' }).click();
await page.waitForTimeout(300);
await shot('03-key-filter-open');

// 4. Select a key (Am / 8A)
await page.selectOption('.FilterPill-select', '8A');
await page.waitForTimeout(500);
await shot('04-key-filter-applied');

// 5. Year filter open
await page.locator('.FilterPill--inactive', { hasText: 'year' }).click();
await page.waitForTimeout(300);
await shot('05-year-filter-open');

// 6. Ownership: cycle to owned
await page.locator('.OwnershipFilter').click();
await page.waitForTimeout(400);
await shot('06-ownership-owned');

await browser.close();
console.log('done');
