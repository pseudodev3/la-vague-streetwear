/**
 * LA VAGUE - Input Validation Middleware
 */

import { body, param, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

export const validateCreateOrder = [
    body('customerEmail')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('customerName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .escape()
        .withMessage('Name must be between 2 and 100 characters'),
    body('customerPhone')
        .optional()
        .trim()
        .matches(/^[\d\s\-+()]{7,20}$/)
        .withMessage('Invalid phone number format'),
    body('shippingAddress')
        .isObject()
        .withMessage('Shipping address is required'),
    body('shippingAddress.address')
        .trim()
        .isLength({ min: 5, max: 200 })
        .escape()
        .withMessage('Address must be between 5 and 200 characters'),
    body('shippingAddress.apartment')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .escape()
        .withMessage('Apartment must be less than 100 characters'),
    body('shippingAddress.city')
        .trim()
        .isLength({ min: 2, max: 50 })
        .escape()
        .withMessage('City must be between 2 and 50 characters'),
    body('shippingAddress.state')
        .trim()
        .isLength({ min: 2, max: 50 })
        .escape()
        .withMessage('State must be between 2 and 50 characters'),
    body('shippingAddress.zip')
        .trim()
        .matches(/^[\w\-\s]{3,10}$/)
        .withMessage('Invalid zip/postal code'),
    body('shippingMethod')
        .optional()
        .trim()
        .isIn(['standard', 'express'])
        .withMessage('Invalid shipping method'),
    body('items')
        .isArray({ min: 1, max: 50 })
        .withMessage('Order must contain 1-50 items'),
    body('items.*.id')
        .trim()
        .matches(/^[\w-]{1,50}$/)
        .withMessage('Invalid item ID'),
    body('items.*.quantity')
        .isInt({ min: 1, max: 100 })
        .withMessage('Quantity must be between 1 and 100'),
    body('items.*.color')
        .trim()
        .isLength({ min: 1, max: 80 })
        .escape()
        .withMessage('Invalid item color'),
    body('items.*.size')
        .trim()
        .isLength({ min: 1, max: 40 })
        .escape()
        .withMessage('Invalid item size'),
    body('discountCode')
        .optional({ nullable: true })
        .trim()
        .isLength({ min: 1, max: 50 })
        .matches(/^[A-Za-z0-9_-]+$/)
        .withMessage('Invalid discount code'),
    body('total')
        .isInt({ min: 0, max: 10000000 })
        .withMessage('Invalid total'),
    body('paymentMethod')
        .trim()
        .isIn(['manual', 'paystack', 'cash'])
        .withMessage('Invalid payment method'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .escape()
        .withMessage('Notes must be less than 1000 characters'),
    handleValidationErrors
];

export const validateAdminLogin = [
    body('password')
        .isString()
        .isLength({ min: 1, max: 200 })
        .withMessage('Password is required'),
    handleValidationErrors
];

export const validateUpdateOrderStatus = [
    param('id')
        .trim()
        .matches(/^[\w-]{3,50}$/)
        .withMessage('Invalid order ID format'),
    body('status')
        .trim()
        .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
        .withMessage('Invalid status value'),
    handleValidationErrors
];

export const validateContactForm = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .escape()
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('subject')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .escape()
        .withMessage('Subject must be less than 200 characters'),
    body('message')
        .trim()
        .isLength({ min: 10, max: 5000 })
        .escape()
        .withMessage('Message must be between 10 and 5000 characters'),
    handleValidationErrors
];

export const validateId = (field = 'id') => [
    param(field)
        .trim()
        .matches(/^[\w-]{3,50}$/)
        .withMessage(`Invalid ${field} format`),
    handleValidationErrors
];
