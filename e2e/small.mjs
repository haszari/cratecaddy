import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 800 } });
await page.goto('http://localhost:5325/genre/Techno', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'screenshots/small-500.png', fullPage: false });
await browser.close();
console.log('done');
