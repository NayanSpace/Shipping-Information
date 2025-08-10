const readline = require('readline');
const puppeteer = require('puppeteer');

async function promptTrackingNumber() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question('Enter UPS tracking number: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function scrapeUPSTracking(trackingNumber) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const url = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.ups-tracking-summary-container', { timeout: 15000 });

    // Extract shipment status and details
    const result = await page.evaluate(() => {
      const status = document.querySelector('.ups-tracking-summary-status')?.innerText || 'Status not found';
      const details = Array.from(document.querySelectorAll('.ups-tracking-progress-container .ups-progress-section'))
        .map(section => section.innerText.trim());
      return { status, details };
    });
    return result;
  } catch (err) {
    return { error: 'Could not retrieve tracking information. Please check the tracking number and try again.' };
  } finally {
    await browser.close();
  }
}

(async () => {
  const trackingNumber = await promptTrackingNumber();
  const info = await scrapeUPSTracking(trackingNumber);
  if (info.error) {
    console.error(info.error);
  } else {
    console.log(`Status: ${info.status}`);
    console.log('Details:');
    info.details.forEach((d, i) => console.log(`${i + 1}. ${d}`));
  }
})(); 