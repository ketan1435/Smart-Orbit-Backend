import catchAsync from '../utils/catchAsync.js';
import { createPOVerificationService, getPOVerificationsService, updatePOVerificationService } from '../services/poVerification.service.js';
import storage from '../factory/storage.factory.js';

export const createPOVerification = catchAsync(async (req, res) => {
    console.log('=== POVerification Controller Debug ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body values:', req.body);
    console.log('Request files:', req.files);
    console.log('Files received:', req.files?.length || 0);
    console.log('Files details:', req.files?.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype })));
    console.log('Request headers:', req.headers['content-type']);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    
    // Process uploaded files and upload to S3
    const attachments = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            try {
                // Upload file to S3
                console.log('Uploading file to S3:', { name: file.originalname, size: file.size, mimetype: file.mimetype });
                const uploadedFile = await storage.uploadFile(file, 'po-verifications');
                console.log('S3 upload result:', uploadedFile);
                
                const attachment = {
                    fileType: file.mimetype.startsWith('image/') ? 'image' : 
                             file.mimetype.startsWith('video/') ? 'video' : 
                             file.mimetype === 'application/pdf' ? 'pdf' : 'document',
                    key: uploadedFile.key, // Now we have the key field
                    originalName: file.originalname,
                    uploadedAt: new Date(),
                };
                
                console.log('Created attachment object:', attachment);
                attachments.push(attachment);
            } catch (error) {
                console.error('Error uploading file to S3:', error);
                // Continue with other files even if one fails
            }
        }
    }
    
    console.log('Processed attachments:', attachments);
    
    // Parse items from JSON string if it's a string
    let items = req.body.items;
    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch (error) {
            console.error('Error parsing items JSON:', error);
            throw new Error('Invalid items format');
        }
    }
    
    const verificationData = {
        poId: req.body.poId,
        items: items,
        verificationNotes: req.body.verificationNotes,
        attachments
    };
    
    console.log('Processed verification data:', JSON.stringify(verificationData, null, 2));
    
    const verification = await createPOVerificationService(req, verificationData);
    res.status(201).send({ 
        status: 1, 
        message: 'PO verification request created successfully', 
        data: verification 
    });
});

export const getPOVerifications = catchAsync(async (req, res) => {
    const results = await getPOVerificationsService(req, req.query);
    res.send({ 
        status: 1, 
        message: 'PO verifications fetched successfully', 
        data: results 
    });
});

export const updatePOVerification = catchAsync(async (req, res) => {
    const { id } = req.params;
    const verification = await updatePOVerificationService(req, id, req.body);
    res.send({ 
        status: 1, 
        message: 'PO verification updated successfully', 
        data: verification 
    });
});
