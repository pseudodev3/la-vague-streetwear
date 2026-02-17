/**
 * LA VAGUE - Utility Functions
 * Input masking, debouncing, button states, image optimization
 */

// Input Masking Utilities
const InputMasks = {
    // Credit card: 4242 4242 4242 4242
    creditCard(input) {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.substring(0, 16);
            const parts = value.match(/.{1,4}/g) || [];
            e.target.value = parts.join(' ');
        });
    },

    // Expiry date: MM/YY
    expiryDate(input) {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.substring(0, 4);
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2);
            }
            e.target.value = value;
        });
    },

    // Phone number with country detection
    phone(input) {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            // Simple formatting - adjust based on your needs
            if (value.length > 10) value = value.substring(0, 15);
            e.target.value = value;
        });
    },

    // Alias for phone - used by contact forms
    phoneNumber(value, country = 'auto') {
        // If called with input element, bind the mask
        if (value && value.tagName) {
            return this.phone(value);
        }
        // Otherwise just return formatted value
        let digits = String(value).replace(/\D/g, '');
        if (digits.length > 15) digits = digits.substring(0, 15);
        return digits;
    },

    // CVV: 3 or 4 digits
    cvv(input) {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value.substring(0, 4);
        });
    }
};

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Button state management
const ButtonState = {
    setLoading(button, text = 'Loading...') {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = text;
        button.classList.add('loading');
    },
    
    setSuccess(button, text = 'Success!') {
        button.textContent = text;
        button.classList.remove('loading');
        button.classList.add('success');
        setTimeout(() => this.reset(button), 2000);
    },
    
    setError(button, text = 'Error') {
        button.textContent = text;
        button.classList.remove('loading');
        button.classList.add('error');
        setTimeout(() => this.reset(button), 2000);
    },
    
    reset(button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Submit';
        button.classList.remove('loading', 'success', 'error');
    }
};

// Form validation helpers
const FormValidation = {
    email(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    
    phone(value) {
        return /^[\d\s\-\+\(\)]{7,20}$/.test(value);
    },
    
    creditCard(value) {
        // Remove spaces and check length
        const clean = value.replace(/\s/g, '');
        if (!/^\d{13,19}$/.test(clean)) return false;
        
        // Luhn algorithm
        let sum = 0;
        let isEven = false;
        for (let i = clean.length - 1; i >= 0; i--) {
            let digit = parseInt(clean.charAt(i), 10);
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            isEven = !isEven;
        }
        return sum % 10 === 0;
    },
    
    expiryDate(value) {
        if (!/^\d{2}\/\d{2}$/.test(value)) return false;
        const [month, year] = value.split('/');
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        
        const expMonth = parseInt(month, 10);
        const expYear = parseInt(year, 10);
        
        if (expMonth < 1 || expMonth > 12) return false;
        if (expYear < currentYear) return false;
        if (expYear === currentYear && expMonth < currentMonth) return false;
        
        return true;
    }
};

// Search helper with debouncing
const SearchHelper = {
    init(inputElement, callback, delay = 300) {
        if (!inputElement) return;
        const debouncedCallback = debounce(callback, delay);
        inputElement.addEventListener('input', (e) => {
            debouncedCallback(e.target.value);
        });
    }
};

// CSRF Protection Utilities
const CSRFProtection = {
    token: null,
    
    // Initialize and fetch CSRF token
    async init() {
        try {
            const API_BASE_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://la-vague-api.onrender.com/api';
                
            const response = await fetch(`${API_BASE_URL}/csrf-token`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.token = data.csrfToken;
                console.log('[CSRF] Token initialized');
            }
        } catch (error) {
            console.error('[CSRF] Failed to initialize token:', error);
        }
    },
    
    // Get current token
    getToken() {
        return this.token;
    },
    
    // Refresh token
    async refreshToken() {
        return this.init();
    },
    
    // Make authenticated fetch request with CSRF token
    async fetch(url, options = {}) {
        // Ensure we have a token
        if (!this.token) {
            await this.init();
        }
        
        // Add CSRF token to headers
        const headers = {
            ...options.headers,
            'X-CSRF-Token': this.token
        };
        
        // Add credentials to include cookies
        const fetchOptions = {
            ...options,
            headers,
            credentials: 'include'
        };
        
        const response = await fetch(url, fetchOptions);
        
        // If we get a 403 with CSRF error, try refreshing the token once
        if (response.status === 403) {
            const data = await response.json().catch(() => ({}));
            if (data.code === 'CSRF_INVALID' || data.code === 'CSRF_MISSING') {
                console.log('[CSRF] Token invalid, refreshing...');
                await this.refreshToken();
                
                // Retry with new token
                fetchOptions.headers['X-CSRF-Token'] = this.token;
                return fetch(url, fetchOptions);
            }
        }
        
        return response;
    }
};

// Global Settings & UI Dynamic Updates
const GlobalSettings = {
    settings: {
        freeShippingThreshold: 150000,
        shippingRate: 10000,
        expressShippingRate: 25000,
        storeName: 'LA VAGUE'
    },

    async init() {
        try {
            const API_BASE_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : 'https://la-vague-api.onrender.com/api';
                
            const response = await fetch(`${API_BASE_URL}/config/settings`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.settings) {
                    this.settings = {
                        ...this.settings,
                        ...data.settings
                    };
                    this.updateDynamicElements();
                }
            }
        } catch (error) {
            console.error('[SETTINGS] Failed to load global settings:', error);
            // Fallback to defaults already in state
            this.updateDynamicElements();
        }
    },

    updateDynamicElements() {
        const { freeShippingThreshold, shippingRate, expressShippingRate } = this.settings;
        
        const format = (val) => (window.CurrencyConfig) ? 
            window.CurrencyConfig.formatPrice(val) : `₦${val.toLocaleString()}`;

        // Update free shipping threshold
        const thresholdElements = document.querySelectorAll('.dynamic-free-shipping');
        thresholdElements.forEach(el => {
            // Check if it's the product meta one which might have different casing
            if (el.getAttribute('data-i18n') === 'product.freeShipping') {
                el.textContent = `Free shipping over ${format(freeShippingThreshold)}`;
            } else {
                el.textContent = `FREE SHIPPING ON ORDERS OVER ${format(freeShippingThreshold)}`;
            }
        });

        // Update standard shipping rate
        const rateElements = document.querySelectorAll('.dynamic-shipping-rate');
        rateElements.forEach(el => {
            el.textContent = format(shippingRate);
        });

        // Update express shipping rate
        const expressElements = document.querySelectorAll('.dynamic-express-rate');
        expressElements.forEach(el => {
            el.textContent = format(expressShippingRate);
        });

        // Also trigger i18n update if available
        if (window.I18n) {
            window.I18n.applyTranslations();
        }
    }
};

