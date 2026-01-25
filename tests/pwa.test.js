/**
 * @jest-environment node
 */
const puppeteer = require('puppeteer');
const path = require('path');

describe('PWA Configuration', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new' });
    page = await browser.newPage();
    const filePath = path.join(process.cwd(), 'divvy.html');
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('has manifest link', async () => {
    const manifest = await page.$('link[rel="manifest"]');
    expect(manifest).not.toBeNull();

    const href = await page.$eval('link[rel="manifest"]', el => el.getAttribute('href'));
    expect(href).toBe('manifest.json');
  });

  test('has apple-touch-icon', async () => {
    const icon = await page.$('link[rel="apple-touch-icon"]');
    expect(icon).not.toBeNull();

    const href = await page.$eval('link[rel="apple-touch-icon"]', el => el.getAttribute('href'));
    expect(href).toContain('icon-180x180.png');
  });

  test('has theme-color meta tag', async () => {
    const theme = await page.$('meta[name="theme-color"]');
    expect(theme).not.toBeNull();

    const content = await page.$eval('meta[name="theme-color"]', el => el.getAttribute('content'));
    expect(content).toBe('#30e87a');
  });

  test('has favicon links', async () => {
    const pngFavicon = await page.$('link[rel="icon"][type="image/png"]');
    expect(pngFavicon).not.toBeNull();

    const svgFavicon = await page.$('link[rel="icon"][type="image/svg+xml"]');
    expect(svgFavicon).not.toBeNull();
  });

  test('has iOS meta tags', async () => {
    const webAppCapable = await page.$('meta[name="apple-mobile-web-app-capable"]');
    expect(webAppCapable).not.toBeNull();

    const statusBarStyle = await page.$('meta[name="apple-mobile-web-app-status-bar-style"]');
    expect(statusBarStyle).not.toBeNull();

    const webAppTitle = await page.$('meta[name="apple-mobile-web-app-title"]');
    expect(webAppTitle).not.toBeNull();
  });

  test('has service worker registration script', async () => {
    const swScript = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes('serviceWorker')) {
          return true;
        }
      }
      return false;
    });
    expect(swScript).toBe(true);
  });
});
