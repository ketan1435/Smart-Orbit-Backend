import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const attendanceSchema = new mongoose.Schema({
    fabricator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    fabricatorName: {
        type: String,
        required: true,
    },
    clockInTime: {
        type: Date,
        required: true,
    },
    clockOutTime: {
        type: Date,
        default: null,
    },
    clockInPhotoKey: {
        type: String,
        required: true,
    },
    clockOutPhotoKey: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ['clocked-in', 'clocked-out'],
        default: 'clocked-in',
    },
    workDuration: {
        type: Number, // in minutes
        default: null,
    },
    location: {
        latitude: {
            type: Number,
            default: null,
        },
        longitude: {
            type: Number,
            default: null,
        },
        address: {
            type: String,
            default: null,
        },
    },
    notes: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Index for efficient queries
attendanceSchema.index({ fabricator: 1, clockInTime: -1 });
attendanceSchema.index({ fabricator: 1, status: 1 });

// Virtual for formatted work duration
attendanceSchema.virtual('formattedWorkDuration').get(function() {
    if (!this.workDuration) return null;
    
    const hours = Math.floor(this.workDuration / 60);
    const minutes = this.workDuration % 60;
    return `${hours}h ${minutes}m`;
});

// Pre-save middleware to calculate work duration
attendanceSchema.pre('save', function(next) {
    if (this.clockOutTime && this.clockInTime) {
        const diffInMs = this.clockOutTime.getTime() - this.clockInTime.getTime();
        this.workDuration = Math.floor(diffInMs / (1000 * 60)); // Convert to minutes
    }
    next();
});

// Virtual fields for formatted times in Indian timezone
attendanceSchema.virtual('formattedClockInTime').get(function() {
    if (!this.clockInTime) return null;
    const indianTime = new Date(this.clockInTime.getTime() + (5.5 * 60 * 60 * 1000));
    return indianTime.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

attendanceSchema.virtual('formattedClockOutTime').get(function() {
    if (!this.clockOutTime) return null;
    const indianTime = new Date(this.clockOutTime.getTime() + (5.5 * 60 * 60 * 1000));
    return indianTime.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

attendanceSchema.virtual('formattedWorkDuration').get(function() {
    if (!this.workDuration) return null;
    const hours = Math.floor(this.workDuration / 60);
    const minutes = this.workDuration % 60;
    return `${hours}h ${minutes}m`;
});

// Ensure virtual fields are included in JSON output
attendanceSchema.set('toJSON', { virtuals: true });
attendanceSchema.set('toObject', { virtuals: true });

attendanceSchema.plugin(mongoosePaginate);

/**
 * @typedef Attendance
 */
const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
