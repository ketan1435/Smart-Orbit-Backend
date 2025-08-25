import passport from 'passport';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError.js';

const verifyCallback = (req, resolve, reject) => async (err, user, info) => {
    if (err || info || !user) {
        if (info) {
            if (info.name === 'TokenExpiredError') {
                return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Your session has expired. Please log in again.'));
            }
            if (info.name === 'JsonWebTokenError') {
                return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token. Please log in again.'));
            }
        }
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }

    // Check if user has permission to access quote functionality
    const allowedRoles = ['site-engineer', 'planning-engineer', 'admin'];
    if (!allowedRoles.includes(user.role)) {
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Access denied. Only site engineers and planning engineers can manage quotes.'));
    }

    req.user = user;
    resolve();
};

const quoteAuth = () => async (req, res, next) => {
    return new Promise((resolve, reject) => {
        passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject))(req, res, next);
    })
        .then(() => next())
        .catch((err) => next(err));
};

export default quoteAuth;
