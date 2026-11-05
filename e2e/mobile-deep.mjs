import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
await page.goto('http://localhost:5325/genre/Deep?bpm.gte=117&bpm.lte=127&rating.gte=4&rating.lte=5&key=8A&key.tolerance=1&shuffle=abc123', { waitUntil: 'networkidle' });
await page.locator('.FilterBar-collapse').click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/10-mobile-deep.png', fullPage: false });
await browser.close();
console.log('done');
