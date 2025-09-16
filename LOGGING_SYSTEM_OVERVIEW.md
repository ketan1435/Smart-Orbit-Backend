# Manual Logging System Overview

## 🎯 System Purpose

The manual logging system provides comprehensive activity tracking and audit trails for all user actions and system events in the application. It ensures complete visibility into what users do, when they do it, and what changes are made.

## 📁 Documentation Structure

### 1. **Main Implementation Guide**
- **File**: `MANUAL_LOGGING_IMPLEMENTATION_GUIDE.md`
- **Purpose**: Comprehensive step-by-step guide for implementing logging in any API
- **Audience**: Developers implementing new features or adding logging to existing code
- **Content**: 
  - Complete implementation patterns
  - Service, controller, and route integration
  - Advanced features and best practices
  - Real-world examples for all models

### 2. **Quick Reference Card**
- **File**: `LOGGING_QUICK_REFERENCE.md`
- **Purpose**: Fast lookup for developers who need quick reminders
- **Audience**: Developers who already know the system but need quick reference
- **Content**:
  - Function signatures and parameters
  - Common patterns and examples
  - Options reference
  - Common mistakes to avoid

### 3. **Implementation Checklist**
- **File**: `LOGGING_IMPLEMENTATION_CHECKLIST.md`
- **Purpose**: Ensure nothing is missed during implementation
- **Audience**: Developers and code reviewers
- **Content**:
  - Step-by-step implementation checklist
  - Quality assurance guidelines
  - Testing requirements
  - Production readiness checklist

### 4. **Embedded Document Guide**
- **File**: `EMBEDDED_DOCUMENT_LOGGING_GUIDE.md`
- **Purpose**: Specialized guide for logging embedded documents
- **Audience**: Developers working with complex nested data structures
- **Content**:
  - Embedded document logging patterns
  - Array operation logging
  - Bulk operation logging
  - Retrieval and query examples

## 🏗️ System Architecture

### Core Components

#### 1. **Activity Log Model** (`src/models/activityLog.model.js`)
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

#### 2. **Logging Middleware** (`src/middlewares/activityLog.middleware.js`)
- **`logActivity`** - General purpose logging
- **`logCRUDOperation`** - Create, update, delete operations
- **`logStatusChange`** - Status modifications
- **`logWorkflowAction`** - Workflow operations
- **`logCommunicationAction`** - Communication events
- **`logFileOperation`** - File operations

#### 3. **Embedded Document Middleware** (`src/middlewares/embeddedDocumentLogging.middleware.js`)
- **`logEmbeddedDocumentOperation`** - Basic embedded operations
- **`logEmbeddedDocumentUpdate`** - Embedded document updates
- **`logEmbeddedDocumentStatusChange`** - Status changes
- **`logEmbeddedArrayOperation`** - Array operations
- **`logEmbeddedDocumentBulkOperation`** - Bulk operations

#### 4. **Activity Log Service** (`src/services/activityLog.service.js`)
- **`createActivityLog`** - Create new log entries
- **`queryActivityLogs`** - Query logs with filters
- **`getActivityLogById`** - Get specific log
- **`getActivityLogsByTarget`** - Get logs for specific target
- **`getActivityLogsByActor`** - Get logs for specific user
- **`getRecentActivityLogs`** - Get recent activity
- **`getActivityLogStats`** - Get statistics

#### 5. **Activity Log Controller** (`src/controllers/activityLog.controller.js`)
- **`queryActivityLogs`** - Query logs endpoint
- **`getActivityLog`** - Get specific log endpoint
- **`getActivityLogsByTarget`** - Get target logs endpoint
- **`getActivityLogsByActor`** - Get actor logs endpoint
- **`getRecentActivityLogs`** - Get recent logs endpoint
- **`getActivityLogStats`** - Get statistics endpoint

#### 6. **Activity Log Routes** (`src/routes/v1/activityLog.route.js`)
- **`GET /activity-logs`** - Query logs
- **`GET /activity-logs/:id`** - Get specific log
- **`GET /activity-logs/target/:model/:id`** - Get target logs
- **`GET /activity-logs/actor/:id/:model`** - Get actor logs
- **`GET /activity-logs/recent`** - Get recent logs
- **`GET /activity-logs/stats`** - Get statistics

