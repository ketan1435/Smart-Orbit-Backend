/**
 * Customer Lead Logging Example
 * 
 * This file demonstrates how the manual logging system works
 * for the createCustomerLeadService function.
 */

import { logActivity } from '../middlewares/activityLog.middleware.js';

/**
 * Example: How the createCustomerLeadService function logs activities
 * 
 * When a customer lead is created, the following activities are logged:
 * 1. Customer Lead creation
 * 2. Requirement creation (for each requirement)
 * 3. Project creation (for each project)
 * 4. Site Visit creation (for each site visit)
 */

// ============================================================================
// 1. CUSTOMER LEAD CREATION LOGGING
// ============================================================================

/**
 * Example: Customer Lead creation log entry
 */
export const exampleCustomerLeadCreationLog = {
    action: 'create',
    targetModel: 'CustomerLead',
    targetId: '60d0fe4f5311236168a109ca',
    targetName: 'John Doe',
    description: 'Created customer lead: John Doe (john.doe@example.com)',
    metadata: {
        leadData: {
            customerName: 'John Doe',
            email: 'john.doe@example.com',
            mobileNumber: '+1234567890',
            state: 'California',
            city: 'San Francisco',
            townVillage: 'Downtown',
            status: 'inprogress',
            leadSource: 'Website'
        },
        requirementsCount: 2,
        projectsCreated: 2,
        createdBy: '60d0fe4f5311236168a109cb',
        createdByModel: 'Admin'
    }
};

// ============================================================================
// 2. REQUIREMENT CREATION LOGGING
// ============================================================================

/**
 * Example: Requirement creation log entry
 */
export const exampleRequirementCreationLog = {
    action: 'create',
    targetModel: 'Requirement',
    targetId: '60d0fe4f5311236168a109cc',
    targetName: 'Residential House Design',
    description: 'Created requirement: Residential House Design for customer lead: John Doe',
    metadata: {
        requirementData: {
            projectName: 'Residential House Design',
            requirementType: 'residential',
            urgency: 'medium',
            budget: '50000',
            fileCount: 3
        },
        leadId: '60d0fe4f5311236168a109ca',
        leadName: 'John Doe',
        projectId: '60d0fe4f5311236168a109cd'
    }
};

// ============================================================================
// 3. PROJECT CREATION LOGGING
// ============================================================================

/**
 * Example: Project creation log entry
 */
export const exampleProjectCreationLog = {
    action: 'create',
    targetModel: 'Project',
    targetId: '60d0fe4f5311236168a109cd',
    targetName: 'Residential House Design',
    description: 'Created project: Residential House Design for customer lead: John Doe',
    metadata: {
        projectData: {
            projectName: 'Residential House Design',
            budget: 50000,
            status: 'draft'
        },
        leadId: '60d0fe4f5311236168a109ca',
        leadName: 'John Doe',
        requirementId: '60d0fe4f5311236168a109cc'
    }
};

// ============================================================================
// 4. SITE VISIT CREATION LOGGING
// ============================================================================

/**
 * Example: Site Visit creation log entry
 */
export const exampleSiteVisitCreationLog = {
    action: 'create',
    targetModel: 'SiteVisit',
    targetId: '60d0fe4f5311236168a109ce',
    targetName: 'Site visit for Residential House Design',
    description: 'Created site visit for project: Residential House Design with site engineer',
    metadata: {
        siteVisitData: {
            projectName: 'Residential House Design',
            siteEngineer: '60d0fe4f5311236168a109cf',
            visitDate: '2024-01-15T10:00:00.000Z',
            visitStartDate: '2024-01-15T10:00:00.000Z',
            visitEndDate: '2024-01-15T16:00:00.000Z',
            hasRequirementEditAccess: true
        },
        leadId: '60d0fe4f5311236168a109ca',
        leadName: 'John Doe',
        projectId: '60d0fe4f5311236168a109cd',
        requirementId: '60d0fe4f5311236168a109cc'
    }
};

