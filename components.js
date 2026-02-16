/**
 * LA VAGUE - Shared UI Components Loader
 * Centralizes Nav, Footer, and Sidebars to keep code DRY
 */

const Components = {
    // Current templates extracted from index.html
    templates: {
        nav: `
        <div class="nav-container">
            <a href="/" class="nav-logo">
                <span class="logo-text">LA VAGUE</span>
            </a>
            <ul class="nav-links" id="navLinks">
                <li><a href="/shop" class="nav-link">Shop</a></li>
                <li><a href="/#collections" class="nav-link">Collections</a></li>
                <li><a href="/#lookbook" class="nav-link">Lookbook</a></li>
                <li><a href="/#about" class="nav-link">About</a></li>
                <li><a href="/contact" class="nav-link">Contact</a></li>
                <li class="mobile-selectors">
                    <div class="mobile-currency-selector">
                        <select id="mobileCurrencySelect" aria-label="Currency">
                            <option value="USD">$ USD</option>
                            <option value="NGN">₦ NGN</option>
                            <option value="EUR">€ EUR</option>
                            <option value="GBP">£ GBP</option>
                        </select>
                    </div>
                    <div class="mobile-language-selector">
                        <select id="mobileLanguageSelect" aria-label="Language">
                            <option value="en">EN</option>
                            <option value="fr">FR</option>
                            <option value="ar">AR</option>
                        </select>
                    </div>
                </li>
            </ul>
            <div class="nav-actions">
                <div class="locale-selector">
                    <button class="locale-btn" id="localeBtn" aria-label="Select currency and language">
                        <span class="locale-current" id="localeCurrent">$ · EN</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="locale-dropdown" id="localeDropdown">
                        <div class="locale-section">
                            <span class="locale-label">Language</span>
                            <div class="locale-options" id="languageOptions">
                                <button class="locale-option" data-lang="en">English</button>
                                <button class="locale-option" data-lang="fr">Français</button>
                                <button class="locale-option" data-lang="ar">العربية</button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Hidden selectors for mobile menu -->
                <div class="currency-selector desktop-hidden">
                    <select id="currencySelect" aria-label="Currency">
                        <option value="USD">$ USD</option>
                        <option value="NGN">₦ NGN</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                    </select>
                </div>
                <div class="language-selector desktop-hidden">
                    <select id="languageSelect" aria-label="Language">
                        <option value="en">EN</option>
                        <option value="fr">FR</option>
                        <option value="ar">AR</option>
                    </select>
                </div>
                <button class="nav-btn" id="searchBtn" aria-label="Search">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </button>
                <button class="nav-btn" id="wishlistBtn" aria-label="Wishlist">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span class="wishlist-count" id="wishlistCount">0</span>
                </button>
                <button class="nav-btn cart-btn" id="cartBtn" aria-label="Cart">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 6h15l-1.5 9h-12z"></path>
                        <circle cx="9" cy="20" r="1"></circle>
                        <circle cx="18" cy="20" r="1"></circle>
                        <path d="M6 6L5 3H2"></path>
                    </svg>
                    <span class="cart-count" id="cartCount">0</span>
                </button>
                <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menu">
                    <span></span>
                    <span></span>
                </button>
            </div>
        </div>
        `,
        footer: `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <img src="la-vague-red-wordmark.png" alt="LA VAGUE" class="footer-logo-img" width="200">
                    <p class="footer-tagline">Ride the wave. Timeless streetwear for the modern individual.</p>
                    <div class="social-links">
                        <a href="https://www.instagram.com/lavague_ng/" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Instagram">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                            </svg>
                        </a>
                        <a href="https://www.tiktok.com/@Lavague.ng" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="TikTok">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
                            </svg>
                        </a>
                    </div>
                </div>
                <div class="footer-links">
                    <h4>Shop</h4>
                    <ul>
                        <li><a href="/shop">All Products</a></li>
                        <li><a href="/shop?category=hoodies">Hoodies</a></li>
                        <li><a href="/shop?category=tees">T-Shirts</a></li>
                        <li><a href="/shop?category=bottoms">Bottoms</a></li>
                        <li><a href="/shop?category=accessories">Accessories</a></li>
                    </ul>
                </div>
                <div class="footer-links">
                    <h4>Help</h4>
                    <ul>
                        <li><a href="/track-order">Track Order</a></li>
                        <li><a href="/shipping">Shipping</a></li>
                        <li><a href="/returns">Returns</a></li>
                        <li><a href="/faq">FAQ</a></li>
                        <li><a href="/contact">Contact</a></li>
                    </ul>
                </div>
                <div class="footer-links">
                    <h4>Legal</h4>
                    <ul>
                        <li><a href="/privacy-policy">Privacy Policy</a></li>
                        <li><a href="/terms-of-service">Terms of Service</a></li>
                        <li><a href="/refund-policy">Refund Policy</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} LA VAGUE. All rights reserved.</p>
                <div class="payment-methods">
                    <span class="payment-icon">VISA</span>
                    <span class="payment-icon">MC</span>
                    <span class="payment-icon">AMEX</span>
                    <span class="payment-icon">PP</span>
                </div>
            </div>
        </div>
        `,
        cartSidebar: `
        <div class="cart-header">
            <h3 data-i18n="cart.title">Your Cart</h3>
            <button class="cart-close" id="cartClose">×</button>
        </div>
        <div class="cart-items" id="cartItems">
            <div class="cart-empty">
                <p data-i18n="cart.empty">Your cart is empty</p>
                <a href="/shop" class="btn btn-secondary" onclick="window.closeCart()" data-i18n="cart.continueShopping">Continue Shopping</a>
            </div>
        </div>
        <div class="cart-footer" id="cartFooter">
            <div class="cart-subtotal">
                <span data-i18n="cart.subtotal">Subtotal</span>
                <span id="cartSubtotal">$0</span>
            </div>
            <a href="/checkout" class="btn btn-primary btn-full" onclick="window.closeCart()" data-i18n="cart.checkout">Checkout</a>
            <p class="cart-note" data-i18n="cart.note">Shipping & taxes calculated at checkout</p>
        </div>
        `,
        wishlistSidebar: `
        <div class="wishlist-header">
            <h3 data-i18n="cart.wishlist">Your Wishlist</h3>
            <button class="wishlist-close" id="wishlistClose">×</button>
        </div>
        <div class="wishlist-items" id="wishlistItems">
            <div class="wishlist-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <p data-i18n="cart.wishlistEmpty">Your wishlist is empty</p>
                <a href="/shop" class="btn btn-secondary" onclick="window.closeWishlist()" data-i18n="cart.startShopping">Start Shopping</a>
            </div>
        </div>
        `,
        searchOverlay: `
        <div class="search-container">
            <button class="search-close" id="searchClose">×</button>
            <div class="search-input-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input type="text" id="searchInput" placeholder="Search products..." autocomplete="off" data-i18n-placeholder="search.placeholder">
            </div>
            <div class="search-results" id="searchResults"></div>
        </div>
        `
    },

    /**
     * Injects the components into the DOM
     * Called automatically by utils.js
     */
    async init() {
        return new Promise((resolve) => {
            const inject = () => {
                console.log('[COMPONENTS] Injecting shared UI elements...');
                
                        const nav = document.getElementById('nav');
                        const footer = document.querySelector('footer');
                        const cartSidebar = document.getElementById('cartSidebar');                const wishlistSidebar = document.getElementById('wishlistSidebar');
                const searchOverlay = document.getElementById('searchOverlay');

                if (nav) nav.innerHTML = this.templates.nav;
                if (footer) footer.innerHTML = this.templates.footer;
                if (cartSidebar) cartSidebar.innerHTML = this.templates.cartSidebar;
                if (wishlistSidebar) wishlistSidebar.innerHTML = this.templates.wishlistSidebar;
                if (searchOverlay) searchOverlay.innerHTML = this.templates.searchOverlay;

                console.log('[COMPONENTS] Injection complete.');
                
                // Dispatch event to signal that DOM is now ready for JS listeners
                window.dispatchEvent(new CustomEvent('componentsLoaded'));
                resolve();
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inject);
            } else {
                inject();
            }
        });
    }
};
