/**
 * Customer Lead Update Logging Example
 * 
 * This file demonstrates how the manual logging system works
 * for the updateCustomerLeadService function and related update operations.
 */

import { logActivity } from '../middlewares/activityLog.middleware.js';

/**
 * Example: How the updateCustomerLeadService function logs activities
 * 
 * When a customer lead is updated, the following activities are logged:
 * 1. Customer Lead field updates
 * 2. Requirement updates (if any)
 * 3. Status changes with cascade updates
 * 4. Activation/Deactivation operations
 */

// ============================================================================
// 1. CUSTOMER LEAD FIELD UPDATE LOGGING
// ============================================================================

/**
 * Example: Customer Lead field update log entry
 */
export const exampleCustomerLeadFieldUpdateLog = {
    action: 'update',
    targetModel: 'CustomerLead',
    targetId: '60d0fe4f5311236168a109ca',
    targetName: 'John Doe',
    description: 'Updated customer lead: John Doe (john.doe@example.com)',
    changes: {
        customerName: {
            from: 'John Smith',
            to: 'John Doe'
        },
        mobileNumber: {
            from: '+1234567890',
            to: '+1234567891'
        },
        city: {
            from: 'San Francisco',
            to: 'Los Angeles'
        }
    },
    metadata: {
        leadData: {
            customerName: 'John Doe',
            email: 'john.doe@example.com',
            mobileNumber: '+1234567891',
            state: 'California',
            city: 'Los Angeles',
            townVillage: 'Downtown',
            status: 'inprogress',
            leadSource: 'Website'
        },
        requirementsUpdated: 0,
        updatedFields: ['customerName', 'mobileNumber', 'city'],
        updatedBy: '60d0fe4f5311236168a109cb',
        updatedByModel: 'Admin'
    }
};

// ============================================================================
// 2. CUSTOMER LEAD STATUS UPDATE LOGGING
// ============================================================================

/**
 * Example: Customer Lead status update log entry
 */
export const exampleCustomerLeadStatusUpdateLog = {
    action: 'update',
    targetModel: 'CustomerLead',
    targetId: '60d0fe4f5311236168a109ca',
    targetName: 'John Doe',
    description: 'Updated customer lead status: John Doe - inprogress → active (cascade updated 2 projects)',
    changes: {
        status: {
            from: 'inprogress',
            to: 'active'
        }
    },
    metadata: {
        leadData: {
            customerName: 'John Doe',
            email: 'john.doe@example.com',
            status: 'active',
            previousStatus: 'inprogress',
            newStatus: 'active'
        },
        statusUpdate: true,
        cascadeUpdate: true,
        projectsUpdated: 2,
        requirementsUpdated: 0,
        updatedFields: ['status'],
        updatedBy: '60d0fe4f5311236168a109cb',
        updatedByModel: 'Admin'
    }
};

// ============================================================================
// 3. REQUIREMENT UPDATE LOGGING
// ============================================================================

/**
 * Example: Requirement update log entry
 */
export const exampleRequirementUpdateLog = {
    action: 'update',
    targetModel: 'Requirement',
    targetId: '60d0fe4f5311236168a109cc',
    targetName: 'Residential House Design',
    description: 'Updated requirement: Residential House Design for customer lead: John Doe',
    changes: {
        projectName: {
            from: 'Residential House Design',
            to: 'Modern Residential House Design'
        },
        budget: {
            from: '50000',
            to: '75000'
        },
        urgency: {
            from: 'medium',
            to: 'high'
        }
    },
    metadata: {
        requirementData: {
            projectName: 'Modern Residential House Design',
            requirementType: 'residential',
            urgency: 'high',
            budget: '75000'
        },
        leadId: '60d0fe4f5311236168a109ca',
        leadName: 'John Doe',
        updatedFields: ['projectName', 'budget', 'urgency'],
        updatedBy: '60d0fe4f5311236168a109cb',
        updatedByModel: 'Admin'
    }
};

// ============================================================================
// 4. ACTIVATION LOGGING
// ============================================================================

/**
 * Example: Customer Lead activation log entry
 */
export const exampleCustomerLeadActivationLog = {
    action: 'activate',
    targetModel: 'CustomerLead',
    targetId: '60d0fe4f5311236168a109ca',
    targetName: 'John Doe',
    description: 'Activated customer lead: John Doe (john.doe@example.com)',
    metadata: {
        leadData: {
            customerName: 'John Doe',
            email: 'john.doe@example.com',
            previousStatus: 'inactive',
            newStatus: 'active'
        },
        statusChange: true,
        activatedBy: '60d0fe4f5311236168a109cb',
        activatedByModel: 'Admin'
    }
};

// ============================================================================
// 5. DEACTIVATION LOGGING
// ============================================================================

