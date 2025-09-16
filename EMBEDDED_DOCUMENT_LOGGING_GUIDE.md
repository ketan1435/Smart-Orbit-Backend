# Embedded Document Logging Guide

This guide explains how to handle logging and retrieval for embedded documents within parent models, such as `architectProposals` and `architectDocuments` in the Project model.

## Overview

Embedded documents are subdocuments stored within a parent document. For example:
- `architectProposals` array in Project model
- `architectDocuments` array in Project model
- Any other embedded schemas within parent models

## Key Concepts

### 1. Embedded Document Structure
```javascript
// Project model with embedded documents
const projectSchema = new mongoose.Schema({
    projectName: String,
    architectProposals: [architectProposalSchema], // Embedded array
    architectDocuments: [architectDocumentSchema], // Embedded array
    // ... other fields
});
```

### 2. Logging Strategy
- **Parent Model**: The main model (e.g., 'Project')
- **Parent ID**: The ID of the parent document
- **Embedded Field**: The name of the embedded field (e.g., 'architectProposals')
- **Embedded Document**: The specific subdocument being modified

## Core Functions

### 1. Basic Embedded Document Operations
```javascript
import { logEmbeddedDocumentOperation } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Log adding an embedded document
await logEmbeddedDocumentOperation(req, 'add', 'Project', projectId, projectName, 'architectProposals', proposal, {
    customDescription: `Added architect proposal to project: ${projectName}`,
    metadata: {
        architectId: proposal.architect,
        proposedCharges: proposal.proposedCharges
    }
});
```

### 2. Embedded Document Updates
```javascript
import { logEmbeddedDocumentUpdate } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Log updating an embedded document
await logEmbeddedDocumentUpdate(req, 'Project', projectId, projectName, 'architectProposals', originalProposal, updatedProposal, {
    customDescription: `Updated architect proposal in project: ${projectName}`,
    metadata: {
        architectId: updatedProposal.architect,
        statusChanged: originalProposal.status !== updatedProposal.status
    }
});
```

### 3. Embedded Document Status Changes
```javascript
import { logEmbeddedDocumentStatusChange } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Log status change
await logEmbeddedDocumentStatusChange(req, 'approve', 'Project', projectId, projectName, 'architectProposals', proposal, {
    customDescription: `Approved architect proposal in project: ${projectName}`,
    metadata: {
        architectId: proposal.architect,
        previousStatus: proposal.status,
        newStatus: 'Approved'
    }
});
```

### 4. Array Operations
```javascript
import { logEmbeddedArrayOperation } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Log array reorder
await logEmbeddedArrayOperation(req, 'reorder', 'Project', projectId, projectName, 'architectProposals', originalArray, newArray, {
    customDescription: `Reordered architect proposals in project: ${projectName}`,
    metadata: {
        originalOrder: originalArray.map(p => p._id),
        newOrder: newArray.map(p => p._id)
    }
});
```

### 5. Bulk Operations
```javascript
import { logEmbeddedDocumentBulkOperation } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Log bulk operations
await logEmbeddedDocumentBulkOperation(req, 'bulk_add', 'Project', projectId, projectName, 'architectProposals', proposals, {
    customDescription: `Bulk added ${proposals.length} architect proposals to project: ${projectName}`,
    metadata: {
        architectIds: proposals.map(p => p.architect),
        statuses: proposals.map(p => p.status)
    }
});
```

## Retrieval Functions

### 1. Get Embedded Document Logs
```javascript
import { getEmbeddedDocumentLogs } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Get all logs for a specific embedded field
const logs = await getEmbeddedDocumentLogs('Project', projectId, 'architectProposals', {
    limit: 20,
    page: 1,
    sortBy: 'timestamp:desc'
});
```

### 2. Get All Embedded Document Logs
```javascript
import { getAllEmbeddedDocumentLogs } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Get all embedded document logs for a parent
const logs = await getAllEmbeddedDocumentLogs('Project', projectId, {
    limit: 50,
    page: 1
});
```

### 3. Get Logs by Action
```javascript
import { getEmbeddedDocumentLogsByAction } from '../middlewares/embeddedDocumentLogging.middleware.js';

// Get logs for specific action
const logs = await getEmbeddedDocumentLogsByAction('Project', projectId, 'architectProposals', 'add', {
    limit: 10
});
```

## Service Integration Examples

### 1. Add Embedded Document
```javascript
export const addArchitectProposalToProject = async (req, projectId, proposalData) => {
    try {
        // Get the project
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Create new proposal
        const newProposal = {
            _id: new mongoose.Types.ObjectId(),
            ...proposalData,
            submittedAt: new Date()
        };
        
        // Add to project
        project.architectProposals.push(newProposal);
        await project.save();

        // Log the addition
        await logEmbeddedDocumentOperation(req, 'add', 'Project', project._id, project.projectName, 'architectProposals', newProposal, {
            customDescription: `Added architect proposal to project: ${project.projectName}`,
            metadata: {
                architectId: newProposal.architect,
                proposedCharges: newProposal.proposedCharges,
                deliveryTimelineDays: newProposal.deliveryTimelineDays
            }
        });

        return { project, proposal: newProposal };
    } catch (error) {
        console.error('Error adding architect proposal:', error);
        throw error;
    }
};
```

