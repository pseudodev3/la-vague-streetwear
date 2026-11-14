/**
 * LA VAGUE - Input Sanitization & Validation Utilities
 */

/**
 * Sanitize HTML to prevent XSS (Works in both Browser and Node.js)
 */
export function sanitizeHTML(input) {
    if (typeof input !== 'string') return '';
    
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize string for safe display
 */
export function sanitizeString(input, maxLength = 255) {
    if (typeof input !== 'string') return '';
    
    // Remove scripts, styles, and event handlers
    let sanitized = input
        .trim()
        .slice(0, maxLength)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .replace(/on\w+=\S+/gi, '');

    // Strip remaining HTML tags
    return sanitized.replace(/<[^>]*>?/gm, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Normalize an email address for storage and lookup.
 *
 * IMPORTANT: this is the single source of truth for how an email is transformed
 * before it touches the database. Both the create-order write path and the
 * track-order lookup path MUST run the email through this function, otherwise
 * an asymmetry appears: an order stored under one form cannot be found when a
 * customer types the other form.
 *
 * We intentionally only lowercase and trim. We do NOT strip Gmail dots or
 * `+tag` sub-addresses, even though express-validator's `normalizeEmail()` does
 * so by default — those are real, distinct inboxes for most providers, and
 * stripping them breaks order tracking for customers whose address contains
 * them (e.g. `prvda.xo@gmail.com` was being stored as `prvdaxo@gmail.com`).
 *
 * @param {string} email
 * @returns {string} the normalized email, or the input untouched if it is not a string
 */
export function normalizeEmail(email) {
    if (typeof email !== 'string') return email;
    return email.trim().toLowerCase();
}

/**
 * Legacy compatibility: return the dot-stripped Gmail form of an email.
 *
 * Orders created before the normalizeEmail() fix were stored with Gmail dots
 * stripped (express-validator's old default), so `prvda.xo@gmail.com` was
 * persisted as `prvdaxo@gmail.com`. We no longer strip dots at write time, but
 * lookup must still find those legacy rows. This function recomputes the
 * legacy dot-stripped form so lookupOrder can fall back to it when an exact
 * match misses. Gmail ignores dots in the local part, so the two addresses
 * route to the same mailbox — stripping is safe ONLY for @gmail.com.
 *
 * @param {string} email a normalized (lowercased, trimmed) email
 * @returns {string|null} the dot-stripped gmail form, or null if not a gmail address
 */
export function legacyGmailDotStripped(email) {
    if (typeof email !== 'string') return null;
    const at = email.lastIndexOf('@');
    if (at < 0) return null;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') return null;
    return `${local.replace(/\./g, '')}@${domain}`;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone) {
    if (typeof phone !== 'string') return false;
    const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;
    return phoneRegex.test(phone.trim());
}

/**
 * Validate order data before sending
 */
export function validateOrderData(data) {
    const errors = [];
    
    // Required fields
    if (!data.customerEmail || !isValidEmail(data.customerEmail)) {
        errors.push('Valid email is required');
    }
    
    if (!data.customerName || data.customerName.trim().length < 2) {
        errors.push('Name must be at least 2 characters');
    }
    
    if (!data.shippingAddress || typeof data.shippingAddress !== 'object') {
        errors.push('Shipping address is required');
    } else {
        const { address, city, state, zip } = data.shippingAddress;
        if (!address || address.trim().length < 5) {
            errors.push('Valid address is required');
        }
        if (!city || city.trim().length < 2) {
            errors.push('City is required');
        }
        if (!state || state.trim().length < 2) {
            errors.push('State is required');
        }
        if (!zip || zip.trim().length < 3) {
            errors.push('Valid zip code is required');
        }
    }
    
    if (!Array.isArray(data.items) || data.items.length === 0) {
        errors.push('Order must contain at least one item');
    } else {
        data.items.forEach((item, index) => {
            if (!item.id || !item.name || !item.price || !item.quantity) {
                errors.push(`Item ${index + 1} is missing required fields`);
            }
        });
    }
    
    if (typeof data.total !== 'number' || data.total <= 0) {
        errors.push('Invalid order total');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount, currency = 'USD') {
    if (typeof amount !== 'number') return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount / 100); // Assuming amount is in cents
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength = 100) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    
    return text.slice(0, maxLength).trim() + '...';
}

/**
 * Generate order ID
 */
export function generateOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LV-${timestamp}-${random}`;
}

/**
 * Debounce function for performance
 */
export function debounce(func, wait = 300) {
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

/**
 * Throttle function for performance
 */
export function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
    return obj;
}

/**
 * LocalStorage wrapper with error handling
 */
export const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading from localStorage: ${key}`, error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage: ${key}`, error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from localStorage: ${key}`, error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage', error);
            return false;
        }
    }
};