/**
 * Example: Customer Lead deactivation log entry
 */
export const exampleCustomerLeadDeactivationLog = {
    action: 'deactivate',
    targetModel: 'CustomerLead',
    targetId: '60d0fe4f5311236168a109ca',
    targetName: 'John Doe',
    description: 'Deactivated customer lead: John Doe (john.doe@example.com)',
    metadata: {
        leadData: {
            customerName: 'John Doe',
            email: 'john.doe@example.com',
            previousStatus: 'active',
            newStatus: 'inactive'
        },
        statusChange: true,
        deactivatedBy: '60d0fe4f5311236168a109cb',
        deactivatedByModel: 'Admin'
    }
};

// ============================================================================
// 6. COMPLETE UPDATE WORKFLOW EXAMPLE
// ============================================================================

/**
 * Example: Complete workflow when updating a customer lead
 * 
 * Input: Customer lead update with field changes and requirement updates
 * 
 * Logged Activities:
 * 1. Customer Lead field updates (1 log entry)
 * 2. Requirement updates (N log entries - one per requirement)
 * 3. Status changes with cascade (1 log entry with cascade info)
 * 
 * Total: 1 + N + 1 = 2 + N log entries for a complete update
 */

export const completeUpdateWorkflowExample = {
    customerLead: {
        id: '60d0fe4f5311236168a109ca',
        name: 'John Doe',
        email: 'john.doe@example.com',
        updates: {
            fields: ['customerName', 'mobileNumber', 'city'],
            status: 'inprogress → active',
            requirements: [
                {
                    id: '60d0fe4f5311236168a109cc',
                    name: 'Residential House Design',
                    updates: ['projectName', 'budget', 'urgency']
                },
                {
                    id: '60d0fe4f5311236168a109dd',
                    name: 'Commercial Office Design',
                    updates: ['requirementType', 'budget']
                }
            ]
        }
    },
    loggedActivities: [
        {
            type: 'Customer Lead Field Update',
            count: 1,
            description: 'Basic field updates (name, phone, city, etc.)'
        },
        {
            type: 'Customer Lead Status Update',
            count: 1,
            description: 'Status change with cascade update information'
        },
        {
            type: 'Requirement Updates',
            count: 2,
            description: 'One log entry per updated requirement'
        }
    ],
    totalLogEntries: 4
};

// ============================================================================
// 7. CHANGE DETECTION EXAMPLES
// ============================================================================

/**
 * Example: How change detection works for field updates
 */
export const changeDetectionExample = {
    originalData: {
        customerName: 'John Smith',
        mobileNumber: '+1234567890',
        city: 'San Francisco',
        status: 'inprogress'
    },
    updatedData: {
        customerName: 'John Doe',
        mobileNumber: '+1234567891',
        city: 'Los Angeles',
        status: 'active'
    },
    detectedChanges: {
        customerName: {
            from: 'John Smith',
            to: 'John Doe'
        },
        mobileNumber: {
            from: '+1234567890',
            to: '+1234567891'
        },
        city: {
            from: 'San Francisco',
            to: 'Los Angeles'
        },
        status: {
            from: 'inprogress',
            to: 'active'
        }
    }
};

// ============================================================================
// 8. METADATA STRUCTURE EXAMPLES
// ============================================================================

/**
 * Example: Customer Lead update metadata structure
 */
export const customerLeadUpdateMetadata = {
    leadData: {
        customerName: 'John Doe',
        email: 'john.doe@example.com',
        mobileNumber: '+1234567891',
        state: 'California',
        city: 'Los Angeles',
        townVillage: 'Downtown',
        status: 'active',
        leadSource: 'Website'
    },
    requirementsUpdated: 2,
    updatedFields: ['customerName', 'mobileNumber', 'city', 'status'],
    updatedBy: '60d0fe4f5311236168a109cb',
    updatedByModel: 'Admin'
};

/**
 * Example: Status update metadata structure
 */
export const statusUpdateMetadata = {
    leadData: {
        customerName: 'John Doe',
        email: 'john.doe@example.com',
        previousStatus: 'inprogress',
        newStatus: 'active'
    },
    statusUpdate: true,
    cascadeUpdate: true,
    projectsUpdated: 2,
    requirementsUpdated: 0,
    updatedFields: ['status'],
    updatedBy: '60d0fe4f5311236168a109cb',
    updatedByModel: 'Admin'
};

/**
 * Example: Requirement update metadata structure
 */
export const requirementUpdateMetadata = {
    requirementData: {
        projectName: 'Modern Residential House Design',
        requirementType: 'residential',
        urgency: 'high',
        budget: '75000'
    },
    leadId: '60d0fe4f5311236168a109ca',
    leadName: 'John Doe',
    updatedFields: ['projectName', 'budget', 'urgency'],
    updatedBy: '60d0fe4f5311236168a109cb',
    updatedByModel: 'Admin'
};

