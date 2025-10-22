import { getFileFromS3, getSignedUrl } from './s3.service.js';
import path from 'path';

// Get file type from extension
const getFileType = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const videoTypes = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    const documentTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    
    if (imageTypes.includes(ext)) return 'image';
    if (videoTypes.includes(ext)) return 'video';
    if (documentTypes.includes(ext)) return 'document';
    return 'unknown';
};

// Get MIME type from file extension
const getMimeType = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

// Get file blob for viewing
const getFileBlob = async (key, filename) => {
    try {
        const fileData = await getFileFromS3(key);
        const fileType = getFileType(filename);
        const mimeType = getMimeType(filename);
        
        return {
            blob: fileData.body,
            contentType: mimeType,
            fileType: fileType,
            size: fileData.contentLength,
            filename: filename
        };
    } catch (error) {
        throw new Error(`Failed to get file blob: ${error.message}`);
    }
};

// Get signed URL for file access
const getFileUrl = async (key, expiresIn = 3600) => {
    try {
        return await getSignedUrl(key, expiresIn);
    } catch (error) {
        throw new Error(`Failed to get file URL: ${error.message}`);
    }
};

// Check if file is viewable in browser
const isViewableInBrowser = (filename) => {
    const fileType = getFileType(filename);
    return fileType === 'image' || fileType === 'video' || getMimeType(filename) === 'application/pdf';
};

// Get file icon based on type
const getFileIcon = (filename) => {
    const fileType = getFileType(filename);
    const ext = path.extname(filename).toLowerCase();
    
    if (fileType === 'image') return '🖼️';
    if (fileType === 'video') return '🎥';
    if (ext === '.pdf') return '📄';
    if (['.doc', '.docx'].includes(ext)) return '📝';
    if (['.xls', '.xlsx'].includes(ext)) return '📊';
    if (['.ppt', '.pptx'].includes(ext)) return '📋';
    if (ext === '.txt') return '📄';
    return '📎';
};

export {
    getFileType,
    getMimeType,
    getFileBlob,
    getFileUrl,
    isViewableInBrowser,
    getFileIcon
};

export default {
    getFileType,
    getMimeType,
    getFileBlob,
    getFileUrl,
    isViewableInBrowser,
    getFileIcon
};
