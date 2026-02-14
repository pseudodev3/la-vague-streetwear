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

    // CVV: 3-4 digits
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
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<span class="btn-spinner"></span> ${text}`;
        button.disabled = true;
    },

    setSuccess(button, text = 'Success!') {
        button.innerHTML = `<span class="btn-checkmark">✓</span> ${text}`;
        button.disabled = false;
        setTimeout(() => this.reset(button), 2000);
    },

    setError(button, text = 'Error') {
        button.innerHTML = `<span class="btn-x">✕</span> ${text}`;
        button.disabled = false;
        setTimeout(() => this.reset(button), 2000);
    },

    reset(button) {
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
        button.disabled = false;
    }
};

// Form validation
const FormValidation = {
    email(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    phone(phone) {
        return phone.length >= 10;
    },

    creditCard(card) {
        return card.replace(/\s/g, '').length === 16;
    },

    expiryDate(expiry) {
        if (!expiry || expiry.length !== 5) return false;
        const [month, year] = expiry.split('/');
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

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputMasks, debounce, ButtonState, FormValidation, SearchHelper };
}
