/**
 * LA VAGUE - Shared Cart & Wishlist System
 * Works across all pages
 */

const { escapeHTML, safeURL } = window.BrowserSecurity;

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
        return '/api';
    },
    
    // Load rates using storage or defaults
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
            const response = await fetch(`${this.API_BASE_URL}/config/currency-rates`);
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

// Export to window for global access
window.CurrencyConfig = CurrencyConfig;

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
            this.renderCart(false);
        }
    },
    
    saveWishlist() {
        localStorage.setItem('wishlist', JSON.stringify(this.wishlist));
        this.updateWishlistCount();
        if (document.getElementById('wishlistSidebar')?.classList.contains('active')) {
            this.renderWishlist(false);
        }
    },
    
    updateCartCount() {
        const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.querySelectorAll('.cart-count, #cartCount').forEach(el => {
            if (el) {
                el.textContent = count;
                el.classList.toggle('active', count > 0);
            }
        });
    },
    
    updateWishlistCount() {
        const count = this.wishlist.length;
        document.querySelectorAll('.wishlist-count, #wishlistCount').forEach(el => {
            if (el) {
                el.textContent = count;
                el.classList.toggle('active', count > 0);
            }
        });
    },
    
    async addToCart(item) {
        const existingItem = this.cart.find(i => 
            i.id === item.id && i.color === item.color && i.size === item.size
        );
        
        const currentQty = existingItem ? existingItem.quantity : 0;
        const newTotalQty = currentQty + item.quantity;

        // Live inventory is authoritative. Never assume stock when the API is unavailable.
        try {
            const stock = await this.getAvailableStock(item.id, item.color, item.size);
            if (newTotalQty > stock) {
                this.showToast(stock <= 0 ? 'Sorry, this item is out of stock' : `Only ${stock} items available in stock`, 'error');
                return false;
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
        this.showToast(`${item.name} added to cart`, 'success', 'View Cart');
        return true;
    },

    /**
     * Read sellable stock from the live API only.
     * Fail closed so an outage can never create overselling.
     */
    async getAvailableStock(productId, color, size) {
        try {
            const response = await fetch(`/api/products/inventory/check/${productId}?color=${encodeURIComponent(color)}&size=${encodeURIComponent(size)}`);

            if (!response.ok) {
                console.warn(`[CART] Live stock unavailable for ${productId}: ${response.status}`);
                return 0;
            }

            const data = await response.json();
            const available = Number.parseInt(data.available, 10);
            return data.success && Number.isFinite(available) ? Math.max(0, available) : 0;
        } catch (error) {
            console.warn('[CART] Live stock check unavailable:', error);
            return 0;
        }
    },
    
    addToWishlist(productId) {
        const index = this.wishlist.indexOf(productId);
        
        if (index > -1) {
            this.wishlist.splice(index, 1);
            this.saveWishlist();
            this.showToast('Removed from wishlist', 'success');
            return false;
        } else {
            this.wishlist.push(productId);
            this.saveWishlist();
            this.showToast('Added to wishlist', 'success');
            return true;
        }
    },
    
    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.saveCart();
        // renderCart is called inside saveCart(false)
    },
    
    removeFromWishlist(index) {
        this.wishlist.splice(index, 1);
        this.saveWishlist();
        // renderWishlist is called inside saveWishlist(false)
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
        // renderCart is called inside saveCart(false)
    },
    
    showToast(message, type = 'success', action = null) {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        const messageElement = document.createElement('span');
        messageElement.className = 'toast-message';
        messageElement.textContent = String(message);
        toast.appendChild(messageElement);

        if (action) {
            const actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = 'toast-action';
            actionButton.textContent = String(action);
            actionButton.addEventListener('click', () => {
                window.openCart();
                toast.remove();
            });
            toast.appendChild(actionButton);
        }

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'lv-toast-out 160ms var(--lv-ease) forwards';
            setTimeout(() => toast.remove(), 180);
        }, 4000);
    },

    async renderCart(isInitialLoad = true) {
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
            
            const footer = document.getElementById('cartFooter');
            if (footer) footer.style.display = 'none';
            return;
        }

        const footer = document.getElementById('cartFooter');
        if (footer) footer.style.display = 'block';

        // Only show skeletons on first open, not when adjusting quantity
        if (isInitialLoad || cartItems.innerHTML.includes('cart-empty')) {
            cartItems.innerHTML = Array(this.cart.length).fill(0).map(() => `
                <div class="wishlist-skeleton wishlist-item-fade">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text short"></div>
                        <div class="skeleton-text shorter"></div>
                    </div>
                </div>
            `).join('');
        }
        
        // Remove artificial delay if it's an update
        const waitTime = isInitialLoad ? 400 : 0;
        const minWait = new Promise(resolve => setTimeout(resolve, waitTime));

        // Batch fetch stock for all items
        const [cartWithStock] = await Promise.all([
            Promise.all(this.cart.map(async (item) => {
                const stock = await this.getAvailableStock(item.id, item.color, item.size);
                return { ...item, stock };
            })),
            minWait
        ]);

        cartItems.innerHTML = cartWithStock.map((item, index) => {
            const isAtMaxStock = item.quantity >= item.stock;
            const safeImage = escapeHTML(safeURL(item.image, { allowDataImage: true }));
            const safeName = escapeHTML(item.name);
            const safeColor = escapeHTML(item.color);
            const safeSize = escapeHTML(item.size);
            const quantity = Math.max(0, Number.parseInt(item.quantity, 10) || 0);

            return `
                <div class="cart-item ${isInitialLoad ? 'wishlist-item-fade' : ''}" style="animation-delay: ${index * 0.1}s">
                    <div class="cart-item-image">
                        <img src="${safeImage}" alt="${safeName}">
                    </div>
                    <div class="cart-item-details">
                        <h4 class="cart-item-name">${safeName}</h4>
                        <p class="cart-item-variant">${safeColor} / ${safeSize}</p>
                        <div class="cart-item-actions">
                            <div class="cart-item-qty">
                                <button type="button" data-cart-action="decrease" data-index="${index}" aria-label="Decrease quantity">−</button>
                                <span>${quantity}</span>
                                <button type="button" data-cart-action="increase" data-index="${index}" aria-label="Increase quantity" ${isAtMaxStock ? 'disabled' : ''}>+</button>
                            </div>
                            <span class="cart-item-price">${CurrencyConfig.formatPrice(Number(item.price) * quantity)}</span>
                        </div>
                    </div>
                    <button type="button" class="cart-item-remove" data-cart-action="remove" data-index="${index}" aria-label="Remove item">
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
    
    async renderWishlist(isInitialLoad = true) {
        const wishlistItems = document.getElementById('wishlistItems');
        if (!wishlistItems) return;

        if (this.wishlist.length === 0) {
            wishlistItems.innerHTML = `
                <div class="wishlist-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <p>Your wishlist is empty</p>
                    <a href="shop.html" class="btn btn-secondary">Continue Shopping</a>
                </div>
            `;
            return;
        }

        // Only show skeletons on first open
        if (isInitialLoad || wishlistItems.innerHTML.includes('wishlist-empty')) {
            wishlistItems.innerHTML = Array(this.wishlist.length).fill(0).map(() => `
                <div class="wishlist-skeleton wishlist-item-fade">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text short"></div>
                        <div class="skeleton-text shorter"></div>
                    </div>
                </div>
            `).join('');
        }
        
        const waitTime = isInitialLoad ? 220 : 0;
        const minWait = new Promise(resolve => setTimeout(resolve, waitTime));
        let apiProducts = [];

        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error(`Products unavailable: ${response.status}`);
            const data = await response.json();
            apiProducts = Array.isArray(data.products) ? data.products : [];
        } catch (error) {
            console.warn('[WISHLIST] Live products unavailable:', error);
            wishlistItems.innerHTML = '<div class="wishlist-empty"><p>Wishlist is temporarily unavailable.</p><a href="/shop" class="btn btn-secondary">Back to shop</a></div>';
            return;
        }

        const [resolvedProducts] = await Promise.all([
            Promise.all(this.wishlist.map(async productId => {
                const product = apiProducts.find(candidate => candidate.id === productId);
                if (!product) return null;

                let colors = product.colors;
                let sizes = product.sizes;
                if (typeof colors === 'string') {
                    try { colors = JSON.parse(colors); } catch { colors = []; }
                }
                if (typeof sizes === 'string') {
                    try { sizes = JSON.parse(sizes); } catch { sizes = []; }
                }

                const color = colors?.[0]?.name || colors?.[0] || 'Default';
                const size = sizes?.[0] || 'OS';
                const stock = await this.getAvailableStock(productId, color, size);
                return { ...product, colors, sizes, color, size, stock };
            })),
            minWait
        ]);

        const filteredProducts = resolvedProducts.filter(p => p);
        if (filteredProducts.length === 0) {
            this.wishlist = [];
            this.saveWishlist();
            return;
        }

        wishlistItems.innerHTML = filteredProducts.map((product, index) => {
            const isSoldOut = product.stock <= 0;
            const wishlistIndex = this.wishlist.indexOf(product.id);
            const rawImage = product.images?.[0]?.src || product.images?.[0] || '';
            const safeImage = escapeHTML(safeURL(rawImage, { allowDataImage: true }));
            const safeName = escapeHTML(product.name);
            const safeCategory = escapeHTML(product.category);
            const safeColor = escapeHTML(product.color);
            const safeSize = escapeHTML(product.size);
            const safeId = escapeHTML(product.id);
            const safeSlug = encodeURIComponent(String(product.slug || product.id || ''));

            return `
                <div class="cart-item ${isInitialLoad ? 'wishlist-item-fade' : ''}" style="animation-delay: ${index * 0.1}s">
                    <a href="/product.html?slug=${safeSlug}" class="cart-item-image">
                        <img src="${safeImage}" alt="${safeName}">
                    </a>
                    <div class="cart-item-details">
                        <h4 class="cart-item-name"><a href="/product.html?slug=${safeSlug}">${safeName}</a></h4>
                        <p class="cart-item-variant">${safeCategory}</p>
                        <span class="cart-item-price">${CurrencyConfig.formatPrice(Number(product.price) || 0)}</span>
                    </div>
                    <div class="cart-item-actions">
                        <button
                            type="button"
                            class="btn btn-primary btn-sm ${isSoldOut ? 'disabled' : ''}"
                            data-wishlist-action="add"
                            data-wishlist-index="${wishlistIndex}"
                            data-product-id="${safeId}"
                            data-product-name="${safeName}"
                            data-product-price="${Number(product.price) || 0}"
                            data-product-image="${safeImage}"
                            data-product-color="${safeColor}"
                            data-product-size="${safeSize}"
                            ${isSoldOut ? 'disabled' : ''}
                        >${isSoldOut ? 'Sold Out' : 'Add to Cart'}</button>
                        <button type="button" class="cart-item-remove" data-wishlist-action="remove" data-wishlist-index="${wishlistIndex}" aria-label="Remove from wishlist">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Professional Abandoned Cart Feature
     * Notifies user if they return with items in cart
     */
    checkAbandonedCart() {
        if (this.cart.length === 0) return;

        const lastVisit = localStorage.getItem('lastVisit');
        const now = Date.now();
        localStorage.setItem('lastVisit', now);

        if (lastVisit && now - Number.parseInt(lastVisit, 10) > 60 * 60 * 1000) {
            setTimeout(() => {
                const toast = document.createElement('div');
                toast.className = 'recovery-toast';

                const content = document.createElement('div');
                content.className = 'recovery-content';
                const title = document.createElement('h5');
                title.textContent = 'WELCOME BACK';
                const copy = document.createElement('p');
                copy.textContent = `You have ${this.cart.length} items waiting in your cart.`;
                content.append(title, copy);

                const actions = document.createElement('div');
                actions.className = 'recovery-actions';
                const viewButton = document.createElement('button');
                viewButton.type = 'button';
                viewButton.className = 'btn btn-primary btn-sm';
                viewButton.textContent = 'VIEW CART';
                viewButton.addEventListener('click', () => {
                    window.openCart();
                    toast.remove();
                });
                const dismissButton = document.createElement('button');
                dismissButton.type = 'button';
                dismissButton.className = 'btn btn-secondary btn-sm';
                dismissButton.textContent = 'DISMISS';
                dismissButton.addEventListener('click', () => toast.remove());
                actions.append(viewButton, dismissButton);

                toast.append(content, actions);
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 10000);
            }, 2000);
        }
    },

    /**
     * Professional Tab Reminder
     * Changes tab title when user navigates away with items in cart
     */
    initProfessionalFeatures() {
        this.checkAbandonedCart();
        
        let originalTitle = document.title;
        window.addEventListener('blur', () => {
            if (this.cart.length > 0) {
                document.title = '🛒 Don\'t forget your wave!';
            }
        });
        
        window.addEventListener('focus', () => {
            document.title = originalTitle;
        });
    }
};

