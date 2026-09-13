import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

function cookieOptions() {
    return {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    };
}

export function generateCSRFToken() {
    return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

function tokensMatch(cookieToken, requestToken) {
    if (!/^[a-f0-9]{64}$/i.test(cookieToken || '')) return false;
    if (!/^[a-f0-9]{64}$/i.test(requestToken || '')) return false;

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

    if (!cookieToken || !requestToken) {
        return res.status(403).json({
            success: false,
            error: 'Security token missing',
            code: 'CSRF_MISSING'
        });
    }

    if (!tokensMatch(cookieToken, requestToken)) {
        return res.status(403).json({
            success: false,
            error: 'Invalid security token',
            code: 'CSRF_INVALID'
        });
    }

    const newToken = generateCSRFToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, cookieOptions());
    req.csrfToken = newToken;
    next();
}

export function csrfToken(req, res, next) {
    let token = req.cookies?.[CSRF_COOKIE_NAME];

    if (!/^[a-f0-9]{64}$/i.test(token || '')) {
        token = generateCSRFToken();
        res.cookie(CSRF_COOKIE_NAME, token, cookieOptions());
    }

    req.csrfToken = token;
    res.locals.csrfToken = token;
    next();
}

export default { csrfProtection, csrfToken, generateCSRFToken };
