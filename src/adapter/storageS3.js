import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageInterface } from '../interface/storage.interface.js';
import config from '../config/config.js';
import logger from '../config/logger.js';

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export class S3Storage extends StorageInterface {
  async generatePresignedUploadUrl(key, contentType) {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3.bucket,
      Key: key,
      ContentType: contentType,
    });

    try {
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // URL expires in 1 hour
      });
      return signedUrl;
    } catch (error) {
      logger.error(`Error generating presigned URL for S3 upload: ${error.message}`);
      throw new Error('Failed to generate upload URL.');
    }
  }

  async copyFile(sourceKey, destinationKey) {
    const command = new CopyObjectCommand({
      Bucket: config.aws.s3.bucket,
      CopySource: `${config.aws.s3.bucket}/${sourceKey}`,
      Key: destinationKey,
    });

    try {
      await s3Client.send(command);
      logger.info(`File copied successfully in S3 from ${sourceKey} to ${destinationKey}`);
    } catch (error) {
      logger.error(`Error copying file in S3: ${error.message}`);
      throw new Error('Failed to copy file in S3.');
    }
  }

  async uploadFile(file, key) {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: config.aws.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    try {
      const result = await upload.done();
      logger.info(`File uploaded successfully to S3: ${result.Location}`);
      return result;
    } catch (error) {
      logger.error(`Error uploading file to S3: ${error.message}`);
      // The SDK will automatically abort the upload on error, so no manual cleanup is needed here.
      throw new Error('Failed to upload file to S3.');
    }
  }

  async getFileUrl(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: config.aws.s3.bucket,
        Key: key,
      });
      // Generate a presigned URL that expires in 1 hour
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return url;
    } catch (error) {
      logger.error(`Error generating signed URL for S3 object: ${error.message}`);
      throw new Error('Failed to retrieve file URL.');
    }
  }

  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3.bucket,
      Key: key,
    });

    try {
      await s3Client.send(command);
      logger.info(`File deleted successfully from S3: ${key}`);
    } catch (error) {
      logger.error(`Error deleting file from S3: ${error.message}`);
      throw new Error('Failed to delete file from S3.');
    }
  }

  // The getFile method from the old implementation is not needed for now,
  // as we'll be serving files via presigned URLs.
}
