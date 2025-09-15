/**
 * Embedded Document Logging Examples
 * 
 * This file demonstrates how to use the embedded document logging system
 * for tracking operations on embedded documents within parent models.
 */

import {
    logEmbeddedDocumentOperation,
    logEmbeddedArrayOperation,
    logEmbeddedDocumentUpdate,
    logEmbeddedDocumentStatusChange,
    logEmbeddedDocumentBulkOperation,
    getEmbeddedDocumentLogs,
    getAllEmbeddedDocumentLogs,
    getEmbeddedDocumentLogsByAction
} from '../middlewares/embeddedDocumentLogging.middleware.js';

// ============================================================================
// PROJECT ARCHITECT PROPOSALS EXAMPLES
// ============================================================================

/**
 * Example: Log architect proposal addition to project
 */
export const logArchitectProposalAddition = async (req, project, proposal) => {
    await logEmbeddedDocumentOperation(req, 'add', 'Project', project._id, project.projectName, 'architectProposals', proposal, {
        customDescription: `Added architect proposal to project: ${project.projectName}`,
        metadata: {
            architectId: proposal.architect,
            architectEmail: proposal.email,
            proposedCharges: proposal.proposedCharges,
            deliveryTimelineDays: proposal.deliveryTimelineDays,
            status: proposal.status
        }
    });
};

/**
 * Example: Log architect proposal update
 */
export const logArchitectProposalUpdate = async (req, project, originalProposal, updatedProposal) => {
    await logEmbeddedDocumentUpdate(req, 'Project', project._id, project.projectName, 'architectProposals', originalProposal, updatedProposal, {
        customDescription: `Updated architect proposal in project: ${project.projectName}`,
        metadata: {
            architectId: updatedProposal.architect,
            architectEmail: updatedProposal.email,
            proposalStatus: updatedProposal.status
        }
    });
};

/**
 * Example: Log architect proposal status change
 */
export const logArchitectProposalStatusChange = async (req, project, proposal, action) => {
    await logEmbeddedDocumentStatusChange(req, action, 'Project', project._id, project.projectName, 'architectProposals', proposal, {
        customDescription: `${action} architect proposal in project: ${project.projectName}`,
        metadata: {
            architectId: proposal.architect,
            architectEmail: proposal.email,
            previousStatus: proposal.status,
            newStatus: action === 'approve' ? 'Approved' : 'Rejected'
        }
    });
};

/**
 * Example: Log architect proposal removal
 */
export const logArchitectProposalRemoval = async (req, project, proposal) => {
    await logEmbeddedDocumentOperation(req, 'remove', 'Project', project._id, project.projectName, 'architectProposals', proposal, {
        customDescription: `Removed architect proposal from project: ${project.projectName}`,
        metadata: {
            architectId: proposal.architect,
            architectEmail: proposal.email,
            removalReason: 'Architect withdrew proposal'
        }
    });
};

// ============================================================================
// PROJECT ARCHITECT DOCUMENTS EXAMPLES
// ============================================================================

/**
 * Example: Log architect document addition
 */
export const logArchitectDocumentAddition = async (req, project, document) => {
    await logEmbeddedDocumentOperation(req, 'add', 'Project', project._id, project.projectName, 'architectDocuments', document, {
        customDescription: `Added architect document to project: ${project.projectName}`,
        metadata: {
            architectId: document.architect,
            fileCount: document.files?.length || 0,
            notes: document.notes
        }
    });
};

/**
 * Example: Log architect document update
 */
export const logArchitectDocumentUpdate = async (req, project, originalDocument, updatedDocument) => {
    await logEmbeddedDocumentUpdate(req, 'Project', project._id, project.projectName, 'architectDocuments', originalDocument, updatedDocument, {
        customDescription: `Updated architect document in project: ${project.projectName}`,
        metadata: {
            architectId: updatedDocument.architect,
            fileCount: updatedDocument.files?.length || 0,
            notesChanged: originalDocument.notes !== updatedDocument.notes
        }
    });
};

/**
 * Example: Log architect document removal
 */
export const logArchitectDocumentRemoval = async (req, project, document) => {
    await logEmbeddedDocumentOperation(req, 'remove', 'Project', project._id, project.projectName, 'architectDocuments', document, {
        customDescription: `Removed architect document from project: ${project.projectName}`,
        metadata: {
            architectId: document.architect,
            removedFileCount: document.files?.length || 0
        }
    });
};

// ============================================================================
// BULK OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log bulk architect proposal operations
 */
