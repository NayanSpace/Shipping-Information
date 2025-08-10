const puppeteer = require('puppeteer');

async function debugUPSTracking(trackingNumber) {
    console.log(`🔍 Debugging tracking number: ${trackingNumber}`);
    
    const browser = await puppeteer.launch({ 
        headless: false, // Show browser window
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
        console.log('📱 Setting viewport...');
        await page.setViewport({ width: 1920, height: 1080 });
        
        console.log('🌐 Navigating to UPS tracking page...');
        const url = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
        console.log('URL:', url);
        
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        console.log('⏳ Waiting for page to load...');
        
        // Wait for the main content to load and be visible
        console.log('Waiting for main content to load...');
        let mainContentLoaded = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds total
        
        while (!mainContentLoaded && attempts < maxAttempts) {
            try {
                // Wait for #ups-main to exist and be visible
                await page.waitForFunction(() => {
                    const mainElement = document.querySelector('#ups-main');
                    if (!mainElement) return false;
                    
                    // Check if element is visible and has content
                    const style = window.getComputedStyle(mainElement);
                    const isVisible = style.display !== 'none' && 
                                    style.visibility !== 'hidden' && 
                                    style.opacity !== '0';
                    
                    // Check if it has meaningful content (not just loading)
                    const hasContent = mainElement.innerText.length > 50;
                    
                    return isVisible && hasContent;
                }, { timeout: 1000 });
                
                console.log('✅ Main content area (#ups-main) is visible and loaded');
                mainContentLoaded = true;
                
            } catch (error) {
                attempts++;
                console.log(`Attempt ${attempts}/${maxAttempts}: Main content not ready yet, waiting...`);
                await page.waitForTimeout(1000);
            }
        }
        
        if (!mainContentLoaded) {
            console.log('❌ Main content did not load within timeout period');
            console.log('Taking screenshot of current state...');
            await page.screenshot({ path: 'debug-ups-page-timeout.png', fullPage: true });
            console.log('💾 Timeout screenshot saved as debug-ups-page-timeout.png');
        }
        
        // Try to handle cookie consent banner if present
        try {
            const cookieButton = await page.$('button[aria-label*="Accept"], button[aria-label*="Close"], .cookie-accept, [id*="cookie"] button, .cookie-banner button');
            if (cookieButton) {
                console.log('🍪 Cookie banner found, clicking accept...');
                await cookieButton.click();
                await page.waitForTimeout(2000);
            }
        } catch (error) {
            console.log('No cookie banner found or error handling it');
        }
        
        // Wait for tracking content to appear
        console.log('Waiting for tracking content to appear...');
        try {
            await page.waitForFunction(() => {
                const trackingSelectors = [
                    'milestone-progress-bar',
                    '.ups-tracking-summary',
                    '[id*="progress"]',
                    '[class*="tracking"]',
                    '[class*="ups-progress"]'
                ];
                
                return trackingSelectors.some(selector => {
                    const element = document.querySelector(selector);
                    return element && element.innerText.length > 0;
                });
            }, { timeout: 10000 });
            console.log('✅ Tracking content found');
        } catch (error) {
            console.log('⚠️ Tracking content not found, but continuing...');
        }
        
        // Final wait to ensure everything is loaded
        await page.waitForTimeout(2000);

        console.log('📄 Getting page information...');
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                bodyText: document.body.innerText.substring(0, 1000)
            };
        });
        
        console.log('📋 Page Title:', pageInfo.title);
        console.log('🔗 Current URL:', pageInfo.url);
        console.log('📝 First 1000 chars of body text:', pageInfo.bodyText);

        console.log('🔍 Looking for milestone progress bar...');
        const milestoneInfo = await page.evaluate(() => {
            // Look for milestone-progress-bar
            const milestoneBar = document.querySelector('milestone-progress-bar');
            console.log('Milestone bar found:', !!milestoneBar);
            
            if (milestoneBar) {
                console.log('Milestone bar ID:', milestoneBar.id);
                console.log('Milestone bar classes:', milestoneBar.className);
            }

            // Look for the specific ID we want
            const specificMilestoneBar = document.querySelector('milestone-progress-bar#stApp_shpmtProgress');
            console.log('Specific milestone bar found:', !!specificMilestoneBar);

            // Look for any element with the ID
            const anyElementWithId = document.querySelector('#stApp_shpmtProgress');
            console.log('Any element with stApp_shpmtProgress ID found:', !!anyElementWithId);

            // Look for table body
            const tbody = document.querySelector('tbody');
            console.log('Any tbody found:', !!tbody);

            // Look for progress rows
            const progressRows = document.querySelectorAll('tr[id^="stApp_ShpmtProg_LVP_progress_row_"]');
            console.log('Progress rows found:', progressRows.length);

            // Look for any tr elements
            const allTrs = document.querySelectorAll('tr');
            console.log('Total tr elements found:', allTrs.length);

            // Look for elements with 'ups-progress' in class
            const upsProgressElements = document.querySelectorAll('*[class*="ups-progress"]');
            console.log('Elements with ups-progress in class:', upsProgressElements.length);

            // List all IDs on the page
            const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
            console.log('All IDs on page:', allIds);

            return {
                milestoneBarFound: !!milestoneBar,
                specificMilestoneBarFound: !!specificMilestoneBar,
                anyElementWithIdFound: !!anyElementWithId,
                tbodyFound: !!tbody,
                progressRowsCount: progressRows.length,
                totalTrs: allTrs.length,
                upsProgressElementsCount: upsProgressElements.length,
                allIds: allIds
            };
        });

        console.log('📊 Milestone Info:', milestoneInfo);

        console.log('📸 Taking screenshot...');
        await page.screenshot({ path: 'debug-ups-page.png', fullPage: true });
        console.log('💾 Screenshot saved as debug-ups-page.png');

        console.log('🔍 Detailed element search...');
        const detailedSearch = await page.evaluate(() => {
            const results = {};

            // Search for milestone-progress-bar
            results.milestoneProgressBar = {
                found: !!document.querySelector('milestone-progress-bar'),
                count: document.querySelectorAll('milestone-progress-bar').length,
                elements: Array.from(document.querySelectorAll('milestone-progress-bar')).map(el => ({
                    id: el.id,
                    className: el.className,
                    innerHTML: el.innerHTML.substring(0, 200)
                }))
            };

            // Search for tbody elements
            results.tbodyElements = {
                found: !!document.querySelector('tbody'),
                count: document.querySelectorAll('tbody').length,
                elements: Array.from(document.querySelectorAll('tbody')).map((el, index) => ({
                    index: index,
                    id: el.id,
                    className: el.className,
                    trCount: el.querySelectorAll('tr').length,
                    innerHTML: el.innerHTML.substring(0, 300)
                }))
            };

            // Search for tr elements with specific patterns
            results.trElements = {
                total: document.querySelectorAll('tr').length,
                withId: document.querySelectorAll('tr[id]').length,
                withProgressId: document.querySelectorAll('tr[id*="progress"]').length,
                withUpsClass: document.querySelectorAll('tr[class*="ups"]').length
            };

            // Search for any elements with 'progress' in ID
            results.progressElements = {
                count: document.querySelectorAll('[id*="progress"]').length,
                ids: Array.from(document.querySelectorAll('[id*="progress"]')).map(el => el.id)
            };

            return results;
        });

        console.log('🔍 Detailed Search Results:', JSON.stringify(detailedSearch, null, 2));

        // Wait for user to see the page
        console.log('\n🖥️  Browser window is open. You can inspect the page manually.');
        console.log('📝 Press Enter to close the browser and continue...');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });

    } catch (error) {
        console.error('❌ Error during debugging:', error);
    } finally {
        await browser.close();
    }
}

// Get tracking number from command line argument
const trackingNumber = process.argv[2];
if (!trackingNumber) {
    console.log('Usage: node debug-tracking.js <tracking-number>');
    console.log('Example: node debug-tracking.js 1Z999AA1234567890');
    process.exit(1);
}

debugUPSTracking(trackingNumber); 