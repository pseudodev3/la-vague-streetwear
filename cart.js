/**
 * LA VAGUE - Shared Cart & Wishlist System
 * Works across all pages
 */

// ==========================================
// CURRENCY CONFIGURATION (NGN ONLY)
// ==========================================
const CurrencyConfig = {
    // NGN is the only supported currency
    defaultRates: {
        NGN: 1
    },
    
    // Current rates (NGN only)
    rates: { NGN: 1 },
    
    // Currency symbols
    symbols: {
        NGN: '₦'
    },
    
    // Currency names
    names: {
        NGN: 'NGN'
    },
    
    // API base URL
    get API_BASE_URL() {
        return window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : 'https://la-vague-api.onrender.com/api';
    },
    
    // Initialize rates from localStorage or defaults
    init() {
        // Try to load cached rates from localStorage
        const cached = localStorage.getItem('currencyRates');
        const cachedTime = localStorage.getItem('currencyRatesUpdated');
        
        if (cached && cachedTime) {
            const age = Date.now() - parseInt(cachedTime);
            // Use cache if less than 1 hour old
            if (age < 60 * 60 * 1000) {
                try {
                    this.rates = JSON.parse(cached);
                } catch (e) {
                    this.rates = { ...this.defaultRates };
                }
            } else {
                // Cache expired, use defaults and fetch fresh
                this.rates = { ...this.defaultRates };
                this.fetchRates();
            }
        } else {
            // No cache, use defaults and fetch
            this.rates = { ...this.defaultRates };
            this.fetchRates();
        }
        
        // Refresh rates every 30 minutes
        setInterval(() => this.fetchRates(), 30 * 60 * 1000);
    },
    
    // Fetch rates from server
    async fetchRates() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/currency-rates`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.rates) {
                    this.rates = data.rates;
                    // Cache in localStorage
                    localStorage.setItem('currencyRates', JSON.stringify(this.rates));
                    localStorage.setItem('currencyRatesUpdated', Date.now().toString());
                    
                    // Notify listeners that rates have been updated
                    window.dispatchEvent(new CustomEvent('currencyRatesUpdated', { 
                        detail: { rates: this.rates } 
                    }));
                }
            }
        } catch (error) {
            console.error('[CURRENCY] Failed to fetch rates:', error);
            // Keep using cached or default rates
        }
    },
    
    // Get current currency (always NGN)
    getCurrentCurrency() {
        return 'NGN';
    },
    
    // Set currency (no-op, always NGN)
    setCurrency(currency) {
        // Currency switching disabled - always NGN
        return currency === 'NGN';
    },
    
    // Convert amount (always returns same amount - NGN only)
    convert(amount, targetCurrency = null) {
        // No conversion needed - always NGN
        return amount;
    },
    
    // Format price for display (always NGN)
    formatPrice(amount, currency = null) {
        // Always format as NGN
        const symbol = this.symbols.NGN;
        // For NGN, show whole numbers without decimals
        return `${symbol}${Math.round(amount).toLocaleString()}`;
    },
    
    // Get all supported currencies (NGN only)
    getSupportedCurrencies() {
        return ['NGN'];
    },
    
    // Get current rates for admin display (NGN only)
    getCurrentRates() {
        return { NGN: 1 };
    }
};

// Initialize currency config on load
CurrencyConfig.init();

// ==========================================
// SHARED STATE
// ==========================================
const CartState = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    wishlist: JSON.parse(localStorage.getItem('wishlist')) || [],
    
    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.updateCartCount();
        if (document.getElementById('cartSidebar')?.classList.contains('active')) {
            this.renderCart();
        }
    },
    
    saveWishlist() {
        localStorage.setItem('wishlist', JSON.stringify(this.wishlist));
        this.updateWishlistCount();
        if (document.getElementById('wishlistSidebar')?.classList.contains('active')) {
            this.renderWishlist();
        }
    },
    
    updateCartCount() {
        const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.querySelectorAll('.cart-count, #cartCount').forEach(el => {
            if (el) {
                el.textContent = count;
                el.style.display = count > 0 ? 'flex' : 'none';
            }
        });
    },
    
    updateWishlistCount() {
        const count = this.wishlist.length;
        document.querySelectorAll('.wishlist-count, #wishlistCount').forEach(el => {
            if (el) {
                el.textContent = count;
                el.style.display = count > 0 ? 'flex' : 'none';
                el.classList?.toggle('active', count > 0);
            }
        });
    },
    
    async addToCart(item) {
        const existingItem = this.cart.find(i => 
            i.id === item.id && i.color === item.color && i.size === item.size
        );
        
        const currentQty = existingItem ? existingItem.quantity : 0;
        const newTotalQty = currentQty + item.quantity;

        // Unified Stock Check (Static + API fallback)
        try {
            const stock = await this.getAvailableStock(item.id, item.color, item.size);
            if (newTotalQty > stock) {
                this.showToast(stock <= 0 ? 'Sorry, this item is out of stock' : `Only ${stock} items available in stock`, 'error');
                return;
            }
        } catch (error) {
            console.error('[CART] Stock check failed:', error);
        }
        
        if (existingItem) {
            existingItem.quantity = newTotalQty;
        } else {
            this.cart.push(item);
        }
        
        this.saveCart();
        const viewCartText = (typeof I18n !== 'undefined') ? I18n.t('toast.viewCart') : 'View Cart';
        this.showToast(`${item.name} ${(typeof I18n !== 'undefined') ? I18n.t('toast.addedToCart') : 'added to cart'}`, 'success', viewCartText);
    },

    /**
     * Helper to get stock from any source
     */
    async getAvailableStock(productId, color, size) {
        // 1. Try static ProductAPI first
        if (typeof ProductAPI !== 'undefined') {
            const staticProduct = ProductAPI.getById(productId);
            if (staticProduct) {
                const inventory = typeof staticProduct.inventory === 'string' ? JSON.parse(staticProduct.inventory || '{}') : (staticProduct.inventory || {});
                return parseInt(inventory[`${color}-${size}`]) || 0;
            }
        }

        // 2. Fallback to API check
        try {
            const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://la-vague-api.onrender.com/api';
            const response = await fetch(`${API_URL}/inventory/check/${productId}?color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);
            if (response.ok) {
                const data = await response.json();
                return parseInt(data.available) || 0;
            }
        } catch (e) {
            console.warn('[CART] API stock check unavailable');
        }

        return 999; // Safe default if everything fails
    },
    
    addToWishlist(productId) {
        const index = this.wishlist.indexOf(productId);
        
        if (index > -1) {
            this.wishlist.splice(index, 1);
            this.saveWishlist();
            this.showToast((typeof I18n !== 'undefined') ? I18n.t('toast.removedFromWishlist') : 'Removed from wishlist', 'success');
            return false;
        } else {
            this.wishlist.push(productId);
            this.saveWishlist();
            this.showToast((typeof I18n !== 'undefined') ? I18n.t('toast.addedToWishlist') : 'Added to wishlist', 'success');
            return true;
        }
    },
    
    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.saveCart();
        this.renderCart();
    },
    
    removeFromWishlist(index) {
        this.wishlist.splice(index, 1);
        this.saveWishlist();
        this.renderWishlist();
    },
    
    async updateCartItemQuantity(index, delta) {
        const item = this.cart[index];
        if (!item) return;
        
        const newQty = item.quantity + delta;
        if (newQty < 1) {
            this.removeFromCart(index);
            return;
        }
        
        // Stock check
        try {
            const stock = await this.getAvailableStock(item.id, item.color, item.size);
            if (newQty > stock) {
                this.showToast(`Only ${stock} items available in stock`, 'error');
                return;
            }
        } catch (error) {}

        item.quantity = newQty;
        this.saveCart();
        this.renderCart();
    },
    
    showToast(message, type = 'success', action = null) {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem;';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            ${action ? `<span class="toast-action" onclick="window.openCart(); this.parentElement.remove();">${action}</span>` : ''}
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    async renderCart() {
        const cartItems = document.getElementById('cartItems');
        const cartSubtotal = document.getElementById('cartSubtotal');
        if (!cartItems) return;
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="cart-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M6 6h15l-1.5 9h-12z"></path>
                        <circle cx="9" cy="20" r="1"></circle>
                        <circle cx="18" cy="20" r="1"></circle>
                        <path d="M6 6L5 3H2"></path>
                    </svg>
                    <p>Your cart is empty</p>
                    <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
                </div>
            `;
            if (cartSubtotal) cartSubtotal.textContent = CurrencyConfig.formatPrice(0);
            return;
        }
        
        // Batch fetch stock for all items to avoid UI flicker
        const cartWithStock = await Promise.all(this.cart.map(async (item) => {
            const stock = await this.getAvailableStock(item.id, item.color, item.size);
            return { ...item, stock };
        }));

        cartItems.innerHTML = cartWithStock.map((item, index) => {
            const isAtMaxStock = item.quantity >= item.stock;

            return `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h4 class="cart-item-name">${item.name}</h4>
                        <p class="cart-item-variant">${item.color} / ${item.size}</p>
                        <div class="cart-item-actions">
                            <div class="quantity-selector">
                                <button class="qty-btn" style="border-radius: 0 !important;" onclick="CartState.updateCartItemQuantity(${index}, -1)">−</button>
                                <span>${item.quantity}</span>
                                <button class="qty-btn" style="border-radius: 0 !important;" onclick="CartState.updateCartItemQuantity(${index}, 1)" ${isAtMaxStock ? 'disabled' : ''}>+</button>
                            </div>
                            <span class="cart-item-price">${CurrencyConfig.formatPrice(item.price * item.quantity)}</span>
                        </div>
                    </div>
                    <button class="cart-item-remove" style="border-radius: 0 !important;" onclick="CartState.removeFromCart(${index})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
        
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (cartSubtotal) cartSubtotal.textContent = CurrencyConfig.formatPrice(subtotal);
    },
    
    async renderWishlist() {
        const wishlistItems = document.getElementById('wishlistItems');
        if (!wishlistItems) return;
        
        if (this.wishlist.length === 0) {
            wishlistItems.innerHTML = `
                <div class="cart-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <p>Your wishlist is empty</p>
                    <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
                </div>
            `;
            return;
        }
        
        // Find products from all sources (Static first, then API)
        const productsWithStock = await Promise.all(this.wishlist.map(async (productId) => {
            let product = null;
            
            // Try static
            if (typeof ProductAPI !== 'undefined') {
                product = ProductAPI.getById(productId);
            }
            
            // Try API if not in static
            if (!product) {
                try {
                    const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://la-vague-api.onrender.com/api';
                    const response = await fetch(`${API_URL}/products`);
                    const data = await response.json();
                    product = data.products?.find(p => p.id === productId);
                } catch (e) {}
            }

            if (!product) return null;

            const color = product.colors?.[0]?.name || 'Default';
            const size = product.sizes?.[0] || 'OS';
            const stock = await this.getAvailableStock(productId, color, size);
            
            return { ...product, color, size, stock };
        }));

        wishlistItems.innerHTML = productsWithStock.filter(p => p).map(product => {
            const isSoldOut = product.stock <= 0;

            return `
                <div class="cart-item">
                    <img src="${product.images?.[0]?.src || product.images?.[0] || ''}" alt="${product.name}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h4 class="cart-item-name">${product.name}</h4>
                        <p class="cart-item-variant">${product.category}</p>
                        <span class="cart-item-price">${CurrencyConfig.formatPrice(product.price)}</span>
                    </div>
                    <div class="cart-item-actions">
                        <button class="btn btn-primary btn-sm ${isSoldOut ? 'disabled' : ''}" 
                                ${isSoldOut ? 'disabled' : ''}
                                style="border-radius: 0 !important; -webkit-border-radius: 0 !important; -moz-border-radius: 0 !important;"
                                onclick="CartState.addToCart({
                            id: '${product.id}',
                            name: '${product.name}',
                            price: ${product.price},
                            image: '${product.images?.[0]?.src || product.images?.[0] || ''}',
                            color: '${product.color}',
                            size: '${product.size}',
                            quantity: 1
                        }); if (!${isSoldOut}) CartState.removeFromWishlist(${this.wishlist.indexOf(product.id)});">
                            ${isSoldOut ? 'Sold Out' : 'Add to Cart'}
                        </button>
                        <button class="cart-item-remove" style="border-radius: 0 !important; -webkit-border-radius: 0 !important; -moz-border-radius: 0 !important;" onclick="CartState.removeFromWishlist(${this.wishlist.indexOf(product.id)})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
};

// ==========================================
// UI FUNCTIONS
// ==========================================
window.openCart = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar && cartOverlay) {
        CartState.renderCart();
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.closeCart = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar && cartOverlay) {
        cartSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
};

window.openWishlist = function() {
    const wishlistSidebar = document.getElementById('wishlistSidebar');
    const wishlistOverlay = document.getElementById('wishlistOverlay');
    if (wishlistSidebar && wishlistOverlay) {
        CartState.renderWishlist();
        wishlistSidebar.classList.add('active');
        wishlistOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.closeWishlist = function() {
    const wishlistSidebar = document.getElementById('wishlistSidebar');
    const wishlistOverlay = document.getElementById('wishlistOverlay');
    if (wishlistSidebar && wishlistOverlay) {
        wishlistSidebar.classList.remove('active');
        wishlistOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Update counts on page load
    CartState.updateCartCount();
    CartState.updateWishlistCount();
    
    // Bind cart button clicks
    document.querySelectorAll('#cartBtn, .cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.openCart();
        });
    });
    
    // Bind wishlist button clicks
    document.querySelectorAll('#wishlistBtn, .wishlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.openWishlist();
        });
    });
    
    // Bind close buttons
    document.getElementById('cartClose')?.addEventListener('click', window.closeCart);
    document.getElementById('cartOverlay')?.addEventListener('click', window.closeCart);
    document.getElementById('wishlistClose')?.addEventListener('click', window.closeWishlist);
    document.getElementById('wishlistOverlay')?.addEventListener('click', window.closeWishlist);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.closeCart();
            window.closeWishlist();
        }
    });

    // Cross-tab synchronization
    window.addEventListener('storage', (e) => {
        if (e.key === 'cart') {
            CartState.cart = JSON.parse(e.newValue || '[]');
            CartState.updateCartCount();
            if (document.getElementById('cartSidebar')?.classList.contains('active')) {
                CartState.renderCart();
            }
        }
        if (e.key === 'wishlist') {
            CartState.wishlist = JSON.parse(e.newValue || '[]');
            CartState.updateWishlistCount();
            if (document.getElementById('wishlistSidebar')?.classList.contains('active')) {
                CartState.renderWishlist();
            }
        }
    });
});
