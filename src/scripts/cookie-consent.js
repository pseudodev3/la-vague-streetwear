/**
 * LA VAGUE - Browser Storage Notice
 * Explains the essential storage currently used by the storefront.
 */

(function() {
    'use strict';

    const NOTICE_KEY = 'la-vague-storage-notice';
    const NOTICE_VERSION = '3.0';

    function hasAcknowledged() {
        try {
            return localStorage.getItem(NOTICE_KEY) === NOTICE_VERSION;
        } catch {
            return false;
        }
    }

    function acknowledge() {
        try {
            localStorage.setItem(NOTICE_KEY, NOTICE_VERSION);
        } catch {
            // The notice can still be dismissed for the current page if storage is unavailable.
        }
    }

    function addStyles() {
        if (document.getElementById('cookie-consent-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'cookie-consent-styles';
        styles.textContent = `
            .cookie-consent-banner {
                position: fixed;
                right: 1rem;
                bottom: 1rem;
                left: 1rem;
                z-index: 10000;
                width: min(620px, calc(100% - 2rem));
                margin-left: auto;
                padding: 1rem 1.05rem;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 14px;
                background: rgba(18,18,20,.97);
                color: #f4f2ee;
                box-shadow: 0 18px 50px rgba(0,0,0,.38);
                backdrop-filter: blur(12px);
                font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
            }

            .cookie-consent-content {
                display: flex;
                gap: 1rem;
                align-items: center;
                justify-content: space-between;
            }

            .cookie-consent-copy {
                min-width: 0;
            }

            .cookie-consent-kicker {
                display: block;
                margin-bottom: .28rem;
                color: #ff5b62;
                font-size: .62rem;
                font-weight: 720;
                letter-spacing: .11em;
                text-transform: uppercase;
            }

            .cookie-consent-text {
                margin: 0;
                color: #b8b6b1;
                font-size: .79rem;
                line-height: 1.55;
            }

            .cookie-consent-link {
                color: #f4f2ee;
                text-decoration: underline;
                text-decoration-color: rgba(255,91,98,.7);
                text-underline-offset: .2em;
            }

            .cookie-btn {
                min-height: 40px;
                flex: 0 0 auto;
                padding: .65rem .9rem;
                border: 0;
                border-radius: 10px;
                background: #e3262e;
                color: #fff;
                font: inherit;
                font-size: .75rem;
                font-weight: 700;
                cursor: pointer;
                transition: background-color 150ms ease, transform 150ms ease;
            }

            .cookie-btn:hover {
                background: #f03840;
            }

            .cookie-btn:active {
                transform: scale(.97);
            }

            @media (max-width: 620px) {
                .cookie-consent-banner {
                    right: .75rem;
                    bottom: .75rem;
                    left: .75rem;
                    width: auto;
                }

                .cookie-consent-content {
                    align-items: flex-start;
                    flex-direction: column;
                    gap: .8rem;
                }

                .cookie-btn {
                    width: 100%;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .cookie-btn {
                    transition: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    function init() {
        if (hasAcknowledged()) return;

        addStyles();

        const banner = document.createElement('aside');
        banner.id = 'cookie-consent-banner';
        banner.className = 'cookie-consent-banner';
        banner.setAttribute('aria-label', 'Browser storage notice');
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-copy">
                    <span class="cookie-consent-kicker">Privacy & storage</span>
                    <p class="cookie-consent-text">
                        We use necessary browser storage for security and to keep your cart and wishlist working.
                        We do not currently use advertising or analytics cookies.
                        <a href="/privacy-policy" class="cookie-consent-link">Privacy Policy</a>
                    </p>
                </div>
                <button type="button" class="cookie-btn" id="cookie-accept-btn">Got it</button>
            </div>
        `;

        banner.querySelector('#cookie-accept-btn').addEventListener('click', () => {
            acknowledge();
            banner.remove();
        });

        document.body.appendChild(banner);
    }

    window.CookieNotice = {
        init,
        hasAcknowledged
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
