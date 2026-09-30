const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2' });

  // Login
  await page.type('input[type="email"]', 'admin@smartbus.com');
  await page.type('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation();

  // Go to children page
  await page.goto('http://localhost:5174/children', {
    waitUntil: 'networkidle2',
  });

  // Click first child profile button
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.textContent, btn);
    if (text.includes('Voir Profil')) {
      await btn.click();
      break;
    }
  }

  // Wait a bit for profile to load
  await new Promise((r) => setTimeout(r, 2000));

  await browser.close();
})();
