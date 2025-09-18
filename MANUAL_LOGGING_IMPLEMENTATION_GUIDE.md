# Manual Logging Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Implementation Steps](#implementation-steps)
5. [API Integration Patterns](#api-integration-patterns)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Examples by Model](#examples-by-model)
10. [Testing & Validation](#testing--validation)

---

## Overview

This guide provides a comprehensive approach to implementing manual activity logging in any API endpoint. The logging system tracks user actions, changes, and system events with complete audit trails.

### What This Guide Covers
- ✅ **Step-by-step implementation** for any API
- ✅ **Complete code examples** for different scenarios
- ✅ **Integration patterns** for controllers, services, and routes
- ✅ **Advanced features** like embedded documents and bulk operations
- ✅ **Best practices** and performance optimization
- ✅ **Testing strategies** and validation approaches

### Prerequisites
- Node.js/Express.js application
- MongoDB with Mongoose
- Understanding of async/await patterns
- Basic knowledge of middleware concepts

---

## Quick Start

### 1. Install Dependencies
```bash
npm install lodash
```

### 2. Import Logging Functions
```javascript
import { 
    logActivity, 
    logCRUDOperation, 
    logStatusChange, 
    logWorkflowAction,
    logCommunicationAction,
    logFileOperation 
} from '../middlewares/activityLog.middleware.js';
```

### 3. Basic Implementation
```javascript
// In your service function
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        // Log the creation
        await logCRUDOperation(req, 'create', 'User', null, user, {
            customDescription: `Created new user: ${user.email}`,
            metadata: { userRole: user.role }
        });
        
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};
```

---

## Core Concepts

### 1. Logging Functions Overview

| Function | Purpose | Use Case |
|----------|---------|----------|
| `logActivity` | General purpose logging | Custom actions, complex operations |
| `logCRUDOperation` | CRUD operations | Create, update, delete operations |
| `logStatusChange` | Status modifications | Approve, reject, activate, deactivate |
| `logWorkflowAction` | Workflow operations | Convert, finalize, submit, assign |
| `logCommunicationAction` | Communication events | Send messages, notifications |
| `logFileOperation` | File operations | Upload, download, delete files |

### 2. Log Structure
```javascript
{
    user: ObjectId,           // Who performed the action
    userModel: String,        // 'User' or 'Admin'
    userName: String,         // User's name
    userEmail: String,        // User's email
    targetModel: String,      // What was affected
    targetId: ObjectId,       // ID of affected document
    targetName: String,       // Human-readable name
    action: String,           // What action was performed
    actionType: String,       // Category of action
    description: String,      // Human-readable description
    changes: Object,          // Detailed changes
    previousValues: Object,   // Previous state
    newValues: Object,        // New state
    metadata: Object,         // Additional context
    timestamp: Date,          // When it happened
    isActive: Boolean         // Log status
}
```

---

## Implementation Steps

### Step 1: Choose the Right Logging Function

#### For CRUD Operations
```javascript
// Create
await logCRUDOperation(req, 'create', 'User', null, newUser, {
    customDescription: `Created new user: ${newUser.email}`,
    metadata: { userRole: newUser.role }
});

// Update
await logCRUDOperation(req, 'update', 'User', oldUser, updatedUser, {
    customDescription: `Updated user: ${updatedUser.email}`,
    excludeFields: ['__v', 'updatedAt'],
    sensitiveFields: ['password']
});

// Delete
await logCRUDOperation(req, 'delete', 'User', userToDelete, null, {
    customDescription: `Deleted user: ${userToDelete.email}`,
    metadata: { deletionReason: 'User requested' }
});
```

#### For Status Changes
```javascript
await logStatusChange(req, 'approve', 'Project', project, {
    oldStatus: 'pending',
    newStatus: 'approved',
    customDescription: `Approved project: ${project.projectName}`,
    metadata: { approvedBy: req.user.name }
});
```

#### For Workflow Actions
```javascript
await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
    customDescription: `Converted proposal to work order: ${proposal.title}`,
    metadata: { projectId: proposal.project }
});
```

#### For Communication Actions
```javascript
await logCommunicationAction(req, 'send_whatsapp', 'PO', po, {
    customDescription: `Sent WhatsApp message for PO: ${po.name}`,
    communicationDetails: {
        recipient: po.vendorWhatsappNumber,
        template: 'order_update',
        status: 'sent'
    }
});
```

#### For File Operations
```javascript
await logFileOperation(req, 'upload', 'Project', projectId, fileDetails, {
    customDescription: `Uploaded file: ${fileDetails.fileName}`,
    metadata: { fileSize: fileDetails.size }
});
```

### Step 2: Implement in Service Layer

```javascript
// Example: User Service with Logging
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        // Log the creation
        await logCRUDOperation(req, 'create', 'User', null, user, {
            customDescription: `Created new user: ${user.email}`,
            metadata: { 
                userRole: user.role,
                createdBy: req.user.name
            }
        });
        
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};

export const updateUser = async (req, userId, updateData) => {
    try {
        const oldUser = await User.findById(userId);
        if (!oldUser) {
            throw new Error('User not found');
        }
        
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { 
            new: true, 
            runValidators: true 
        });
        
        // Log the update
        await logCRUDOperation(req, 'update', 'User', oldUser, updatedUser, {
            customDescription: `Updated user: ${updatedUser.email}`,
            excludeFields: ['__v', 'updatedAt'],
            sensitiveFields: ['password'],
            metadata: { 
                updatedBy: req.user.name,
                fieldsChanged: Object.keys(updateData)
            }
        });
        
        return updatedUser;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
};

export const deleteUser = async (req, userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        await User.findByIdAndDelete(userId);
        
        // Log the deletion
        await logCRUDOperation(req, 'delete', 'User', user, null, {
            customDescription: `Deleted user: ${user.email}`,
            metadata: { 
                deletedBy: req.user.name,
                deletionReason: 'User requested'
            }
        });
        
        return { message: 'User deleted successfully' };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
};
```

### Step 3: Implement in Controller Layer

```javascript
// Example: User Controller with Logging
export const createUser = catchAsync(async (req, res) => {
    const userData = req.body;
    
    const user = await userService.createUser(req, userData);
    
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'User created successfully',
        data: user
    });
});

export const updateUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const updateData = req.body;
    
    const user = await userService.updateUser(req, userId, updateData);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'User updated successfully',
        data: user
    });
});

export const deleteUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    
    const result = await userService.deleteUser(req, userId);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'User deleted successfully',
        data: result
    });
});
```

### Step 4: Add Logging Routes (Optional)

```javascript
// Example: Activity Log Routes
router.get('/activity-logs', auth('getLogs'), activityLogController.queryActivityLogs);
router.get('/activity-logs/:activityLogId', auth('getLogs'), activityLogController.getActivityLog);
router.get('/activity-logs/target/:targetModel/:targetId', auth('getLogs'), activityLogController.getActivityLogsByTarget);
router.get('/activity-logs/actor/:actorId/:actorModel', auth('getLogs'), activityLogController.getActivityLogsByActor);
```

---

## API Integration Patterns

### Pattern 1: Simple CRUD with Logging

```javascript
// Service
export const createProject = async (req, projectData) => {
    try {
        const project = await Project.create(projectData);
        
        await logCRUDOperation(req, 'create', 'Project', null, project, {
            customDescription: `Created project: ${project.projectName}`,
            metadata: { 
                projectCode: project.projectCode,
                budget: project.budget
            }
        });
        
        return project;
    } catch (error) {
        console.error('Error creating project:', error);
        throw error;
    }
};

// Controller
export const createProject = catchAsync(async (req, res) => {
    const projectData = req.body;
    const project = await projectService.createProject(req, projectData);
    
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'Project created successfully',
        data: project
    });
});
```

### Pattern 2: Status Change with Logging

```javascript
// Service
export const approveProject = async (req, projectId) => {
    try {
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        
        const oldStatus = project.status;
        project.status = 'approved';
        project.approvedBy = req.user._id;
        project.approvedAt = new Date();
        await project.save();
        
        await logStatusChange(req, 'approve', 'Project', project, {
            oldStatus: oldStatus,
            newStatus: project.status,
            customDescription: `Approved project: ${project.projectName}`,
            metadata: { 
                approvedBy: req.user.name,
                approvedAt: project.approvedAt
            }
        });
        
        return project;
    } catch (error) {
        console.error('Error approving project:', error);
        throw error;
    }
};

// Controller
export const approveProject = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const project = await projectService.approveProject(req, projectId);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Project approved successfully',
        data: project
    });
});
```

### Pattern 3: Workflow Action with Logging

```javascript
// Service
export const convertProposalToWorkOrder = async (req, proposalId) => {
    try {
        const proposal = await ClientProposal.findById(proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        
        proposal.convertedToWorkOrder = true;
        proposal.convertedToWorkOrderAt = new Date();
        await proposal.save();
        
        await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
            customDescription: `Converted proposal to work order: ${proposal.title}`,
            metadata: { 
                projectId: proposal.project,
                convertedAt: proposal.convertedToWorkOrderAt
            }
        });
        
        return proposal;
    } catch (error) {
        console.error('Error converting proposal:', error);
        throw error;
    }
};

// Controller
export const convertProposalToWorkOrder = catchAsync(async (req, res) => {
    const { proposalId } = req.params;
    const proposal = await proposalService.convertProposalToWorkOrder(req, proposalId);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Proposal converted to work order successfully',
        data: proposal
    });
});
```

### Pattern 4: Communication Action with Logging

```javascript
// Service
export const sendWhatsAppMessage = async (req, poId) => {
    try {
        const po = await PO.findById(poId);
        if (!po) {
            throw new Error('PO not found');
        }
        
        // Send WhatsApp message logic here
        const whatsappResult = await sendWhatsAppToVendor(po);
        
        await logCommunicationAction(req, 'send_whatsapp', 'PO', po, {
            customDescription: `Sent WhatsApp message for PO: ${po.name}`,
            communicationDetails: {
                recipient: po.vendorWhatsappNumber,
                template: 'order_update',
                status: whatsappResult.success ? 'sent' : 'failed',
                messageId: whatsappResult.messageId
            }
        });
        
        return { po, whatsappResult };
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        throw error;
    }
};

// Controller
export const sendWhatsAppMessage = catchAsync(async (req, res) => {
    const { poId } = req.params;
    const result = await poService.sendWhatsAppMessage(req, poId);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'WhatsApp message sent successfully',
        data: result
    });
});
```

### Pattern 5: File Operation with Logging

```javascript
// Service
export const uploadProjectDocument = async (req, projectId, fileDetails) => {
    try {
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        
        // File upload logic here
        const uploadedFile = await uploadToS3(fileDetails);
        
        await logFileOperation(req, 'upload', 'Project', projectId, fileDetails, {
            customDescription: `Uploaded file: ${fileDetails.fileName}`,
            metadata: { 
                fileSize: fileDetails.size,
                fileType: fileDetails.type,
                s3Key: uploadedFile.key
            }
        });
        
        return uploadedFile;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

// Controller
export const uploadProjectDocument = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const fileDetails = req.file;
    
    const result = await projectService.uploadProjectDocument(req, projectId, fileDetails);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'File uploaded successfully',
        data: result
    });
});
```

---

## Advanced Features

### 1. Embedded Document Logging

```javascript
import { 
    logEmbeddedDocumentOperation,
    logEmbeddedDocumentUpdate,
    logEmbeddedDocumentStatusChange 
} from '../middlewares/embeddedDocumentLogging.middleware.js';

// Add embedded document
export const addArchitectProposal = async (req, projectId, proposalData) => {
    try {
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        
        const newProposal = {
            _id: new mongoose.Types.ObjectId(),
            ...proposalData,
            submittedAt: new Date()
        };
        
        project.architectProposals.push(newProposal);
        await project.save();
        
        await logEmbeddedDocumentOperation(req, 'add', 'Project', project._id, project.projectName, 'architectProposals', newProposal, {
            customDescription: `Added architect proposal to project: ${project.projectName}`,
            metadata: {
                architectId: newProposal.architect,
                proposedCharges: newProposal.proposedCharges
            }
        });
        
        return { project, proposal: newProposal };
    } catch (error) {
        console.error('Error adding architect proposal:', error);
        throw error;
    }
};
```

### 2. Bulk Operations Logging

```javascript
export const bulkUpdateUsers = async (req, userIds, updateData) => {
    try {
        const users = await User.find({ _id: { $in: userIds } });
        
        await User.updateMany(
            { _id: { $in: userIds } },
            updateData
        );
        
        await logActivity(req, {
            action: 'bulk_update',
            targetModel: 'User',
            targetId: userIds[0], // Use first ID as reference
            targetName: `${userIds.length} users`,
            description: `Bulk updated ${userIds.length} users`,
            metadata: {
                userIds: userIds,
                updateData: updateData,
                updatedBy: req.user.name
            }
        });
        
        return { message: `Updated ${userIds.length} users successfully` };
    } catch (error) {
        console.error('Error bulk updating users:', error);
        throw error;
    }
};
```

### 3. Custom Action Logging

```javascript
export const customAction = async (req, targetId, actionData) => {
    try {
        const target = await TargetModel.findById(targetId);
        if (!target) {
            throw new Error('Target not found');
        }
        
        // Perform custom action
        const result = await performCustomAction(target, actionData);
        
        await logActivity(req, {
            action: 'custom_action',
            targetModel: 'TargetModel',
            targetId: target._id,
            targetName: target.name,
            description: `Performed custom action: ${actionData.actionType}`,
            metadata: {
                actionType: actionData.actionType,
                actionData: actionData,
                result: result
            }
        });
        
        return result;
    } catch (error) {
        console.error('Error performing custom action:', error);
        throw error;
    }
};
```

---

## Best Practices

### 1. Error Handling
```javascript
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        // Always wrap logging in try-catch
        try {
            await logCRUDOperation(req, 'create', 'User', null, user, {
                customDescription: `Created new user: ${user.email}`
            });
        } catch (logError) {
            console.error('Logging error (non-critical):', logError);
            // Don't throw - logging errors shouldn't break the main operation
        }
        
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};
```

### 2. Performance Optimization
```javascript
// Use async/await for better performance
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        // Log asynchronously without waiting
        logCRUDOperation(req, 'create', 'User', null, user, {
            customDescription: `Created new user: ${user.email}`
        }).catch(error => {
            console.error('Logging error:', error);
        });
        
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};
```

### 3. Sensitive Data Handling
```javascript
export const updateUser = async (req, userId, updateData) => {
    try {
        const oldUser = await User.findById(userId);
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
        
        await logCRUDOperation(req, 'update', 'User', oldUser, updatedUser, {
            customDescription: `Updated user: ${updatedUser.email}`,
            excludeFields: ['__v', 'updatedAt', 'password'],
            sensitiveFields: ['password', 'token', 'secret'],
            metadata: { updatedBy: req.user.name }
        });
        
        return updatedUser;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
};
```

### 4. Consistent Naming
```javascript
// Use consistent naming patterns
export const createProject = async (req, projectData) => {
    try {
        const project = await Project.create(projectData);
        
        await logCRUDOperation(req, 'create', 'Project', null, project, {
            customDescription: `Created project: ${project.projectName}`, // Always use descriptive names
            metadata: { 
                projectCode: project.projectCode,
                budget: project.budget
            }
        });
        
        return project;
    } catch (error) {
        console.error('Error creating project:', error);
        throw error;
    }
};
```

### 5. Metadata Best Practices
```javascript
export const createProject = async (req, projectData) => {
    try {
        const project = await Project.create(projectData);
        
        await logCRUDOperation(req, 'create', 'Project', null, project, {
            customDescription: `Created project: ${project.projectName}`,
            metadata: { 
                // Include relevant business context
                projectCode: project.projectCode,
                budget: project.budget,
                clientId: project.client,
                
                // Include user context
                createdBy: req.user.name,
                createdByRole: req.user.role,
                
                // Include system context
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                
                // Include timestamps
                createdAt: project.createdAt
            }
        });
        
        return project;
    } catch (error) {
        console.error('Error creating project:', error);
        throw error;
    }
};
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Logging Errors Breaking Main Operations
```javascript
// ❌ Bad - logging error breaks main operation
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        await logCRUDOperation(req, 'create', 'User', null, user); // This could throw
        return user;
    } catch (error) {
        throw error; // This includes logging errors
    }
};

