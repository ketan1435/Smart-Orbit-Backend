import catchAsync from '../utils/catchAsync.js';
import { 
    createDeliveryScheduleService, 
    getDeliverySchedulesService, 
    updateDeliveryScheduleService, 
    deleteDeliveryScheduleService 
} from '../services/deliverySchedule.service.js';
import storage from '../factory/storage.factory.js';

export const createDeliverySchedule = catchAsync(async (req, res) => {
    console.log('=== Delivery Schedule Controller Debug ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body values:', req.body);
    console.log('Request files:', req.files);
    console.log('Files received:', req.files?.length || 0);
    console.log('Request headers:', req.headers['content-type']);
    
    // Process uploaded files and upload to S3
    const attachments = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            try {
                console.log('Uploading file to S3:', { name: file.originalname, size: file.size, mimetype: file.mimetype });
                const uploadedFile = await storage.uploadFile(file, 'delivery-schedules');
                console.log('S3 upload result:', uploadedFile);
                
                const attachment = {
                    fileType: file.mimetype.startsWith('image/') ? 'image' : 
                             file.mimetype.startsWith('video/') ? 'video' : 
                             file.mimetype === 'application/pdf' ? 'pdf' : 'document',
                    key: uploadedFile.key,
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
    
    const scheduleData = {
        poId: req.body.poId,
        vehicleName: req.body.vehicleName,
        vehicleNumber: req.body.vehicleNumber,
        driverName: req.body.driverName,
        driverMobile: req.body.driverMobile,
        driverAddress: req.body.driverAddress || '',
        attachments
    };
    
    console.log('Processed schedule data:', JSON.stringify(scheduleData, null, 2));
    
    const deliverySchedule = await createDeliveryScheduleService(req, scheduleData);
    
    res.status(201).send({ 
        status: 1, 
        message: 'Delivery schedule created successfully', 
        data: deliverySchedule 
    });
});

export const getDeliverySchedules = catchAsync(async (req, res) => {
    const { poId, projectId, status } = req.query;
    
    const schedules = await getDeliverySchedulesService(req, { poId, projectId, status });
    
    res.status(200).send({
        status: 1,
        message: 'Delivery schedules fetched successfully',
        data: schedules
    });
});

export const updateDeliverySchedule = catchAsync(async (req, res) => {
    const { scheduleId } = req.params;
    const updateData = req.body;
    
    const updatedSchedule = await updateDeliveryScheduleService(req, scheduleId, updateData);
    
    res.status(200).send({
        status: 1,
        message: 'Delivery schedule updated successfully',
        data: updatedSchedule
    });
});

export const deleteDeliverySchedule = catchAsync(async (req, res) => {
    const { scheduleId } = req.params;
    
    const result = await deleteDeliveryScheduleService(req, scheduleId);
    
    res.status(200).send({
        status: 1,
        message: result.message
    });
});