export const logBulkArchitectProposalOperations = async (req, project, action, proposals) => {
    await logEmbeddedDocumentBulkOperation(req, action, 'Project', project._id, project.projectName, 'architectProposals', proposals, {
        customDescription: `${action} ${proposals.length} architect proposals in project: ${project.projectName}`,
        metadata: {
            operationType: 'bulk_architect_proposal_operation',
            architectIds: proposals.map(p => p.architect),
            statuses: proposals.map(p => p.status)
        }
    });
};

/**
 * Example: Log bulk architect document operations
 */
export const logBulkArchitectDocumentOperations = async (req, project, action, documents) => {
    await logEmbeddedDocumentBulkOperation(req, action, 'Project', project._id, project.projectName, 'architectDocuments', documents, {
        customDescription: `${action} ${documents.length} architect documents in project: ${project.projectName}`,
        metadata: {
            operationType: 'bulk_architect_document_operation',
            architectIds: documents.map(d => d.architect),
            totalFiles: documents.reduce((sum, doc) => sum + (doc.files?.length || 0), 0)
        }
    });
};

// ============================================================================
// ARRAY OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log architect proposals array reorder
 */
export const logArchitectProposalsReorder = async (req, project, originalProposals, newProposals) => {
    await logEmbeddedArrayOperation(req, 'reorder', 'Project', project._id, project.projectName, 'architectProposals', originalProposals, newProposals, {
        customDescription: `Reordered architect proposals in project: ${project.projectName}`,
        metadata: {
            operationType: 'array_reorder',
            originalOrder: originalProposals.map(p => p._id),
            newOrder: newProposals.map(p => p._id)
        }
    });
};

/**
 * Example: Log architect documents array update
 */
export const logArchitectDocumentsArrayUpdate = async (req, project, originalDocuments, newDocuments) => {
    await logEmbeddedArrayOperation(req, 'update', 'Project', project._id, project.projectName, 'architectDocuments', originalDocuments, newDocuments, {
        customDescription: `Updated architect documents array in project: ${project.projectName}`,
        metadata: {
            operationType: 'array_update',
            originalCount: originalDocuments.length,
            newCount: newDocuments.length
        }
    });
};

// ============================================================================
// RETRIEVAL EXAMPLES
// ============================================================================

/**
 * Example: Get all architect proposal logs for a project
 */
export const getArchitectProposalLogs = async (projectId, options = {}) => {
    return await getEmbeddedDocumentLogs('Project', projectId, 'architectProposals', options);
};

/**
 * Example: Get all architect document logs for a project
 */
export const getArchitectDocumentLogs = async (projectId, options = {}) => {
    return await getEmbeddedDocumentLogs('Project', projectId, 'architectDocuments', options);
};

/**
 * Example: Get all embedded document logs for a project
 */
export const getAllProjectEmbeddedLogs = async (projectId, options = {}) => {
    return await getAllEmbeddedDocumentLogs('Project', projectId, options);
};

/**
 * Example: Get architect proposal logs by action
 */
export const getArchitectProposalLogsByAction = async (projectId, action, options = {}) => {
    return await getEmbeddedDocumentLogsByAction('Project', projectId, 'architectProposals', action, options);
};

/**
 * Example: Get architect document logs by action
 */
export const getArchitectDocumentLogsByAction = async (projectId, action, options = {}) => {
    return await getEmbeddedDocumentLogsByAction('Project', projectId, 'architectDocuments', action, options);
};

// ============================================================================
// SERVICE INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: Service function with embedded document logging
 */
export const addArchitectProposalToProject = async (req, projectId, proposalData) => {
    try {
        // Get the project
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Add the proposal to the project
        const newProposal = {
            _id: new mongoose.Types.ObjectId(),
            ...proposalData,
            submittedAt: new Date()
        };

        project.architectProposals.push(newProposal);
        await project.save();

        // Log the addition
        await logArchitectProposalAddition(req, project, newProposal);

        return { project, proposal: newProposal };
    } catch (error) {
        console.error('Error adding architect proposal:', error);
        throw error;
    }
};

/**
 * Example: Service function to update embedded document
 */
export const updateArchitectProposalInProject = async (req, projectId, proposalId, updateData) => {
    try {
        // Get the project
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Find the proposal
        const proposalIndex = project.architectProposals.findIndex(p => p._id.toString() === proposalId);
        if (proposalIndex === -1) {
            throw new Error('Architect proposal not found');
        }

        // Store original for logging
        const originalProposal = { ...project.architectProposals[proposalIndex].toObject() };

        // Update the proposal
        project.architectProposals[proposalIndex] = {
            ...project.architectProposals[proposalIndex].toObject(),
            ...updateData
        };

        await project.save();

        // Log the update
        await logArchitectProposalUpdate(req, project, originalProposal, project.architectProposals[proposalIndex]);

        return { project, proposal: project.architectProposals[proposalIndex] };
    } catch (error) {
        console.error('Error updating architect proposal:', error);
        throw error;
    }
};

