/**
 * LA VAGUE - Checkout Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // STATE
    // ==========================================
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        shipping: 10,
        discount: 0,
        discountCode: null
    };

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
        nav: document.getElementById('nav'),
        summaryItems: document.getElementById('summaryItems'),
        summarySubtotal: document.getElementById('summarySubtotal'),
        summaryShipping: document.getElementById('summaryShipping'),
        summaryDiscount: document.getElementById('summaryDiscount'),
        summaryTotal: document.getElementById('summaryTotal'),
        discountLine: document.getElementById('discountLine'),
        discountCode: document.getElementById('discountCode'),
        applyDiscount: document.getElementById('applyDiscount'),
        shippingOptions: document.querySelectorAll('input[name="shipping"]'),
        placeOrderBtn: document.getElementById('placeOrderBtn'),
        cardNumber: document.getElementById('cardNumber'),
        expiry: document.getElementById('expiry'),
        toastContainer: document.getElementById('toastContainer')
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        if (state.cart.length === 0) {
            window.location.href = 'shop.html';
            return;
        }
        
        renderOrderSummary();
        updateTotals();
        bindEvents();
        
        // Nav scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                elements.nav?.classList.add('scrolled');
            } else {
                elements.nav?.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // ==========================================
    // ORDER SUMMARY
    // ==========================================
    function renderOrderSummary() {
        elements.summaryItems.innerHTML = state.cart.map(item => `
            <div class="summary-item">
                <div class="summary-item-image">
                    <img src="${item.image}" alt="${item.name}">
                    <span class="summary-item-qty">${item.quantity}</span>
                </div>
                <div class="summary-item-details">
                    <p class="summary-item-name">${item.name}</p>
                    <p class="summary-item-variant">${item.color} / ${item.size}</p>
                </div>
                <span class="summary-item-price">$${item.price * item.quantity}</span>
            </div>
        `).join('');
    }

    function updateTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal + state.shipping - state.discount;
        
        elements.summarySubtotal.textContent = `$${subtotal.toFixed(2)}`;
        elements.summaryShipping.textContent = `$${state.shipping.toFixed(2)}`;
        elements.summaryTotal.textContent = `$${total.toFixed(2)}`;
        
        if (state.discount > 0) {
            elements.summaryDiscount.textContent = `-$${state.discount.toFixed(2)}`;
            elements.discountLine.style.display = 'flex';
        } else {
            elements.discountLine.style.display = 'none';
        }
        
        // Free shipping threshold
        if (subtotal >= 150) {
            state.shipping = 0;
            elements.summaryShipping.textContent = 'FREE';
            document.getElementById('standardShipping').textContent = 'FREE';
        }
    }

    // ==========================================
    // DISCOUNT CODE
    // ==========================================
    function applyDiscountCode() {
        const code = elements.discountCode.value.trim().toUpperCase();
        
        if (!code) {
            showToast('Please enter a discount code', 'error');
            return;
        }
        
        // Mock discount codes
        const codes = {
            'WELCOME10': 10,
            'WAVE20': 20,
            'FREESHIP': 0 // Special handling for free shipping
        };
        
        if (codes[code] !== undefined) {
            if (code === 'FREESHIP') {
                state.shipping = 0;
                state.discount = 0;
                showToast('Free shipping applied!', 'success');
            } else {
                const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                state.discount = (subtotal * codes[code]) / 100;
                showToast(`${codes[code]}% discount applied!`, 'success');
            }
            
            state.discountCode = code;
            updateTotals();
            elements.discountCode.value = '';
        } else {
            showToast('Invalid discount code', 'error');
        }
    }

    // ==========================================
    // FORM HANDLING
    // ==========================================
    function formatCardNumber(value) {
        return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
    }

    function formatExpiry(value) {
        return value.replace(/\D/g, '').replace(/(\d{2})(\d{0,2})/, '$1 / $2').trim();
    }

    async function handlePlaceOrder(e) {
        e.preventDefault();
        
        // Basic validation
        const requiredFields = ['email', 'firstName', 'lastName', 'address', 'city', 'state', 'zip', 'phone'];
        let isValid = true;
        
        requiredFields.forEach(field => {
            const input = document.getElementById(field);
            if (!input || !input.value.trim()) {
                isValid = false;
                input?.classList.add('error');
            } else {
                input?.classList.remove('error');
            }
        });
        
        if (!isValid) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Get form data
        const orderData = {
            email: document.getElementById('email').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            address: document.getElementById('address').value,
            apartment: document.getElementById('apartment')?.value || '',
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value,
            phone: document.getElementById('phone').value,
            shippingMethod: document.querySelector('input[name="shipping"]:checked')?.value || 'standard',
            shippingCost: state.shipping,
            subtotal: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            discount: state.discount,
            total: parseFloat(document.getElementById('summaryTotal').textContent.replace('$', '')) || 0,
            items: state.cart,
            paystackReference: 'manual-order-' + Date.now() // Placeholder until payment integration
        };
        
        // Show loading
        elements.placeOrderBtn.textContent = 'Processing...';
        elements.placeOrderBtn.disabled = true;
        
        try {
            // Try to send to backend API
            const API_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://la-vague-api.onrender.com/api';
            
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Also save to localStorage for the admin panel to read
                const orders = JSON.parse(localStorage.getItem('orders') || '[]');
                orders.unshift({
                    ...orderData,
                    id: result.orderId,
                    date: new Date().toISOString(),
                    status: 'pending'
                });
                localStorage.setItem('orders', JSON.stringify(orders));
                
                // Clear cart
                localStorage.removeItem('cart');
                
                // Show success and redirect
                showToast('Order placed successfully!', 'success');
                
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?order=${result.orderId}`;
                }, 1500);
            } else {
                throw new Error(result.error || 'Order failed');
            }
        } catch (error) {
            console.error('Order error:', error);
            
            // Fallback: Save order locally even if API fails
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const fallbackOrder = {
                ...orderData,
                id: 'LV-' + Date.now().toString(36).toUpperCase(),
                date: new Date().toISOString(),
                status: 'pending'
            };
            orders.unshift(fallbackOrder);
            localStorage.setItem('orders', JSON.stringify(orders));
            
            // Clear cart
            localStorage.removeItem('cart');
            
            showToast('Order saved locally (API unavailable)', 'success');
            
            setTimeout(() => {
                window.location.href = `order-confirmation.html?order=${fallbackOrder.id}`;
            }, 1500);
        }
    }

    // ==========================================
    // TOAST
    // ==========================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-message">${message}</span>`;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toast-in 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==========================================
    // EVENTS
    // ==========================================
    function bindEvents() {
        // Shipping option change
        elements.shippingOptions.forEach(option => {
            option.addEventListener('change', (e) => {
                state.shipping = e.target.value === 'express' ? 25 : (state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) >= 150 ? 0 : 10);
                updateTotals();
            });
        });
        
        // Discount code
        elements.applyDiscount?.addEventListener('click', applyDiscountCode);
        elements.discountCode?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyDiscountCode();
        });
        
        // Card formatting
        elements.cardNumber?.addEventListener('input', (e) => {
            e.target.value = formatCardNumber(e.target.value);
        });
        
        elements.expiry?.addEventListener('input', (e) => {
            e.target.value = formatExpiry(e.target.value);
        });
        
        // Place order
        elements.placeOrderBtn?.addEventListener('click', handlePlaceOrder);
    }

    // Start
    init();
});
