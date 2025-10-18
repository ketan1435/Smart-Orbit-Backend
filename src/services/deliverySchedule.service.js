import DeliverySchedule from '../models/deliverySchedule.model.js';
import PO from '../models/po.model.js';
import { createActivityLog } from '../services/activityLog.service.js';

export const createDeliveryScheduleService = async (req, data) => {
    const { poId, vehicleName, vehicleNumber, driverName, driverMobile, driverAddress, attachments } = data;

    console.log('=== Delivery Schedule Service Debug ===');
    console.log('User object:', req.user);
    console.log('User name:', req.user?.name);
    console.log('User email:', req.user?.email);

    // Validate PO exists
    const po = await PO.findById(poId).populate('project');
    if (!po) {
        throw new Error('Purchase Order not found');
    }

    // Get user name, fallback to email if name is not available
    const scheduledByName = req.user?.name || req.user?.email || 'Unknown User';

    // Extract items from PO for delivery
    const deliveryItems = po.items.map(item => ({
        itemName: item.itemName,
        quantity: item.quantity,
        units: item.units,
        unitCost: item.unitCost,
        description: item.description || '',
        brand: item.brand || ''
    }));

    // Create delivery schedule
    const deliverySchedule = await DeliverySchedule.create({
        poId,
        projectId: po.project._id,
        vehicleName,
        vehicleNumber,
        driverName,
        driverMobile,
        driverAddress: driverAddress || '',
        attachments: attachments || [],
        items: deliveryItems,
        scheduledBy: req.user._id,
        scheduledByName: scheduledByName,
        status: 'scheduled'
    });

    // Log activity
    await createActivityLog({
        user: req.user._id,
        userModel: req.user?.role === 'admin' ? 'Admin' : 'User',
        userName: scheduledByName,
        userEmail: req.user?.email || 'unknown@example.com',
        targetModel: 'DeliverySchedule',
        targetId: deliverySchedule._id,
        targetName: po.name,
        projectId: po.project._id,
        action: 'delivery_scheduled',
        actionType: 'Workflow',
        description: `Delivery scheduled for PO ${po.name} - Vehicle: ${vehicleName} (${vehicleNumber}), Driver: ${driverName}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        metadata: {
            poId: po._id,
            vehicleName,
            vehicleNumber,
            driverName,
            driverMobile,
            scheduleId: deliverySchedule._id,
            method: req.method,
            url: req.url,
            timestamp: new Date()
        }
    });

    return deliverySchedule;
};

export const getDeliverySchedulesService = async (req, filters = {}) => {
    const { poId, projectId, status } = filters;
    
    let query = { isActive: true };
    
    if (poId) {
        query.poId = poId;
    }
    
    if (projectId) {
        query.projectId = projectId;
    }
    
    if (status) {
        query.status = status;
    }

    const schedules = await DeliverySchedule.find(query)
        .populate('poId', 'name vendorName')
        .populate('projectId', 'projectName projectCode')
        .populate('scheduledBy', 'name email')
        .sort({ createdAt: -1 });

    return schedules;
};

export const updateDeliveryScheduleService = async (req, scheduleId, updateData) => {
    const schedule = await DeliverySchedule.findById(scheduleId);
    if (!schedule) {
        throw new Error('Delivery schedule not found');
    }

    const updatedSchedule = await DeliverySchedule.findByIdAndUpdate(
        scheduleId,
        updateData,
        { new: true }
    ).populate('poId', 'name vendorName')
     .populate('projectId', 'projectName projectCode')
     .populate('scheduledBy', 'name email');

    // Log activity for status changes
    if (updateData.status && updateData.status !== schedule.status) {
        const userName = req.user?.name || req.user?.email || 'Unknown User';
        
        // Create specific description based on status change
        let description;
        if (updateData.status === 'delivered') {
            description = `Material delivered at site successfully`;
        } else {
            description = `Delivery status updated to ${updateData.status} for PO ${updatedSchedule.poId.name}`;
        }
        
        await createActivityLog({
            user: req.user._id,
            userModel: req.user?.role === 'admin' ? 'Admin' : 'User',
            userName: userName,
            userEmail: req.user?.email || 'unknown@example.com',
            targetModel: 'DeliverySchedule',
            targetId: updatedSchedule._id,
            targetName: updatedSchedule.poId.name,
            projectId: updatedSchedule.projectId,
            action: 'delivery_status_updated',
            actionType: 'Status Change',
            description: description,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            metadata: {
                poId: updatedSchedule.poId._id,
                oldStatus: schedule.status,
                newStatus: updateData.status,
                scheduleId: updatedSchedule._id,
                method: req.method,
                url: req.url,
                timestamp: new Date()
            }
        });
    }

    return updatedSchedule;
};

export const deleteDeliveryScheduleService = async (req, scheduleId) => {
    const schedule = await DeliverySchedule.findById(scheduleId);
    if (!schedule) {
        throw new Error('Delivery schedule not found');
    }

    await DeliverySchedule.findByIdAndUpdate(scheduleId, { isActive: false });

    // Log activity
    const userName = req.user?.name || req.user?.email || 'Unknown User';
    await createActivityLog({
        user: req.user._id,
        userModel: req.user?.role === 'admin' ? 'Admin' : 'User',
        userName: userName,
        userEmail: req.user?.email || 'unknown@example.com',
        targetModel: 'DeliverySchedule',
        targetId: schedule._id,
        targetName: schedule.poId.name,
        projectId: schedule.projectId,
        action: 'delivery_schedule_deleted',
        actionType: 'CRUD',
        description: `Delivery schedule deleted for PO ${schedule.poId.name}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        metadata: {
            poId: schedule.poId._id,
            scheduleId: schedule._id,
            vehicleName: schedule.vehicleName,
            driverName: schedule.driverName,
            method: req.method,
            url: req.url,
            timestamp: new Date()
        }
    });

    return { message: 'Delivery schedule deleted successfully' };
};
