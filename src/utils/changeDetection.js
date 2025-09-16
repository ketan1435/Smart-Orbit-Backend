/**
 * Utility functions for detecting and formatting changes between objects
 */

/**
 * Deep comparison of two objects to detect changes
 * @param {Object} oldObj - Original object
 * @param {Object} newObj - Updated object
 * @param {Array} excludeFields - Fields to exclude from comparison
 * @returns {Object} Changes object with field-level changes
 */
export const detectChanges = (oldObj, newObj, excludeFields = []) => {
    const changes = {};
    const previousValues = {};
    const newValues = {};

    // Get all unique keys from both objects
    const allKeys = new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {})
    ]);

    for (const key of allKeys) {
        // Skip excluded fields
        if (excludeFields.includes(key)) {
            continue;
        }

        const oldValue = oldObj?.[key];
        const newValue = newObj?.[key];

        // Skip if values are the same
        if (deepEqual(oldValue, newValue)) {
            continue;
        }

        // Determine change type
        const changeType = getChangeType(oldValue, newValue);

        changes[key] = {
            from: formatValue(oldValue),
            to: formatValue(newValue),
            type: changeType
        };

        previousValues[key] = oldValue;
        newValues[key] = newValue;
    }

    return {
        changes,
        previousValues,
        newValues
    };
};

/**
 * Deep equality check for objects
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if equal
 */
const deepEqual = (a, b) => {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (typeof a !== typeof b) return false;

    if (typeof a !== 'object') return a === b;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
};

/**
 * Determine the type of change
 * @param {*} oldValue - Original value
 * @param {*} newValue - New value
 * @returns {string} Change type
 */
const getChangeType = (oldValue, newValue) => {
    if (oldValue === undefined || oldValue === null) return 'added';
    if (newValue === undefined || newValue === null) return 'removed';
    if (typeof oldValue !== typeof newValue) return 'type_changed';
    if (Array.isArray(oldValue) && Array.isArray(newValue)) return 'array_modified';
    if (typeof oldValue === 'object' && typeof newValue === 'object') return 'object_modified';
    return 'modified';
};

/**
 * Format value for display
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
const formatValue = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') {
        if (value._id) return `Object(${value._id})`;
        return `{${Object.keys(value).length} properties}`;
    }
    return String(value);
};

/**
 * Create a human-readable description of changes
 * @param {Object} changes - Changes object
 * @param {string} action - Action performed
 * @param {string} targetName - Target name
 * @returns {string} Human-readable description
 */
export const createChangeDescription = (changes, action, targetName) => {
    const changeCount = Object.keys(changes).length;

    if (changeCount === 0) {
        return `${action} ${targetName}`;
    }

    const changedFields = Object.keys(changes);
    const fieldList = changedFields.length <= 3
        ? changedFields.join(', ')
        : `${changedFields.slice(0, 3).join(', ')} and ${changedFields.length - 3} more`;

    return `${action} ${targetName} - Updated: ${fieldList}`;
};

/**
 * Get field display name for better readability
 * @param {string} fieldName - Field name
 * @returns {string} Display name
 */
export const getFieldDisplayName = (fieldName) => {
    const fieldMap = {
        'name': 'Name',
        'email': 'Email',
        'phone': 'Phone',
        'mobileNumber': 'Mobile Number',
        'address': 'Address',
        'city': 'City',
        'state': 'State',
        'country': 'Country',
        'status': 'Status',
        'isActive': 'Active Status',
        'description': 'Description',
        'notes': 'Notes',
        'title': 'Title',
        'projectName': 'Project Name',
        'projectCode': 'Project Code',
        'storeName': 'Store Name',
        'gstNo': 'GST Number',
        'unitCost': 'Unit Cost',
        'quantity': 'Quantity',
        'units': 'Units',
        'itemName': 'Item Name',
        'vendorName': 'Vendor Name',
        'vendorWhatsappNumber': 'Vendor WhatsApp',
        'convertedToWorkOrder': 'Converted to Work Order',
        'workOrderSentToPlanningEngineer': 'Work Order Sent to Planning',
        'isSent': 'Sent Status',
        'sentAt': 'Sent At',
        'finalizedAt': 'Finalized At',
        'approvedAt': 'Approved At',
        'acceptedAt': 'Accepted At',
        'createdAt': 'Created At',
        'updatedAt': 'Updated At'
    };

    return fieldMap[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

/**
 * Create detailed change summary
 * @param {Object} changes - Changes object
 * @returns {Array} Array of change summaries
 */
export const createChangeSummary = (changes) => {
    return Object.entries(changes).map(([field, change]) => ({
        field,
        displayName: getFieldDisplayName(field),
        from: change.from,
        to: change.to,
        type: change.type
    }));
};

/**
 * Filter sensitive fields from changes
 * @param {Object} changes - Changes object
 * @param {Array} sensitiveFields - Fields to filter out
 * @returns {Object} Filtered changes
 */
export const filterSensitiveFields = (changes, sensitiveFields = ['password', 'token', 'secret', 'key']) => {
    const filtered = {};

    for (const [field, change] of Object.entries(changes)) {
        const isSensitive = sensitiveFields.some(sensitive =>
            field.toLowerCase().includes(sensitive.toLowerCase())
        );

        if (!isSensitive) {
            filtered[field] = change;
        }
    }

    return filtered;
};

/**
 * Get change statistics
 * @param {Object} changes - Changes object
 * @returns {Object} Change statistics
 */
export const getChangeStats = (changes) => {
    const stats = {
        totalChanges: Object.keys(changes).length,
        addedFields: 0,
        removedFields: 0,
        modifiedFields: 0,
        typeChanges: 0
    };

    for (const change of Object.values(changes)) {
        switch (change.type) {
            case 'added':
                stats.addedFields++;
                break;
            case 'removed':
                stats.removedFields++;
                break;
            case 'modified':
                stats.modifiedFields++;
                break;
            case 'type_changed':
                stats.typeChanges++;
                break;
        }
    }

    return stats;
};
