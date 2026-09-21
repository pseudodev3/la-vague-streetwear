import { query, USE_POSTGRES } from '../config/db.js';
import { APIError } from './errorHandler.js';
import { ADMIN_SESSION_GENERATION } from '../config/adminSession.js';

export const ADMIN_SESSION_COOKIE = 'la_vague_admin_session';
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function adminSessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: ADMIN_SESSION_TTL_MS,
        path: '/api/admin'
    };
}

function adminSessionClearOptions() {
    const { maxAge, ...options } = adminSessionCookieOptions();
    return options;
}

export function setAdminSessionCookie(res, sessionKey) {
    res.cookie(ADMIN_SESSION_COOKIE, sessionKey, adminSessionCookieOptions());
}

export function clearAdminSessionCookie(res) {
    res.clearCookie(ADMIN_SESSION_COOKIE, adminSessionClearOptions());
}

export async function verifyAdminSession(req, res, next) {
    const sessionKey = req.cookies?.[ADMIN_SESSION_COOKIE];

    if (!sessionKey || !/^[a-f0-9]{64}$/.test(sessionKey)) {
        if (sessionKey) clearAdminSessionCookie(res);
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTH_ERROR'
        });
    }

    try {
        let session;

        if (USE_POSTGRES) {
            const result = await query(
                'SELECT * FROM admin_sessions WHERE session_key = $1 AND expires_at > CURRENT_TIMESTAMP AND session_generation = $2',
                [sessionKey, ADMIN_SESSION_GENERATION]
            );
            session = result.rows[0];
        } else {
            session = (
                await query(
                    "SELECT * FROM admin_sessions WHERE session_key = ? AND expires_at > datetime('now') AND session_generation = ?",
                    [sessionKey, ADMIN_SESSION_GENERATION]
                )
            ).rows[0];
        }

        if (!session) {
            clearAdminSessionCookie(res);
            return res.status(401).json({
                success: false,
                error: 'Session expired or invalid',
                code: 'AUTH_ERROR'
            });
        }

        req.adminSessionKey = sessionKey;
        req.adminSession = session;
        next();
    } catch (error) {
        console.error('[ADMIN] Session verification error:', error);
        next(new APIError('Session verification failed', 500, 'INTERNAL_ERROR'));
    }
}
