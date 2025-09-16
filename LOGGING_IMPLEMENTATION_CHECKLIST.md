# Logging Implementation Checklist

## Pre-Implementation Checklist

### ✅ Environment Setup
- [ ] Activity log model is created and migrated
- [ ] Activity log service is implemented
- [ ] Activity log controller is implemented
- [ ] Activity log routes are configured
- [ ] Activity log middleware is available
- [ ] Database indexes are created for performance

### ✅ Dependencies
- [ ] `lodash` is installed for change detection
- [ ] All required imports are available
- [ ] Error handling utilities are in place

---

## Implementation Checklist

### ✅ For Each API Endpoint

#### 1. Service Layer
- [ ] Import logging functions at the top of the file
- [ ] Add `req` parameter to service function signature
- [ ] Identify the appropriate logging function to use
- [ ] Add logging call after successful operation
- [ ] Wrap logging in try-catch to prevent breaking main operation
- [ ] Include meaningful custom description
- [ ] Add relevant metadata for context

#### 2. Controller Layer
- [ ] Pass `req` object to service function
- [ ] Ensure proper error handling with `catchAsync`
- [ ] Return appropriate HTTP status codes
- [ ] Include success/error messages

#### 3. Route Layer
- [ ] Add authentication middleware if needed
- [ ] Add validation middleware if needed
- [ ] Ensure proper HTTP methods are used
- [ ] Add Swagger documentation if applicable

---

## Function Selection Guide

### ✅ Choose the Right Logging Function

#### For CRUD Operations
- [ ] **Create**: `logCRUDOperation(req, 'create', 'ModelName', null, newDoc, options)`
- [ ] **Update**: `logCRUDOperation(req, 'update', 'ModelName', oldDoc, newDoc, options)`
- [ ] **Delete**: `logCRUDOperation(req, 'delete', 'ModelName', oldDoc, null, options)`

#### For Status Changes
- [ ] **Approve**: `logStatusChange(req, 'approve', 'ModelName', doc, options)`
- [ ] **Reject**: `logStatusChange(req, 'reject', 'ModelName', doc, options)`
- [ ] **Activate**: `logStatusChange(req, 'activate', 'ModelName', doc, options)`
- [ ] **Deactivate**: `logStatusChange(req, 'deactivate', 'ModelName', doc, options)`

#### For Workflow Actions
- [ ] **Convert**: `logWorkflowAction(req, 'convert', 'ModelName', doc, options)`
- [ ] **Finalize**: `logWorkflowAction(req, 'finalize', 'ModelName', doc, options)`
- [ ] **Submit**: `logWorkflowAction(req, 'submit', 'ModelName', doc, options)`
- [ ] **Assign**: `logWorkflowAction(req, 'assign', 'ModelName', doc, options)`

#### For Communication
- [ ] **Send Message**: `logCommunicationAction(req, 'send_whatsapp', 'ModelName', doc, options)`
- [ ] **Send Email**: `logCommunicationAction(req, 'send_email', 'ModelName', doc, options)`
- [ ] **Send Notification**: `logCommunicationAction(req, 'send_notification', 'ModelName', doc, options)`

#### For File Operations
- [ ] **Upload**: `logFileOperation(req, 'upload', 'ModelName', targetId, fileDetails, options)`
- [ ] **Download**: `logFileOperation(req, 'download', 'ModelName', targetId, fileDetails, options)`
- [ ] **Delete File**: `logFileOperation(req, 'delete_file', 'ModelName', targetId, fileDetails, options)`

#### For Custom Actions
- [ ] **Custom Action**: `logActivity(req, { action: 'custom_action', ... })`

---

## Code Quality Checklist

### ✅ Error Handling
- [ ] Logging is wrapped in try-catch
- [ ] Logging errors don't break main operations
- [ ] Error messages are logged to console
- [ ] Main operation errors are properly thrown

### ✅ Performance
- [ ] Logging is non-blocking where possible
- [ ] Sensitive fields are excluded from change detection
- [ ] Only necessary fields are included in metadata
- [ ] Database queries are optimized

### ✅ Security
- [ ] Sensitive fields are masked in logs
- [ ] User context is properly validated
- [ ] No sensitive data in descriptions
- [ ] Proper authentication checks

### ✅ Consistency
- [ ] Same logging pattern across similar operations
- [ ] Consistent naming conventions
- [ ] Consistent metadata structure
- [ ] Consistent error handling

---

## Testing Checklist

### ✅ Unit Tests
- [ ] Test service functions with logging
- [ ] Mock logging functions if needed
- [ ] Test error handling scenarios
- [ ] Verify logging calls are made

### ✅ Integration Tests
- [ ] Test API endpoints with logging
- [ ] Verify logs are created in database
- [ ] Test error scenarios
- [ ] Verify log structure and content

### ✅ Manual Testing
- [ ] Test each endpoint manually
- [ ] Verify logs appear in database
- [ ] Check log content for accuracy
- [ ] Test error scenarios

---

## Model-Specific Checklist

### ✅ User Model
- [ ] Create user logging
- [ ] Update user logging
- [ ] Delete user logging
- [ ] Activate/deactivate user logging
- [ ] Login/logout logging

