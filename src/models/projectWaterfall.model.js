import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema({
    stepNo: {
        type: Number,
        required: true,
        min: 1,
        max: 63
    },
    stepName: {
        type: String,
        required: true
    },
    performedBy: {
        type: String,
        required: true
    },
    nextStep: {
        type: String,
        required: true
    },
    remarks: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'active', 'pending', 'skipped'],
        default: 'pending'
    },
    completedAt: {
        type: Date,
        default: null
    },
    completedBy: {
        type: String,
        default: null
    },
    history: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        performedBy: {
            type: String,
            required: true
        },
        action: {
            type: String,
            required: true
        },
        remarks: {
            type: String,
            default: ''
        }
    }]
});

const projectWaterfallSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        unique: true
    },
    projectName: {
        type: String,
        required: true
    },
    currentStepNumber: {
        type: Number,
        default: 1,
        min: 1,
        max: 63
    },
    steps: [stepSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Initialize with all 63 steps
projectWaterfallSchema.statics.initializeSteps = function() {
    return [
        { stepNo: 1, stepName: 'Customer Lead Received', performedBy: 'Sales Admin', nextStep: 'Create Project', remarks: 'Lead captured from ad, call, or referral' },
        { stepNo: 2, stepName: 'New Project Created in System', performedBy: 'Admin', nextStep: 'Assign to SCP', remarks: 'Project record created in Flyvendo' },
        { stepNo: 3, stepName: 'Project Sent to SCP', performedBy: 'Admin', nextStep: 'SCP to Update Project Data', remarks: 'SCP receives project assignment' },
        { stepNo: 4, stepName: 'SCP Updates Project Data', performedBy: 'SCP', nextStep: 'Send to Customer', remarks: 'Site, customer, and requirement data updated' },
        { stepNo: 4.5, stepName: 'SCP Data Sent to Customer', performedBy: 'SCP', nextStep: 'Admin Review', remarks: 'SCP data sent to customer for confirmation' },
        { stepNo: 5, stepName: 'Admin Reviews SCP Input', performedBy: 'Admin', nextStep: 'Customer Confirmation', remarks: 'Verify correctness before next step' },
        { stepNo: 5.5, stepName: 'Admin Rejection Feedback', performedBy: 'Admin', nextStep: 'SCP Data Revision', remarks: 'Project rejected - SCP to revise data' },
        { stepNo: 6, stepName: 'Customer Confirms Requirements', performedBy: 'Customer', nextStep: 'Send to Vendor', remarks: 'Approval of basic requirement before quotation' },
        { stepNo: 7, stepName: 'Project Sent to Vendor', performedBy: 'Admin', nextStep: 'Vendor Submits Proposal', remarks: 'Requirement sent for quotation' },
        { stepNo: 8, stepName: 'Vendor Submits Proposal', performedBy: 'Vendor', nextStep: 'Admin Review', remarks: 'Vendor sends proposal' },
        { stepNo: 9, stepName: 'Compare Multiple Vendor Proposals', performedBy: 'Admin / Planning Engineer', nextStep: 'Select Vendor', remarks: 'Compare cost, quality, delivery' },
        { stepNo: 10, stepName: 'Vendor Selected and Confirmed', performedBy: 'Admin', nextStep: 'Ask Vendor for Documents', remarks: 'Mark final vendor approved' },
        { stepNo: 11, stepName: 'Vendor Submits Documents', performedBy: 'Vendor', nextStep: 'Admin Document Review', remarks: 'Documents uploaded for review' },
        { stepNo: 12, stepName: 'Vendor Documents Not Approved', performedBy: 'Admin', nextStep: 'Vendor Resubmission', remarks: 'Resend requested' },
        { stepNo: 13, stepName: 'Vendor Documents Approved', performedBy: 'Admin', nextStep: 'Send to Customer', remarks: 'Documents verified and approved' },
        { stepNo: 14, stepName: 'Documents Sent to Customer', performedBy: 'Admin', nextStep: 'Customer Review', remarks: 'Sent for customer confirmation' },
        { stepNo: 15, stepName: 'Customer Rejects Vendor Documents', performedBy: 'Customer', nextStep: 'Admin to Revise / Resend', remarks: 'Rejection case handled' },
        { stepNo: 16, stepName: 'Customer Approves Vendor Documents', performedBy: 'Customer', nextStep: 'Send to Planning Engineer', remarks: 'Approval completed' },
        { stepNo: 17, stepName: 'Archive Approved Vendor Documents', performedBy: 'Admin', nextStep: 'Proceed to Planning', remarks: 'Move all approved docs to permanent folder' },
        { stepNo: 18, stepName: 'Documents Sent to Planning Engineer', performedBy: 'Admin', nextStep: 'Create Rough BOM', remarks: 'Transferred to planning stage' },
        { stepNo: 19, stepName: 'Planning Engineer Creates Rough BOM', performedBy: 'Planning Engineer', nextStep: 'Send to Site Engineer', remarks: 'Initial BOM prepared' },
        { stepNo: 20, stepName: 'Site Engineer Reviews Rough BOM', performedBy: 'Site Engineer', nextStep: 'Send Feedback', remarks: 'Review and feedback process' },
        { stepNo: 21, stepName: 'Planning Engineer Updates Final BOM', performedBy: 'Planning Engineer', nextStep: 'Send to Admin', remarks: 'Revised and finalized BOM' },
        { stepNo: 22, stepName: 'Admin Verifies Cost Sheet / Margin', performedBy: 'Admin', nextStep: 'Send to Customer', remarks: 'Ensure profitability before proposal' },
        { stepNo: 23, stepName: 'Customer Confirms Final Layout', performedBy: 'Customer', nextStep: 'Generate Proposal', remarks: 'Freeze final design before proposal' },
        { stepNo: 24, stepName: 'Proposal Sent to Customer', performedBy: 'Admin', nextStep: 'Await Customer Approval', remarks: 'Proposal emailed or shared' },
        { stepNo: 25, stepName: 'Customer Rejects Proposal', performedBy: 'Customer', nextStep: 'Admin to Revise Proposal', remarks: 'Resubmission required' },
        { stepNo: 26, stepName: 'Customer Approves Proposal', performedBy: 'Customer', nextStep: 'Convert to Work Order', remarks: 'Approval complete' },
        { stepNo: 27, stepName: 'Work Order Created', performedBy: 'Admin', nextStep: 'Send to Planning Engineer', remarks: 'WO prepared post customer approval' },
        { stepNo: 28, stepName: 'Planning Engineer Reviews Work Order', performedBy: 'Planning Engineer', nextStep: 'Generate Purchase Orders', remarks: 'Work Order confirmation' },
        { stepNo: 29, stepName: 'Check Material Availability', performedBy: 'Procurement', nextStep: 'Create PO', remarks: 'Verify stock before purchase' },
        { stepNo: 30, stepName: 'Purchase Order Created', performedBy: 'Planning Engineer', nextStep: 'Admin Approval', remarks: 'PO generation process' },
        { stepNo: 31, stepName: 'Admin Approves Purchase Order', performedBy: 'Admin', nextStep: 'Send to Vendor / Dispatch', remarks: 'Approval complete' },
        { stepNo: 32, stepName: 'Material Procured / Packed', performedBy: 'Vendor', nextStep: 'Pre-Dispatch QC', remarks: 'Vendor readiness for dispatch' },
        { stepNo: 33, stepName: 'Pre-Dispatch QC and Photo Upload', performedBy: 'Quality Inspector', nextStep: 'Dispatch Material', remarks: 'Ensure quality before shipment' },
        { stepNo: 34, stepName: 'Transport & Delivery Schedule Confirmed', performedBy: 'Dispatch Team', nextStep: 'Material Dispatch', remarks: 'Truck no. & ETA logged' },
        { stepNo: 35, stepName: 'Material Dispatched to Site', performedBy: 'Dispatch Team', nextStep: 'Site Engineer Verification', remarks: 'Material sent to site' },
        { stepNo: 36, stepName: 'Site Engineer Verifies Material', performedBy: 'Site Engineer', nextStep: 'Approve / Report Discrepancy', remarks: 'Site check for materials' },
        { stepNo: 37, stepName: 'Material Approved at Site', performedBy: 'Site Engineer', nextStep: 'Start Installation Work', remarks: 'Ready for installation' },
        { stepNo: 38, stepName: 'Site Readiness Confirmation', performedBy: 'Site Engineer', nextStep: 'Begin Work', remarks: 'Check plinth, power, water availability' },
        { stepNo: 39, stepName: 'Site Work Assigned to Workers', performedBy: 'Site Engineer', nextStep: 'Execution Begins', remarks: 'Team assigned and briefed' },
        { stepNo: 40, stepName: 'Daily / Weekly Progress Log Updated', performedBy: 'Supervisor', nextStep: 'Site Engineer Review', remarks: 'Track ongoing progress' },
        { stepNo: 41, stepName: 'Workers Upload Photos & Progress', performedBy: 'Worker / Supervisor', nextStep: 'Site Engineer Review', remarks: 'Progress updates submitted' },
        { stepNo: 42, stepName: 'Safety / Compliance Checklist Verified', performedBy: 'Site Engineer / Supervisor', nextStep: 'Continue Work', remarks: 'Ensure safety before work' },
        { stepNo: 43, stepName: 'Site Engineer Rejects Work', performedBy: 'Site Engineer', nextStep: 'Workers to Re-do / Update', remarks: 'Corrections requested' },
        { stepNo: 44, stepName: 'Site Engineer Approves Work', performedBy: 'Site Engineer', nextStep: 'Send to Admin', remarks: 'Site work approved' },
        { stepNo: 45, stepName: 'Customer Mid-Stage Review (Optional)', performedBy: 'Customer', nextStep: 'Admin Review', remarks: 'Customer sees halfway progress' },
        { stepNo: 46, stepName: 'Admin Reviews Site Work', performedBy: 'Admin', nextStep: 'Approve / Reject', remarks: 'Administrative check' },
        { stepNo: 47, stepName: 'Admin Approves Work', performedBy: 'Admin', nextStep: 'Send to Customer', remarks: 'Approved and ready for client review' },
        { stepNo: 48, stepName: 'Customer Reviews Work', performedBy: 'Customer', nextStep: 'Approve / Reject', remarks: 'Customer evaluation' },
        { stepNo: 49, stepName: 'Customer Approves Site Work', performedBy: 'Customer', nextStep: 'Mark Site as Complete', remarks: 'Customer satisfaction achieved' },
        { stepNo: 50, stepName: 'Final Quality Inspection Report Upload', performedBy: 'Admin / QC', nextStep: 'Quality Check Approval', remarks: 'Final inspection done' },
        { stepNo: 51, stepName: 'Quality Check Approved', performedBy: 'QC / Admin', nextStep: 'Project Closure Stage', remarks: 'QC completed' },
        { stepNo: 52, stepName: 'Project Marked as Completed', performedBy: 'Admin', nextStep: 'Generate Final Reports', remarks: 'Project closure initiated' },
        { stepNo: 53, stepName: 'Automatic Report Generated', performedBy: 'System / Admin', nextStep: 'Send Invoice to Customer', remarks: 'Summary and documentation prepared' },
        { stepNo: 54, stepName: 'Invoice Sent to Customer', performedBy: 'Accounts', nextStep: 'Await Payment', remarks: 'Billing initiated' },
        { stepNo: 55, stepName: 'Payment Received', performedBy: 'Accounts', nextStep: 'Issue Completion Certificate', remarks: 'Payment confirmed' },
        { stepNo: 56, stepName: 'Completion Certificate Issued', performedBy: 'Admin', nextStep: 'Customer Handover', remarks: 'Project officially completed' },
        { stepNo: 57, stepName: 'Final Handover Document (Customer Sign-off)', performedBy: 'Customer', nextStep: 'Warranty Registration', remarks: 'Customer acceptance proof' },
        { stepNo: 58, stepName: 'Warranty / Maintenance Entry Created', performedBy: 'System / Admin', nextStep: 'Case Study Preparation', remarks: 'Warranty period started' },
        { stepNo: 59, stepName: 'Post-Completion Site Photos Uploaded', performedBy: 'Admin / Marketing', nextStep: 'Customer Feedback', remarks: 'Visual record for case study' },
        { stepNo: 60, stepName: 'Customer Feedback Collected', performedBy: 'CRM / Sales Admin', nextStep: 'Vendor Feedback', remarks: 'Feedback documented' },
        { stepNo: 61, stepName: 'Vendor / SCP Feedback Collected', performedBy: 'Admin', nextStep: 'Performance Rating', remarks: 'Performance tracking' },
        { stepNo: 62, stepName: 'Customer & Vendor Performance Rating', performedBy: 'Admin', nextStep: 'Archive Project', remarks: 'Rate satisfaction and quality' },
        { stepNo: 63, stepName: 'Project Archived', performedBy: 'System', nextStep: 'END', remarks: 'Project lifecycle complete' }
    ];
};

// Pre-save middleware to initialize steps
projectWaterfallSchema.pre('save', function(next) {
    if (this.isNew && this.steps.length === 0) {
        this.steps = this.constructor.initializeSteps();
    }
    this.updatedAt = new Date();
    next();
});

// Method to move to next step
projectWaterfallSchema.methods.moveToNextStep = function(performedBy, remarks = '') {
    const nextStepNumber = this.currentStepNumber + 1;
    
    // Mark current step as completed
    const currentStep = this.steps.find(step => step.stepNo === this.currentStepNumber);
    if (currentStep) {
        currentStep.status = 'completed';
        currentStep.completedAt = new Date();
        currentStep.completedBy = performedBy;
        currentStep.history.push({
            timestamp: new Date(),
            performedBy,
            action: 'completed',
            remarks
        });
    }
    
    // Mark all steps between current and next as skipped
    for (let i = this.currentStepNumber + 1; i < nextStepNumber; i++) {
        const step = this.steps.find(s => s.stepNo === i);
        if (step && step.status === 'pending') {
            step.status = 'skipped';
            step.history.push({
                timestamp: new Date(),
                performedBy,
                action: 'skipped',
                remarks: `Skipped due to jumping to step ${nextStepNumber}`
            });
        }
    }
    
    // Mark next step as active
    const nextStep = this.steps.find(step => step.stepNo === nextStepNumber);
    if (nextStep) {
        nextStep.status = 'active';
        nextStep.history.push({
            timestamp: new Date(),
            performedBy,
            action: 'activated',
            remarks: `Moved to step ${nextStepNumber}`
        });
    }
    
    this.currentStepNumber = nextStepNumber;
    return this.save();
};

// Method to get progress statistics
projectWaterfallSchema.methods.getProgressStats = function() {
    const totalSteps = this.steps.length;
    const completedSteps = this.steps.filter(step => step.status === 'completed').length;
    const skippedSteps = this.steps.filter(step => step.status === 'skipped').length;
    const activeSteps = this.steps.filter(step => step.status === 'active').length;
    const pendingSteps = this.steps.filter(step => step.status === 'pending').length;
    
    return {
        total: totalSteps,
        completed: completedSteps,
        skipped: skippedSteps,
        active: activeSteps,
        pending: pendingSteps,
        progressPercentage: Math.round((completedSteps / totalSteps) * 100)
    };
};

const ProjectWaterfall = mongoose.model('ProjectWaterfall', projectWaterfallSchema);

export default ProjectWaterfall;
