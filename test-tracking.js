const puppeteer = require('puppeteer');

async function testUPSTracking(trackingNumber) {
    console.log(`Testing tracking number: ${trackingNumber}`);
    
    const browser = await puppeteer.launch({ 
        headless: false, // Set to false to see what's happening
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('Setting viewport...');
        await page.setViewport({ width: 1920, height: 1080 });
        
        console.log('Navigating to UPS tracking page...');
        const url = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
        console.log('URL:', url);
        
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        console.log('Page loaded, waiting 5 seconds...');
        await page.waitForTimeout(5000);

        console.log('Getting page title...');
        const title = await page.title();
        console.log('Page title:', title);

        console.log('Getting page URL...');
        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);

        console.log('Taking screenshot...');
        await page.screenshot({ path: 'ups-tracking-page.png', fullPage: true });
        console.log('Screenshot saved as ups-tracking-page.png');

        console.log('Extracting page content...');
        const content = await page.content();
        console.log('Page content length:', content.length);
        console.log('First 1000 characters:', content.substring(0, 1000));

        console.log('Looking for tracking information...');
        const trackingData = await page.evaluate(() => {
            // Log all elements with class names containing 'track' or 'status'
            const elements = document.querySelectorAll('*[class*="track"], *[class*="status"], *[class*="ups"]');
            console.log('Found elements with track/status/ups in class:', elements.length);
            
            elements.forEach((el, index) => {
                if (index < 10) { // Log first 10 elements
                    console.log(`Element ${index}:`, el.className, el.innerText.substring(0, 100));
                }
            });

            // Try to find any text that looks like a status
            const allText = document.body.innerText;
            const statusKeywords = ['delivered', 'in transit', 'out for delivery', 'pending', 'shipped', 'processing', 'arrived', 'departed'];
            
            const foundStatuses = statusKeywords.filter(keyword => 
                allText.toLowerCase().includes(keyword)
            );
            
            console.log('Found status keywords:', foundStatuses);

            return {
                title: document.title,
                url: window.location.href,
                bodyText: document.body.innerText.substring(0, 500),
                foundStatuses
            };
        });

        console.log('Tracking data:', trackingData);

        // Wait for user to see the page
        console.log('Browser window is open. Press Enter to close...');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });

    } catch (error) {
        console.error('Error during testing:', error);
    } finally {
        await browser.close();
    }
}

// Get tracking number from command line argument
const trackingNumber = process.argv[2];
if (!trackingNumber) {
    console.log('Usage: node test-tracking.js <tracking-number>');
    console.log('Example: node test-tracking.js 1Z999AA1234567890');
    process.exit(1);
}

testUPSTracking(trackingNumber); 