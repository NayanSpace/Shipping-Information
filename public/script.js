document.addEventListener('DOMContentLoaded', function() {
    const trackingForm = document.getElementById('trackingForm');
    const trackButton = document.getElementById('trackButton');
    const resultsDiv = document.getElementById('results');
    const trackingInfoDiv = document.getElementById('trackingInfo');
    const shipmentListDiv = document.getElementById('shipmentList');

    // Load saved shipments from localStorage
    let savedShipments = JSON.parse(localStorage.getItem('shipments') || '[]');
    displayShipmentHistory();

    trackingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const trackingNumber = document.getElementById('trackingNumber').value.trim();
        const carrier = document.getElementById('carrier').value;
        
        if (!trackingNumber) {
            showError('Please enter a tracking number');
            return;
        }

        // Show loading state
        setLoadingState(true);
        resultsDiv.style.display = 'none';

        try {
            const response = await fetch('/api/track-ups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ trackingNumber, carrier })
            });

            const data = await response.json();

            if (data.error) {
                showError(data.error);
            } else {
                displayTrackingResults(data);
                saveShipment(trackingNumber, data);
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
        
        let html = `
            <div class="tracking-info">
                <h4>Tracking Number: ${data.trackingNumber || 'N/A'}</h4>
                <p><strong>Current Status:</strong> <span class="status-${getStatusClass(data.currentStep || data.status)}">${data.currentStep || data.status}</span></p>
                <p><strong>Last Updated:</strong> ${formatTimestamp(data.timestamp)}</p>
        `;

        if (data.progressSteps && data.progressSteps.length > 0) {
            html += `
                <div class="tracking-details">
                    <h5>Shipment Progress (${data.totalSteps} steps):</h5>
                    <div class="progress-timeline">
                        ${data.progressSteps.map((step, index) => `
                            <div class="progress-step ${step.completed ? 'completed' : 'pending'}">
                                <div class="step-indicator">
                                    ${step.completed ? '✓' : (index + 1)}
                                </div>
                                <div class="step-content">
                                    <div class="step-text">${step.text}</div>
                                    ${step.completed ? '<div class="step-status">Completed</div>' : '<div class="step-status">Pending</div>'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (data.details && data.details.length > 0) {
            html += `
                <div class="tracking-details">
                    <h5>Shipment Details:</h5>
                    <ul>
                        ${data.details.map(detail => `<li>${detail}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += '</div>';
        trackingInfoDiv.innerHTML = html;
    }

    function getStatusClass(status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes('delivered')) return 'delivered';
        if (statusLower.includes('transit') || statusLower.includes('shipped')) return 'in-transit';
        if (statusLower.includes('pending') || statusLower.includes('processing')) return 'pending';
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

    function saveShipment(trackingNumber, data) {
        const shipment = {
            trackingNumber,
            status: data.status,
            timestamp: data.timestamp,
            details: data.details || []
        };

        // Add to beginning of array
        savedShipments.unshift(shipment);
        
        // Keep only last 10 shipments
        if (savedShipments.length > 10) {
            savedShipments = savedShipments.slice(0, 10);
        }

        // Save to localStorage
        localStorage.setItem('shipments', JSON.stringify(savedShipments));
        
        // Update display
        displayShipmentHistory();
    }

    function displayShipmentHistory() {
        if (savedShipments.length === 0) {
            shipmentListDiv.innerHTML = '<p class="no-shipments">No shipments tracked yet. Enter a tracking number above to get started!</p>';
            return;
        }

        const html = savedShipments.map(shipment => `
            <div class="shipment-item">
                <h4>${shipment.trackingNumber}</h4>
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