// Reveal Animations Utility
window.initRevealAnimations = function() {
    const revealElements = document.querySelectorAll('.reveal-up:not(.visible), .reveal-scale:not(.visible), .reveal-left:not(.visible), .reveal-right:not(.visible)');
    
    if (revealElements.length === 0) return;

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    revealElements.forEach(el => revealObserver.observe(el));
};

// WhatsApp Support Initialization
const WhatsAppSupport = {
    init() {
        // Don't show on checkout pages to avoid distraction
        const isCheckoutPage = window.location.pathname.includes('checkout') || 
                              window.location.pathname.includes('order-confirmation');
        
        if (isCheckoutPage) return;
        
        // Check if already injected
        if (document.getElementById('whatsappChat')) return;

        const phone = '2348100864527';
        const message = encodeURIComponent("Yo LA VAGUE! I'm checking out the store and had a question...");
        const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

        const chatBtn = document.createElement('a');
        chatBtn.id = 'whatsappChat';
        chatBtn.href = whatsappUrl;
        chatBtn.className = 'whatsapp-chat';
        chatBtn.target = '_blank';
        chatBtn.rel = 'noopener noreferrer';
        chatBtn.setAttribute('aria-label', 'Chat on WhatsApp');
        
        chatBtn.innerHTML = `
            <div class="whatsapp-tooltip">Chat with us</div>
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.87 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.87 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
        `;

        document.body.appendChild(chatBtn);
    }
};

// Auto-initialize on page load
if (!window.utilsInitialized) {
    window.utilsInitialized = true;
    document.addEventListener('DOMContentLoaded', async () => {
        
        // 1. Inject Shared Components (Header, Footer, Sidebars)
        if (window.Components) {
            try {
                await window.Components.init();
            } catch (e) {
                console.error('[UTILS] Component injection failed:', e);
            }
        } else {
            console.warn('[UTILS] window.Components not found!');
        }

        // 2. Initialize other core systems
        CSRFProtection.init();
        WhatsAppSupport.init();
        GlobalSettings.init();
    });
}

// Make CSRFProtection available globally
window.CSRFProtection = CSRFProtection;

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputMasks, debounce, ButtonState, FormValidation, SearchHelper, CSRFProtection };
}
