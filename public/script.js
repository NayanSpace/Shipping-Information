document.addEventListener('DOMContentLoaded', function () {
    const trackingForm = document.getElementById('trackingForm');
    const trackButton = document.getElementById('trackButton');
    const resultsDiv = document.getElementById('results');
    const trackingInfoDiv = document.getElementById('trackingInfo');
    const shipmentListDiv = document.getElementById('shipmentList');
    const tabsContainer = document.getElementById('carrierTabs');
    let activeCarrierTab = 'all';

    // Load saved shipments from localStorage
    let savedShipments = JSON.parse(localStorage.getItem('shipments') || '[]');
    displayShipmentHistory();

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
            const response = await fetch('/api/track-ups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber, carrier })
            });

            const data = await response.json();

            if (data.error) {
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
        const shipment = {
            trackingNumber,
            status: data.status || data.currentStep || 'Unknown',
            timestamp: data.timestamp || Date.now(),
            details: data.details || data.progressSteps || [],
            carrier: (carrier || data.carrier || 'unknown').toLowerCase(),
            label: label || data.label || ''
        };

        // Dedupe by trackingNumber + carrier
        savedShipments = savedShipments.filter(s => !(s.trackingNumber === shipment.trackingNumber && (s.carrier || '') === shipment.carrier));
        savedShipments.unshift(shipment);

        // Keep last 20
        if (savedShipments.length > 20) savedShipments = savedShipments.slice(0, 20);

        localStorage.setItem('shipments', JSON.stringify(savedShipments));
        displayShipmentHistory();
    }

    function displayShipmentHistory() {
        const filtered = (activeCarrierTab && activeCarrierTab !== 'all')
            ? savedShipments.filter(s => (s.carrier || 'unknown') === activeCarrierTab)
            : savedShipments.slice();

        if (filtered.length === 0) {
            shipmentListDiv.innerHTML = '<p class="no-shipments">No shipments to show for this tab. Track something above!</p>';
            return;
        }

        const html = filtered.map(shipment => `
            <div class="shipment-item">
                <h4>
                    ${shipment.trackingNumber}
                    ${shipment.carrier ? `<span class="carrier-badge">${shipment.carrier.toUpperCase()}</span>` : ''}
                </h4>
                ${shipment.label ? `<div class="label-line">${shipment.label}</div>` : ''}
                <p><strong>Status:</strong> <span class="status-${getStatusClass(shipment.status)}">${shipment.status}</span></p>
                <p class="timestamp">Tracked: ${formatTimestamp(shipment.timestamp)}</p>
            </div>
        `).join('');

        shipmentListDiv.innerHTML = html;
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }
});