// ✅ Good - logging errors don't break main operation
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        try {
            await logCRUDOperation(req, 'create', 'User', null, user);
        } catch (logError) {
            console.error('Logging error (non-critical):', logError);
        }
        
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};
```

#### 2. Missing User Context
```javascript
// ❌ Bad - no user context
export const createUser = async (userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(null, 'create', 'User', null, user); // No req object
    return user;
};

// ✅ Good - proper user context
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(req, 'create', 'User', null, user);
    return user;
};
```

#### 3. Inconsistent Logging
```javascript
// ❌ Bad - inconsistent logging
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    // No logging
    return user;
};

export const updateUser = async (req, userId, updateData) => {
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    await logCRUDOperation(req, 'update', 'User', null, user); // Inconsistent
    return user;
};

// ✅ Good - consistent logging
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(req, 'create', 'User', null, user);
    return user;
};

export const updateUser = async (req, userId, updateData) => {
    const oldUser = await User.findById(userId);
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    await logCRUDOperation(req, 'update', 'User', oldUser, user);
    return user;
};
```

#### 4. Performance Issues
```javascript
// ❌ Bad - blocking logging
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(req, 'create', 'User', null, user); // Blocks response
    return user;
};

// ✅ Good - non-blocking logging
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    
    // Log asynchronously without waiting
    logCRUDOperation(req, 'create', 'User', null, user).catch(error => {
        console.error('Logging error:', error);
    });
    
    return user;
};
```

---

## Examples by Model

### User Model
```javascript
// Create User
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        await logCRUDOperation(req, 'create', 'User', null, user, {
            customDescription: `Created new user: ${user.email}`,
            metadata: { 
                userRole: user.role,
                createdBy: req.user.name
            }
        });
        
        return user;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};

