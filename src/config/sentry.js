/**
 * LA VAGUE - Sentry Error Tracking Configuration
 * Monitors errors and performance in both backend and frontend
 */

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.RELEASE || '1.1.0';

// Track if Sentry is initialized
let isSentryInitialized = false;

/**
 * Initialize Sentry for backend
 */
export function initSentry() {
    if (!SENTRY_DSN) {
        return false;
    }

    try {
        Sentry.init({
            dsn: SENTRY_DSN,
            environment: ENVIRONMENT,
            release: RELEASE,
            
            // Performance monitoring - sample 10% in production
            tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
            
            // Integrations - keep it simple
            integrations: [
                new Sentry.Integrations.Http({ tracing: true }),
            ],
            
            // Before sending, sanitize sensitive data
            beforeSend(event) {
                try {
                    // Remove sensitive information from request
                    if (event && typeof event === 'object' && event.request) {
                        if (event.request.cookies) delete event.request.cookies;
                        if (event.request.headers) {
                            delete event.request.headers.cookie;
                            delete event.request.headers.authorization;
                        }
                    }
                    
                    // Filter out common bot errors
                    if (event?.exception?.values?.[0]?.value) {
                        const errorMessage = String(event.exception.values[0].value);
                        const ignorePatterns = [
                            'favicon.ico',
                            'robots.txt',
                            'sitemap.xml',
                            '/wp-admin/',
                            '/wp-login/',
                            '/admin/',
                            '/config/',
                            '/.env',
                            '/.git/',
                        ];
                        
                        if (ignorePatterns.some(pattern => errorMessage.includes(pattern))) {
                            return null;
                        }
                    }
                } catch (e) {
                    // If sanitization fails, still send the event
                    console.error('[SENTRY] beforeSend error:', e.message);
                }
                
                return event;
            },
            
            // Ignore specific errors
            ignoreErrors: [
                'ResizeObserver loop limit exceeded',
                'Network Error',
                'Request aborted',
                'TimeoutError',
            ],
        });

        isSentryInitialized = true;
        console.log('[SENTRY] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[SENTRY] Failed to initialize:', error.message);
        isSentryInitialized = false;
        return false;
    }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user) {
    if (!isSentryInitialized) return;
    
    try {
        Sentry.setUser({
            id: user.id || user.email,
            email: user.email,
            username: user.name,
        });
    } catch (e) {
        console.error('[SENTRY] setUserContext error:', e.message);
    }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
    if (!isSentryInitialized) return;
    try {
        Sentry.setUser(null);
    } catch (e) {
        console.error('[SENTRY] clearUserContext error:', e.message);
    }
}

/**
 * Capture exception with additional context
 */
export function captureException(error, context = {}) {
    if (!isSentryInitialized) {
        console.error('[ERROR]', error);
        return;
    }
    
    try {
        Sentry.withScope((scope) => {
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
            
            if (context.level) {
                scope.setLevel(context.level);
            }
            
            Sentry.captureException(error);
        });
    } catch (e) {
        console.error('[ERROR]', error);
        console.error('[SENTRY] captureException error:', e.message);
    }
}

/**
 * Capture message
 */
export function captureMessage(message, level = 'info') {
    if (!isSentryInitialized) {
        console.log(`[${level.toUpperCase()}]`, message);
        return;
    }
    
    try {
        Sentry.captureMessage(message, level);
    } catch (e) {
        console.log(`[${level.toUpperCase()}]`, message);
    }
}

/**
 * Create Sentry request handler middleware
 */
export function sentryRequestHandler() {
    if (!isSentryInitialized) {
        return (req, res, next) => next();
    }
    try {
        return Sentry.Handlers.requestHandler();
    } catch (e) {
        console.error('[SENTRY] requestHandler error:', e.message);
        return (req, res, next) => next();
    }
}

/**
 * Create Sentry tracing middleware
 */
export function sentryTracingHandler() {
    if (!isSentryInitialized) {
        return (req, res, next) => next();
    }
    try {
        return Sentry.Handlers.tracingHandler();
    } catch (e) {
        console.error('[SENTRY] tracingHandler error:', e.message);
        return (req, res, next) => next();
    }
}

/**
 * Create Sentry error handler middleware (must be last)
 */
export function sentryErrorHandler() {
    if (!isSentryInitialized) {
        return (err, req, res, next) => next(err);
    }
    try {
        return Sentry.Handlers.errorHandler();
    } catch (e) {
        console.error('[SENTRY] errorHandler error:', e.message);
        return (err, req, res, next) => next(err);
    }
}

export { Sentry, isSentryInitialized };
