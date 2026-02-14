/**
 * LA VAGUE - CSRF Protection Middleware
 * Simple Double Submit Cookie pattern for CSRF protection
 */

import crypto from 'crypto';

// CSRF Token configuration
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken() {
    return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * CSRF Protection Middleware
 * Uses Double Submit Cookie pattern:
 * 1. Sets a cookie with the CSRF token
 * 2. Requires the same token in the request header or body
 */
export function csrfProtection(req, res, next) {
    // Skip CSRF for GET, HEAD, OPTIONS requests (they should be safe)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // Set a new CSRF token cookie for forms to use
        if (!req.cookies || !req.cookies[CSRF_COOKIE_NAME]) {
            const token = generateCSRFToken();
            res.cookie(CSRF_COOKIE_NAME, token, {
                httpOnly: false, // Must be accessible by JavaScript
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            req.csrfToken = token;
        } else {
            req.csrfToken = req.cookies[CSRF_COOKIE_NAME];
        }
        return next();
    }

    // For state-changing methods, validate CSRF token
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];
    const bodyToken = req.body?._csrf;

    // Accept token from header or body
    const requestToken = headerToken || bodyToken;

    if (!cookieToken || !requestToken) {
        return res.status(403).json({
            success: false,
            error: 'CSRF token missing',
            code: 'CSRF_MISSING'
        });
    }

    // Use timing-safe comparison to prevent timing attacks
    try {
        const cookieBuffer = Buffer.from(cookieToken, 'hex');
        const requestBuffer = Buffer.from(requestToken, 'hex');
        
        if (cookieBuffer.length !== requestBuffer.length || 
            !crypto.timingSafeEqual(cookieBuffer, requestBuffer)) {
            return res.status(403).json({
                success: false,
                error: 'Invalid CSRF token',
                code: 'CSRF_INVALID'
            });
        }
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'CSRF validation failed',
            code: 'CSRF_ERROR'
        });
    }

    // Generate new token after successful validation (token rotation)
    const newToken = generateCSRFToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    });
    req.csrfToken = newToken;

    next();
}

/**
 * Middleware to get/set CSRF token without full protection
 * Useful for public endpoints that need optional protection
 */
export function csrfToken(req, res, next) {
    let token = req.cookies?.[CSRF_COOKIE_NAME];
    
    if (!token) {
        token = generateCSRFToken();
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });
    }
    
    req.csrfToken = token;
    res.locals.csrfToken = token;
    next();
}

/**
 * Optional CSRF protection - validates if token is present
 * but doesn't reject requests without it
 */
export function optionalCSRF(req, res, next) {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];
    const bodyToken = req.body?._csrf;
    const requestToken = headerToken || bodyToken;

    if (cookieToken && requestToken) {
        try {
            const cookieBuffer = Buffer.from(cookieToken, 'hex');
            const requestBuffer = Buffer.from(requestToken, 'hex');
            
            if (cookieBuffer.length === requestBuffer.length && 
                crypto.timingSafeEqual(cookieBuffer, requestBuffer)) {
                req.csrfValidated = true;
            }
        } catch (error) {
            // Invalid tokens, but we don't reject
        }
    }

    // Generate/refresh token
    const newToken = generateCSRFToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    });
    req.csrfToken = newToken;
    
    next();
}

export default { csrfProtection, csrfToken, optionalCSRF, generateCSRFToken };
