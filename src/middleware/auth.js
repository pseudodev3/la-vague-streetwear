import { query, USE_POSTGRES } from '../config/db.js';
import { APIError } from './errorHandler.js';

export async function verifyAdminToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(401).json({ success: false, error: 'Invalid token format', code: 'AUTH_ERROR' });
    }

    try {
        let session;

        if (USE_POSTGRES) {
            const result = await query('SELECT * FROM admin_sessions WHERE session_key = $1 AND expires_at > CURRENT_TIMESTAMP', [token]);
            session = result.rows[0];
        } else {
            session = (await query('SELECT * FROM admin_sessions WHERE session_key = ? AND expires_at > datetime("now")', [token])).rows[0];
        }

        if (!session) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'AUTH_ERROR' });
        }

        req.adminToken = token;
        next();
    } catch (error) {
        console.error('[ADMIN] Token verification error:', error);
        throw new APIError('Token verification failed', 500, 'INTERNAL_ERROR');
    }
}
