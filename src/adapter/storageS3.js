import { StorageInterface } from '../interface/storage.interface.js';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({ /* config */ });

export class S3Storage extends StorageInterface {
  async uploadFile(file) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: file.originalname,
      Body: file.buffer,
    };
    return s3.upload(params).promise();
  }

  async getFile(key) {
    return s3.getObject({ Bucket: process.env.S3_BUCKET, Key: key }).createReadStream();
  }

  async deleteFile(key) {
    return s3.deleteObject({ Bucket: process.env.S3_BUCKET, Key: key }).promise();
  }
}