### ✅ Project Model
- [ ] Create project logging
- [ ] Update project logging
- [ ] Delete project logging
- [ ] Approve/reject project logging
- [ ] Status change logging

### ✅ Client Proposal Model
- [ ] Create proposal logging
- [ ] Update proposal logging
- [ ] Delete proposal logging
- [ ] Convert to work order logging
- [ ] Status change logging

### ✅ PO Model
- [ ] Create PO logging
- [ ] Update PO logging
- [ ] Delete PO logging
- [ ] Send WhatsApp message logging
- [ ] Status change logging

### ✅ Vendor Model
- [ ] Create vendor logging
- [ ] Update vendor logging
- [ ] Delete vendor logging
- [ ] Activate/deactivate vendor logging

### ✅ BOM Model
- [ ] Create BOM logging
- [ ] Update BOM logging
- [ ] Delete BOM logging
- [ ] Finalize BOM logging
- [ ] Status change logging

---

## Embedded Document Checklist

### ✅ For Embedded Documents
- [ ] Use `logEmbeddedDocumentOperation` for add/remove
- [ ] Use `logEmbeddedDocumentUpdate` for updates
- [ ] Use `logEmbeddedDocumentStatusChange` for status changes
- [ ] Use `logEmbeddedArrayOperation` for array operations
- [ ] Use `logEmbeddedDocumentBulkOperation` for bulk operations

### ✅ Examples
- [ ] Project architect proposals
- [ ] Project architect documents
- [ ] Any other embedded arrays

---

## Validation Checklist

### ✅ Log Structure
- [ ] All required fields are present
- [ ] User context is correct
- [ ] Target model and ID are correct
- [ ] Action is valid
- [ ] Description is meaningful
- [ ] Metadata is relevant

### ✅ Log Content
- [ ] Descriptions are human-readable
- [ ] Metadata provides useful context
- [ ] Sensitive data is masked
- [ ] Timestamps are accurate
- [ ] Changes are properly detected

### ✅ Database
- [ ] Logs are stored correctly
- [ ] Indexes are working
- [ ] Queries are performant
- [ ] No duplicate logs
- [ ] Logs are retrievable

---

## Performance Checklist

### ✅ Database Performance
- [ ] Proper indexes are created
- [ ] Queries are optimized
- [ ] Pagination is implemented
- [ ] No N+1 queries

### ✅ Application Performance
- [ ] Logging is non-blocking
- [ ] Error handling is efficient
- [ ] Memory usage is reasonable
- [ ] No memory leaks

### ✅ Monitoring
- [ ] Log levels are appropriate
- [ ] Error rates are monitored
- [ ] Performance metrics are tracked
- [ ] Alerts are configured

---

## Documentation Checklist

### ✅ Code Documentation
- [ ] Functions are documented
- [ ] Parameters are explained
- [ ] Examples are provided
- [ ] Error cases are documented

### ✅ API Documentation
- [ ] Swagger documentation is updated
- [ ] Request/response examples are provided
- [ ] Error responses are documented
- [ ] Authentication requirements are clear

### ✅ User Documentation
- [ ] Implementation guide is complete
- [ ] Quick reference is available
- [ ] Examples are comprehensive
- [ ] Troubleshooting guide is provided

---

## Maintenance Checklist

### ✅ Regular Maintenance
- [ ] Log cleanup is scheduled
- [ ] Performance is monitored
- [ ] Error rates are tracked
- [ ] Logs are archived if needed

### ✅ Updates
- [ ] Logging functions are updated
- [ ] New features are logged
- [ ] Deprecated functions are removed
- [ ] Documentation is updated

### ✅ Monitoring
- [ ] Log volume is monitored
- [ ] Error rates are tracked
- [ ] Performance is measured
- [ ] Alerts are configured

---

## Final Verification

### ✅ Complete Implementation
- [ ] All endpoints have logging
- [ ] All logging functions are used correctly
- [ ] Error handling is consistent
- [ ] Performance is acceptable
- [ ] Security is maintained
- [ ] Documentation is complete
- [ ] Tests are passing
- [ ] Manual testing is complete

### ✅ Production Readiness
- [ ] Logging is production-ready
- [ ] Error handling is robust
- [ ] Performance is optimized
- [ ] Security is validated
- [ ] Monitoring is in place
- [ ] Documentation is complete
- [ ] Team is trained

---

## Quick Reference

### Import Statement
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

### Basic Pattern
```javascript
export const createEntity = async (req, entityData) => {
    try {
        const entity = await Entity.create(entityData);
        
        try {
            await logCRUDOperation(req, 'create', 'Entity', null, entity, {
                customDescription: `Created ${entity.name}`,
                metadata: { createdBy: req.user.name }
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

### Error Handling Pattern
```javascript
// Always wrap logging in try-catch
try {
    await logCRUDOperation(req, 'create', 'Entity', null, entity, options);
} catch (logError) {
    console.error('Logging error (non-critical):', logError);
}
```

---

**Remember**: Logging errors should never break your main operations! 🚀




