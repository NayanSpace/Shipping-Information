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
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
    });
    
    const page = await browser.newPage();
    
    try {
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Handle cookie consent if it appears
        page.on('dialog', async dialog => {
            console.log('Dialog appeared:', dialog.message());
            await dialog.accept();
        });
        
        // Go to UPS tracking page (using same approach as debug script)
        console.log('🌐 Navigating to UPS tracking page...');
        const url = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
        console.log('URL:', url);
        
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
                                           row.innerHTML.includes('✓');

                        const step = {
                            stepNumber: index + 1,
                            text: rowText,
                            completed: hasCheckmark,
                            timestamp: new Date().toISOString()
                        };

                        progressSteps.push(step);

                        // Update current status to the last completed step
                        if (hasCheckmark) {
                            lastCompletedStep = rowText;
                        }
                    }
                } catch (error) {
                    console.log(`Error processing row ${index}:`, error);
                }
            });

            // Set current status to the last completed step
            if (lastCompletedStep) {
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

            // Get tracking number from URL or page
            const trackingNumber = window.location.search.match(/tracknum=([^&]+)/)?.[1] || '';

            return {
                status: deliveryStatus,
                currentStep: currentStatus,
                progressSteps: progressSteps,
                trackingNumber: trackingNumber,
                timestamp: new Date().toISOString(),
                pageTitle: document.title,
                totalSteps: progressSteps.length
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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Open your browser and go to the URL above to use the tracking application');
}); 