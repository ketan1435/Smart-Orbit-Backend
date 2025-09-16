import Vendor from '../models/vendor.model.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';
import { detectChanges, createChangeDescription } from '../utils/changeDetection.js';

/**
 * Example of how to integrate activity logging into existing services
 * This shows how to add logging to vendor operations
 */

export const createVendorServiceWithLogging = async (data, req) => {
    try {
        // Create the vendor
        const vendor = await Vendor.create(data);

        // Log the creation activity
        await logActivity(req, {
            action: 'create',
            targetModel: 'Vendor',
            targetId: vendor._id,
            targetName: vendor.storeName || vendor.name,
            description: `Created vendor: ${vendor.storeName} (${vendor.name})`,
            metadata: {
                vendorData: {
                    name: vendor.name,
                    storeName: vendor.storeName,
                    email: vendor.email,
                    city: vendor.city,
                    state: vendor.state,
                    country: vendor.country
                }
            }
        });

        return vendor;
    } catch (error) {
        console.error('Error creating vendor with logging:', error);
        throw error;
    }
};

export const updateVendorServiceWithLogging = async (id, data, req) => {
    try {
        // Get the original vendor for change detection
        const originalVendor = await Vendor.findById(id).lean();
        if (!originalVendor) {
            throw new Error('Vendor not found');
        }

        // Update the vendor
        const updatedVendor = await Vendor.findByIdAndUpdate(id, data, { new: true, runValidators: true });

        // Detect changes
        const { changes, previousValues, newValues } = detectChanges(originalVendor, updatedVendor.toObject(), ['__v', 'updatedAt']);

        // Log the update activity
        await logActivity(req, {
            action: 'update',
            targetModel: 'Vendor',
            targetId: updatedVendor._id,
            targetName: updatedVendor.storeName || updatedVendor.name,
            changes,
            previousValues,
            newValues,
            description: createChangeDescription(changes, 'update', updatedVendor.storeName || updatedVendor.name),
            metadata: {
                changeCount: Object.keys(changes).length,
                updatedFields: Object.keys(changes)
            }
        });

        return updatedVendor;
    } catch (error) {
        console.error('Error updating vendor with logging:', error);
        throw error;
    }
};

export const deleteVendorServiceWithLogging = async (id, req) => {
    try {
        // Get the vendor before deletion
        const vendor = await Vendor.findById(id);
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Soft delete the vendor
        const deletedVendor = await Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true });

        // Log the deletion activity
        await logActivity(req, {
            action: 'delete',
            targetModel: 'Vendor',
            targetId: deletedVendor._id,
            targetName: deletedVendor.storeName || deletedVendor.name,
            description: `Deleted vendor: ${deletedVendor.storeName} (${deletedVendor.name})`,
            metadata: {
                deletionType: 'soft_delete',
                vendorData: {
                    name: deletedVendor.name,
                    storeName: deletedVendor.storeName,
                    email: deletedVendor.email
                }
            }
        });

        return deletedVendor;
    } catch (error) {
        console.error('Error deleting vendor with logging:', error);
        throw error;
    }
};

export const activateVendorServiceWithLogging = async (id, req) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(id, { isActive: true }, { new: true, runValidators: true });
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Log the activation activity
        await logActivity(req, {
            action: 'activate',
            targetModel: 'Vendor',
            targetId: vendor._id,
            targetName: vendor.storeName || vendor.name,
            description: `Activated vendor: ${vendor.storeName} (${vendor.name})`,
            metadata: {
                statusChange: 'inactive -> active'
            }
        });

        return vendor;
    } catch (error) {
        console.error('Error activating vendor with logging:', error);
        throw error;
    }
};

export const deactivateVendorServiceWithLogging = async (id, req) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true, runValidators: true });
        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Log the deactivation activity
        await logActivity(req, {
            action: 'deactivate',
            targetModel: 'Vendor',
            targetId: vendor._id,
            targetName: vendor.storeName || vendor.name,
            description: `Deactivated vendor: ${vendor.storeName} (${vendor.name})`,
            metadata: {
                statusChange: 'active -> inactive'
            }
        });

        return vendor;
    } catch (error) {
        console.error('Error deactivating vendor with logging:', error);
        throw error;
    }
};
