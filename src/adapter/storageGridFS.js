// src/adapter/storageGridFS.js
import mongoose from 'mongoose';
import { StorageInterface } from '../interface/storage.interface.js';

export class GridFSStorage extends StorageInterface {
  constructor() {
    super();
    this.bucket = null;

    mongoose.connection.once('open', () => {
      this.bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
      });
    });
  }

  async uploadFile(file, context = {}) {
    if (!this.bucket) {
      throw new Error('GridFSBucket is not initialized.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
      });

      const fileId = uploadStream.id; // This is the ObjectId of the uploaded file

      uploadStream.end(file.buffer);

      uploadStream.on('finish', () => {
        if (context?.req?.uploadedFiles) {
          context.req.uploadedFiles.push(fileId.toString());
        }
        resolve({
          id: fileId,
          filename: file.originalname,
          contentType: file.mimetype,
        });
      });

      uploadStream.on('error', (err) => {
        reject(err);
      });
    });
  }

  getFile(fileId) {
    if (!this.bucket) {
      throw new Error('GridFSBucket is not initialized.');
    }

    return this.bucket.openDownloadStream(mongoose.Types.ObjectId(fileId));
  }

  async deleteFile(fileId) {
    if (!this.bucket) {
      throw new Error('GridFSBucket is not initialized.');
    }

    return this.bucket.delete(mongoose.Types.ObjectId(fileId));
  }
}
