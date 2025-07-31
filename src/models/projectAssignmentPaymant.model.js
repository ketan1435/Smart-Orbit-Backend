import mongoose from 'mongoose';

const assignmentPaymentSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAmount: Number,
    note: String,
    perDayAmount: Number,
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
    createdByModel: { type: String, enum: ['Admin', 'User'] },
}, { timestamps: true });

const ProjectAssignmentPayment = mongoose.model('ProjectAssignmentPayment', assignmentPaymentSchema);

export default ProjectAssignmentPayment;