### 2. Update Embedded Document
```javascript
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
        await logEmbeddedDocumentUpdate(req, 'Project', project._id, project.projectName, 'architectProposals', originalProposal, project.architectProposals[proposalIndex], {
            customDescription: `Updated architect proposal in project: ${project.projectName}`,
            metadata: {
                architectId: project.architectProposals[proposalIndex].architect,
                statusChanged: originalProposal.status !== project.architectProposals[proposalIndex].status
            }
        });

        return { project, proposal: project.architectProposals[proposalIndex] };
    } catch (error) {
        console.error('Error updating architect proposal:', error);
        throw error;
    }
};
```

### 3. Change Embedded Document Status
```javascript
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
        await logEmbeddedDocumentStatusChange(req, action, 'Project', project._id, project.projectName, 'architectProposals', project.architectProposals[proposalIndex], {
            customDescription: `${action} architect proposal in project: ${project.projectName}`,
            metadata: {
                architectId: project.architectProposals[proposalIndex].architect,
                previousStatus: project.architectProposals[proposalIndex].status,
                newStatus: newStatus
            }
        });

        return { project, proposal: project.architectProposals[proposalIndex] };
    } catch (error) {
        console.error('Error changing architect proposal status:', error);
        throw error;
    }
};
```

### 4. Remove Embedded Document
```javascript
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
        await logEmbeddedDocumentOperation(req, 'remove', 'Project', project._id, project.projectName, 'architectProposals', proposalToRemove, {
            customDescription: `Removed architect proposal from project: ${project.projectName}`,
            metadata: {
                architectId: proposalToRemove.architect,
                removalReason: 'Architect withdrew proposal'
            }
        });

        return { project };
    } catch (error) {
        console.error('Error removing architect proposal:', error);
        throw error;
    }
};
```

## Controller Integration

### 1. Add Embedded Document Controller
```javascript
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
```

### 2. Update Embedded Document Controller
```javascript
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
```

### 3. Get Embedded Document Logs Controller
```javascript
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
```

## Route Integration

### 1. Embedded Document Routes
```javascript
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
```

## Query Examples

### 1. Get All Architect Proposal Logs
```javascript
// Get all architect proposal logs for a project
const logs = await getEmbeddedDocumentLogs('Project', projectId, 'architectProposals', {
    limit: 20,
    page: 1,
    sortBy: 'timestamp:desc'
});
```

### 2. Get Logs by Action
```javascript
// Get only 'add' actions for architect proposals
const addLogs = await getEmbeddedDocumentLogsByAction('Project', projectId, 'architectProposals', 'add', {
    limit: 10
});
```

### 3. Get All Embedded Document Logs
```javascript
// Get all embedded document logs for a project
const allLogs = await getAllProjectEmbeddedLogs(projectId, {
    limit: 50,
    page: 1
});
```

### 4. Advanced Queries
```javascript
// Get logs for specific architect
const architectLogs = await activityLogService.queryActivityLogs({
    targetModel: 'Project',
    targetId: projectId,
    'metadata.embeddedDocument': true,
    'metadata.embeddedField': 'architectProposals',
    'metadata.architectId': architectId
}, { limit: 20 });
```

## Best Practices

### 1. Always Log Operations
- Log every add, update, remove, and status change
- Include relevant metadata for context
- Use descriptive custom descriptions

### 2. Handle Errors Gracefully
- Don't let logging errors break the main operation
- Use try-catch blocks around logging calls
- Log errors to console for debugging

### 3. Use Appropriate Actions
- `add` - Adding new embedded documents
- `update` - Updating existing embedded documents
- `remove` - Removing embedded documents
- `approve`/`reject` - Status changes
- `reorder` - Array reordering

### 4. Include Relevant Metadata
- Embedded document ID
- Parent document context
- User information
- Timestamps
- Change details

### 5. Optimize Queries
- Use indexes for embedded document queries
- Limit results with pagination
- Sort by timestamp for chronological order

## Database Indexes

The system includes optimized indexes for embedded document queries:

```javascript
// Indexes for embedded document queries
activityLogSchema.index({ 'metadata.embeddedDocument': 1, targetModel: 1, targetId: 1 });
activityLogSchema.index({ 'metadata.embeddedField': 1, targetModel: 1, targetId: 1 });
activityLogSchema.index({ 'metadata.embeddedDocument': 1, 'metadata.embeddedField': 1, action: 1 });
activityLogSchema.index({ 'metadata.embeddedDocId': 1, targetModel: 1, targetId: 1 });
```

## Real-world Example

Here's a complete example of handling architect proposals in a project:

```javascript
// 1. Add architect proposal
const result = await addArchitectProposalToProject(req, projectId, {
    architect: architectId,
    email: 'architect@example.com',
    proposedCharges: 5000,
    deliveryTimelineDays: 7,
    status: 'Pending'
});

// 2. Update proposal
const updated = await updateArchitectProposalInProject(req, projectId, proposalId, {
    proposedCharges: 4500,
    deliveryTimelineDays: 5
});

// 3. Approve proposal
const approved = await changeArchitectProposalStatus(req, projectId, proposalId, 'approve');

// 4. Get logs
const logs = await getEmbeddedDocumentLogs('Project', projectId, 'architectProposals', {
    limit: 20,
    page: 1
});
```

This system provides comprehensive logging and retrieval capabilities for embedded documents, ensuring complete audit trails for all operations.
