import catchAsync from '../utils/catchAsync.js';
import { initiateUploadService } from '../services/file.service.js';
import { S3Storage } from '../adapter/storageS3.js';

const s3Storage = new S3Storage();

export const initiateUploadController = catchAsync(async (req, res) => {
  const result = await initiateUploadService(req.body);
  res.status(200).json({ success: true, status: 1, ...result });
});

export const getSignedUrlController = catchAsync(async (req, res) => {
  const { key } = req.params;
  
  if (!key) {
    return res.status(400).json({ 
      success: false, 
      status: 0, 
      message: 'File key is required' 
    });
  }

  try {
    const signedUrl = await s3Storage.getFileUrl(key);
    res.status(200).json({ 
      success: true, 
      status: 1, 
      signedUrl: signedUrl 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      status: 0, 
      message: 'Failed to generate signed URL' 
    });
  }
}); 