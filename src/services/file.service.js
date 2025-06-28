import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import storage, { STORAGE_TYPE } from '../factory/storage.factory.js';
import logger from '../config/logger.js';
import ApiError from '../utils/ApiError.js';

export const initiateUploadService = async (body) => {
  if (STORAGE_TYPE !== 's3') {
    throw new ApiError(400, 'File upload initiation is only supported for S3 storage. Please configure STORAGE_TYPE=s3 in your .env file.');
  }
  const { fileName, fileType, fileCategory } = body;

  if (!fileCategory || typeof fileCategory !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(fileCategory)) {
    throw new ApiError(400, 'A valid file category is required.');
  }

  const uniqueId = uuidv4();
  const fileExtension = path.extname(fileName);
  const fileBaseName = path.basename(fileName, fileExtension)
    .toLowerCase()
    .replace(/\s+/g, '-')      // replace spaces with -
    .replace(/[^\w-]+/g, ''); // remove all non-word chars except -

  const key = `uploads/tmp/${fileCategory}/${fileBaseName}-${uniqueId}${fileExtension}`;

  try {
    const uploadUrl = await storage.generatePresignedUploadUrl(key, fileType);
    return { uploadUrl, key };
  } catch (error) {
    logger.error(`Failed to initiate upload: ${error.message}`);
    throw new ApiError(500, 'Could not initiate file upload.');
  }
}; 