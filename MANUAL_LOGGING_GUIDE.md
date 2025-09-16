# Manual Activity Logging Guide

This guide explains how to use the manual activity logging system for tracking admin and user actions across your application.

## Overview

The manual logging system provides:
- **Manual Control**: You decide exactly when and what to log
- **Change Detection**: Automatic detection of what changed between old and new values
- **User Tracking**: Track who performed actions (Admin or User model)
- **Target Tracking**: Track what was modified (any model with refPath support)
- **Comprehensive Metadata**: IP address, user agent, timestamps, and custom metadata

## Core Components

### 1. Main Logging Function
```javascript
import { logActivity } from '../middlewares/activityLog.middleware.js';

await logActivity(req, {
    action: 'create',
    targetModel: 'Vendor',
    targetId: vendor._id,
    targetName: vendor.storeName,
    description: 'Created new vendor',
    metadata: { customData: 'value' }
});
```

### 2. Helper Functions
- `logCRUDOperation` - For create, update, delete operations
- `logStatusChange` - For activate, deactivate operations
- `logWorkflowAction` - For approve, reject, convert, finalize operations
- `logCommunicationAction` - For send, notify operations
- `logFileOperation` - For upload, download, delete file operations

## Basic Usage

### 1. Simple Activity Logging
```javascript
import { logActivity } from '../middlewares/activityLog.middleware.js';

// Log a simple action
await logActivity(req, {
    action: 'create',
    targetModel: 'Vendor',
    targetId: vendor._id,
    targetName: vendor.storeName,
    description: `Created vendor: ${vendor.storeName}`
});
```

### 2. CRUD Operations with Change Detection
```javascript
import { logCRUDOperation } from '../middlewares/activityLog.middleware.js';

// Log update with automatic change detection
await logCRUDOperation(req, 'update', 'Vendor', originalVendor, updatedVendor, {
    excludeFields: ['__v', 'updatedAt'],
    customDescription: `Updated vendor: ${updatedVendor.storeName}`
});
```

### 3. Status Changes
```javascript
import { logStatusChange } from '../middlewares/activityLog.middleware.js';

// Log status change
await logStatusChange(req, 'activate', 'Vendor', vendor, {
    customDescription: `Activated vendor: ${vendor.storeName}`,
    metadata: { reason: 'Admin approval' }
});
```

### 4. Workflow Actions
```javascript
import { logWorkflowAction } from '../middlewares/activityLog.middleware.js';

// Log workflow action
await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
    customDescription: `Converted proposal to work order: ${proposal.projectName}`,
    metadata: { conversionReason: 'Client approved' }
});
```

## Integration Examples

### 1. Vendor Service Integration
```javascript
import { logActivity, logStatusChange } from '../middlewares/activityLog.middleware.js';

export const createVendorService = async (data, req) => {
    try {
        const vendor = await Vendor.create(data);
        
        // Log creation
        await logActivity(req, {
            action: 'create',
            targetModel: 'Vendor',
            targetId: vendor._id,
            targetName: vendor.storeName,
            description: `Created vendor: ${vendor.storeName} (${vendor.name})`,
            metadata: {
                vendorData: {
                    name: vendor.name,
                    email: vendor.email,
                    city: vendor.city
                }
            }
        });
        
        return vendor;
    } catch (error) {
        console.error('Error creating vendor:', error);
        throw error;
    }
};

export const updateVendorService = async (id, data, req) => {
    try {
        const originalVendor = await Vendor.findById(id).lean();
        const updatedVendor = await Vendor.findByIdAndUpdate(id, data, { new: true });
        
        // Log update with change detection
        const { changes, previousValues, newValues } = detectChanges(originalVendor, updatedVendor);
        
        await logActivity(req, {
            action: 'update',
            targetModel: 'Vendor',
            targetId: updatedVendor._id,
            targetName: updatedVendor.storeName,
            changes,
            previousValues,
            newValues,
            description: `Updated vendor: ${updatedVendor.storeName}`
        });
        
        return updatedVendor;
    } catch (error) {
        console.error('Error updating vendor:', error);
        throw error;
    }
};
```

### 2. Controller Integration
```javascript
import { logActivity } from '../middlewares/activityLog.middleware.js';

export const createVendor = catchAsync(async (req, res) => {
    const vendor = await createVendorService(req.body, req);
    
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'Vendor created successfully',
        data: vendor
    });
});

export const updateVendor = catchAsync(async (req, res) => {
    const vendor = await updateVendorService(req.params.id, req.body, req);
    
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Vendor updated successfully',
        data: vendor
    });
});
```

## Advanced Usage

### 1. Custom Change Detection
```javascript
import { detectChanges, createChangeDescription } from '../utils/changeDetection.js';

const { changes, previousValues, newValues } = detectChanges(oldDoc, newDoc, ['__v', 'updatedAt']);

await logActivity(req, {
    action: 'update',
    targetModel: 'Vendor',
    targetId: newDoc._id,
    targetName: newDoc.storeName,
    changes,
    previousValues,
    newValues,
    description: createChangeDescription(changes, 'update', newDoc.storeName)
});
```

### 2. Bulk Operations
```javascript
await logActivity(req, {
    action: 'update',
    targetModel: 'Vendor',
    targetId: 'bulk_operation',
    targetName: `Bulk update - ${vendors.length} vendors`,
    description: `Bulk updated ${vendors.length} vendors`,
    metadata: {
        bulkOperation: true,
        itemCount: vendors.length,
        itemIds: vendors.map(v => v._id)
    }
});
```

