# Logging Quick Reference Card

## 🚀 Quick Start

### 1. Import Functions
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

### 2. Basic Implementation
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

## 📋 Function Reference

### `logCRUDOperation(req, action, targetModel, oldDoc, newDoc, options)`
**Use for:** Create, Update, Delete operations
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
    customDescription: `Deleted user: ${userToDelete.email}`
});
```

### `logStatusChange(req, action, targetModel, doc, options)`
**Use for:** Approve, Reject, Activate, Deactivate
```javascript
await logStatusChange(req, 'approve', 'Project', project, {
    oldStatus: 'pending',
    newStatus: 'approved',
    customDescription: `Approved project: ${project.projectName}`,
    metadata: { approvedBy: req.user.name }
});
```

### `logWorkflowAction(req, action, targetModel, doc, options)`
**Use for:** Convert, Finalize, Submit, Assign
```javascript
await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
    customDescription: `Converted proposal to work order: ${proposal.title}`,
    metadata: { projectId: proposal.project }
});
```

### `logCommunicationAction(req, action, targetModel, doc, options)`
**Use for:** Send messages, notifications
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

### `logFileOperation(req, action, targetModel, targetId, fileDetails, options)`
**Use for:** Upload, Download, Delete files
```javascript
await logFileOperation(req, 'upload', 'Project', projectId, fileDetails, {
    customDescription: `Uploaded file: ${fileDetails.fileName}`,
    metadata: { fileSize: fileDetails.size }
});
```

### `logActivity(req, logDetails)`
**Use for:** Custom actions, complex operations
```javascript
await logActivity(req, {
    action: 'custom_action',
    targetModel: 'Project',
    targetId: project._id,
    targetName: project.projectName,
    description: `Performed custom action: ${actionData.actionType}`,
    metadata: { actionData: actionData }
});
```

---

## 🎯 Common Patterns

### Service Layer Pattern
```javascript
export const createEntity = async (req, entityData) => {
    try {
        const entity = await Entity.create(entityData);
        
        // Log the creation
        await logCRUDOperation(req, 'create', 'Entity', null, entity, {
            customDescription: `Created ${entity.name}`,
            metadata: { createdBy: req.user.name }
        });
        
        return entity;
    } catch (error) {
        console.error('Error creating entity:', error);
        throw error;
    }
};
```

### Controller Layer Pattern
```javascript
export const createEntity = catchAsync(async (req, res) => {
    const entityData = req.body;
    const entity = await entityService.createEntity(req, entityData);
    
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'Entity created successfully',
        data: entity
    });
});
```

### Error Handling Pattern
```javascript
export const createEntity = async (req, entityData) => {
    try {
        const entity = await Entity.create(entityData);
        
        // Log with error handling
        try {
            await logCRUDOperation(req, 'create', 'Entity', null, entity, {
                customDescription: `Created ${entity.name}`
            });
        } catch (logError) {
            console.error('Logging error (non-critical):', logError);
        }
        
        return entity;
    } catch (error) {
        console.error('Error creating entity:', error);
        throw error;
    }
};
```

---

## 🔧 Options Reference

### `logCRUDOperation` Options
```javascript
{
    customDescription: 'Custom description',     // Override default description
    excludeFields: ['__v', 'updatedAt'],        // Fields to exclude from change detection
    sensitiveFields: ['password', 'token'],     // Fields to mask in logs
    metadata: {                                 // Additional context
        field1: 'value1',
        field2: 'value2'
    }
}
```

### `logStatusChange` Options
```javascript
{
    oldStatus: 'pending',                       // Previous status
    newStatus: 'approved',                      // New status
    customDescription: 'Custom description',    // Override default description
    metadata: {                                 // Additional context
        approvedBy: 'John Doe',
        approvedAt: new Date()
    }
}
```

### `logWorkflowAction` Options
```javascript
{
    customDescription: 'Custom description',    // Override default description
    metadata: {                                 // Additional context
        projectId: 'project123',
        convertedAt: new Date()
    }
}
```

### `logCommunicationAction` Options
```javascript
{
    customDescription: 'Custom description',    // Override default description
    communicationDetails: {                     // Communication specifics
        recipient: 'vendor@example.com',
        template: 'order_update',
        status: 'sent',
        messageId: 'msg123'
    },
    metadata: {                                 // Additional context
        sentBy: 'John Doe'
    }
}
```

### `logFileOperation` Options
```javascript
{
    customDescription: 'Custom description',    // Override default description
    metadata: {                                 // Additional context
        fileSize: 1024,
        fileType: 'pdf',
        s3Key: 'uploads/file.pdf'
    }
}
```

---

## 📊 Metadata Best Practices

### Include Business Context
```javascript
metadata: {
    // Business identifiers
    projectCode: project.projectCode,
    clientId: project.client,
    vendorId: po.vendor,
    
    // User context
    createdBy: req.user.name,
    createdByRole: req.user.role,
    
    // System context
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    
    // Timestamps
    createdAt: new Date()
}
```

### Include Relevant Data
```javascript
metadata: {
    // For user operations
    userRole: user.role,
    userStatus: user.isActive,
    
    // For project operations
    projectStatus: project.status,
    projectBudget: project.budget,
    
    // For PO operations
    totalAmount: po.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0),
    itemCount: po.items.length,
    
    // For file operations
    fileSize: fileDetails.size,
    fileType: fileDetails.type
}
```

---

## ⚠️ Common Mistakes

### ❌ Don't Break Main Operations
```javascript
// Bad - logging error breaks main operation
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(req, 'create', 'User', null, user); // Could throw
    return user;
};

