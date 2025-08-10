const puppeteer = require('puppeteer');

async function testAntiDetection() {
  console.log('🧪 Testing anti-detection measures...');
  
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
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
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

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
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

    console.log('🌐 Testing access to UPS homepage...');
    
    // Test with UPS homepage first
    await page.goto('https://www.ups.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('✅ Successfully loaded UPS homepage');
    
    // Check if we can access the tracking page
    console.log('🔍 Testing tracking page access...');
    
    // Use a sample tracking number for testing
    const testTrackingNumber = '1Z999AA10123456784'; // This is a sample UPS tracking number
    const trackingUrl = `https://www.ups.com/track?loc=en_US&tracknum=${testTrackingNumber}`;
    
    await page.goto(trackingUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Check if we got an access denied error
    const pageContent = await page.content();
    const hasAccessDenied = pageContent.includes('Access Denied') || 
                           pageContent.includes('access denied') ||
                           pageContent.includes('403') ||
                           pageContent.includes('Forbidden');
    
    if (hasAccessDenied) {
      console.log('❌ Still getting access denied error');
      console.log('💡 This means UPS is still blocking the request');
      console.log('🔧 Try the alternative approach with mobile user agent');
    } else {
      console.log('✅ No access denied error detected');
      console.log('🎉 Anti-detection measures appear to be working!');
    }

    // Wait a bit so you can see the result
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testAntiDetection().catch(console.error);