/**
 * Example: Service function to change embedded document status
 */
export const changeArchitectProposalStatus = async (req, projectId, proposalId, action) => {
    try {
        // Get the project
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Find the proposal
        const proposalIndex = project.architectProposals.findIndex(p => p._id.toString() === proposalId);
        if (proposalIndex === -1) {
            throw new Error('Architect proposal not found');
        }

        // Update the status
        const newStatus = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : project.architectProposals[proposalIndex].status;
        project.architectProposals[proposalIndex].status = newStatus;

        await project.save();

        // Log the status change
        await logArchitectProposalStatusChange(req, project, project.architectProposals[proposalIndex], action);

        return { project, proposal: project.architectProposals[proposalIndex] };
    } catch (error) {
        console.error('Error changing architect proposal status:', error);
        throw error;
    }
};

/**
 * Example: Service function to remove embedded document
 */
export const removeArchitectProposalFromProject = async (req, projectId, proposalId) => {
    try {
        // Get the project
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Find the proposal
        const proposalIndex = project.architectProposals.findIndex(p => p._id.toString() === proposalId);
        if (proposalIndex === -1) {
            throw new Error('Architect proposal not found');
        }

        // Store for logging
        const proposalToRemove = project.architectProposals[proposalIndex];

        // Remove the proposal
        project.architectProposals.splice(proposalIndex, 1);
        await project.save();

        // Log the removal
        await logArchitectProposalRemoval(req, project, proposalToRemove);

        return { project };
    } catch (error) {
        console.error('Error removing architect proposal:', error);
        throw error;
    }
};

// ============================================================================
// CONTROLLER INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: Controller function with embedded document logging
 */
export const addArchitectProposal = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const proposalData = req.body;

    const result = await addArchitectProposalToProject(req, projectId, proposalData);

    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'Architect proposal added successfully',
        data: {
            project: result.project,
            proposal: result.proposal
        }
    });
});

/**
 * Example: Controller function to update embedded document
 */
export const updateArchitectProposal = catchAsync(async (req, res) => {
    const { projectId, proposalId } = req.params;
    const updateData = req.body;

    const result = await updateArchitectProposalInProject(req, projectId, proposalId, updateData);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Architect proposal updated successfully',
        data: {
            project: result.project,
            proposal: result.proposal
        }
    });
});

/**
 * Example: Controller function to change embedded document status
 */
export const changeProposalStatus = catchAsync(async (req, res) => {
    const { projectId, proposalId } = req.params;
    const { action } = req.body;

    const result = await changeArchitectProposalStatus(req, projectId, proposalId, action);

    res.status(httpStatus.OK).json({
        status: 1,
        message: `Architect proposal ${action}d successfully`,
        data: {
            project: result.project,
            proposal: result.proposal
        }
    });
});

/**
 * Example: Controller function to get embedded document logs
 */
export const getProjectEmbeddedLogs = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { embeddedField, action, limit = 20, page = 1 } = req.query;

    let logs;
    if (embeddedField && action) {
        logs = await getEmbeddedDocumentLogsByAction('Project', projectId, embeddedField, action, { limit, page });
    } else if (embeddedField) {
        logs = await getEmbeddedDocumentLogs('Project', projectId, embeddedField, { limit, page });
    } else {
        logs = await getAllProjectEmbeddedLogs(projectId, { limit, page });
    }

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Embedded document logs fetched successfully',
        data: logs
    });
});

// ============================================================================
// ROUTE INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: Routes for embedded document operations
 */
export const embeddedDocumentRoutes = (router) => {
    // Add architect proposal to project
    router.post('/projects/:projectId/architect-proposals', auth('manageProjects'), addArchitectProposal);

    // Update architect proposal in project
    router.put('/projects/:projectId/architect-proposals/:proposalId', auth('manageProjects'), updateArchitectProposal);

    // Change architect proposal status
    router.patch('/projects/:projectId/architect-proposals/:proposalId/status', auth('manageProjects'), changeProposalStatus);

    // Remove architect proposal from project
    router.delete('/projects/:projectId/architect-proposals/:proposalId', auth('manageProjects'), removeArchitectProposal);

    // Get embedded document logs
    router.get('/projects/:projectId/embedded-logs', auth('getLogs'), getProjectEmbeddedLogs);

    return router;
};
