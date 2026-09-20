/**
 * LA VAGUE - Product Type Definitions
 * TypeScript declarations for product module
 */

// Product Types
export interface ProductColor {
    name: string;
    value: string;
    imageIndex: number;
}

export interface ProductImage {
    src: string;
    alt: string;
}

export interface ProductMeta {
    title: string;
    description: string;
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    category: string;
    price: number;
    compareAtPrice: number | null;
    description: string;
    features: string[];
    images: ProductImage[];
    colors: ProductColor[];
    sizes: string[];
    sizeGuide: string | null;
    inventory: Record<string, number>;
    tags: string[];
    badge: string | null;
    meta: ProductMeta;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
}

export interface SizeMeasurement {
    size: string;
    chest?: string;
    length?: string;
    sleeve?: string;
    waist?: string;
    inseam?: string;
    hip?: string;
}

export interface SizeGuide {
    name: string;
    unit: string;
    measurements: SizeMeasurement[];
}

export interface SizeGuides {
    regular: SizeGuide;
    oversized: SizeGuide;
    pants: SizeGuide;
}

// Storefront reference-data API. Sellable products come from /api/products.
export interface ProductReferenceAPI {
    getSizeGuide: (type: string) => SizeGuide | null;
}

// Cart Types
export interface CartItem {
    id: string;
    name: string;
    price: number;
    image: string;
    color: string;
    size: string;
    quantity: number;
}

export interface CartState {
    cart: CartItem[];
    wishlist: string[];
}

// Order Types
export interface ShippingAddress {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

export interface OrderItem {
    id: string;
    name: string;
    price: number;
    color: string;
    size: string;
    quantity: number;
    image: string;
}

export interface Order {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: ShippingAddress;
    items: OrderItem[];
    subtotal: number;
    shippingCost: number;
    discount: number;
    total: number;
    paymentMethod: string;
    notes?: string;
}

// Global declarations
declare global {
    const CATEGORIES: Category[];
    const SIZE_GUIDES: SizeGuides;
    const ProductAPI: ProductReferenceAPI;
    const CartState: CartState & {
        saveCart: () => void;
        saveWishlist: () => void;
        updateCartCount: () => void;
        updateWishlistCount: () => void;
        addToCart: (item: CartItem) => Promise<boolean>;
        addToWishlist: (productId: string) => boolean;
        removeFromCart: (index: number) => void;
        removeFromWishlist: (index: number) => void;
        updateCartItemQuantity: (index: number, delta: number) => Promise<void>;
        showToast: (message: string, type?: string, action?: string | null) => void;
        renderCart: () => void;
        renderWishlist: () => void;
    };
    const BrowserSecurity: {
        escapeHTML: (value: unknown) => string;
        safeURL: (value: unknown, options?: { allowDataImage?: boolean }) => string;
        safeClassToken: (value: unknown) => string;
        safeColor: (value: unknown, fallback?: string) => string;
    };
}

export {};
