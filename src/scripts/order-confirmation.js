
/**
 * LA VAGUE - Order Confirmation Logic
 */
function initOrderConfirmation() {
    // Get order details from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    const paymentStatus = urlParams.get('status');
    
    // Display order number
    if (orderId) {
        // Robust case-insensitive removal of LV- prefix
        const displayId = orderId.replace(/^lv-/gi, '').toUpperCase();
        const orderNumberEl = document.getElementById('orderNumber');
        if (orderNumberEl) orderNumberEl.textContent = displayId;
    } else {
        const orderNumberEl = document.getElementById('orderNumber');
        if (orderNumberEl) orderNumberEl.textContent = Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    
    // Show payment success message if applicable
    if (paymentStatus === 'success') {
        const confirmationMsg = document.querySelector('.confirmation > p');
        if (confirmationMsg) {
            confirmationMsg.innerHTML = "Your payment was successful! We've sent a confirmation email with your order details.";
        }
    }
}

// Wait for components to be loaded before initializing
window.addEventListener('componentsLoaded', initOrderConfirmation);

// Fallback if event already fired or components.js not used
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (document.getElementById('orderNumber')) initOrderConfirmation();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('orderNumber')) initOrderConfirmation();
    });
}
