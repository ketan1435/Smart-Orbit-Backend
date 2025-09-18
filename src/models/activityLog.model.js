import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
    // Who performed the action
    user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'userModel',
        required: true,
    },
    userModel: {
        type: String,
        required: true,
        enum: ['User', 'Admin'],
    },
    userName: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
        required: true,
    },

    // What was the target of the action
    targetModel: {
        type: String,
        required: true,
        enum: [
            'User', 'Admin', 'Project', 'ClientProposal', 'BOM', 'PO',
            'Vendor', 'SiteVisit', 'Message', 'File', 'CustomerLead',
            'Quote', 'Sitework', 'ProjectAssignmentPayment', 'WalletTransaction'
        ],
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    targetName: {
        type: String,
        required: true,
    },

    // Action details
    action: {
        type: String,
        required: true,
        enum: [
            'create',
            'update',
            'delete',
            'activate',
            'deactivate',
            'approve',
            'reject',
            'send',
            'convert',
            'finalize',
            // --- Actions found in the code ---
            // 'error',
            'bulk_update',
            'custom_action',
            'submit_quote',
            'create_admin',
            'create_bom',
            'update_bom',
            'update_bom_status',
            'delete_bom',
            'submit_bom',
            'review_bom',
            'assign_bom_to_site_engineer',
            'update_bom_by_site_engineer',
            'submit_updated_bom_to_planning',
            'create_finalized_bom',
            'create_client_proposal',
            'send_to_customer',
            'customer_review',
            'update_client_proposal',
            'update_client_proposal_status',
            'create_new_version',
            'delete_client_proposal',
            'convert_to_work_order',
            'send_work_order_to_planning_engineer',
            'share',
            'mark_items_delivered',
            'submit_proposal',
            'accept_proposal',
            'submit_document',
            'upload',
            'review_document',
            'delete_proposal',
            'reject_proposal',
            'send_to_procurement',
            'assign_site_engineers',
            'update_project_status',
            'delete_quote',
            'review_quote',
            'create_quote',
            'bulk_create_quotes',
            'create_sitework',
            'update_sitework',
            'approve_or_reject_sitework_document',
            'customer_review_sitework_document',
            'send_sitework_document_to_customer',
            'reset_password',
            'create_vendor',
            'activate_vendor',
            'deactivate_vendor',
            'update_vendor',
            'delete_vendor'
        ],
    },
    actionType: {
        type: String,
        required: true,
        enum: ['CRUD', 'Status Change', 'Workflow', 'Communication', 'File Operation', 'System'],
    },

    // Changes made
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    previousValues: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    newValues: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // Additional context
    description: {
        type: String,
        required: true,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
    },

    // Status
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Indexes for better query performance
activityLogSchema.index({ user: 1, timestamp: -1 });
activityLogSchema.index({ targetModel: 1, targetId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ userModel: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

// Indexes for embedded document queries
activityLogSchema.index({ 'metadata.embeddedDocument': 1, targetModel: 1, targetId: 1 });
activityLogSchema.index({ 'metadata.embeddedField': 1, targetModel: 1, targetId: 1 });
activityLogSchema.index({ 'metadata.embeddedDocument': 1, 'metadata.embeddedField': 1, action: 1 });
activityLogSchema.index({ 'metadata.embeddedDocId': 1, targetModel: 1, targetId: 1 });

// Virtual for formatted timestamp
activityLogSchema.virtual('formattedTimestamp').get(function () {
    return this.timestamp.toISOString();
});

// Method to get readable changes
activityLogSchema.methods.getReadableChanges = function () {
    const changes = [];

    for (const [field, change] of Object.entries(this.changes)) {
        if (change.from !== change.to) {
            changes.push({
                field,
                from: change.from,
                to: change.to,
                type: change.type || 'string'
            });
        }
    }

    return changes;
};

// Method to get summary
activityLogSchema.methods.getSummary = function () {
    return {
        id: this._id,
        user: this.userName,
        action: this.action,
        target: `${this.targetModel}: ${this.targetName}`,
        timestamp: this.formattedTimestamp,
        changesCount: Object.keys(this.changes).length,
        description: this.description
    };
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
