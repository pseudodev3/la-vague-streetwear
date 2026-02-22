
/**
 * LA VAGUE - Order Confirmation Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    // Get order details from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    const paymentStatus = urlParams.get('status');
    
    // Display order number
    if (orderId) {
        const displayId = orderId.startsWith('LV-') ? orderId.replace('LV-', '') : orderId;
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
            confirmationMsg.innerHTML = 'Your payment was successful! We've sent a confirmation email with your order details.';
        }
    }
});