// Update User
export const updateUser = async (req, userId, updateData) => {
    try {
        const oldUser = await User.findById(userId);
        if (!oldUser) {
            throw new Error('User not found');
        }
        
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { 
            new: true, 
            runValidators: true 
        });
        
        await logCRUDOperation(req, 'update', 'User', oldUser, updatedUser, {
            customDescription: `Updated user: ${updatedUser.email}`,
            excludeFields: ['__v', 'updatedAt'],
            sensitiveFields: ['password'],
            metadata: { 
                updatedBy: req.user.name,
                fieldsChanged: Object.keys(updateData)
            }
        });
        
        return updatedUser;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
};

// Activate User
export const activateUser = async (req, userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const oldStatus = user.isActive;
        user.isActive = true;
        await user.save();
        
        await logStatusChange(req, 'activate', 'User', user, {
            oldStatus: oldStatus,
            newStatus: user.isActive,
            customDescription: `Activated user: ${user.email}`,
            metadata: { 
                activatedBy: req.user.name,
                activatedAt: new Date()
            }
        });
        
        return user;
    } catch (error) {
        console.error('Error activating user:', error);
        throw error;
    }
};
```

### Project Model
```javascript
// Create Project
export const createProject = async (req, projectData) => {
    try {
        const project = await Project.create(projectData);
        
        await logCRUDOperation(req, 'create', 'Project', null, project, {
            customDescription: `Created project: ${project.projectName}`,
            metadata: { 
                projectCode: project.projectCode,
                budget: project.budget,
                clientId: project.client
            }
        });
        
        return project;
    } catch (error) {
        console.error('Error creating project:', error);
        throw error;
    }
};

