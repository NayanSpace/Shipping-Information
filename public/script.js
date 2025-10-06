document.addEventListener('DOMContentLoaded', function () {
    const trackingForm = document.getElementById('trackingForm');
    const trackButton = document.getElementById('trackButton');
    const resultsDiv = document.getElementById('results');
    const trackingInfoDiv = document.getElementById('trackingInfo');
    const shipmentListDiv = document.getElementById('shipmentList');
    const tabsContainer = document.getElementById('carrierTabs');
    let activeCarrierTab = 'all';

    // Load saved shipments from localStorage (safe parse) and dedupe
    let savedShipments = [];
    try {
        const raw = localStorage.getItem('shipments');
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        // Dedupe by trackingNumber + carrier, keep latest by timestamp
        const keyToShipment = new Map();
        for (const item of list) {
            if (!item || !item.trackingNumber) continue;
            const normalizedCarrier = (item.carrier || 'unknown').toLowerCase();
            const normalizedTracking = String(item.trackingNumber).trim();
            const key = normalizedTracking + '::' + normalizedCarrier;
            const prev = keyToShipment.get(key);
            if (!prev || (new Date(item.timestamp).getTime() > new Date(prev.timestamp).getTime())) {
                keyToShipment.set(key, {
                    ...item,
                    trackingNumber: normalizedTracking,
                    carrier: normalizedCarrier,
                });
            }
        }
        savedShipments = Array.from(keyToShipment.values());
        localStorage.setItem('shipments', JSON.stringify(savedShipments));
    } catch (_) {
        savedShipments = [];
    }

    // ----- Filters -----
    const filterStatusEl = document.getElementById('filterStatus');
    const filterCarrierEl = document.getElementById('filterCarrier');
    const filterFromEl = document.getElementById('filterFrom');
    const filterToEl = document.getElementById('filterTo');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const refreshUndeliveredBtn = document.getElementById('refreshUndeliveredBtn');

    function getActiveFilter() {
        return {
            status: (filterStatusEl && filterStatusEl.value) ? filterStatusEl.value : 'all',
            carrier: (filterCarrierEl && filterCarrierEl.value) ? filterCarrierEl.value : 'all',
            from: (filterFromEl && filterFromEl.value) ? filterFromEl.value : '',
            to: (filterToEl && filterToEl.value) ? filterToEl.value : ''
        };
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => displayShipmentHistory());
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterStatusEl) filterStatusEl.value = 'all';
            if (filterCarrierEl) filterCarrierEl.value = 'all';
            if (filterFromEl) filterFromEl.value = '';
            if (filterToEl) filterToEl.value = '';
            displayShipmentHistory();
        });
    }

    async function refreshUndeliveredShipments() {
        const undelivered = savedShipments.filter(s => !isDeliveredStatus(s.status));
        if (undelivered.length === 0) return;

        // Optional: basic UX lock to avoid double-clicks
        const btn = refreshUndeliveredBtn;
        if (btn) {
            btn.disabled = true;
            const old = btn.textContent;
            btn.textContent = 'Refreshing...';
            try {
                for (const s of undelivered) {
                    const data = await tryTrackEndpoints(s.trackingNumber, s.carrier || 'ups');
                    if (data && !data.error) {
                        // Merge and save
                        saveShipment(s.trackingNumber, data, s.carrier, s.label || '');
                    }
                }
            } finally {
                btn.disabled = false;
                btn.textContent = 'Refresh Undelivered';
            }
        } else {
            for (const s of undelivered) {
                const data = await tryTrackEndpoints(s.trackingNumber, s.carrier || 'ups');
                if (data && !data.error) {
                    saveShipment(s.trackingNumber, data, s.carrier, s.label || '');
                }
            }
        }
        displayShipmentHistory();
    }

    if (refreshUndeliveredBtn) {
        refreshUndeliveredBtn.addEventListener('click', () => {
            refreshUndeliveredShipments();
        });
    }

    // Tab switching
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab');
            if (!btn) return;
            tabsContainer.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCarrierTab = btn.getAttribute('data-carrier') || 'all';
            displayShipmentHistory();
        });
    }

    
async function tryTrackEndpoints(trackingNumber, carrier) {
    const payload = { trackingNumber, carrier };
    const candidates = [
        { url: '/api/track-ups', method: 'POST', body: JSON.stringify(payload) },
        { url: '/track-ups', method: 'POST', body: JSON.stringify(payload) },
        { url: '/api/track', method: 'POST', body: JSON.stringify(payload) },
        { url: '/track', method: 'POST', body: JSON.stringify(payload) },
        { url: `/api/track-ups?trackingNumber=${encodeURIComponent(trackingNumber)}`, method: 'GET' },
        { url: `/track-ups?trackingNumber=${encodeURIComponent(trackingNumber)}`, method: 'GET' },
        { url: `/api/track?trackingNumber=${encodeURIComponent(trackingNumber)}`, method: 'GET' },
        { url: `/track?trackingNumber=${encodeURIComponent(trackingNumber)}`, method: 'GET' },
    ];

    for (const c of candidates) {
        try {
            const res = await fetch(c.url, {
                method: c.method,
                headers: c.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
                body: c.method === 'POST' ? c.body : undefined,
            });
            if (!res.ok) continue;
            const data = await res.json().catch(() => null);
            if (data && !data.error) return data;
        } catch (err) {
            // try next
        }
    }
    return { error: 'Unable to reach tracking endpoint. Please verify server routes.' };
}

trackingForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const trackingNumber = document.getElementById('trackingNumber').value.trim();
        const customerLabel = (document.getElementById('customerLabel')?.value || '').trim();
        const carrier = document.getElementById('carrier').value;

        if (!trackingNumber) {
            showError('Please enter a tracking number');
            return;
        }

        // Show loading state
        setLoadingState(true);
        resultsDiv.style.display = 'none';

        try {
            // for now we only call UPS endpoint (your server routes it)
            const data = await tryTrackEndpoints(trackingNumber, carrier);

            if (data && data.error) {
                showError(data.error);
            } else {
                // augment data with label and carrier for immediate display
                data.label = customerLabel;
                data.carrier = carrier;
                displayTrackingResults(data);
                saveShipment(trackingNumber, data, carrier, customerLabel);
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to track shipment. Please try again.');
        } finally {
            setLoadingState(false);
        }
    });

    function setLoadingState(loading) {
        const buttonText = trackButton.querySelector('.button-text');
        const spinner = trackButton.querySelector('.loading-spinner');
        if (loading) {
            buttonText.style.display = 'none';
            spinner.style.display = 'inline';
            trackButton.disabled = true;
        } else {
            buttonText.style.display = 'inline';
            spinner.style.display = 'none';
            trackButton.disabled = false;
        }
    }

    function displayTrackingResults(data) {
        resultsDiv.style.display = 'block';

        const statusText = data.currentStep || data.status || 'Unknown';
        const when = data.timestamp ? formatTimestamp(data.timestamp) : 'N/A';
        const steps = data.progressSteps || data.details || [];

        let html = `
            <div class="tracking-info">
                <h4>Tracking Number: ${data.trackingNumber || 'N/A'}</h4>
                ${data.label ? `<div class="tracking-label">${data.label}</div>` : ''}
                <p><strong>Current Status:</strong> <span class="status-${getStatusClass(statusText)}">${statusText}</span></p>
                <p><strong>Last Updated:</strong> ${when}</p>
        `;

        if (Array.isArray(steps) && steps.length) {
            html += `
                <div class="tracking-details">
                    <h5>Shipment Progress (${steps.length} step${steps.length===1?'':'s'}):</h5>
                    <div class="progress-timeline">
                        ${steps.map((step) => {
                            const text = step.activityScan || step.status || step.text || '';
                            const ts = step.dateTime || step.timestamp || '';
                            const nice = ts ? formatTimestamp(ts) : '';
                            const lower = (text || '').toLowerCase();
const completed = step.completed === true || lower.startsWith('past event') || lower.includes('delivered');
                            return `
                                <div class="progress-step ${completed ? 'completed' : 'pending'}">
                                    <div class="what"><strong>${text}</strong></div>
                                    <div class="when">${nice}</div>\n                                        <div class="status-line">${completed ? "✅ Completed" : "🟡 Pending"}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        trackingInfoDiv.innerHTML = html;
    }

    function isDeliveredStatus(status) {
        const s = (status || '').toLowerCase();
        return s.includes('delivered');
    }

    function getDaysUntilRemoval(shipment) {
        if (!isDeliveredStatus(shipment.status)) return null;
        
        const deliveredTime = new Date(shipment.timestamp);
        const now = new Date();
        const daysSinceDelivered = Math.floor((now - deliveredTime) / (1000 * 60 * 60 * 24));
        const daysUntilRemoval = 5 - daysSinceDelivered;
        
        return Math.max(0, daysUntilRemoval);
    }

    function shouldAutoRemove(shipment) {
        if (!isDeliveredStatus(shipment.status)) return false;
        
        const deliveredTime = new Date(shipment.timestamp);
        const now = new Date();
        const daysSinceDelivered = Math.floor((now - deliveredTime) / (1000 * 60 * 60 * 24));
        
        return daysSinceDelivered >= 5;
    }

    function removeShipmentFromHistory(trackingNumber, carrier) {
        const normalizedTracking = String(trackingNumber).trim();
        const normalizedCarrier = (carrier || 'unknown').toLowerCase();
        
        savedShipments = savedShipments.filter(s => 
            !(String(s.trackingNumber).trim() === normalizedTracking && (s.carrier || 'unknown') === normalizedCarrier)
        );
        
        localStorage.setItem('shipments', JSON.stringify(savedShipments));
        displayShipmentHistory();
    }

    // Make the function globally accessible for onclick handlers
    window.removeShipmentFromHistory = removeShipmentFromHistory;

    function getStatusClass(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('delivered')) return 'delivered';
        if (s.includes('transit') || s.includes('shipped') || s.includes('departed') || s.includes('arrived')) return 'in-transit';
        if (s.includes('pending') || s.includes('processing') || s.includes('label')) return 'pending';
        return 'error';
    }

    function showError(message) {
        resultsDiv.style.display = 'block';
        trackingInfoDiv.innerHTML = `
            <div class="error-message">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }

    function saveShipment(trackingNumber, data, carrier, label) {
        const normalizedTracking = String(trackingNumber || data.trackingNumber || '').trim();
        const normalizedCarrier = (carrier || data.carrier || 'unknown').toLowerCase();
        const shipment = {
            trackingNumber: normalizedTracking,
            status: data.status || data.currentStep || 'Unknown',
            timestamp: data.timestamp || Date.now(),
            details: data.details || data.progressSteps || [],
            carrier: normalizedCarrier,
            label: label || data.label || ''
        };

        // Dedupe by trackingNumber + carrier
        savedShipments = savedShipments.filter(s => !(String(s.trackingNumber).trim() === shipment.trackingNumber && (s.carrier || 'unknown') === shipment.carrier));
        savedShipments.unshift(shipment);

        // Keep last 20
        if (savedShipments.length > 20) savedShipments = savedShipments.slice(0, 20);

        localStorage.setItem('shipments', JSON.stringify(savedShipments));
        displayShipmentHistory();
    }

    function displayShipmentHistory() {
        // First, remove any delivered packages that are older than 5 days
        const beforeFilter = savedShipments.length;
        savedShipments = savedShipments.filter(shipment => !shouldAutoRemove(shipment));
        const afterFilter = savedShipments.length;
        
        if (beforeFilter !== afterFilter) {
            localStorage.setItem('shipments', JSON.stringify(savedShipments));
            console.log(`Auto-removed ${beforeFilter - afterFilter} delivered packages older than 5 days`);
        }

        const f = (typeof getActiveFilter === 'function') ? getActiveFilter() : { status: 'all', carrier: 'all', from: '', to: '' };
        let filtered = (activeCarrierTab && activeCarrierTab !== 'all')
            ? savedShipments.filter(s => (s.carrier || 'unknown') === activeCarrierTab)
            : savedShipments.slice();

        // Carrier filter
        if (f.carrier && f.carrier !== 'all') {
            filtered = filtered.filter(s => (s.carrier || 'unknown') === f.carrier);
        }

        // Status filter
        if (f.status === 'delivered') {
            filtered = filtered.filter(s => isDeliveredStatus(s.status));
        } else if (f.status === 'not-delivered') {
            filtered = filtered.filter(s => !isDeliveredStatus(s.status));
        }

        // Date range
        const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : null;
        const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : null;
        if (from || to) {
            filtered = filtered.filter(s => {
                const t = new Date(s.timestamp).getTime();
                if (Number.isNaN(t)) return false;
                if (from && t < from) return false;
                if (to && t > to) return false;
                return true;
            });
        }

        if (filtered.length === 0) {
            shipmentListDiv.innerHTML = '<p class="no-shipments">No shipments to show for this tab. Track something above!</p>';
            return;
        }

        const html = filtered.map(shipment => {
            const daysUntilRemoval = getDaysUntilRemoval(shipment);
            const removalInfo = daysUntilRemoval !== null ? 
                `<div class="removal-info">
                    <span class="removal-countdown">${daysUntilRemoval} day${daysUntilRemoval === 1 ? '' : 's'} left before removal</span>
                </div>` : '';
            
            return `
                <div class="shipment-item">
                    <div class="shipment-header">
                        <h4>
                            ${shipment.trackingNumber}
                            ${shipment.carrier ? `<span class="carrier-badge">${shipment.carrier.toUpperCase()}</span>` : ''}
                        </h4>
                        <button class="remove-btn" onclick="removeShipmentFromHistory('${shipment.trackingNumber}', '${shipment.carrier || 'unknown'}')" title="Remove from history">
                            🗑️
                        </button>
                    </div>
                    ${shipment.label ? `<div class="label-line">${shipment.label}</div>` : ''}
                    <p><strong>Status:</strong> <span class="status-${getStatusClass(shipment.status)}">${shipment.status}</span></p>
                    <p class="timestamp">Tracked: ${formatTimestamp(shipment.timestamp)}</p>
                    ${removalInfo}
                </div>
            `;
        }).join('');

        shipmentListDiv.innerHTML = html;
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }
    // Initial render after filters and handlers are ready
    displayShipmentHistory();
});