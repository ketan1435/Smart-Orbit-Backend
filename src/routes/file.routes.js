import express from 'express';
import { getFileBlob, getFileUrl, isViewableInBrowser, getFileIcon } from '../services/blob.service.js';

const router = express.Router();

// Get file blob for viewing
router.get('/view/:key(*)', async (req, res) => {
    try {
        const { key } = req.params;
        const filename = req.query.filename || 'file';
        
        console.log('File Route Debug - Key:', key);
        console.log('File Route Debug - Filename:', filename);
        
        const fileData = await getFileBlob(key, filename);
        
        res.set({
            'Content-Type': fileData.contentType,
            'Content-Length': fileData.size,
            'Content-Disposition': `inline; filename="${fileData.filename}"`,
            'Cache-Control': 'public, max-age=3600'
        });
        
        res.send(fileData.blob);
    } catch (error) {
        console.error('File Route Error:', error);
        
        // Fallback: redirect to direct S3 URL
        const { key } = req.params;
        const s3Url = `https://smart-orbit-dev-bucket.s3.ap-south-1.amazonaws.com/${key}`;
        console.log('File Route Fallback - Redirecting to S3 URL:', s3Url);
        
        res.redirect(302, s3Url);
    }
});

// Get file URL for download
router.get('/download/:key(*)', async (req, res) => {
    try {
        const { key } = req.params;
        const filename = req.query.filename || 'file';
        
        const fileUrl = await getFileUrl(key, 3600); // 1 hour expiry
        
        res.json({
            status: 1,
            message: 'File URL generated successfully',
            data: {
                url: fileUrl,
                filename: filename,
                expiresIn: 3600
            }
        });
    } catch (error) {
        console.error('Download Route Error:', error);
        
        // Fallback: return direct S3 URL
        const { key } = req.params;
        const s3Url = `https://smart-orbit-dev-bucket.s3.ap-south-1.amazonaws.com/${key}`;
        console.log('Download Route Fallback - Using S3 URL:', s3Url);
        
        res.json({
            status: 1,
            message: 'File URL generated successfully (fallback)',
            data: {
                url: s3Url,
                filename: filename,
                expiresIn: 3600
            }
        });
    }
});

// Test route to check if file routes are working
router.get('/test', (req, res) => {
    res.json({
        status: 1,
        message: 'File routes are working',
        timestamp: new Date().toISOString()
    });
});

// Get file info
router.get('/info/:key(*)', async (req, res) => {
    try {
        const { key } = req.params;
        const filename = req.query.filename || 'file';
        
        const fileData = await getFileBlob(key, filename);
        const isViewable = isViewableInBrowser(filename);
        const icon = getFileIcon(filename);
        
        res.json({
            status: 1,
            message: 'File info retrieved successfully',
            data: {
                filename: filename,
                contentType: fileData.contentType,
                size: fileData.size,
                fileType: fileData.fileType,
                isViewable: isViewable,
                icon: icon
            }
        });
    } catch (error) {
        res.status(404).json({
            status: 0,
            message: 'File not found',
            error: error.message
        });
    }
});

export default router;
