/**
 * LA VAGUE - Centralized Error Handling
 */

/**
 * Custom API Error class
 */
export class APIError extends Error {
    constructor(message, statusCode, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error types for consistent handling
 */
export const ErrorTypes = {
    VALIDATION: { code: 'VALIDATION_ERROR', status: 400 },
    AUTHENTICATION: { code: 'AUTH_ERROR', status: 401 },
    AUTHORIZATION: { code: 'FORBIDDEN', status: 403 },
    NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
    CONFLICT: { code: 'CONFLICT', status: 409 },
    RATE_LIMIT: { code: 'RATE_LIMIT', status: 429 },
    INTERNAL: { code: 'INTERNAL_ERROR', status: 500 }
};

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let errorCode = err.code || ErrorTypes.INTERNAL.code;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = ErrorTypes.VALIDATION.code;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = ErrorTypes.AUTHENTICATION.code;
    } else if (err.code === '23505') { // PostgreSQL unique violation
        statusCode = 409;
        errorCode = ErrorTypes.CONFLICT.code;
        message = 'Resource already exists';
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        statusCode = 503;
        message = 'Service temporarily unavailable';
    }

    // Log error (but don't expose internals in production)
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.path}:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        code: errorCode,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });

    // Send response
    res.status(statusCode).json({
        success: false,
        error: message,
        code: errorCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`,
        code: ErrorTypes.NOT_FOUND.code
    });
};
