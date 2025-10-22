import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getSignedUrlPresigner } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import path from 'path';

// Configure AWS S3 Client
const s3Client = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION || 'ap-south-1'
});

// Configure multer for memory storage (we'll handle S3 upload manually)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
        }
    }
});

// Upload single file
const uploadSingle = (fieldName) => {
    return upload.single(fieldName);
};

// Upload multiple files
const uploadMultiple = (fieldName, maxCount = 5) => {
    return upload.array(fieldName, maxCount);
};

// Upload file to S3
const uploadFileToS3 = async (file, folder = 'uploads') => {
    try {
        const bucketName = process.env.AWS_S3_BUCKET_NAME || 'smart-orbit-dev-bucket';
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.originalname}`;
        const key = `${folder}/${filename}`;
        
        console.log('S3 Upload Debug - Bucket:', bucketName);
        console.log('S3 Upload Debug - Key:', key);
        console.log('S3 Upload Debug - File size:', file.buffer?.length);
        console.log('S3 Upload Debug - Content type:', file.mimetype);
        
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
        });
        
        await s3Client.send(command);
        console.log('S3 Upload Debug - Upload successful');
        console.log('S3 Upload Debug - Final key:', key);
        console.log('S3 Upload Debug - Final URL:', `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`);
        
        return {
            key: key,
            url: `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`,
            filename: filename
        };
    } catch (error) {
        console.error('S3 Upload Error:', error);
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
};

// Get file from S3
const getFileFromS3 = async (key) => {
    try {
        const bucketName = process.env.AWS_S3_BUCKET_NAME || 'smart-orbit-dev-bucket';
        console.log('S3 Debug - Bucket Name:', bucketName);
        console.log('S3 Debug - Key:', key);
        console.log('S3 Debug - AWS Region:', process.env.AWS_REGION);
        console.log('S3 Debug - AWS Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not Set');
        
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        
        const data = await s3Client.send(command);
        return {
            body: data.Body,
            contentType: data.ContentType,
            contentLength: data.ContentLength
        };
    } catch (error) {
        console.error('S3 Error:', error);
        throw new Error(`Failed to get file from S3: ${error.message}`);
    }
};

// Delete file from S3
const deleteFileFromS3 = async (key) => {
    try {
        const bucketName = process.env.AWS_S3_BUCKET_NAME || 'smart-orbit-dev-bucket';
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        
        await s3Client.send(command);
        return true;
    } catch (error) {
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
};

// Generate signed URL for private files
const getSignedUrl = async (key, expiresIn = 3600) => {
    try {
        const bucketName = process.env.AWS_S3_BUCKET_NAME || 'smart-orbit-dev-bucket';
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        
        return await getSignedUrlPresigner(s3Client, command, { expiresIn });
    } catch (error) {
        throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
};

export {
    uploadSingle,
    uploadMultiple,
    uploadFileToS3,
    getFileFromS3,
    deleteFileFromS3,
    getSignedUrl
};

export default {
    uploadSingle,
    uploadMultiple,
    uploadFileToS3,
    getFileFromS3,
    deleteFileFromS3,
    getSignedUrl
};
