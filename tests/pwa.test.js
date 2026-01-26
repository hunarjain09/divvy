/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('PWA Configuration', () => {
  let htmlContent;

  beforeAll(() => {
    const filePath = path.join(process.cwd(), 'divvy.html');
    htmlContent = fs.readFileSync(filePath, 'utf8');
  });

  test('has manifest link', () => {
    expect(htmlContent).toMatch(/<link\s+rel="manifest"\s+href="manifest\.json">/);
  });

  test('has apple-touch-icon', () => {
    expect(htmlContent).toMatch(/<link\s+rel="apple-touch-icon"[^>]*href="icons\/icon-180x180\.png"/);
  });

  test('has theme-color meta tag', () => {
    expect(htmlContent).toMatch(/<meta\s+name="theme-color"\s+content="#30e87a">/);
  });

  test('has favicon links', () => {
    // PNG favicon
    expect(htmlContent).toMatch(/<link\s+rel="icon"\s+type="image\/png"[^>]*href="icons\/icon-32x32\.png"/);
    // SVG favicon
    expect(htmlContent).toMatch(/<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="icons\/divvy-icon\.svg">/);
  });

  test('has iOS meta tags', () => {
    expect(htmlContent).toMatch(/<meta\s+name="mobile-web-app-capable"\s+content="yes">/);
    expect(htmlContent).toMatch(/<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="default">/);
    expect(htmlContent).toMatch(/<meta\s+name="apple-mobile-web-app-title"\s+content="Divvy">/);
  });

  test('has service worker registration script', () => {
    expect(htmlContent).toMatch(/navigator\.serviceWorker\.register\(['"]sw\.js['"]\)/);
  });

  test('manifest.json exists and is valid', () => {
    const manifestPath = path.join(process.cwd(), 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.name).toBe('Divvy');
    expect(manifest.short_name).toBe('Divvy');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#30e87a');
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThan(0);

    // Check for required icon sizes
    const sizes = manifest.icons.map(i => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  test('service worker file exists and has required handlers', () => {
    const swPath = path.join(process.cwd(), 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf8');
    // Check for service worker event listeners
    expect(swContent).toContain("addEventListener('install'");
    expect(swContent).toContain("addEventListener('activate'");
    expect(swContent).toContain("addEventListener('fetch'");
    expect(swContent).toContain('caches');
  });

  test('icon files exist', () => {
    const iconDir = path.join(process.cwd(), 'icons');
    expect(fs.existsSync(iconDir)).toBe(true);

    // Check critical icons exist
    expect(fs.existsSync(path.join(iconDir, 'icon-180x180.png'))).toBe(true);
    expect(fs.existsSync(path.join(iconDir, 'icon-192x192.png'))).toBe(true);
    expect(fs.existsSync(path.join(iconDir, 'icon-512x512.png'))).toBe(true);
    expect(fs.existsSync(path.join(iconDir, 'divvy-icon.svg'))).toBe(true);
  });
});
