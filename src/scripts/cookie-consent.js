/**
 * LA VAGUE - Cookie Consent Manager
 * GDPR/CCPA compliant cookie consent banner
 */

(function() {
    'use strict';

    const CONSENT_KEY = 'la-vague-cookie-consent';
    const CONSENT_VERSION = '1.0';

    // Cookie consent configuration
    const config = {
        position: 'bottom',
        theme: 'dark',
        dismissOnScroll: false,
        dismissOnTimeout: false,
        showPreferences: true
    };

    // Cookie categories
    const categories = {
        necessary: {
            name: 'Necessary',
            description: 'Required for the website to function properly. Cannot be disabled.',
            required: true,
            cookies: ['csrf-token', 'session', 'locale-preference']
        },
        analytics: {
            name: 'Analytics',
            description: 'Helps us understand how visitors interact with our website.',
            required: false,
            cookies: ['_ga', '_gid', '_gat', '_gcl_au']
        },
        marketing: {
            name: 'Marketing',
            description: 'Used to deliver personalized advertisements.',
            required: false,
            cookies: ['_fbp', 'fr', 'test_cookie']
        },
        preferences: {
            name: 'Preferences',
            description: 'Remember your settings and preferences.',
            required: false,
            cookies: ['currency', 'language', 'cart-items']
        }
    };

    // Get stored consent
    function getConsent() {
        try {
            const stored = localStorage.getItem(CONSENT_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === CONSENT_VERSION) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('[CookieConsent] Error reading consent:', e);
        }
        return null;
    }

    // Save consent
    function saveConsent(choices) {
        const consent = {
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
            choices: choices
        };
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
            return true;
        } catch (e) {
            console.error('[CookieConsent] Error saving consent:', e);
            return false;
        }
    }

    // Check if specific category is allowed
    function isAllowed(category) {
        const consent = getConsent();
        if (!consent) return false;
        if (categories[category]?.required) return true;
        return consent.choices[category] === true;
    }

    // Create banner HTML
    function createBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.className = `cookie-consent-banner cookie-consent-${config.position}`;
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <h3>🍪 Cookie Preferences</h3>
                    <p>We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. <a href="/privacy-policy.html" class="cookie-consent-link">Learn more</a></p>
                </div>
                <div class="cookie-consent-actions">
                    <button type="button" class="cookie-btn cookie-btn-secondary" id="cookie-preferences-btn">
                        Preferences
                    </button>
                    <button type="button" class="cookie-btn cookie-btn-outline" id="cookie-reject-btn">
                        Reject All
                    </button>
                    <button type="button" class="cookie-btn cookie-btn-primary" id="cookie-accept-btn">
                        Accept All
                    </button>
                </div>
            </div>
        `;
        return banner;
    }

    // Create preferences modal HTML
    function createPreferencesModal() {
        const modal = document.createElement('div');
        modal.id = 'cookie-preferences-modal';
        modal.className = 'cookie-consent-modal';
        modal.style.display = 'none';
        
        let categoriesHtml = '';
        for (const [key, category] of Object.entries(categories)) {
            const isRequired = category.required;
            const checked = isRequired ? 'checked disabled' : '';
            categoriesHtml += `
                <div class="cookie-category">
                    <div class="cookie-category-header">
                        <label class="cookie-toggle">
                            <input type="checkbox" name="cookie-category-${key}" ${checked} data-category="${key}">
                            <span class="cookie-toggle-slider"></span>
                        </label>
                        <span class="cookie-category-name">${category.name}</span>
                        ${isRequired ? '<span class="cookie-required">Required</span>' : ''}
                    </div>
                    <p class="cookie-category-desc">${category.description}</p>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="cookie-modal-overlay"></div>
            <div class="cookie-modal-content">
                <div class="cookie-modal-header">
                    <h3>Cookie Preferences</h3>
                    <button type="button" class="cookie-modal-close" id="cookie-modal-close">&times;</button>
                </div>
                <div class="cookie-modal-body">
                    <p>Manage your cookie preferences below. Necessary cookies are always enabled as they are required for the website to function.</p>
                    ${categoriesHtml}
                </div>
                <div class="cookie-modal-footer">
                    <button type="button" class="cookie-btn cookie-btn-secondary" id="cookie-save-preferences">Save Preferences</button>
                    <button type="button" class="cookie-btn cookie-btn-primary" id="cookie-accept-all-modal">Accept All</button>
                </div>
            </div>
        `;
        return modal;
    }

    // Add styles
    function addStyles() {
        if (document.getElementById('cookie-consent-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cookie-consent-styles';
        styles.textContent = `
            /* Cookie Consent Banner */
            .cookie-consent-banner {
                position: fixed;
                left: 0;
                right: 0;
                background: #1a1a1a;
                color: #fff;
                padding: 1.5rem;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
                animation: cookie-slide-up 0.4s ease-out;
            }
            
            @keyframes cookie-slide-up {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .cookie-consent-bottom {
                bottom: 0;
            }
            
            .cookie-consent-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                gap: 2rem;
                align-items: center;
                justify-content: space-between;
            }
            
            @media (max-width: 768px) {
                .cookie-consent-content {
                    flex-direction: column;
                    gap: 1rem;
                    text-align: center;
                }
            }
            
            .cookie-consent-text h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .cookie-consent-text p {
                margin: 0;
                font-size: 0.9rem;
                line-height: 1.5;
                color: #ccc;
            }
            
            .cookie-consent-link {
                color: #dc2626;
                text-decoration: underline;
            }
            
            .cookie-consent-link:hover {
                color: #ef4444;
            }
            
            .cookie-consent-actions {
                display: flex;
                gap: 0.75rem;
                flex-shrink: 0;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .cookie-btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 6px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .cookie-btn-primary {
                background: #dc2626;
                color: #fff;
            }
            
            .cookie-btn-primary:hover {
                background: #b91c1c;
            }
            
            .cookie-btn-secondary {
                background: #374151;
                color: #fff;
            }
            
            .cookie-btn-secondary:hover {
                background: #4b5563;
            }
            
            .cookie-btn-outline {
                background: transparent;
                color: #fff;
                border: 1px solid #6b7280;
            }
            
            .cookie-btn-outline:hover {
                background: rgba(255,255,255,0.1);
            }
            
            /* Modal */
            .cookie-consent-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .cookie-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(4px);
            }
            
            .cookie-modal-content {
                position: relative;
                background: #1a1a1a;
                color: #fff;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                animation: cookie-modal-appear 0.3s ease-out;
            }
            
            @keyframes cookie-modal-appear {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            .cookie-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid #374151;
            }
            
            .cookie-modal-header h3 {
                margin: 0;
                font-size: 1.25rem;
            }
            
            .cookie-modal-close {
                background: none;
                border: none;
                color: #9ca3af;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s;
            }
            
            .cookie-modal-close:hover {
                background: #374151;
                color: #fff;
            }
            
            .cookie-modal-body {
                padding: 1.5rem;
            }
            
            .cookie-modal-body > p {
                margin: 0 0 1.5rem 0;
                color: #9ca3af;
                font-size: 0.9rem;
            }
            
            .cookie-category {
                padding: 1rem 0;
                border-bottom: 1px solid #374151;
            }
            
            .cookie-category:last-child {
                border-bottom: none;
            }
            
            .cookie-category-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 0.5rem;
            }
            
            .cookie-category-name {
                font-weight: 600;
            }
            
            .cookie-required {
                font-size: 0.75rem;
                background: #374151;
                color: #9ca3af;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
            }
            
            .cookie-category-desc {
                margin: 0;
                font-size: 0.85rem;
                color: #9ca3af;
                padding-left: 3.5rem;
            }
            
            /* Toggle Switch */
            .cookie-toggle {
                position: relative;
                display: inline-block;
                width: 48px;
                height: 26px;
                cursor: pointer;
            }
            
            .cookie-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .cookie-toggle-slider {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #374151;
                border-radius: 26px;
                transition: 0.3s;
            }
            
            .cookie-toggle-slider:before {
                content: "";
                position: absolute;
                height: 20px;
                width: 20px;
                left: 3px;
                bottom: 3px;
                background: #fff;
                border-radius: 50%;
                transition: 0.3s;
            }
            
            .cookie-toggle input:checked + .cookie-toggle-slider {
                background: #dc2626;
            }
            
            .cookie-toggle input:checked + .cookie-toggle-slider:before {
                transform: translateX(22px);
            }
            
            .cookie-toggle input:disabled + .cookie-toggle-slider {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .cookie-modal-footer {
                display: flex;
                gap: 0.75rem;
                padding: 1.5rem;
                border-top: 1px solid #374151;
                justify-content: flex-end;
            }
            
            @media (max-width: 480px) {
                .cookie-modal-footer {
                    flex-direction: column;
                }
                .cookie-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Initialize the banner
    function init() {
        // Check if consent already given
        if (getConsent()) {
            return;
        }

        // Add styles
        addStyles();

        // Create and append banner
        const banner = createBanner();
        document.body.appendChild(banner);

        // Create and append modal
        const modal = createPreferencesModal();
        document.body.appendChild(modal);

        // Bind events
        bindEvents(banner, modal);
    }

    // Bind event listeners
    function bindEvents(banner, modal) {
        // Accept all
        banner.querySelector('#cookie-accept-btn').addEventListener('click', () => {
            const choices = {};
            for (const key of Object.keys(categories)) {
                choices[key] = true;
            }
            saveConsent(choices);
            banner.remove();
            modal.remove();
        });

        // Reject all
        banner.querySelector('#cookie-reject-btn').addEventListener('click', () => {
            const choices = {};
            for (const [key, category] of Object.entries(categories)) {
                choices[key] = category.required;
            }
            saveConsent(choices);
            banner.remove();
            modal.remove();
        });

        // Open preferences
        banner.querySelector('#cookie-preferences-btn').addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        // Close modal
        modal.querySelector('#cookie-modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.querySelector('.cookie-modal-overlay').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // User choice: grant full access
        modal.querySelector('#cookie-accept-all-modal').addEventListener('click', () => {
            const choices = {};
            for (const key of Object.keys(categories)) {
                choices[key] = true;
            }
            saveConsent(choices);
            banner.remove();
            modal.style.display = 'none';
            modal.remove();
        });

        // Save preferences
        modal.querySelector('#cookie-save-preferences').addEventListener('click', () => {
            const choices = {};
            modal.querySelectorAll('[data-category]').forEach(checkbox => {
                choices[checkbox.dataset.category] = checkbox.checked;
            });
            saveConsent(choices);
            banner.remove();
            modal.style.display = 'none';
            modal.remove();
        });
    }

    // Public API
    window.CookieConsent = {
        init,
        getConsent,
        isAllowed,
        categories
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
