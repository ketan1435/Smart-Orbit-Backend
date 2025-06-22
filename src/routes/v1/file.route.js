// routes/file.routes.js
import express from 'express';
import mongoose from 'mongoose';
import validate from '../../middlewares/validate.js';
import * as fileValidation from '../../validations/file.validation.js';
import * as fileController from '../../controllers/file.controller.js';
import auth from '../../middlewares/auth.js';

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

    // 4) Tell the browser "this is an image/png" (or whatever was stored)
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

/**
 * @swagger
 * /initiate-upload:
 *   post:
 *     summary: Initiate a file upload and get a presigned URL
 *     description: "Requests a secure, one-time URL to upload a file directly to S3. This is the first step in the two-phase upload process."
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: "The name of the file to be uploaded."
 *                 example: "project-video.mp4"
 *               fileType:
 *                 type: string
 *                 description: "The MIME type of the file."
 *                 example: "video/mp4"
 *               fileCategory:
 *                 type: string
 *                 description: "A generic category for the upload (e.g., 'customer-images', 'user-avatars'). This will be used for organizing temporary files."
 *                 example: "customer-images"
 *             required:
 *               - fileName
 *               - fileType
 *               - fileCategory
 *     responses:
 *       200:
 *         description: Successfully generated presigned URL.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 uploadUrl:
 *                   type: string
 *                   description: "The presigned URL to use for the PUT request to upload the file."
 *                 key:
 *                   type: string
 *                   description: "The unique key for the file in S3. This key must be sent in the final form submission."
 *       400:
 *         description: Bad Request. Invalid input provided.
 *       401:
 *         description: Unauthorized. The user is not authenticated.
 *       500:
 *         description: Internal Server Error. Failed to generate the upload URL.
 */
router.post(
  '/initiate-upload',
  auth(),
  validate(fileValidation.initiateUpload),
  fileController.initiateUploadController
);

export default router;
