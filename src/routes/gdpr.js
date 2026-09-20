import express from 'express';

const router = express.Router();

const privacyRequestUnavailable = (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Self-service privacy requests are unavailable until requester identity can be verified.',
        code: 'PRIVACY_IDENTITY_VERIFICATION_REQUIRED',
        contact: 'support@la-vague.store'
    });
};

/**
 * Privacy exports and deletion must never rely on an email address alone.
 * Customers can request access, correction, portability, restriction or deletion
 * through support while an identity-verification workflow is implemented.
 */
router.post('/export', privacyRequestUnavailable);
router.post('/delete', privacyRequestUnavailable);

export default router;
