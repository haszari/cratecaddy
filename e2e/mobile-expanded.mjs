import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
await page.goto('http://localhost:5325/genre/Deep?bpm.gte=116&bpm.lte=129&key=8A&key.tolerance=1', { waitUntil: 'networkidle' });
await page.locator('.FilterBar-collapse').click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/09-mobile-expanded-filters.png', fullPage: false });
await browser.close();
console.log('done');
