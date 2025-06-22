import catchAsync from '../utils/catchAsync.js';
import { initiateUploadService } from '../services/file.service.js';

export const initiateUploadController = catchAsync(async (req, res) => {
  const result = await initiateUploadService(req.body);
  res.status(200).json({ success: true, status: 1, ...result });
}); 