// routes/file.routes.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  try {
    // 1) Convert the :id into an ObjectId
    const fileId = req.params.id;
    const _id = new mongoose.Types.ObjectId(fileId);

    // 2) Access the native DB and set up GridFSBucket
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads',
    });

    // 3) Look up the metadata so we know contentType
    const filesColl = db.collection('uploads.files');
    const fileDoc = await filesColl.findOne({ _id });
    if (!fileDoc) {
      return res.status(404).json({ status: 0, message: 'File not found' });
    }

    // 4) Tell the browser “this is an image/png” (or whatever was stored)
    // res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
    // 4) Set Content-Disposition for original filename & extension
    res.set('Content-Disposition', `attachment; filename="${fileDoc.filename}"`);
    // Optional: force a download instead of inline display:
    // res.set('Content-Disposition', `attachment; filename="${fileDoc.filename}"`);

    // 5) Pipe the chunks back to the client
    const downloadStream = bucket.openDownloadStream(_id);
    downloadStream.on('error', () => res.sendStatus(404));
    downloadStream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
