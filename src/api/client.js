/**
 * LA VAGUE - API Client
 * Centralized API communication layer with error handling
 */

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://la-vague-api.onrender.com/api';

/**
 * API Error class for structured error handling
 */
export class APIError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
    }
}

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    // Add auth token if available
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new APIError(
                data.error || 'Request failed',
                response.status,
                data.code || 'UNKNOWN_ERROR'
            );
        }
        
        return data;
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        
        // Network or parsing error
        throw new APIError(
            error.message || 'Network error',
            0,
            'NETWORK_ERROR'
        );
    }
}

/**
 * Product API endpoints
 */
export const ProductAPI = {
    async getAll() {
        return fetchAPI('/products');
    },
    
    async getBySlug(slug) {
        return fetchAPI(`/products/${encodeURIComponent(slug)}`);
    },
    
    async search(query) {
        // Search is client-side for now, but could be server-side
        const { products } = await this.getAll();
        const lowerQuery = query.toLowerCase();
        return {
            success: true,
            products: products.filter(p => 
                p.name.toLowerCase().includes(lowerQuery) ||
                p.description.toLowerCase().includes(lowerQuery) ||
                p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
            )
        };
    }
};

/**
 * Order API endpoints
 */
export const OrderAPI = {
    async create(orderData) {
        return fetchAPI('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    },
    
    async getById(orderId) {
        // Not implemented on backend yet
        throw new APIError('Not implemented', 501, 'NOT_IMPLEMENTED');
    }
};

/**
 * Admin API endpoints
 */
export const AdminAPI = {
    async login(password) {
        const data = await fetchAPI('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        
        if (data.token) {
            sessionStorage.setItem('adminToken', data.token);
        }
        
        return data;
    },
    
    async logout() {
        try {
            await fetchAPI('/admin/logout', { method: 'POST' });
        } finally {
            sessionStorage.removeItem('adminToken');
        }
    },
    
    async getOrders() {
        return fetchAPI('/admin/orders');
    },
    
    async updateOrderStatus(orderId, status) {
        return fetchAPI(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
    },
    
    async getStats() {
        return fetchAPI('/admin/stats');
    },
    
    isAuthenticated() {
        return !!sessionStorage.getItem('adminToken');
    }
};

/**
 * Contact API endpoints
 */
export const ContactAPI = {
    async send({ name, email, subject, message }) {
        return fetchAPI('/contact', {
            method: 'POST',
            body: JSON.stringify({ name, email, subject, message })
        });
    }
};

/**
 * Utility to handle API errors consistently
 */
export function handleAPIError(error, options = {}) {
    const { 
        onAuthError = () => {},
        onValidationError = () => {},
        onNetworkError = () => {},
        onUnknownError = () => {}
    } = options;
    
    if (error instanceof APIError) {
        switch (error.status) {
            case 401:
                sessionStorage.removeItem('adminToken');
                onAuthError(error);
                break;
            case 400:
                onValidationError(error);
                break;
            case 0:
            case 503:
                onNetworkError(error);
                break;
            default:
                onUnknownError(error);
        }
    } else {
        onUnknownError(error);
    }
    
    return error.message || 'An unexpected error occurred';
}

// Export API_URL for direct use if needed
export { API_URL };