window.CartState = CartState;

// ==========================================
// UI FUNCTIONS
// ==========================================
window.openCart = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar && cartOverlay) {
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Render AFTER showing sidebar to ensure skeletons are seen during transition
        setTimeout(() => CartState.renderCart(), 50);
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
        wishlistSidebar.classList.add('active');
        wishlistOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Render AFTER showing sidebar to ensure skeletons are seen during transition
        setTimeout(() => CartState.renderWishlist(), 50);
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
function bindOnce(element, key, eventName, handler) {
    if (!element || element.dataset[key] === 'true') return;
    element.dataset[key] = 'true';
    element.addEventListener(eventName, handler);
}

function initCartUI() {
    CartState.updateCartCount();
    CartState.updateWishlistCount();

    document.querySelectorAll('#cartBtn, .cart-btn').forEach(button => {
        bindOnce(button, 'cartOpenBound', 'click', event => {
            event.preventDefault();
            window.openCart();
        });
    });

    document.querySelectorAll('#wishlistBtn, .wishlist-btn').forEach(button => {
        bindOnce(button, 'wishlistOpenBound', 'click', event => {
            event.preventDefault();
            window.openWishlist();
        });
    });

    bindOnce(document.getElementById('cartClose'), 'cartCloseBound', 'click', window.closeCart);
    bindOnce(document.getElementById('cartOverlay'), 'cartOverlayBound', 'click', window.closeCart);
    bindOnce(document.getElementById('wishlistClose'), 'wishlistCloseBound', 'click', window.closeWishlist);
    bindOnce(document.getElementById('wishlistOverlay'), 'wishlistOverlayBound', 'click', window.closeWishlist);

    bindOnce(document.getElementById('cartSidebar'), 'cartActionsBound', 'click', event => {
        const control = event.target.closest('[data-cart-action]');
        if (!control) return;

        const index = Number.parseInt(control.dataset.index, 10);
        if (!Number.isInteger(index)) return;

        if (control.dataset.cartAction === 'decrease') void CartState.updateCartItemQuantity(index, -1);
        if (control.dataset.cartAction === 'increase') void CartState.updateCartItemQuantity(index, 1);
        if (control.dataset.cartAction === 'remove') CartState.removeFromCart(index);
    });

    bindOnce(document.getElementById('wishlistSidebar'), 'wishlistActionsBound', 'click', async event => {
        const control = event.target.closest('[data-wishlist-action]');
        if (!control) return;

        const index = Number.parseInt(control.dataset.wishlistIndex, 10);
        if (!Number.isInteger(index)) return;

        if (control.dataset.wishlistAction === 'remove') {
            CartState.removeFromWishlist(index);
            return;
        }

        if (control.dataset.wishlistAction === 'add') {
            const added = await CartState.addToCart({
                id: control.dataset.productId || '',
                name: control.dataset.productName || '',
                price: Number(control.dataset.productPrice) || 0,
                image: control.dataset.productImage || '',
                color: control.dataset.productColor || '',
                size: control.dataset.productSize || '',
                quantity: 1
            });
            if (added) CartState.removeFromWishlist(index);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI
    initCartUI();
    
    // Initialize Professional features (Abandoned cart, Tab reminder)
    CartState.initProfessionalFeatures();
    
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
                CartState.renderCart(false);
            }
        }
        if (e.key === 'wishlist') {
            CartState.wishlist = JSON.parse(e.newValue || '[]');
            CartState.updateWishlistCount();
            if (document.getElementById('wishlistSidebar')?.classList.contains('active')) {
                CartState.renderWishlist(false);
            }
        }
    });
});

// Re-initialize UI when shared components are loaded (for other pages)
window.addEventListener('componentsLoaded', initCartUI);
