const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to track UPS shipments
app.post('/api/track-ups', async (req, res) => {
    const { trackingNumber } = req.body;
    
    if (!trackingNumber) {
        return res.status(400).json({ error: 'Tracking number is required' });
    }

    try {
        const trackingInfo = await scrapeUPSTracking(trackingNumber);
        res.json(trackingInfo);
    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ error: 'Failed to track shipment' });
    }
});

// API endpoint to track FedEx shipments
app.post('/api/track-fedex', async (req, res) => {
    const { trackingNumber } = req.body;

    if (!trackingNumber) {
        return res.status(400).json({ error: 'Tracking number is required' });
    }

    try {
        const trackingInfo = await scrapeFedExTracking(trackingNumber);
        res.json(trackingInfo);
    } catch (error) {
        console.error('FedEx tracking error:', error);
        res.status(500).json({ error: 'Failed to track FedEx shipment' });
    }
});

async function scrapeUPSTracking(trackingNumber) {
    const browser = await puppeteer.launch({ 
        headless: false, // Changed to false to match debug script
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
            '--disable-images',
            '--disable-javascript',
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
        // Set viewport and user agent
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

        // Set additional headers to look more like a real browser
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
        
        // Handle cookie consent if it appears
        page.on('dialog', async dialog => {
            console.log('Dialog appeared:', dialog.message());
            await dialog.accept();
        });
        
        // Go to UPS tracking page (using same approach as debug script)
        console.log('🌐 Navigating to UPS tracking page...');
        const url = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
        console.log('URL:', url);
        
        // Add a random delay to simulate human behavior
        await page.waitForTimeout(Math.random() * 2000 + 1000);
        
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        console.log('Page loaded, waiting for content to appear...');
        
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
            return {
                error: 'Page took too long to load. Please try again.',
                trackingNumber,
                timestamp: new Date().toISOString()
            };
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

        // Extract tracking information from UPS milestone progress bar
        const trackingData = await page.evaluate(() => {
            console.log('🔍 Starting tracking data extraction...');
            
            // First, check if the package is delivered by looking for the delivered checkmark at the top
            const deliveredCheckmark = document.querySelector('#st_App_DelvdLabel i.ups-icon-checkcircle-solid, .ups-icon-checkcircle-solid, [id*="DelvdLabel"] i');
            const hasDeliveredCheckmark = deliveredCheckmark !== null;
            
            // Also check for "Delivered On" text at the top
            const hasDeliveredOnText = document.body.innerText.includes('Delivered On');
            
            console.log('Delivered checkmark found:', hasDeliveredCheckmark);
            console.log('Delivered On text found:', hasDeliveredOnText);
            
            // First, try to find the milestone progress bar
            const milestoneBar = document.querySelector('milestone-progress-bar#stApp_shpmtProgress');
            console.log('Milestone bar found:', !!milestoneBar);
            
            if (!milestoneBar) {
                console.log('❌ Milestone progress bar not found');
                
                // Try alternative selectors
                const alternativeSelectors = [
                    'milestone-progress-bar',
                    '#stApp_shpmtProgress',
                    '[id*="progress"]',
                    '[class*="progress"]'
                ];
                
                for (const selector of alternativeSelectors) {
                    const element = document.querySelector(selector);
                    console.log(`Trying selector "${selector}":`, !!element);
                    if (element) {
                        console.log('Found element with selector:', selector);
                        break;
                    }
                }
                
                return { error: 'Could not find tracking information on page' };
            }

            // Find the table body with progress rows
            const tbody = milestoneBar.querySelector('tbody');
            if (!tbody) {
                console.log('Progress table body not found');
                return { error: 'Could not find progress table' };
            }

            // Get all progress rows
            const progressRows = tbody.querySelectorAll('tr[id^="stApp_ShpmtProg_LVP_progress_row_"]');
            console.log('Found progress rows:', progressRows.length);

            if (progressRows.length === 0) {
                console.log('No progress rows found');
                return { error: 'No tracking progress found' };
            }

            // Extract information from each progress row
            const progressSteps = [];
            let currentStatus = 'Status not found';
            let lastCompletedStep = null;
            let deliveredStepFound = false;

            progressRows.forEach((row, index) => {
                try {
                    // Get the text content of the row
                    const rowText = row.innerText.trim();
                    console.log(`Row ${index} text:`, rowText);

                    if (rowText) {
                        // Check if this row has a checkmark (completed step)
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
                        if ((hasDeliveredCheckmark || hasDeliveredOnText) && isDeliveredStep && index === progressRows.length - 1) {
                            forceCompleted = true;
                            console.log('Forcing delivered step to be completed');
                        }

                        const step = {
                            stepNumber: index + 1,
                            text: rowText,
                            completed: hasCheckmark || forceCompleted,
                            isDelivered: isDeliveredStep,
                            forceCompleted: forceCompleted,
                            timestamp: new Date().toISOString()
                        };

                        progressSteps.push(step);

                        // Update current status to the last completed step
                        if (hasCheckmark || forceCompleted) {
                            lastCompletedStep = rowText;
                            if (isDeliveredStep) {
                                deliveredStepFound = true;
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Error processing row ${index}:`, error);
                }
            });

            // Determine the current status
            if (hasDeliveredCheckmark || hasDeliveredOnText || deliveredStepFound) {
                // Package is delivered - look for the delivered step in progress
                const deliveredStep = progressSteps.find(step => step.isDelivered);
                if (deliveredStep) {
                    currentStatus = deliveredStep.text;
                } else {
                    currentStatus = 'Delivered';
                }
            } else if (lastCompletedStep) {
                currentStatus = lastCompletedStep;
            } else if (progressSteps.length > 0) {
                // If no completed steps, use the first step as current status
                currentStatus = progressSteps[0].text;
            }

            // Also try to get the main delivery status from the page
            const deliveryStatusSelectors = [
                '.ups-tracking-summary-status',
                '.ups-tracking-status',
                '[data-testid="tracking-status"]',
                '.status-text',
                '.tracking-status'
            ];

            let deliveryStatus = currentStatus;
            for (const selector of deliveryStatusSelectors) {
                const element = document.querySelector(selector);
                if (element && element.innerText.trim()) {
                    deliveryStatus = element.innerText.trim();
                    break;
                }
            }

            // If we found delivered indicators but status doesn't reflect it, override
            if ((hasDeliveredCheckmark || hasDeliveredOnText || deliveredStepFound) && 
                !deliveryStatus.toLowerCase().includes('delivered')) {
                deliveryStatus = 'Delivered';
                currentStatus = 'Delivered';
            }

            // Get tracking number from URL or page
            const trackingNumber = window.location.search.match(/tracknum=([^&]+)/)?.[1] || '';

            return {
                status: deliveryStatus,
                currentStep: currentStatus,
                progressSteps: progressSteps,
                trackingNumber: trackingNumber,
                timestamp: new Date().toISOString(),
                pageTitle: document.title,
                totalSteps: progressSteps.length,
                isDelivered: hasDeliveredCheckmark || hasDeliveredOnText || deliveredStepFound
            };
        });

        // If still no status found, try a different approach
        if (trackingData.status === 'Status not found') {
            const pageContent = await page.content();
            console.log('Page content preview:', pageContent.substring(0, 1000));
            
            // Try to find any text that looks like a status
            const statusMatch = pageContent.match(/(delivered|in transit|out for delivery|pending|shipped|processing)/i);
            if (statusMatch) {
                trackingData.status = statusMatch[0];
            }
        }

        return trackingData;
    } catch (error) {
        console.error('Scraping error:', error);
        
        // Log more details about the error
        if (error.message.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
            console.log('HTTP2 protocol error detected. This is a known issue with some websites.');
        }
        
        // Try alternative approach - use UPS API if available
        try {
            console.log('Attempting API fallback...');
            const apiResponse = await page.evaluate(async (trackNum) => {
                try {
                    const response = await fetch(`https://www.ups.com/track/api/Track/GetStatus?loc=en_US`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ InquiryNumber: trackNum })
                    });
                    return await response.json();
                } catch (fetchError) {
                    console.log('Fetch error in API fallback:', fetchError);
                    return null;
                }
            }, trackingNumber);
            
            if (apiResponse && apiResponse.trackDetails) {
                console.log('API fallback successful');
                return {
                    status: apiResponse.trackDetails[0]?.shipmentProgressActivities?.[0]?.activityScan || 'Status found via API',
                    details: apiResponse.trackDetails[0]?.shipmentProgressActivities?.map(activity => activity.activityScan) || [],
                    trackingNumber,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (apiError) {
            console.error('API fallback error:', apiError);
        }
        
        return {
            error: 'Could not retrieve tracking information. Please check the tracking number and try again.',
            trackingNumber,
            timestamp: new Date().toISOString(),
            debugInfo: {
                errorType: error.name,
                errorMessage: error.message,
                errorStack: error.stack.substring(0, 500)
            }
        };
    } finally {
        // Add a small delay so you can see the browser window
        await page.waitForTimeout(2000);
        await browser.close();
    }
}

async function scrapeFedExTracking(trackingNumber) {
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
            '--disable-images',
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
        await page.setViewport({ width: 1920, height: 1080 });
        await page.evaluateOnNewDocument(() => {
            delete navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        // Add realistic headers to lower WAF risk
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Referer': 'https://www.fedex.com/'
        });

        const url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}&cntry_code=us&locale=en_US`;
        await page.waitForTimeout(Math.random() * 2000 + 1000);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // If system error page is shown, fall back to homepage + form submit
        if (page.url().includes('fedextrack/system-error')) {
            try {
                await page.waitForTimeout(1000 + Math.random() * 1000);
                await page.goto('https://www.fedex.com/fedextrack/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(1500);
                await page.evaluate((tn) => {
                    const inputs = [
                        'input[name="trackingnumber"]',
                        'input[name*="track"]',
                        '#trackingInput',
                        'input[type="search"]',
                        'form input'
                    ];
                    let input = null;
                    for (const sel of inputs) {
                        const el = document.querySelector(sel);
                        if (el) { input = el; break; }
                    }
                    if (input) {
                        input.focus();
                        input.value = tn;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        const form = input.closest('form');
                        if (form) {
                            form.requestSubmit ? form.requestSubmit() : form.submit();
                        } else {
                            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                        }
                    }
                }, trackingNumber);
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
            } catch (_) {}
        }

        // Ensure the main content container is visible before proceeding
        try {
            await page.waitForSelector('#content', { visible: true, timeout: 30000 });
        } catch (_) {}

        // Wait for progress container to show up
        try {
            await page.waitForFunction(() => {
                const container = document.querySelector('.shipment-status-progress-container');
                return container && container.querySelectorAll('.shipment-status-progress-step').length > 0;
            }, { timeout: 15000 });
        } catch (_) {}

        await page.waitForTimeout(1500);

        // Guarded evaluate to avoid "Requesting main frame too early"; retry a couple of times
        async function extractWithRetry() {
            let lastError = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    return await page.evaluate(() => {
                        const stepsNodes = Array.from(document.querySelectorAll('.shipment-status-progress-container .shipment-status-progress-step'));
                        const progressSteps = stepsNodes.map((el, idx) => {
                            const text = el.innerText.trim() || `Step ${idx + 1}`;
                            const classes = el.className || '';
                            const isComplete = classes.includes('complete');
                            const isActive = classes.includes('active');
                            return {
                                stepNumber: idx + 1,
                                text,
                                completed: isComplete,
                                active: isActive,
                                timestamp: new Date().toISOString()
                            };
                        });

                        // Determine status
                        const activeStep = progressSteps.find(s => s.active);
                        const lastCompleted = [...progressSteps].reverse().find(s => s.completed);
                        let currentStatus = activeStep?.text || lastCompleted?.text || (progressSteps[0]?.text || 'Unknown');

                        // Delivered detection
                        const delivered = progressSteps.some(s => /delivered/i.test(s.text)) || document.body.innerText.toLowerCase().includes('delivered');
                        const allCompleted = progressSteps.length > 0 && progressSteps.every(s => s.completed === true);
                        if ((delivered || allCompleted) && !/delivered/i.test(currentStatus)) {
                            currentStatus = 'Delivered';
                        }

                        // Status label on page if present
                        const statusEl = document.querySelector('[data-automation*="status"], .status, .scan-status, [class*="status"]');
                        let pageStatus = statusEl && statusEl.textContent && statusEl.textContent.trim().length > 0 ? statusEl.textContent.trim() : currentStatus;
                        if (allCompleted && !/delivered/i.test(pageStatus)) {
                            pageStatus = 'Delivered';
                        }

                        return {
                            status: pageStatus,
                            currentStep: currentStatus,
                            progressSteps,
                            trackingNumber: (new URLSearchParams(location.search).get('trknbr') || ''),
                            timestamp: new Date().toISOString(),
                            carrier: 'fedex',
                            isDelivered: /delivered/i.test(pageStatus) || delivered || allCompleted
                        };
                    });
                } catch (err) {
                    lastError = err;
                    const msg = String(err && err.message || '');
                    if (msg.includes('Requesting main frame too early')) {
                        await page.waitForTimeout(1000);
                        continue;
                    }
                    throw err;
                }
            }
            throw lastError;
        }

        const trackingData = await extractWithRetry();

        // Ensure tracking number set
        if (!trackingData.trackingNumber) {
            trackingData.trackingNumber = String(trackingNumber);
        }

        return trackingData;
    } catch (error) {
        console.error('FedEx scraping error:', error);
        return {
            error: 'Could not retrieve FedEx tracking information',
            trackingNumber,
            timestamp: new Date().toISOString()
        };
    } finally {
        await page.waitForTimeout(1000);
        await browser.close();
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Open your browser and go to the URL above to use the tracking application');
}); 