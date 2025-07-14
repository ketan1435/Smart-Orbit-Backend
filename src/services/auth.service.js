import httpStatus from 'http-status';
import Admin from '../models/admin.model.js';
import ApiError from '../utils/ApiError.js';
import { userService } from './index.js';
import * as tokenService from './token.service.js';

/**
 * Login with username and password
 * This function first checks if the user is an admin, then checks if they are a regular user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: (Admin|User), tokens: Object}>}
 */
export const loginUserWithEmailAndPassword = async (email, password) => {
  // First, try to find an admin with the provided email
  let user = await Admin.findOne({ email });

  if (user) {
    // If an admin is found, check their password
    if (!(await user.isPasswordMatch(password))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
    }
  } else {
    // If no admin is found, try to find a regular user
    user = await userService.getUserByEmail(email);
    if (!user || !(await user.isPasswordMatch(password))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
    }
  }
  delete user.password;
  const tokens = await tokenService.generateAuthTokens(user);
  return { user, tokens };
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
export const logout = async (refreshToken) => {
  const refreshTokenDoc = await tokenService.verifyToken(refreshToken, 'refresh');
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.remove();
}; 