// ============================================================================
// 9. QUERY EXAMPLES
// ============================================================================

/**
 * Example: How to query logs for customer lead updates
 */
export const queryCustomerLeadUpdateLogs = async (leadId) => {
    // Get all update logs for a specific customer lead
    const updateLogs = await getActivityLogsByAction('update', 'CustomerLead', leadId);

    return updateLogs;
};

/**
 * Example: How to query logs for status changes
 */
export const queryStatusChangeLogs = async (leadId) => {
    // Get all status change logs for a customer lead
    const statusLogs = await getActivityLogsByAction('update', 'CustomerLead', leadId, {
        'metadata.statusUpdate': true
    });

    return statusLogs;
};

/**
 * Example: How to query logs for requirement updates
 */
export const queryRequirementUpdateLogs = async (leadId) => {
    // Get all requirement update logs for a customer lead
    const requirementLogs = await getActivityLogsByAction('update', 'Requirement', leadId);

    return requirementLogs;
};

// ============================================================================
// 10. REAL-WORLD USAGE EXAMPLES
// ============================================================================

/**
 * Example: How to track customer lead update history
 */
export const trackCustomerLeadUpdateHistory = async (leadId) => {
    // Get all update activities for this customer lead
    const activities = await queryRelatedEntityLogs(leadId);

    // Create a timeline of update events
    const timeline = [
        ...activities.leadLogs.map(log => ({
            timestamp: log.timestamp,
            action: 'Customer Lead Updated',
            description: log.description,
            actor: log.userName,
            changes: log.changes,
            metadata: log.metadata
        })),
        ...activities.requirementLogs.map(log => ({
            timestamp: log.timestamp,
            action: 'Requirement Updated',
            description: log.description,
            actor: log.userName,
            changes: log.changes,
            metadata: log.metadata
        }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return timeline;
};

/**
 * Example: How to get update statistics for customer leads
 */
export const getCustomerLeadUpdateStats = async (startDate, endDate) => {
    // Get all customer lead update logs in date range
    const updateLogs = await getActivityLogsByAction('update', 'CustomerLead', {
        startDate,
        endDate
    });

    // Calculate statistics
    const stats = {
        totalUpdates: updateLogs.length,
        updatesByField: {},
        statusChanges: 0,
        cascadeUpdates: 0,
        averageFieldsPerUpdate: 0,
        mostUpdatedFields: []
    };

    // Process logs to calculate statistics
    updateLogs.forEach(log => {
        const metadata = log.metadata;

        // Count field updates
        if (metadata.updatedFields) {
            metadata.updatedFields.forEach(field => {
                stats.updatesByField[field] = (stats.updatesByField[field] || 0) + 1;
            });
        }

        // Count status changes
        if (metadata.statusUpdate) {
            stats.statusChanges++;
        }

        // Count cascade updates
        if (metadata.cascadeUpdate) {
            stats.cascadeUpdates++;
        }

        // Calculate average fields per update
        stats.averageFieldsPerUpdate += metadata.updatedFields?.length || 0;
    });

    // Calculate final averages
    if (updateLogs.length > 0) {
        stats.averageFieldsPerUpdate = stats.averageFieldsPerUpdate / updateLogs.length;
    }

    // Get most updated fields
    stats.mostUpdatedFields = Object.entries(stats.updatesByField)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([field, count]) => ({ field, count }));

    return stats;
};

// ============================================================================
// 11. ERROR HANDLING EXAMPLES
// ============================================================================

/**
 * Example: How errors in update logging are handled
 */
export const updateErrorHandlingExample = async (req, logData) => {
    // If logging fails, it doesn't break the main operation
    try {
        await logActivity(req, logData);
    } catch (error) {
        console.error('Error logging customer lead update:', error);
        // Don't throw error - logging should not break the main operation
    }
};

// ============================================================================
// 12. CONTROLLER INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: How to update controller functions to pass req parameter
 */
export const updateControllerExample = {
    // Before: activateCustomerLeadService(id)
    // After: activateCustomerLeadService(req, id)

    activateCustomerLead: catchAsync(async (req, res) => {
        const { id } = req.params;
        const lead = await activateCustomerLeadService(req, id);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Customer lead activated successfully',
            data: lead
        });
    }),

    deactivateCustomerLead: catchAsync(async (req, res) => {
        const { id } = req.params;
        const lead = await deactivateCustomerLeadService(req, id);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Customer lead deactivated successfully',
            data: lead
        });
    }),

    updateCustomerLeadStatus: catchAsync(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const lead = await updateCustomerLeadStatusService(req, id, status);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Customer lead status updated successfully',
            data: lead
        });
    })
};
