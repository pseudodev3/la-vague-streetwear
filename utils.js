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

// Auto-initialize CSRF on page load
document.addEventListener('DOMContentLoaded', () => {
    CSRFProtection.init();
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputMasks, debounce, ButtonState, FormValidation, SearchHelper, CSRFProtection };
}