### 3. Error Logging
```javascript
try {
    // Your operation
} catch (error) {
    await logActivity(req, {
        action: 'error',
        targetModel: 'Vendor',
        targetId: vendorId,
        targetName: 'Unknown',
        description: `Failed to update vendor: ${error.message}`,
        metadata: {
            errorOperation: true,
            errorMessage: error.message,
            errorStack: error.stack
        }
    });
    throw error;
}
```

## Supported Actions

### CRUD Operations
- `create` - Document creation
- `update` - Document update
- `delete` - Document deletion

### Status Changes
- `activate` - Activate document
- `deactivate` - Deactivate document

### Workflow Actions
- `approve` - Approve document
- `reject` - Reject document
- `convert` - Convert document (e.g., proposal to work order)
- `finalize` - Finalize document

### Communication
- `send` - Send message/notification

### Custom Actions
- `custom` - Custom business operations
- `error` - Operation failures

## Supported Models

### User Models (Actors)
- `User` - Regular users
- `Admin` - Administrators

### Target Models
- `User`, `Admin` - User management
- `Project` - Project management
- `ClientProposal` - Client proposals
- `BOM` - Bill of Materials
- `PO` - Purchase Orders
- `Vendor` - Vendor management
- `SiteVisit` - Site visits
- `Message` - Messages
- `File` - File operations
- `CustomerLead` - Customer leads
- `Quote` - Quotes
- `Sitework` - Site work
- `ProjectAssignmentPayment` - Payments
- `WalletTransaction` - Wallet transactions

## Helper Functions

### 1. logCRUDOperation
```javascript
await logCRUDOperation(req, 'update', 'Vendor', originalDoc, newDoc, {
    excludeFields: ['__v', 'updatedAt'],
    customDescription: 'Custom description',
    metadata: { customData: 'value' }
});
```

### 2. logStatusChange
```javascript
await logStatusChange(req, 'activate', 'Vendor', vendor, {
    customDescription: 'Activated vendor',
    metadata: { reason: 'Admin approval' }
});
```

### 3. logWorkflowAction
```javascript
await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
    customDescription: 'Converted to work order',
    metadata: { conversionReason: 'Client approved' }
});
```

### 4. logCommunicationAction
```javascript
await logCommunicationAction(req, 'send', 'PO', po, {
    customDescription: 'Sent WhatsApp message',
    metadata: { recipient: po.vendorWhatsappNumber }
});
```

### 5. logFileOperation
```javascript
await logFileOperation(req, 'upload', 'File', file, {
    customDescription: 'Uploaded file',
    metadata: { fileType: file.fileType, size: file.size }
});
```

## Change Detection

### Automatic Change Detection
```javascript
import { detectChanges } from '../utils/changeDetection.js';

const { changes, previousValues, newValues } = detectChanges(oldDoc, newDoc, excludeFields);
```

### Change Types
- `added` - New field added
- `removed` - Field removed
- `modified` - Field value changed
- `type_changed` - Field type changed
- `array_modified` - Array modified
- `object_modified` - Object modified

### Sensitive Field Filtering
```javascript
import { filterSensitiveFields } from '../utils/changeDetection.js';

const filteredChanges = filterSensitiveFields(changes, ['password', 'token', 'secret']);
```

## Best Practices

### 1. Always Use Try-Catch
```javascript
try {
    await logActivity(req, logData);
} catch (error) {
    console.error('Logging error:', error);
    // Don't throw - logging should not break the main operation
}
```

### 2. Use Async Logging
```javascript
// Don't await - let it run in background
logActivity(req, logData).catch(console.error);
```

### 3. Provide Meaningful Descriptions
```javascript
const description = `Updated vendor: ${vendor.storeName} - Changed: ${Object.keys(changes).join(', ')}`;
```

### 4. Include Relevant Metadata
```javascript
metadata: {
    reason: 'Customer requested update',
    source: 'admin_panel',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
}
```

### 5. Use Appropriate Actions
- Use `create` for new documents
- Use `update` for modifications
- Use `activate`/`deactivate` for status changes
- Use `approve`/`reject` for workflow actions
- Use `convert` for document conversions

## Error Handling

The logging system is designed to be non-intrusive:
- Logging errors don't affect the main operation
- Errors are logged to console
- Failed logs don't throw exceptions

## Performance Considerations

### 1. Async Logging
Always use async logging to avoid blocking the main request:
```javascript
// Good - non-blocking
logActivity(req, logData).catch(console.error);

// Bad - blocking
await logActivity(req, logData);
```

### 2. Batch Operations
For bulk operations, consider using a single summary log instead of individual logs.

### 3. Cleanup
Set up regular cleanup of old logs:
```javascript
// Clean up logs older than 1 year
await cleanupOldLogs(365);
```

## API Endpoints

### Get Activity Logs
```
GET /api/v1/activity-logs
```

### Get Target Activity Logs
```
GET /api/v1/activity-logs/target/{model}/{id}
```

### Get User Activity Logs
```
GET /api/v1/activity-logs/user/{userId}/{userModel}
```

### Get Activity Statistics
```
GET /api/v1/activity-logs/stats
```

### Get Recent Activity
```
GET /api/v1/activity-logs/recent
```

### Get Activity Summary
```
GET /api/v1/activity-logs/summary
```

## Real-time Monitoring

### Event Listening
```javascript
import { activityEventEmitter } from '../services/activityLog.service.js';

// Listen for all activities
activityEventEmitter.on('activity.created', (data) => {
    console.log('New activity:', data);
    // Send notifications, update dashboards, etc.
});
```

### Dashboard Integration
```javascript
const stats = await getActivityStats({ startDate: lastWeek, endDate: now });
// Display stats in dashboard
```

This manual logging system provides complete control over what gets logged and when, ensuring comprehensive audit trails for your application.
