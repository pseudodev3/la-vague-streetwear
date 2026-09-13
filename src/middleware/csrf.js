import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function cookieOptions() {
    return {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    };
}

function isTrustedOrigin(origin) {
    if (!origin) return false;

    const trustedOrigins = [
        process.env.FRONTEND_URL,
        'https://la-vague.store',
        'https://www.la-vague.store',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
    ].filter(Boolean);

    return trustedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin);
}

export function generateCSRFToken() {
    return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

function tokensMatch(cookieToken, requestToken) {
    if (!TOKEN_PATTERN.test(cookieToken || '')) return false;
    if (!TOKEN_PATTERN.test(requestToken || '')) return false;

    const cookieBuffer = Buffer.from(cookieToken, 'hex');
    const requestBuffer = Buffer.from(requestToken, 'hex');
    return (
        cookieBuffer.length === requestBuffer.length &&
        crypto.timingSafeEqual(cookieBuffer, requestBuffer)
    );
}

export function csrfProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const requestToken = req.headers[CSRF_HEADER_NAME] || req.body?._csrf;

    if (!requestToken || !TOKEN_PATTERN.test(requestToken)) {
        return res.status(403).json({
            success: false,
            error: 'Security token missing or invalid',
            code: 'CSRF_MISSING'
        });
    }

    if (cookieToken) {
        if (!tokensMatch(cookieToken, requestToken)) {
            return res.status(403).json({
                success: false,
                error: 'Invalid security token',
                code: 'CSRF_INVALID'
            });
        }
    } else {
        // Legacy browser scripts still call the Render API directly on a few pages.
        // A custom CSRF header triggers CORS preflight, and we only permit this
        // fallback for explicitly trusted storefront origins.
        if (!isTrustedOrigin(req.headers.origin)) {
            return res.status(403).json({
                success: false,
                error: 'Security token cookie missing',
                code: 'CSRF_MISSING'
            });
        }
    }

    const newToken = generateCSRFToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, cookieOptions());
    req.csrfToken = newToken;
    next();
}

export function csrfToken(req, res, next) {
    let token = req.cookies?.[CSRF_COOKIE_NAME];

    if (!TOKEN_PATTERN.test(token || '')) {
        token = generateCSRFToken();
        res.cookie(CSRF_COOKIE_NAME, token, cookieOptions());
    }

    req.csrfToken = token;
    res.locals.csrfToken = token;
    next();
}

export default { csrfProtection, csrfToken, generateCSRFToken };
