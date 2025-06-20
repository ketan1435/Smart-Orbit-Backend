import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import ApiError from '../utils/ApiError.js';
// import { Store } from '../models/store.model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const register = async (data) => {
  if (await Admin.isEmailTaken(data.email)) {
    throw new ApiError(409, 'Email already taken');
  }

  data.password = await bcrypt.hash(data.password, 10);

  const admin = await Admin.create(data);
  return admin;
};

export const login = async ({ email, password }) => {
  const admin = await Admin.findOne({ email });
  if (!admin) throw new ApiError(404, 'Admin not found');

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new ApiError(401, 'Invalid credentials');

  const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });

  return {
    status: 1,
    message: 'Login successful',
    token,
    admin: {
      id: admin._id,
      email: admin.email,
      adminName: admin.adminName,
      role: admin.role,
    },
  };
};

export const updateProfile = async (adminId, data) => {
  const admin = await Admin.findByIdAndUpdate(adminId, data, { new: true });
  if (!admin) throw new ApiError(404, 'Admin not found');
  return admin;
};
