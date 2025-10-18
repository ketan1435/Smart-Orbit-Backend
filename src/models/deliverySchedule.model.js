import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';

const deliveryScheduleSchema = new mongoose.Schema({
    poId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PO',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    vehicleName: {
        type: String,
        required: true
    },
    vehicleNumber: {
        type: String,
        required: true
    },
    driverName: {
        type: String,
        required: true
    },
    driverMobile: {
        type: String,
        required: true
    },
    driverAddress: {
        type: String,
        default: ''
    },
    attachments: {
        type: [fileSchema],
        default: []
    },
    items: [{
        itemName: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        units: {
            type: String,
            required: true
        },
        unitCost: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            default: ''
        },
        brand: {
            type: String,
            default: ''
        }
    }],
    status: {
        type: String,
        enum: ['scheduled', 'in-transit', 'delivered', 'cancelled'],
        default: 'scheduled'
    },
    scheduledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledByName: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model('DeliverySchedule', deliveryScheduleSchema);