// ============================================================================
// 5. COMPLETE WORKFLOW EXAMPLE
// ============================================================================

/**
 * Example: Complete workflow when creating a customer lead
 * 
 * Input: Customer lead with 2 requirements, each having site visits
 * 
 * Logged Activities:
 * 1. Customer Lead creation (1 log entry)
 * 2. Requirement creation (2 log entries - one per requirement)
 * 3. Project creation (2 log entries - one per project)
 * 4. Site Visit creation (4 log entries - 2 per requirement)
 * 
 * Total: 9 log entries for a complete customer lead creation
 */

export const completeWorkflowExample = {
    customerLead: {
        id: '60d0fe4f5311236168a109ca',
        name: 'John Doe',
        email: 'john.doe@example.com',
        requirements: [
            {
                id: '60d0fe4f5311236168a109cc',
                name: 'Residential House Design',
                siteVisits: 2
            },
            {
                id: '60d0fe4f5311236168a109dd',
                name: 'Commercial Office Design',
                siteVisits: 2
            }
        ]
    },
    loggedActivities: [
        {
            type: 'Customer Lead Creation',
            count: 1,
            description: 'Main customer lead record created'
        },
        {
            type: 'Requirement Creation',
            count: 2,
            description: 'One requirement per project created'
        },
        {
            type: 'Project Creation',
            count: 2,
            description: 'One project per requirement created'
        },
        {
            type: 'Site Visit Creation',
            count: 4,
            description: 'Two site visits per requirement created'
        }
    ],
    totalLogEntries: 9
};

// ============================================================================
// 6. QUERY EXAMPLES
// ============================================================================

/**
 * Example: How to query logs for a specific customer lead
 */
export const queryCustomerLeadLogs = async (leadId) => {
    // Get all logs for a specific customer lead
    const leadLogs = await logActivity(req, {
        action: 'create',
        targetModel: 'CustomerLead',
        targetId: leadId
    });

    return leadLogs;
};

/**
 * Example: How to query logs for all related entities
 */
export const queryRelatedEntityLogs = async (leadId) => {
    // Get all logs for the lead
    const leadLogs = await getActivityLogsByTarget('CustomerLead', leadId);

    // Get all logs for requirements related to this lead
    const requirementLogs = await getActivityLogsByTarget('Requirement', leadId);

    // Get all logs for projects related to this lead
    const projectLogs = await getActivityLogsByTarget('Project', leadId);

    // Get all logs for site visits related to this lead
    const siteVisitLogs = await getActivityLogsByTarget('SiteVisit', leadId);

    return {
        leadLogs,
        requirementLogs,
        projectLogs,
        siteVisitLogs
    };
};

// ============================================================================
// 7. ERROR HANDLING EXAMPLES
// ============================================================================

/**
 * Example: How errors in logging are handled
 */
export const errorHandlingExample = async (req, logData) => {
    // If logging fails, it doesn't break the main operation
    try {
        await logActivity(req, logData);
    } catch (error) {
        console.error('Error logging customer lead creation:', error);
        // Don't throw error - logging should not break the main operation
    }
};

// ============================================================================
// 8. METADATA STRUCTURE EXAMPLES
// ============================================================================

/**
 * Example: Customer Lead metadata structure
 */
export const customerLeadMetadata = {
    leadData: {
        customerName: 'John Doe',
        email: 'john.doe@example.com',
        mobileNumber: '+1234567890',
        state: 'California',
        city: 'San Francisco',
        townVillage: 'Downtown',
        status: 'inprogress',
        leadSource: 'Website'
    },
    requirementsCount: 2,
    projectsCreated: 2,
    createdBy: '60d0fe4f5311236168a109cb',
    createdByModel: 'Admin'
};

/**
 * Example: Requirement metadata structure
 */