## 🚀 Quick Start Guide

### 1. **Choose Your Logging Function**
```javascript
// For CRUD operations
await logCRUDOperation(req, 'create', 'User', null, newUser, options);

// For status changes
await logStatusChange(req, 'approve', 'Project', project, options);

// For workflow actions
await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, options);

// For communication
await logCommunicationAction(req, 'send_whatsapp', 'PO', po, options);

// For file operations
await logFileOperation(req, 'upload', 'Project', projectId, fileDetails, options);
```

### 2. **Implement in Service Layer**
```javascript
export const createUser = async (req, userData) => {
    try {
        const user = await User.create(userData);
        
        // Log the creation
        try {
            await logCRUDOperation(req, 'create', 'User', null, user, {
                customDescription: `Created new user: ${user.email}`,
                metadata: { userRole: user.role }
            });
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

### 3. **Implement in Controller Layer**
```javascript
export const createUser = catchAsync(async (req, res) => {
    const userData = req.body;
    const user = await userService.createUser(req, userData);
    
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'User created successfully',
        data: user
    });
});
```

## 📊 Supported Operations

### CRUD Operations
- ✅ **Create** - New entity creation
- ✅ **Update** - Entity modification
- ✅ **Delete** - Entity removal

### Status Changes
- ✅ **Approve** - Approve entities
- ✅ **Reject** - Reject entities
- ✅ **Activate** - Activate entities
- ✅ **Deactivate** - Deactivate entities

### Workflow Actions
- ✅ **Convert** - Convert between entity types
- ✅ **Finalize** - Finalize entities
- ✅ **Submit** - Submit for review
- ✅ **Assign** - Assign to users

### Communication Actions
- ✅ **Send WhatsApp** - Send WhatsApp messages
- ✅ **Send Email** - Send email notifications
- ✅ **Send Notification** - Send system notifications

### File Operations
- ✅ **Upload** - File uploads
- ✅ **Download** - File downloads
- ✅ **Delete File** - File removal

### Custom Actions
- ✅ **Custom Actions** - Any custom business logic

## 🔍 Query Capabilities

### Basic Queries
```javascript
// Get all logs
const logs = await queryActivityLogs({}, { limit: 20, page: 1 });

// Get logs by user
const userLogs = await queryActivityLogs({ user: userId }, { limit: 20 });

// Get logs by target
const targetLogs = await queryActivityLogs({ 
    targetModel: 'Project', 
    targetId: projectId 
}, { limit: 20 });
```

### Advanced Queries
```javascript
// Get logs by action
const createLogs = await queryActivityLogs({ action: 'create' }, { limit: 20 });

// Get logs by date range
const recentLogs = await queryActivityLogs({
    timestamp: { $gte: new Date('2024-01-01') }
}, { limit: 50 });

// Get logs by multiple criteria
const filteredLogs = await queryActivityLogs({
    user: userId,
    targetModel: 'Project',
    action: 'update',
    'metadata.projectStatus': 'active'
}, { limit: 20 });
```

### Embedded Document Queries
```javascript
// Get embedded document logs
const embeddedLogs = await getEmbeddedDocumentLogs('Project', projectId, 'architectProposals', {
    limit: 20,
    page: 1
});

// Get logs by embedded action
const addLogs = await getEmbeddedDocumentLogsByAction('Project', projectId, 'architectProposals', 'add', {
    limit: 10
});
```

## 🎯 Use Cases

### 1. **Audit Trails**
- Track all user actions
- Monitor system changes
- Ensure compliance
- Investigate issues

### 2. **User Activity Monitoring**
- See what users are doing
- Track user engagement
- Identify patterns
- Monitor performance

### 3. **Change Tracking**
- Track what changed
- See who made changes
- When changes occurred
- Why changes were made

### 4. **Security Monitoring**
- Detect suspicious activity
- Track access patterns
- Monitor privilege changes
- Audit security events

### 5. **Business Intelligence**
- Understand user behavior
- Track feature usage
- Measure performance
- Generate reports

## 🔧 Configuration

### Environment Variables
```bash
# Database connection
MONGODB_URI=mongodb://localhost:27017/your-db

