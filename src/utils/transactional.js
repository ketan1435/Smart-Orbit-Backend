// src/utils/transactional.js
import mongoose from 'mongoose';
import storage from '../factory/storage.factory.js';
import logger from '../config/logger.js';

export const transactional = (service) => {
  return async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      await session.startTransaction();
      req.session = session;
      req.uploadedFiles = [];

      // Execute service logic with session
      const result = await service(req, session);

      // Commit transaction and send response
      await session.commitTransaction();
      res.status(result.status || 200).json(result.body);
    } catch (err) {
      // Abort transaction and clean up files
      if (session.inTransaction()) await session.abortTransaction();
      for (const fileId of req.uploadedFiles) {
        try {
          await storage.deleteFile(fileId);
        } catch (cleanupErr) {
          logger.error(`File cleanup failed: ${cleanupErr}`);
        }
      }
      next(err);
    } finally {
      await session.endSession(); // Always release session
    }
  };
};
