# Activity Logging Integration Guide

This guide explains how to integrate the comprehensive activity logging system into your existing models and controllers.

## Overview

The activity logging system provides:
- **Event Emitting**: Real-time notifications when activities occur
- **Change Detection**: Automatic detection of what changed between old and new values
- **User Tracking**: Track who performed actions (Admin or User model)
- **Target Tracking**: Track what was modified (any model with refPath support)
- **Comprehensive Metadata**: IP address, user agent, timestamps, and custom metadata

## Components

### 1. Models
- `ActivityLog` - Main logging model with refPath support
- Supports both User and Admin models as actors
- Supports all major models as targets

### 2. Services
- `activityLog.service.js` - Core logging functionality
- Event emitter for real-time notifications
- Query and statistics functions

### 3. Middleware
- `activityLog.middleware.js` - Automatic logging middleware
- Manual logging functions
- Change detection utilities

### 4. Utilities
- `changeDetection.js` - Change detection and formatting utilities

## Integration Methods

### Method 1: Automatic Middleware (Recommended)

Add the logging middleware to your routes:

```javascript
import { createActivityLogMiddleware, attachModel } from '../middlewares/activityLog.middleware.js';
import Vendor from '../models/vendor.model.js';

// Attach model to request
router.use('/vendors', attachModel(Vendor));

// Add logging middleware to specific routes
router.post('/', 
    auth('manageVendors'), 
    validate(vendorValidation.createVendor),
    createActivityLogMiddleware({
        targetModel: 'Vendor',
        excludeFields: ['__v', 'updatedAt'],
        getTargetName: (doc) => doc.storeName || doc.name
    }),
    createVendor
);

router.put('/:id',
    auth('manageVendors'),
    validate(vendorValidation.updateVendor),
    createActivityLogMiddleware({
        targetModel: 'Vendor',
        excludeFields: ['__v', 'updatedAt'],
        getTargetName: (doc) => doc.storeName || doc.name
    }),
    updateVendor
);
```

### Method 2: Manual Logging in Services

Add logging directly to your service functions:

```javascript
import { logActivity } from '../middlewares/activityLog.middleware.js';
import { detectChanges, createChangeDescription } from '../utils/changeDetection.js';

export const updateVendorService = async (id, data, req) => {
    // Get original document
    const originalVendor = await Vendor.findById(id).lean();
    
    // Perform update
    const updatedVendor = await Vendor.findByIdAndUpdate(id, data, { new: true });
    
    // Detect changes
    const { changes, previousValues, newValues } = detectChanges(
        originalVendor, 
        updatedVendor.toObject(), 
        ['__v', 'updatedAt']
    );
    
    // Log activity
    await logActivity(req, {
        action: 'update',
        targetModel: 'Vendor',
        targetId: updatedVendor._id,
        targetName: updatedVendor.storeName || updatedVendor.name,
        changes,
        previousValues,
        newValues,
        description: createChangeDescription(changes, 'update', updatedVendor.storeName)
    });
    
    return updatedVendor;
};
```

### Method 3: Event-Based Logging

Listen to events and log activities:

```javascript
import { activityEventEmitter } from '../services/activityLog.service.js';

// Listen for specific events
activityEventEmitter.on('activity.created', (data) => {
    console.log('New activity logged:', data);
    // Send real-time notifications, update dashboards, etc.
});

// Listen for all activities
activityEventEmitter.on('activity.*', (eventName, data) => {
    console.log(`Activity event ${eventName}:`, data);
});
```

## Configuration Options

### Middleware Options

```javascript
createActivityLogMiddleware({
    targetModel: 'Vendor',                    // Required: Target model name
    excludeFields: ['__v', 'updatedAt'],     // Fields to exclude from change detection
    sensitiveFields: ['password', 'token'],   // Sensitive fields to filter out
    getTargetName: (doc) => doc.name,         // Function to get target name
    getUserInfo: (req) => ({                  // Function to get user info
        user: req.user._id,
        userModel: req.user.role === 'admin' ? 'Admin' : 'User',
        userName: req.user.name,
        userEmail: req.user.email
    })
})
```

### Manual Logging Options