# Logging configuration
LOG_LEVEL=info
LOG_RETENTION_DAYS=90

# Performance settings
LOG_BATCH_SIZE=100
LOG_FLUSH_INTERVAL=5000
```

### Database Indexes
```javascript
// Optimized indexes for performance
activityLogSchema.index({ user: 1, timestamp: -1 });
activityLogSchema.index({ targetModel: 1, targetId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ 'metadata.embeddedDocument': 1, targetModel: 1, targetId: 1 });
activityLogSchema.index({ 'metadata.embeddedField': 1, targetModel: 1, targetId: 1 });
```

## 📈 Performance Considerations

### 1. **Non-blocking Logging**
```javascript
// Log asynchronously without waiting
logCRUDOperation(req, 'create', 'User', null, user, options).catch(error => {
    console.error('Logging error:', error);
});
```

### 2. **Error Handling**
```javascript
// Always wrap logging in try-catch
try {
    await logCRUDOperation(req, 'create', 'User', null, user, options);
} catch (logError) {
    console.error('Logging error (non-critical):', logError);
}
```

### 3. **Sensitive Data Handling**
```javascript
// Exclude sensitive fields
await logCRUDOperation(req, 'update', 'User', oldUser, newUser, {
    excludeFields: ['__v', 'updatedAt'],
    sensitiveFields: ['password', 'token', 'secret']
});
```

### 4. **Database Optimization**
- Use proper indexes
- Implement pagination
- Clean up old logs
- Monitor query performance

## 🧪 Testing

### Unit Tests
```javascript
describe('User Service Logging', () => {
    it('should log user creation', async () => {
        const mockReq = { user: { _id: 'user123', name: 'Test User' } };
        const userData = { name: 'New User', email: 'newuser@example.com' };
        
        const user = await userService.createUser(mockReq, userData);
        
        expect(user).toBeDefined();
        // Verify logging was called
    });
});
```

### Integration Tests
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

## 🚀 Getting Started

### 1. **Read the Documentation**
- Start with `MANUAL_LOGGING_IMPLEMENTATION_GUIDE.md`
- Use `LOGGING_QUICK_REFERENCE.md` for quick lookup
- Follow `LOGGING_IMPLEMENTATION_CHECKLIST.md` for implementation

### 2. **Choose Your Approach**
- **New APIs**: Implement logging from the start
- **Existing APIs**: Add logging incrementally
- **Complex Data**: Use embedded document logging

### 3. **Start Simple**
- Begin with basic CRUD operations
- Add status changes
- Implement workflow actions
- Add communication and file operations

### 4. **Test Thoroughly**
- Write unit tests
- Test integration
- Verify logs are created
- Check log content

### 5. **Monitor and Optimize**
- Monitor performance
- Check error rates
- Optimize queries
- Clean up old logs

## 📚 Additional Resources

- **Implementation Guide**: `MANUAL_LOGGING_IMPLEMENTATION_GUIDE.md`
- **Quick Reference**: `LOGGING_QUICK_REFERENCE.md`
- **Implementation Checklist**: `LOGGING_IMPLEMENTATION_CHECKLIST.md`
- **Embedded Document Guide**: `EMBEDDED_DOCUMENT_LOGGING_GUIDE.md`
- **Examples**: `src/examples/manualLoggingExamples.js`
- **Embedded Examples**: `src/examples/embeddedDocumentLoggingExamples.js`

## 🆘 Support

### Common Issues
1. **Logging errors breaking main operations** - Always wrap in try-catch
2. **Missing user context** - Ensure req object is passed
3. **Sensitive data in logs** - Use excludeFields and sensitiveFields
4. **Performance issues** - Use non-blocking logging and proper indexes

### Getting Help
1. Check the documentation
2. Look at existing implementations
3. Test your implementation
4. Check console errors
5. Verify database logs

---

**Remember**: The logging system is designed to be robust, performant, and easy to use. Follow the patterns, handle errors gracefully, and test thoroughly! 🚀