// Approve Project
export const approveProject = async (req, projectId) => {
    try {
        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        
        const oldStatus = project.status;
        project.status = 'approved';
        project.approvedBy = req.user._id;
        project.approvedAt = new Date();
        await project.save();
        
        await logStatusChange(req, 'approve', 'Project', project, {
            oldStatus: oldStatus,
            newStatus: project.status,
            customDescription: `Approved project: ${project.projectName}`,
            metadata: { 
                approvedBy: req.user.name,
                approvedAt: project.approvedAt
            }
        });
        
        return project;
    } catch (error) {
        console.error('Error approving project:', error);
        throw error;
    }
};
```

### Client Proposal Model
```javascript
// Convert Proposal to Work Order
export const convertProposalToWorkOrder = async (req, proposalId) => {
    try {
        const proposal = await ClientProposal.findById(proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        
        proposal.convertedToWorkOrder = true;
        proposal.convertedToWorkOrderAt = new Date();
        await proposal.save();
        
        await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
            customDescription: `Converted proposal to work order: ${proposal.title}`,
            metadata: { 
                projectId: proposal.project,
                convertedAt: proposal.convertedToWorkOrderAt
            }
        });
        
        return proposal;
    } catch (error) {
        console.error('Error converting proposal:', error);
        throw error;
    }
};
```

### PO Model
```javascript
// Create PO
export const createPO = async (req, poData) => {
    try {
        const po = await PO.create(poData);
        
        await logCRUDOperation(req, 'create', 'PO', null, po, {
            customDescription: `Created PO: ${po.name}`,
            metadata: { 
                vendorId: po.vendor,
                projectId: po.project,
                totalAmount: po.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
            }
        });
        
        return po;
    } catch (error) {
        console.error('Error creating PO:', error);
        throw error;
    }
};

