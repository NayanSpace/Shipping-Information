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
  // Use a different approach - try to access the mobile version first
  const browser = await puppeteer.launch({ 
    headless: false,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-http2',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    
    // Remove webdriver property to avoid detection
    await page.evaluateOnNewDocument(() => {
      delete navigator.__proto__.webdriver;
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Add additional stealth measures
    await page.evaluateOnNewDocument(() => {
      // Override the plugins property
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override the languages property
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override the permissions property
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Set additional headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // Try the mobile version first
    const mobileUrl = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
    
    // Add a random delay to simulate human behavior
    await page.waitForTimeout(Math.random() * 3000 + 2000);
    
    console.log('Trying mobile version...');
    await page.goto(mobileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Try to handle cookie consent banner if present
    try {
      const cookieButton = await page.$('button[aria-label*="Accept"], button[aria-label*="Close"], .cookie-accept, [id*="cookie"] button, .cookie-banner button');
      if (cookieButton) {
        console.log('Cookie banner found, clicking accept...');
        await cookieButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log('No cookie banner found or error handling it');
    }

    // Wait for tracking content to appear
    try {
      await page.waitForFunction(() => {
        const trackingSelectors = [
          'milestone-progress-bar',
          '.ups-tracking-summary',
          '[id*="progress"]',
          '[class*="tracking"]',
          '[class*="ups-progress"]',
          '.tracking-details',
          '.shipment-progress'
        ];
        
        return trackingSelectors.some(selector => {
          const element = document.querySelector(selector);
          return element && element.innerText.length > 0;
        });
      }, { timeout: 15000 });
    } catch (error) {
      console.log('Tracking content not found, but continuing...');
    }

    // Extract shipment status and details
    const result = await page.evaluate(() => {
      // First, check if the package is delivered by looking for the delivered checkmark at the top
      const deliveredCheckmark = document.querySelector('#st_App_DelvdLabel i.ups-icon-checkcircle-solid, .ups-icon-checkcircle-solid, [id*="DelvdLabel"] i');
      const hasDeliveredCheckmark = deliveredCheckmark !== null;
      
      // Also check for "Delivered On" text at the top
      const hasDeliveredOnText = document.body.innerText.includes('Delivered On');
      
      console.log('Delivered checkmark found:', hasDeliveredCheckmark);
      console.log('Delivered On text found:', hasDeliveredOnText);
      
      // Try multiple approaches to find tracking information
      
      // Approach 1: Look for milestone progress bar
      const milestoneBar = document.querySelector('milestone-progress-bar#stApp_shpmtProgress');
      if (milestoneBar) {
        const tbody = milestoneBar.querySelector('tbody');
        if (tbody) {
          const progressRows = tbody.querySelectorAll('tr[id^="stApp_ShpmtProg_LVP_progress_row_"]');
          const details = Array.from(progressRows).map(row => row.innerText.trim()).filter(text => text);
          
          let status = 'Status not found';
          let deliveredStepFound = false;
          
          for (let i = progressRows.length - 1; i >= 0; i--) {
            const row = progressRows[i];
            const rowText = row.innerText.trim();
            const hasCheckmark = row.querySelector('.ups-progress_past_row') !== null || 
                               row.classList.contains('ups-progress_past_row') ||
                               row.innerHTML.includes('check') ||
                               row.innerHTML.includes('✓') ||
                               row.querySelector('.ups-icon-checkcircle-solid') !== null;
            
            // Check if this is the delivered step
            const isDeliveredStep = rowText.toLowerCase().includes('delivered') || 
                                  rowText.toLowerCase().includes('delivery');
            
            // Special logic: If package is delivered and this is the last step (delivered step), 
            // force it to be completed even if it shows pending
            let forceCompleted = false;
            if ((hasDeliveredCheckmark || hasDeliveredOnText) && isDeliveredStep && i === progressRows.length - 1) {
              forceCompleted = true;
              console.log('Forcing delivered step to be completed');
            }
            
            if (hasCheckmark || forceCompleted) {
              if (isDeliveredStep) {
                status = rowText;
                deliveredStepFound = true;
                break;
              } else if (!deliveredStepFound) {
                status = rowText;
              }
            }
          }
          
                     // If we found delivered indicators but status doesn't reflect it, override
           if ((hasDeliveredCheckmark || hasDeliveredOnText || deliveredStepFound) && 
               !status.toLowerCase().includes('delivered')) {
             status = 'Delivered';
           }

           // Force status to be delivered if package is delivered
           if (hasDeliveredCheckmark || hasDeliveredOnText || deliveredStepFound) {
             status = 'Delivered';
           }
          
          return { status, details };
        }
      }
      
      // Approach 2: Look for any tracking-related content
      const allText = document.body.innerText;
      const lines = allText.split('\n').filter(line => line.trim().length > 0);
      
      // Look for lines that might contain tracking information
      const trackingLines = lines.filter(line => 
        line.toLowerCase().includes('delivered') ||
        line.toLowerCase().includes('in transit') ||
        line.toLowerCase().includes('out for delivery') ||
        line.toLowerCase().includes('pending') ||
        line.toLowerCase().includes('shipped') ||
        line.toLowerCase().includes('processing') ||
        line.toLowerCase().includes('arrived') ||
        line.toLowerCase().includes('departed')
      );
      
      if (trackingLines.length > 0) {
        let status = trackingLines[0];
        
        // If we found delivered indicators, prioritize delivered status
        if ((hasDeliveredCheckmark || hasDeliveredOnText) && 
            !status.toLowerCase().includes('delivered')) {
          status = 'Delivered';
        }
        
        return {
          status: status,
          details: trackingLines.slice(0, 5) // Take first 5 relevant lines
        };
      }
      
      // Approach 3: Fallback to old selectors
      const status = document.querySelector('.ups-tracking-summary-status')?.innerText || 
                    document.querySelector('.tracking-status')?.innerText ||
                    document.querySelector('.status-text')?.innerText ||
                    'Status not found';
                    
      const details = Array.from(document.querySelectorAll('.ups-tracking-progress-container .ups-progress-section, .tracking-details, .shipment-progress'))
        .map(section => section.innerText.trim())
        .filter(text => text);
        
      return { status, details };
    });
    
    return result;
  } catch (err) {
    console.error('Scraping error:', err);
    return { error: 'Could not retrieve tracking information. Please check the tracking number and try again.' };
  } finally {
    await page.waitForTimeout(3000);
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
