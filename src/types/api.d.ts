/**
 * LA VAGUE - API Type Definitions
 * TypeScript declarations for API module
 */

// API Response Types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface HealthCheckResponse {
    status: string;
    timestamp: string;
    uptimeSeconds: number;
    database: string;
}

export interface ReadinessResponse {
    status: 'ready' | 'not_ready';
    timestamp: string;
    database: 'reachable' | 'unavailable';
}

export interface ProductsResponse {
    success: boolean;
    products: import('./products').Product[];
}

export interface ProductResponse {
    success: boolean;
    product: import('./products').Product;
}

export interface OrderResponse {
    success: boolean;
    orderId: string;
}

export interface PaymentInitializeResponse {
    success: boolean;
    authorization_url?: string;
    reference?: string;
    error?: string;
}

export interface PaymentVerifyResponse {
    success: boolean;
    status?: string;
    orderId?: string;
    error?: string;
}

// API Client Types
export interface ApiClient {
    request: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
    getProducts: (params?: URLSearchParams) => Promise<ProductsResponse>;
    getProduct: (slug: string) => Promise<ProductResponse>;
    checkInventory: (productId: string, color: string, size: string) => Promise<{ available: number }>;
    initializePayment: (email: string, amount: number, metadata: Record<string, unknown>) => Promise<PaymentInitializeResponse>;
    verifyPayment: (reference: string) => Promise<PaymentVerifyResponse>;
    createOrder: (orderData: import('./products').Order) => Promise<OrderResponse>;
    getOrder: (orderId: string) => Promise<ApiResponse>;
}

// Loading Manager Types
export interface LoadingManager {
    show: (button: HTMLButtonElement, text?: string) => void;
    hide: (button: HTMLButtonElement) => void;
    showOverlay: (message?: string) => void;
    hideOverlay: () => void;
}

// Toast Types
export interface ToastManager {
    init: () => void;
    show: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

// Validator Types
export interface ValidatorRules {
    email: (value: string) => boolean;
    phone: (value: string) => boolean;
    zip: (value: string) => boolean;
    card: (value: string) => boolean;
    expiry: (value: string) => boolean;
    cvv: (value: string) => boolean;
    required: (value: string) => boolean;
}

export interface Validator {
    rules: ValidatorRules;
    validate: (field: string, value: string, rule: string | string[]) => boolean;
    showError: (input: HTMLInputElement, message: string) => void;
    clearError: (input: HTMLInputElement) => void;
    clearAllErrors: (form: HTMLFormElement) => void;
}

// Global declarations
declare global {
    const LaVagueAPI: ApiClient;
    const LoadingManager: LoadingManager;
    const Toast: ToastManager;
    const Validator: Validator;
}

export {};