```javascript
await logActivity(req, {
    action: 'create',                         // Required: Action performed
    targetModel: 'Vendor',                    // Required: Target model
    targetId: vendor._id,                     // Required: Target ID
    targetName: vendor.name,                  // Required: Target name
    changes: {},                              // Changes made
    previousValues: {},                       // Previous values
    newValues: {},                           // New values
    description: 'Custom description',        // Human-readable description
    metadata: {                              // Additional metadata
        customField: 'value'
    }
});
```

## Supported Actions

### CRUD Operations
- `create` - Document creation
- `update` - Document update
- `delete` - Document deletion (soft or hard)

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

## API Endpoints

### Get Activity Logs
```
GET /api/v1/activity-logs
```

### Get Target Activity Logs
```
GET /api/v1/activity-logs/target/{targetModel}/{targetId}
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

## Change Detection Features

### Automatic Change Detection
- Deep comparison of objects
- Field-level change tracking
- Type-aware change detection
- Array and object change detection

### Change Types
- `added` - New field added
- `removed` - Field removed
- `modified` - Field value changed
- `type_changed` - Field type changed
- `array_modified` - Array modified
- `object_modified` - Object modified

### Sensitive Field Filtering
Automatically filters out sensitive fields like passwords, tokens, and secrets.

## Event System

### Available Events
- `activity.created` - New activity logged
- `activity.deleted` - Activity log deleted

### Event Data
```javascript
{
    logId: 'activity_log_id',
    user: 'user_id',
    targetModel: 'Vendor',
    targetId: 'target_id',
    action: 'update',
    timestamp: '2024-01-01T00:00:00.000Z'
}
```

## Best Practices

### 1. Use Appropriate Actions
Choose the most specific action that describes what happened:
- Use `create` for new documents
- Use `update` for modifications
- Use `activate`/`deactivate` for status changes
- Use `approve`/`reject` for workflow actions

### 2. Exclude Unnecessary Fields
Always exclude system fields from change detection:
```javascript
excludeFields: ['__v', 'updatedAt', 'createdAt']
```

### 3. Filter Sensitive Data
Always filter sensitive fields:
```javascript
sensitiveFields: ['password', 'token', 'secret', 'key', 'apiKey']
```

### 4. Provide Meaningful Descriptions
Use the `createChangeDescription` utility or provide custom descriptions:
```javascript
description: `Updated vendor ${vendor.name} - Changed: name, email, phone`
```

### 5. Use Metadata for Context
Add relevant context in metadata:
```javascript
metadata: {
    reason: 'Customer requested update',
    source: 'admin_panel',
    ipAddress: req.ip
}
```

## Performance Considerations

### 1. Async Logging
Always use async logging to avoid blocking the main request:
```javascript
// Don't await - let it run in background
createActivityLog(logData).catch(console.error);
```

### 2. Batch Operations
For bulk operations, consider batching logs or using a single summary log.

### 3. Indexing
The ActivityLog model includes optimized indexes for common queries.

### 4. Cleanup
Set up regular cleanup of old logs:
```javascript
// Clean up logs older than 1 year
await cleanupOldLogs(365);
```

## Error Handling

The logging system is designed to be non-intrusive:
- Logging errors don't affect the main operation
- Errors are logged to console
- Failed logs don't throw exceptions

## Testing

### Unit Tests
Test logging functions independently:
```javascript
import { detectChanges } from '../utils/changeDetection.js';

const changes = detectChanges(oldObj, newObj);
expect(changes.changes).toHaveProperty('name');
```

### Integration Tests
Test logging with actual operations:
```javascript
const vendor = await createVendorService(data, req);
const logs = await getTargetActivityLogs('Vendor', vendor._id);
expect(logs).toHaveLength(1);
expect(logs[0].action).toBe('create');
```

## Monitoring and Alerts

### Real-time Monitoring
Use the event system for real-time monitoring:
```javascript
activityEventEmitter.on('activity.created', (data) => {
    if (data.action === 'delete') {
        // Send alert for deletions
        sendAlert(`Document deleted: ${data.targetModel} ${data.targetId}`);
    }
});
```

### Dashboard Integration
Use the statistics endpoints for dashboard data:
```javascript
const stats = await getActivityStats({ startDate: lastWeek, endDate: now });
// Display stats in dashboard
```

This comprehensive logging system provides full audit trails, change tracking, and real-time monitoring capabilities for your application.
