/**
 * LA VAGUE - Sentry Error Tracking Configuration
 * Monitors errors and performance in both backend and frontend
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.RELEASE || '1.1.0';

/**
 * Initialize Sentry for backend
 */
export function initSentry() {
    if (!SENTRY_DSN) {
        console.log('[SENTRY] DSN not configured, error tracking disabled');
        return false;
    }

    try {
        Sentry.init({
            dsn: SENTRY_DSN,
            environment: ENVIRONMENT,
            release: RELEASE,
            
            // Performance monitoring
            tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
            
            // Profiling (CPU usage)
            profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
            
            // Integrations
            integrations: [
                new ProfilingIntegration(),
                new Sentry.Integrations.Http({ tracing: true }),
                new Sentry.Integrations.Express({ app: true }),
            ],
            
            // Before sending, sanitize sensitive data
            beforeSend(event) {
                // Remove sensitive information
                if (event.request) {
                    delete event.request.cookies;
                    delete event.request.headers?.cookie;
                    delete event.request.headers?.authorization;
                }
                
                // Filter out common bot errors
                if (event.exception?.values?.[0]?.value) {
                    const errorMessage = event.exception.values[0].value;
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
                
                return event;
            },
            
            // Ignore specific errors
            ignoreErrors: [
                'ResizeObserver loop limit exceeded',
                'Non-Error promise rejection captured with value: Object Not Found Matching Id',
                'Network Error',
                'Request aborted',
                'TimeoutError',
            ],
            
            // Set user context (will be populated per request)
            initialScope: {
                tags: {
                    component: 'backend',
                },
            },
        });

        console.log('[SENTRY] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[SENTRY] Failed to initialize:', error.message);
        return false;
    }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user) {
    if (!SENTRY_DSN) return;
    
    Sentry.setUser({
        id: user.id || user.email,
        email: user.email,
        username: user.name,
    });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
    if (!SENTRY_DSN) return;
    Sentry.setUser(null);
}

/**
 * Capture exception with additional context
 */
export function captureException(error, context = {}) {
    if (!SENTRY_DSN) {
        console.error('[ERROR]', error);
        return;
    }
    
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
}

/**
 * Capture message
 */
export function captureMessage(message, level = 'info') {
    if (!SENTRY_DSN) {
        console.log(`[${level.toUpperCase()}]`, message);
        return;
    }
    
    Sentry.captureMessage(message, level);
}

/**
 * Create Sentry request handler middleware
 */
export function sentryRequestHandler() {
    if (!SENTRY_DSN) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.requestHandler();
}

/**
 * Create Sentry tracing middleware
 */
export function sentryTracingHandler() {
    if (!SENTRY_DSN) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.tracingHandler();
}

/**
 * Create Sentry error handler middleware (must be last)
 */
export function sentryErrorHandler() {
    if (!SENTRY_DSN) {
        return (err, req, res, next) => next(err);
    }
    return Sentry.Handlers.errorHandler();
}

export { Sentry };
