/**
 * LA VAGUE - Sentry Browser SDK for Frontend Error Tracking
 * Include this script in your HTML pages for automatic error tracking
 */

(function() {
    'use strict';

    // Sentry DSN - Replace with your actual DSN
    const SENTRY_DSN = window.SENTRY_DSN || null;
    
    // Environment
    const ENVIRONMENT = window.location.hostname === 'localhost' ? 'development' : 'production';
    const RELEASE = '1.1.0';
    
    // Check if Sentry should be enabled
    if (!SENTRY_DSN) {
        return;
    }

    // Load Sentry SDK
    const script = document.createElement('script');
    script.src = 'https://browser.sentry-cdn.com/7.100.0/bundle.tracing.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = initSentry;
    script.onerror = function() {
        console.error('[SENTRY] Failed to load Sentry SDK');
    };
    document.head.appendChild(script);

    function initSentry() {
        if (typeof Sentry === 'undefined') {
            console.error('[SENTRY] Sentry object not available');
            return;
        }

        try {
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: ENVIRONMENT,
                release: RELEASE,
                
                // Performance monitoring
                integrations: [
                    new Sentry.BrowserTracing({
                        // Trace requests to backend
                        tracePropagationTargets: [
                            'localhost',
                            /^https:\/\/la-vague-api\.onrender\.com/,
                            /^https:\/\/.*\.la-vague\.store/
                        ],
                    }),
                ],
                
                // Sample rate for performance monitoring
                tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
                
                // Replay session recording (optional, for debugging)
                replaysSessionSampleRate: 0,
                replaysOnErrorSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
                
                // Before sending, sanitize sensitive data
                beforeSend(event) {
                    // Remove sensitive information from URL
                    if (event.request?.url) {
                        event.request.url = event.request.url.replace(
                            /(password|token|secret|key)=([^&]+)/gi,
                            '$1=[REDACTED]'
                        );
                    }
                    
                    // Filter out common non-actionable errors
                    if (event.exception?.values?.[0]) {
                        const error = event.exception.values[0];
                        const ignorePatterns = [
                            'ResizeObserver loop limit exceeded',
                            'ResizeObserver loop completed with undelivered notifications',
                            'Non-Error promise rejection captured with value: Object Not Found Matching Id',
                            'NetworkError when attempting to fetch resource',
                            'Failed to fetch',
                            'AbortError: The user aborted a request',
                            'The operation was aborted',
                            'The operation is insecure',
                            'Script error',
                            'SyntaxError: Unexpected token',
                            'favicon.ico',
                            'robots.txt',
                            'sitemap.xml',
                            'chrome-extension://',
                            'moz-extension://',
                        ];
                        
                        if (ignorePatterns.some(pattern => 
                            error.value?.includes(pattern) || 
                            error.type?.includes(pattern)
                        )) {
                            return null;
                        }
                    }
                    
                    return event;
                },
                
                // Ignore specific errors
                ignoreErrors: [
                    // Network errors
                    'Network Error',
                    'NetworkError',
                    'Request aborted',
                    'TimeoutError',
                    'AbortError',
                    // Browser extensions
                    'chrome-extension',
                    'moz-extension',
                    'webkit-masked-url',
                    // Third-party scripts
                    'Non-Error exception captured',
                    'Non-Error promise rejection captured',
                    // Common benign errors
                    'ResizeObserver loop',
                    'Navigation cancelled',
                    'cancelled',
                ],
                
                // Deny URLs (ads, extensions, etc.)
                denyUrls: [
                    // Chrome extensions
                    /^chrome:\/\//i,
                    /^chrome-extension:\/\//i,
                    // Firefox extensions
                    /^moz-extension:\/\//i,
                    // Edge extensions
                    /^ms-browser-extension:\/\//i,
                    // Google Translate
                    /translate\.google\.com/,
                    // Facebook
                    /connect\.facebook\.net/,
                    // Common ad scripts
                    /googleads\.g\.doubleclick\.net/,
                    /pagead\/js\/adsbygoogle/,
                ],
            });

            // Set user context if available
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail) {
                Sentry.setUser({ email: userEmail });
            }

            // Set tags
            Sentry.setTag('page', window.location.pathname);
            Sentry.setTag('component', 'frontend');

            // Expose Sentry to window for manual error capture
            window.SentryClient = Sentry;
            
        } catch (error) {
            console.error('[SENTRY] Failed to initialize:', error);
        }
    }
})();

/**
 * Helper function to manually capture exceptions
 * Usage: captureException(new Error('Something went wrong'));
 */
function captureException(error, context) {
    if (window.SentryClient) {
        if (context) {
            window.SentryClient.withScope((scope) => {
                if (context.tags) {
                    Object.entries(context.tags).forEach(([key, value]) => {
                        scope.setTag(key, value);
                    });
                }
                if (context.extra) {
                    Object.entries(context.extra).forEach(([key, value]) => {
                        scope.setExtra(key, value);
                    });
                }
                window.SentryClient.captureException(error);
            });
        } else {
            window.SentryClient.captureException(error);
        }
    } else {
        console.error('[ERROR]', error);
    }
}

/**
 * Helper function to capture messages
 * Usage: captureMessage('User completed checkout', 'info');
 */
function captureMessage(message, level = 'info') {
    if (window.SentryClient) {
        window.SentryClient.captureMessage(message, level);
    } else {
        // Silent in production if Sentry not available
    }
}

// Expose helpers globally
window.captureException = captureException;
window.captureMessage = captureMessage;
