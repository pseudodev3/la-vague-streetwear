
/**
 * LA VAGUE - Order Confirmation Logic
 */
function initOrderConfirmation() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    const paymentStatus = urlParams.get('status');
    
    const orderNumberEl = document.getElementById('orderNumber');
    if (orderNumberEl) {
        if (orderId) {
            // Show full ID from URL (e.g., LV-87DF27C1)
            orderNumberEl.textContent = orderId.toUpperCase();
        } else {
            // Fallback for missing ID
            orderNumberEl.textContent = 'LV-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        }
    }
    
    // Show payment success message if applicable
    if (paymentStatus === 'success') {
        const confirmationMsg = document.querySelector('.confirmation > p');
        if (confirmationMsg) {
            confirmationMsg.innerHTML = "Your payment was successful! We've sent a confirmation email with your order details.";
        }
    }
}

// Initialize on load and when components are ready
window.addEventListener('componentsLoaded', initOrderConfirmation);
window.addEventListener('load', initOrderConfirmation);
document.addEventListener('DOMContentLoaded', initOrderConfirmation);

// Run immediately if ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initOrderConfirmation();
}
