/**
 * LA VAGUE - Internationalization (i18n) System
 * Handles language switching, translations, and RTL support
 */

const I18n = {
    currentLang: 'en',
    
    // Initialize i18n system
    init() {
        // Load saved language preference from localStorage
        const savedLang = localStorage.getItem('laVagueLanguage');
        if (savedLang && TRANSLATIONS[savedLang]) {
            this.currentLang = savedLang;
        }
        
        // Apply initial language
        this.setLanguage(this.currentLang, false);
        
        // Add language selector to navigation
        this.addLanguageSelector();
        
        console.log(`🌍 I18n initialized: ${this.currentLang}`);
    },
    
    // Set language and apply translations
    setLanguage(lang, save = true) {
        if (!TRANSLATIONS[lang]) {
            console.warn(`Language "${lang}" not found, falling back to English`);
            lang = 'en';
        }
        
        this.currentLang = lang;
        
        // Save to localStorage
        if (save) {
            localStorage.setItem('laVagueLanguage', lang);
        }
        
        // Get language metadata
        const langMeta = LANGUAGE_METADATA[lang];
        
        // Update HTML lang attribute and direction
        document.documentElement.lang = lang;
        document.documentElement.dir = langMeta.dir;
        
        // Apply RTL/LTR body attribute for CSS targeting
        document.body.setAttribute('data-lang', lang);
        document.body.setAttribute('data-dir', langMeta.dir);
        
        // Apply translations
        this.applyTranslations();
        
        // Update language selector UI
        this.updateLanguageSelector();
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: lang, dir: langMeta.dir } 
        }));
        
        console.log(`🌍 Language changed to: ${lang} (${langMeta.name})`);
    },
    
    // Apply translations to all elements with data-i18n attribute
    applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            
            if (translation) {
                // Handle different element types
                if (el.tagName === 'INPUT' && el.type === 'placeholder') {
                    el.placeholder = translation;
                } else if (el.tagName === 'INPUT') {
                    el.placeholder = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });
        
        // Handle placeholder translations
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.getTranslation(key);
            if (translation) {
                el.placeholder = translation;
            }
        });
        
        // Handle input value translations (for buttons)
        const valueElements = document.querySelectorAll('[data-i18n-value]');
        valueElements.forEach(el => {
            const key = el.getAttribute('data-i18n-value');
            const translation = this.getTranslation(key);
            if (translation) {
                el.value = translation;
            }
        });
        
        // Update dynamic content
        this.updateDynamicContent();
    },
    
    // Get translation by key (supports nested keys like "nav.home")
    getTranslation(key) {
        const keys = key.split('.');
        let value = TRANSLATIONS[this.currentLang];
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Fallback to English
                value = TRANSLATIONS.en;
                for (const fk of keys) {
                    if (value && typeof value === 'object' && fk in value) {
                        value = value[fk];
                    } else {
                        return null;
                    }
                }
                return value;
            }
        }
        
        return value;
    },
    
    // Get translation with variables replacement
    t(key, vars = {}) {
        let translation = this.getTranslation(key);
        
        if (!translation) return key;
        
        // Replace variables
        Object.keys(vars).forEach(varKey => {
            translation = translation.replace(new RegExp(`{{${varKey}}}`, 'g'), vars[varKey]);
        });
        
        return translation;
    },
    
    // Update dynamic content that requires JavaScript translation
    updateDynamicContent() {
        // Update cart title
        const cartTitle = document.querySelector('.cart-header h3');
        if (cartTitle) {
            cartTitle.textContent = this.getTranslation('cart.title');
        }
        
        // Update cart empty state
        const cartEmptyText = document.querySelector('.cart-empty > p');
        if (cartEmptyText) {
            cartEmptyText.textContent = this.getTranslation('cart.empty');
        }
        
        const cartEmptyBtn = document.querySelector('.cart-empty .btn');
        if (cartEmptyBtn) {
            cartEmptyBtn.textContent = this.getTranslation('cart.continueShopping');
        }
        
        // Update wishlist title
        const wishlistTitle = document.querySelector('.wishlist-header h3');
        if (wishlistTitle) {
            wishlistTitle.textContent = this.getTranslation('cart.wishlist');
        }
        
        // Update wishlist empty state
        const wishlistEmptyText = document.querySelector('.wishlist-empty > p');
        if (wishlistEmptyText) {
            wishlistEmptyText.textContent = this.getTranslation('cart.wishlistEmpty');
        }
        
        const wishlistEmptyBtn = document.querySelector('.wishlist-empty .btn');
        if (wishlistEmptyBtn) {
            wishlistEmptyBtn.textContent = this.getTranslation('cart.startShopping');
        }
        
        // Update subtotal label
        const subtotalLabel = document.querySelector('.cart-subtotal span:first-child');
        if (subtotalLabel) {
            subtotalLabel.textContent = this.getTranslation('cart.subtotal');
        }
        
        // Update checkout button
        const checkoutBtn = document.querySelector('.cart-footer .btn-primary');
        if (checkoutBtn) {
            checkoutBtn.textContent = this.getTranslation('cart.checkout');
        }
        
        // Update cart note
        const cartNote = document.querySelector('.cart-note');
        if (cartNote) {
            cartNote.textContent = this.getTranslation('cart.note');
        }
        
        // Update announcement bar
        this.updateAnnouncementBar();
        
        // Update search placeholder
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.placeholder = this.getTranslation('search.placeholder');
        }
        
        // Update product page specific elements
        this.updateProductPageElements();
        
        // Update shop page specific elements
        this.updateShopPageElements();
        
        // Update checkout page specific elements
        this.updateCheckoutPageElements();
    },
    
    // Update announcement bar
    updateAnnouncementBar() {
        const threshold = (window.GlobalSettings) ? 
            window.GlobalSettings.settings.freeShippingThreshold : 150000;
        const formattedThreshold = (window.CurrencyConfig) ? 
            window.CurrencyConfig.formatPrice(threshold) : `₦${threshold.toLocaleString()}`;

        const announcementSpans = document.querySelectorAll('.announcement-content span:not(.announcement-divider)');
        if (announcementSpans.length >= 2) {
            announcementSpans[0].textContent = this.t('announcement.freeShipping', { threshold: formattedThreshold });
            announcementSpans[1].textContent = this.getTranslation('announcement.newDrop');
        } else if (announcementSpans.length === 1) {
            announcementSpans[0].textContent = this.t('announcement.freeShipping', { threshold: formattedThreshold });
        }
    },
    
    // Update product page elements
    updateProductPageElements() {
        const threshold = (window.GlobalSettings) ? 
            window.GlobalSettings.settings.freeShippingThreshold : 150000;
        const formattedThreshold = (window.CurrencyConfig) ? 
            window.CurrencyConfig.formatPrice(threshold) : `₦${threshold.toLocaleString()}`;

        // Color label
        const colorLabel = document.querySelector('#colorGroup .option-label');
        if (colorLabel) {
            const colorText = colorLabel.childNodes[0];
            if (colorText) colorText.textContent = this.getTranslation('product.color') + ': ';
        }
        
        // Size label
        const sizeLabel = document.querySelector('#sizeGroup .option-label');
        if (sizeLabel) {
            const sizeText = sizeLabel.childNodes[0];
            if (sizeText) sizeText.textContent = this.getTranslation('product.size') + ': ';
        }
        
        // Size guide button
        const sizeGuideBtn = document.getElementById('sizeGuideBtn');
        if (sizeGuideBtn) {
            sizeGuideBtn.textContent = this.getTranslation('product.sizeGuide');
        }
        
        // Add to cart button
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            const svg = addToCartBtn.querySelector('svg');
            addToCartBtn.innerHTML = '';
            if (svg) addToCartBtn.appendChild(svg);
            addToCartBtn.appendChild(document.createTextNode(' ' + this.getTranslation('product.addToCart')));
        }
        
        // Meta items
        const metaItems = document.querySelectorAll('.product-meta .meta-item span');
        if (metaItems.length >= 3) {
            metaItems[0].textContent = this.t('product.freeShipping', { threshold: formattedThreshold });
            metaItems[1].textContent = this.getTranslation('product.shipsIn');
            metaItems[2].textContent = this.getTranslation('product.returns');
        }
        
        // Accordion headers - preserve span structure for CSS layout
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        accordionHeaders.forEach(header => {
            const textSpan = header.querySelector('.accordion-text');
            const iconSpan = header.querySelector('.accordion-icon');
            const currentText = textSpan ? textSpan.textContent.trim() : header.textContent.trim();
            
            if (currentText.includes('Description')) {
                if (textSpan) {
                    textSpan.textContent = this.getTranslation('product.description');
                }
            } else if (currentText.includes('Shipping') || currentText.includes('Livraison') || currentText.includes('الشحن')) {
                if (textSpan) {
                    textSpan.textContent = this.getTranslation('product.shippingReturns');
                }
            }
        });
        
        // Related products title
        const relatedTitle = document.querySelector('.related-products .section-title');
        if (relatedTitle) {
            relatedTitle.textContent = this.getTranslation('product.youMayAlsoLike');
        }
        
        // Breadcrumb
        const breadcrumbHome = document.querySelector('.breadcrumb a[href="index.html"]');
        if (breadcrumbHome) {
            breadcrumbHome.textContent = this.getTranslation('breadcrumb.home');
        }
        
        const breadcrumbShop = document.querySelector('.breadcrumb a[href="shop.html"]');
        if (breadcrumbShop) {
            breadcrumbShop.textContent = this.getTranslation('breadcrumb.shop');
        }
    },
    
    // Update shop page elements
    updateShopPageElements() {
        // Shop title
        const shopTitle = document.querySelector('.shop-title');
        if (shopTitle) {
            shopTitle.textContent = this.getTranslation('shop.title');
        }
        
        // Shop description
        const shopDesc = document.querySelector('.shop-description');
        if (shopDesc) {
            shopDesc.textContent = this.getTranslation('shop.description');
        }
        
        // Filter button
        const filterBtn = document.getElementById('filterToggle');
        if (filterBtn) {
            const svg = filterBtn.querySelector('svg');
            const text = this.getTranslation('shop.filter');
            filterBtn.innerHTML = '';
            if (svg) filterBtn.appendChild(svg);
            filterBtn.appendChild(document.createTextNode(' ' + text));
        }
        
        // Filter sidebar title
        const filterTitle = document.querySelector('.filter-header h3');
        if (filterTitle) {
            filterTitle.textContent = this.getTranslation('shop.filters');
        }
        
        // Category filter labels
        const categorySection = document.querySelector('.filter-section:first-child h4');
        if (categorySection) {
            categorySection.textContent = this.getTranslation('shop.categories');
        }
        
        // All Products radio label
        const allProductsLabel = document.querySelector('input[value="all"] + span');
        if (allProductsLabel) {
            allProductsLabel.textContent = this.getTranslation('shop.allProducts');
        }
        
        // Price range label
        const priceSection = document.querySelector('.filter-section:nth-child(2) h4');
        if (priceSection) {
            priceSection.textContent = this.getTranslation('shop.priceRange');
        }
        
        // Tags section
        const tagsSection = document.querySelector('.filter-section:nth-child(3) h4');
        if (tagsSection) {
            tagsSection.textContent = this.getTranslation('shop.tags');
        }
        
        // Tag labels
        const saleLabel = document.querySelector('input[value="sale"] + span');
        if (saleLabel) saleLabel.textContent = this.getTranslation('shop.onSale');
        
        const newLabel = document.querySelector('input[value="new"] + span');
        if (newLabel) newLabel.textContent = this.getTranslation('shop.newArrivals');
        
        const bestsellerLabel = document.querySelector('input[value="bestseller"] + span');
        if (bestsellerLabel) bestsellerLabel.textContent = this.getTranslation('shop.bestsellers');
        
        // Filter footer buttons
        const clearBtn = document.getElementById('clearFilters');
        if (clearBtn) clearBtn.textContent = this.getTranslation('shop.clearAll');
        
        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) applyBtn.textContent = this.getTranslation('shop.apply');
        
        // Empty state
        const emptyTitle = document.querySelector('.empty-state h3');
        if (emptyTitle) emptyTitle.textContent = this.getTranslation('shop.noProducts');
        
        const emptyText = document.querySelector('.empty-state p');
        if (emptyText) emptyText.textContent = this.getTranslation('shop.tryAdjusting');
        
        const emptyBtn = document.getElementById('clearAllFilters');
        if (emptyBtn) emptyBtn.textContent = this.getTranslation('shop.clearFilters');
    },
    
    // Update checkout page elements
    updateCheckoutPageElements() {
        // Nav link
        const continueShopping = document.querySelector('.nav-links .nav-link');
        if (continueShopping) {
            continueShopping.textContent = this.getTranslation('checkout.continueShopping');
        }
        
        // Secure badge
        const secureBadge = document.querySelector('.secure-badge');
        if (secureBadge) {
            const svg = secureBadge.querySelector('svg');
            secureBadge.innerHTML = '';
            if (svg) secureBadge.appendChild(svg);
            secureBadge.appendChild(document.createTextNode(' ' + this.getTranslation('checkout.secure')));
        }
        
        // Contact section
        const contactTitle = document.querySelector('#contactSection .checkout-title');
        if (contactTitle) contactTitle.textContent = this.getTranslation('checkout.contact');
        
        // Email label
        const emailLabel = document.querySelector('label[for="email"]');
        if (emailLabel) emailLabel.textContent = this.getTranslation('checkout.email');
        
        // Newsletter checkbox
        const newsletterLabel = document.querySelector('#contactSection .checkbox-label span');
        if (newsletterLabel) newsletterLabel.textContent = this.getTranslation('checkout.newsletter');
        
        // Shipping section
        const shippingTitle = document.querySelector('#shippingSection .checkout-title');
        if (shippingTitle) shippingTitle.textContent = this.getTranslation('checkout.shippingAddress');
        
        // Form labels
        const labels = {
            'firstName': 'checkout.firstName',
            'lastName': 'checkout.lastName',
            'address': 'checkout.address',
            'apartment': 'checkout.apartment',
            'city': 'checkout.city',
            'state': 'checkout.state',
            'zip': 'checkout.zip',
            'phone': 'checkout.phone',
            'email': 'checkout.email',
            'cardNumber': 'checkout.cardNumber',
            'expiry': 'checkout.expiry',
            'cvv': 'checkout.cvv',
            'cardName': 'checkout.nameOnCard'
        };
        
        Object.keys(labels).forEach(id => {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                label.textContent = this.getTranslation(labels[id]);
            }
        });
        
        // Shipping method section
        const shippingMethodTitle = document.querySelector('#shippingMethodSection .checkout-title');
        if (shippingMethodTitle) shippingMethodTitle.textContent = this.getTranslation('checkout.shippingMethod');
        
        // Shipping options
        const shippingNames = document.querySelectorAll('.shipping-name');
        const shippingTimes = document.querySelectorAll('.shipping-time');
        if (shippingNames.length >= 2) {
            shippingNames[0].textContent = this.getTranslation('checkout.standardShipping');
            shippingNames[1].textContent = this.getTranslation('checkout.expressShipping');
        }
        if (shippingTimes.length >= 2) {
            shippingTimes[0].textContent = this.getTranslation('checkout.standardTime');
            shippingTimes[1].textContent = this.getTranslation('checkout.expressTime');
        }
        
        // Payment section
        const paymentTitle = document.querySelector('#paymentSection .checkout-title');
        if (paymentTitle) paymentTitle.textContent = this.getTranslation('checkout.payment');
        
        const paymentNote = document.querySelector('.payment-note');
        if (paymentNote) paymentNote.textContent = this.getTranslation('checkout.secureNote');
        
        const creditCardLabel = document.querySelector('.payment-method span');
        if (creditCardLabel) creditCardLabel.textContent = this.getTranslation('checkout.creditCard');
        
        // Save info checkbox
        const saveInfoLabel = document.querySelector('#paymentSection .checkbox-label span');
        if (saveInfoLabel) saveInfoLabel.textContent = this.getTranslation('checkout.saveInfo');
        
        // Place order button
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        if (placeOrderBtn && !placeOrderBtn.disabled) {
            placeOrderBtn.textContent = this.getTranslation('checkout.completeOrder');
        }
        
        // Order summary
        const summaryTitle = document.querySelector('.summary-title');
        if (summaryTitle) summaryTitle.textContent = this.getTranslation('checkout.orderSummary');
        
        // Discount code
        const discountInput = document.getElementById('discountCode');
        if (discountInput) discountInput.placeholder = this.getTranslation('checkout.discountCode');
        
        const applyBtn = document.getElementById('applyDiscount');
        if (applyBtn) applyBtn.textContent = this.getTranslation('checkout.apply');
        
        // Totals
        const totalLabels = document.querySelectorAll('.summary-line span:first-child');
        if (totalLabels.length >= 3) {
            totalLabels[0].textContent = this.getTranslation('checkout.subtotal');
            totalLabels[1].textContent = this.getTranslation('checkout.shipping');
            totalLabels[2].textContent = this.getTranslation('checkout.total');
        }
        
        const discountLabel = document.querySelector('#discountLine span:first-child');
        if (discountLabel) discountLabel.textContent = this.getTranslation('checkout.discount');
    },
    
    // Add language selector to navigation
    addLanguageSelector() {
        // Check if selector already exists
        if (document.getElementById('languageSelector')) return;
        
        // Find nav actions container
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;
        
        // Create language selector
        const selector = document.createElement('div');
        selector.className = 'language-selector';
        selector.id = 'languageSelector';
        
        const currentLang = LANGUAGE_METADATA[this.currentLang];
        
        selector.innerHTML = `
            <button class="language-btn" id="languageBtn" aria-label="Select language">
                <span class="language-flag">${currentLang.flag}</span>
                <span class="language-code">${currentLang.code.toUpperCase()}</span>
            </button>
            <div class="language-dropdown" id="languageDropdown">
                ${Object.keys(LANGUAGE_METADATA).map(lang => {
                    const meta = LANGUAGE_METADATA[lang];
                    return `
                        <button class="language-option ${lang === this.currentLang ? 'active' : ''}" 
                                data-lang="${lang}" 
                                aria-label="Switch to ${meta.name}">
                            <span class="language-flag">${meta.flag}</span>
                            <span class="language-name">${meta.name}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
        
        // Insert before mobile menu button
        const mobileMenuBtn = navActions.querySelector('.mobile-menu-btn');
        if (mobileMenuBtn) {
            navActions.insertBefore(selector, mobileMenuBtn);
        } else {
            navActions.appendChild(selector);
        }
        
        // Add event listeners
        const languageBtn = document.getElementById('languageBtn');
        const languageDropdown = document.getElementById('languageDropdown');
        
        languageBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            selector.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            selector.classList.remove('active');
        });
        
        // Language option click handlers
        selector.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const lang = option.getAttribute('data-lang');
                this.setLanguage(lang);
                selector.classList.remove('active');
            });
        });
    },
    
    // Update language selector UI
    updateLanguageSelector() {
        const selector = document.getElementById('languageSelector');
        if (!selector) return;
        
        const currentLang = LANGUAGE_METADATA[this.currentLang];
        const flag = selector.querySelector('.language-flag');
        const code = selector.querySelector('.language-code');
        
        if (flag) flag.textContent = currentLang.flag;
        if (code) code.textContent = currentLang.code.toUpperCase();
        
        // Update active state in dropdown
        selector.querySelectorAll('.language-option').forEach(option => {
            const lang = option.getAttribute('data-lang');
            option.classList.toggle('active', lang === this.currentLang);
        });
    },
    
    // Get current language
    getCurrentLang() {
        return this.currentLang;
    },
    
    // Get current direction
    getCurrentDir() {
        return LANGUAGE_METADATA[this.currentLang].dir;
    },
    
    // Check if current language is RTL
    isRTL() {
        return this.getCurrentDir() === 'rtl';
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
});

// Make I18n globally available
window.I18n = I18n;