export const requirementMetadata = {
    requirementData: {
        projectName: 'Residential House Design',
        requirementType: 'residential',
        urgency: 'medium',
        budget: '50000',
        fileCount: 3
    },
    leadId: '60d0fe4f5311236168a109ca',
    leadName: 'John Doe',
    projectId: '60d0fe4f5311236168a109cd'
};

/**
 * Example: Project metadata structure
 */
export const projectMetadata = {
    projectData: {
        projectName: 'Residential House Design',
        budget: 50000,
        status: 'draft'
    },
    leadId: '60d0fe4f5311236168a109ca',
    leadName: 'John Doe',
    requirementId: '60d0fe4f5311236168a109cc'
};

/**
 * Example: Site Visit metadata structure
 */
export const siteVisitMetadata = {
    siteVisitData: {
        projectName: 'Residential House Design',
        siteEngineer: '60d0fe4f5311236168a109cf',
        visitDate: '2024-01-15T10:00:00.000Z',
        visitStartDate: '2024-01-15T10:00:00.000Z',
        visitEndDate: '2024-01-15T16:00:00.000Z',
        hasRequirementEditAccess: true
    },
    leadId: '60d0fe4f5311236168a109ca',
    leadName: 'John Doe',
    projectId: '60d0fe4f5311236168a109cd',
    requirementId: '60d0fe4f5311236168a109cc'
};

// ============================================================================
// 9. REAL-WORLD USAGE EXAMPLES
// ============================================================================

/**
 * Example: How to track the complete customer journey
 */
export const trackCustomerJourney = async (leadId) => {
    // Get all activities for this customer lead
    const activities = await queryRelatedEntityLogs(leadId);

    // Create a timeline of events
    const timeline = [
        ...activities.leadLogs.map(log => ({
            timestamp: log.timestamp,
            action: 'Customer Lead Created',
            description: log.description,
            actor: log.userName
        })),
        ...activities.requirementLogs.map(log => ({
            timestamp: log.timestamp,
            action: 'Requirement Created',
            description: log.description,
            actor: log.userName
        })),
        ...activities.projectLogs.map(log => ({
            timestamp: log.timestamp,
            action: 'Project Created',
            description: log.description,
            actor: log.userName
        })),
        ...activities.siteVisitLogs.map(log => ({
            timestamp: log.timestamp,
            action: 'Site Visit Created',
            description: log.description,
            actor: log.userName
        }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return timeline;
};

/**
 * Example: How to get statistics for customer lead creation
 */
export const getCustomerLeadStats = async (startDate, endDate) => {
    // Get all customer lead creation logs in date range
    const leadCreationLogs = await getActivityLogsByAction('create', 'CustomerLead', {
        startDate,
        endDate
    });

    // Calculate statistics
    const stats = {
        totalLeadsCreated: leadCreationLogs.length,
        leadsBySource: {},
        leadsByStatus: {},
        averageRequirementsPerLead: 0,
        averageProjectsPerLead: 0,
        averageSiteVisitsPerLead: 0
    };

    // Process logs to calculate statistics
    leadCreationLogs.forEach(log => {
        const metadata = log.metadata;

        // Count by source
        const source = metadata.leadData?.leadSource || 'Unknown';
        stats.leadsBySource[source] = (stats.leadsBySource[source] || 0) + 1;

        // Count by status
        const status = metadata.leadData?.status || 'Unknown';
        stats.leadsByStatus[status] = (stats.leadsByStatus[status] || 0) + 1;

        // Calculate averages
        stats.averageRequirementsPerLead += metadata.requirementsCount || 0;
        stats.averageProjectsPerLead += metadata.projectsCreated || 0;
    });

    // Calculate final averages
    if (leadCreationLogs.length > 0) {
        stats.averageRequirementsPerLead = stats.averageRequirementsPerLead / leadCreationLogs.length;
        stats.averageProjectsPerLead = stats.averageProjectsPerLead / leadCreationLogs.length;
    }

    return stats;
};
