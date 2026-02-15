/**
 * LA VAGUE - Checkout Page JavaScript
 */

console.log('=== CHECKOUT.JS LOADED ===');

// API Configuration
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== CHECKOUT DOM LOADED ===');
    // ==========================================
    // STATE
    // ==========================================
    const state = {
        cart: JSON.parse(localStorage.getItem('cart')) || [],
        shipping: 10,
        discount: 0,
        discountCode: null,
        settings: {
            shippingRate: 10,
            expressShippingRate: 25,
            freeShippingThreshold: 150
        }
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
        toastContainer: document.getElementById('toastContainer'),
        standardShippingPrice: document.getElementById('standardShipping'),
        expressShippingPrice: document.getElementById('expressShipping')
    };

    // ==========================================
    // RENDER FUNCTION
    // ==========================================
    function render() {
        // Render order summary items
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
                <span class="summary-item-price">${CurrencyConfig.formatPrice(item.price * item.quantity)}</span>
            </div>
        `).join('');

        // Render totals
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal + state.shipping - state.discount;
        
        elements.summarySubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
        elements.summaryShipping.textContent = state.shipping === 0 ? 'FREE' : CurrencyConfig.formatPrice(state.shipping);
        elements.summaryTotal.textContent = CurrencyConfig.formatPrice(total);

        // Render discount
        if (state.discount > 0) {
            elements.summaryDiscount.textContent = `-${CurrencyConfig.formatPrice(state.discount)}`;
            elements.discountLine.style.display = 'flex';
        } else {
            elements.discountLine.style.display = 'none';
        }

        // Render shipping options
        const isStandardSelected = document.querySelector('input[name="shipping"]:checked').value === 'standard';
        if (subtotal >= state.settings.freeShippingThreshold && isStandardSelected) {
            elements.standardShippingPrice.textContent = 'FREE';
        } else {
            elements.standardShippingPrice.textContent = `₦${state.settings.shippingRate.toLocaleString()}.00`;
        }
        elements.expressShippingPrice.textContent = `₦${state.settings.expressShippingRate.toLocaleString()}.00`;
    }

    // ==========================================
    // LOGIC FUNCTIONS
    // ==========================================
    function updateShippingState() {
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const selectedShipping = document.querySelector('input[name="shipping"]:checked').value;

        if (selectedShipping === 'express') {
            state.shipping = state.settings.expressShippingRate;
        } else { // standard shipping
            if (subtotal >= state.settings.freeShippingThreshold) {
                state.shipping = 0;
            } else {
                state.shipping = state.settings.shippingRate;
            }
        }
    }

    async function loadSettings() {
        try {
            const response = await fetch(`${API_URL}/config/settings`);
            const data = await response.json();
            
            if (data.success && data.settings) {
                state.settings.shippingRate = data.settings.shippingRate || 10;
                state.settings.expressShippingRate = data.settings.expressShippingRate || 25;
                state.settings.freeShippingThreshold = data.settings.freeShippingThreshold || 150;
                console.log('[CHECKOUT] Settings loaded:', state.settings);
            }
        } catch (error) {
            console.error('[CHECKOUT] Failed to load settings:', error);
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        console.log('Cart items:', state.cart.length);
        if (state.cart.length === 0) {
            console.log('Cart is empty, redirecting to shop...');
            window.location.href = 'shop.html';
            return;
        }
        
        console.log('Initializing checkout...');
        await loadSettings();
        updateShippingState();
        render();
        bindEvents();
        console.log('Checkout initialized successfully');
        
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
    // EVENTS
    // ==========================================
    function bindEvents() {
        // Shipping option change
        elements.shippingOptions.forEach(option => {
            option.addEventListener('change', () => {
                updateShippingState();
                render();
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
        console.log('Place Order Button:', elements.placeOrderBtn ? 'FOUND' : 'NOT FOUND');
        if (elements.placeOrderBtn) {
            elements.placeOrderBtn.addEventListener('click', handlePlaceOrder);
            console.log('Event listener attached to place order button');
        } else {
            console.error('ERROR: Place Order button not found!');
        }
    }

    // ==========================================
    // OTHER FUNCTIONS (DISCOUNT, FORM HANDLING, ETC.)
    // ==========================================
    async function applyDiscountCode() {
        const code = elements.discountCode.value.trim().toUpperCase();
        
        if (!code) {
            showToast('Please enter a discount code', 'error');
            return;
        }
        
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = state.shipping;
        const cartTotal = subtotal + shipping;
        
        try {
            const csrfResponse = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
            const csrfData = await csrfResponse.json();
            
            const response = await fetch(`${API_URL}/coupons/validate`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfData.csrfToken },
                body: JSON.stringify({ code: code, cartTotal: cartTotal, items: state.cart })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.valid) {
                showToast(data.error || 'Invalid discount code', 'error');
                return;
            }
            
            if (data.coupon.type === 'free_shipping') {
                state.shipping = 0;
                state.discount = 0;
                showToast('Free shipping applied!', 'success');
            } else if (data.coupon.type === 'percentage') {
                state.discount = Math.round((subtotal * data.coupon.discount) / 100);
                showToast(`${data.coupon.discount}% discount applied!`, 'success');
            } else if (data.coupon.type === 'fixed') {
                state.discount = data.coupon.discount;
                showToast(`₦${data.coupon.discount.toLocaleString()} discount applied!`, 'success');
            }
            
            state.discountCode = code;
            render();
            elements.discountCode.value = '';
            
        } catch (error) {
            console.error('Coupon validation error:', error);
            showToast('Failed to validate coupon. Please try again.', 'error');
        }
    }

    function formatCardNumber(value) {
        return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
    }

    function formatExpiry(value) {
        return value.replace(/\D/g, '').replace(/(\d{2})(\d{0,2})/, '$1 / $2').trim();
    }

    async function handlePlaceOrder(e) {
        e.preventDefault();
        console.log('=== PLACE ORDER CLICKED ===');
        
        const requiredFields = ['email', 'firstName', 'lastName', 'address', 'city', 'state', 'zip', 'phone'];
        let isValid = true;
        const missingFields = [];
        
        requiredFields.forEach(field => {
            const input = document.getElementById(field);
            if (!input || !input.value.trim()) {
                isValid = false;
                missingFields.push(field);
                input?.classList.add('error');
            } else {
                input?.classList.remove('error');
            }
        });
        
        if (!isValid) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const selectedPayment = document.querySelector('input[name="payment"]:checked')?.value || 'manual';
        const orderData = {
            customerEmail: document.getElementById('email').value,
            customerName: `${firstName} ${lastName}`,
            customerPhone: document.getElementById('phone').value,
            shippingAddress: {
                address: document.getElementById('address').value,
                apartment: document.getElementById('apartment')?.value || '',
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                zip: document.getElementById('zip').value
            },
            shippingMethod: document.querySelector('input[name="shipping"]:checked')?.value || 'standard',
            shippingCost: state.shipping,
            subtotal: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            discount: state.discount,
            total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + state.shipping - state.discount,
            items: state.cart,
            paymentMethod: selectedPayment,
            notes: ''
        };
        
        elements.placeOrderBtn.textContent = 'Processing...';
        elements.placeOrderBtn.disabled = true;
        
        if (selectedPayment === 'paystack' && window.PaystackCheckout?.isConfigured()) {
            try {
                await window.PaystackCheckout.processOrder(orderData);
                elements.placeOrderBtn.textContent = 'Complete Order';
                elements.placeOrderBtn.disabled = false;
                return;
            } catch (error) {
                console.error('[CHECKOUT] Paystack error:', error);
                showToast('Payment initialization failed. Please try again.', 'error');
                elements.placeOrderBtn.textContent = 'Complete Order';
                elements.placeOrderBtn.disabled = false;
                return;
            }
        }
        
        try {
            const csrfResponse = await fetch(`${API_URL}/csrf-token`, { credentials: 'include' });
            const csrfData = await csrfResponse.json();
            
            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfData.csrfToken },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${result.error || 'Unknown error'}`);
            }
            
            if (result.success) {
                localStorage.removeItem('cart');
                showToast('Order placed successfully!', 'success');
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?order=${result.orderId}`;
                }, 1500);
            } else {
                throw new Error(result.error || 'Order failed');
            }
        } catch (error) {
            console.error('Order API error:', error);
            showToast(`API Error: ${error.message}`, 'error');
        }
    }

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
    
    init();
});