// Good - logging error doesn't break main operation
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    
    try {
        await logCRUDOperation(req, 'create', 'User', null, user);
    } catch (logError) {
        console.error('Logging error (non-critical):', logError);
    }
    
    return user;
};
```

### ❌ Don't Forget User Context
```javascript
// Bad - no user context
export const createUser = async (userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(null, 'create', 'User', null, user); // No req
    return user;
};

// Good - proper user context
export const createUser = async (req, userData) => {
    const user = await User.create(userData);
    await logCRUDOperation(req, 'create', 'User', null, user);
    return user;
};
```

### ❌ Don't Log Sensitive Data
```javascript
// Bad - logging sensitive data
await logCRUDOperation(req, 'update', 'User', oldUser, updatedUser, {
    metadata: { password: updatedUser.password } // Don't do this!
});

// Good - exclude sensitive fields
await logCRUDOperation(req, 'update', 'User', oldUser, updatedUser, {
    excludeFields: ['__v', 'updatedAt'],
    sensitiveFields: ['password', 'token', 'secret']
});
```

---

## 🧪 Testing

### Unit Test Example
```javascript
describe('User Service Logging', () => {
    it('should log user creation', async () => {
        const mockReq = {
            user: { _id: 'user123', name: 'Test User', email: 'test@example.com' }
        };
        
        const userData = { name: 'New User', email: 'newuser@example.com' };
        const user = await userService.createUser(mockReq, userData);
        
        expect(user).toBeDefined();
        expect(user.email).toBe('newuser@example.com');
    });
});
```

### Integration Test Example
```javascript
describe('User API with Logging', () => {
    it('should create user and log activity', async () => {
        const userData = { name: 'Test User', email: 'test@example.com' };
        
        const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${validToken}`)
            .send(userData)
            .expect(201);
        
        expect(response.body.status).toBe(1);
        
        // Verify activity log was created
        const activityLogs = await ActivityLog.find({
            targetModel: 'User',
            action: 'create'
        });
        
        expect(activityLogs).toHaveLength(1);
    });
});
```

---

## 📚 Additional Resources

- **Full Implementation Guide**: `MANUAL_LOGGING_IMPLEMENTATION_GUIDE.md`
- **Embedded Document Logging**: `EMBEDDED_DOCUMENT_LOGGING_GUIDE.md`
- **Examples**: `src/examples/manualLoggingExamples.js`
- **Middleware**: `src/middlewares/activityLog.middleware.js`
- **Model**: `src/models/activityLog.model.js`

---

## 🆘 Need Help?

1. **Check the full guide** for detailed examples
2. **Look at existing implementations** in the codebase
3. **Test your implementation** with unit tests
4. **Verify logs** are being created in the database
5. **Check console errors** for logging issues

Remember: **Logging errors should never break your main operations!** 🚀