// Send WhatsApp Message
export const sendWhatsAppMessage = async (req, poId) => {
    try {
        const po = await PO.findById(poId);
        if (!po) {
            throw new Error('PO not found');
        }
        
        const whatsappResult = await sendWhatsAppToVendor(po);
        
        await logCommunicationAction(req, 'send_whatsapp', 'PO', po, {
            customDescription: `Sent WhatsApp message for PO: ${po.name}`,
            communicationDetails: {
                recipient: po.vendorWhatsappNumber,
                template: 'order_update',
                status: whatsappResult.success ? 'sent' : 'failed',
                messageId: whatsappResult.messageId
            }
        });
        
        return { po, whatsappResult };
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        throw error;
    }
};
```

---

## Testing & Validation

### 1. Unit Tests
```javascript
// Test logging functionality
describe('User Service Logging', () => {
    it('should log user creation', async () => {
        const mockReq = {
            user: { _id: 'user123', name: 'Test User', email: 'test@example.com' }
        };
        
        const userData = {
            name: 'New User',
            email: 'newuser@example.com',
            role: 'user'
        };
        
        const user = await userService.createUser(mockReq, userData);
        
        // Verify user was created
        expect(user).toBeDefined();
        expect(user.email).toBe('newuser@example.com');
        
        // Verify logging was called (you might need to mock the logging function)
        // This depends on your testing setup
    });
});
```

### 2. Integration Tests
```javascript
// Test API endpoints with logging
describe('User API with Logging', () => {
    it('should create user and log activity', async () => {
        const userData = {
            name: 'Test User',
            email: 'test@example.com',
            role: 'user'
        };
        
        const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${validToken}`)
            .send(userData)
            .expect(201);
        
        expect(response.body.status).toBe(1);
        expect(response.body.data.email).toBe('test@example.com');
        
        // Verify activity log was created
        const activityLogs = await ActivityLog.find({
            targetModel: 'User',
            action: 'create'
        });
        
        expect(activityLogs).toHaveLength(1);
        expect(activityLogs[0].targetName).toBe('test@example.com');
    });
});
```

### 3. Log Validation
```javascript
// Validate log structure
export const validateActivityLog = (log) => {
    const requiredFields = [
        'user', 'userModel', 'userName', 'userEmail',
        'targetModel', 'targetId', 'targetName',
        'action', 'description', 'timestamp'
    ];
    
    for (const field of requiredFields) {
        if (!log[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    
    // Validate action enum
    const validActions = [
        'create', 'update', 'delete', 'activate', 'deactivate',
        'approve', 'reject', 'send', 'convert', 'finalize'
    ];
    
    if (!validActions.includes(log.action)) {
        throw new Error(`Invalid action: ${log.action}`);
    }
    
    return true;
};
```

---

## Conclusion

This guide provides a comprehensive approach to implementing manual activity logging in any API. By following these patterns and best practices, you can ensure:

- ✅ **Complete audit trails** for all user actions
- ✅ **Consistent logging** across all endpoints
- ✅ **Performance optimization** with non-blocking logging
- ✅ **Error handling** that doesn't break main operations
- ✅ **Flexible metadata** for rich context
- ✅ **Easy testing** and validation

Remember to:
1. **Always log operations** - consistency is key
2. **Handle errors gracefully** - logging shouldn't break main operations
3. **Use appropriate functions** - choose the right logging function for each scenario
4. **Include rich metadata** - provide context for future analysis
5. **Test thoroughly** - ensure logging works as expected

For more specific examples and advanced patterns, refer to the individual model examples and the embedded document logging guide.








