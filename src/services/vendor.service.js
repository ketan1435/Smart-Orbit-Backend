import Vendor from '../models/vendor.model.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

export const createVendorService = async (req, data) => {
    const vendor = await Vendor.create(data);

    // Log the vendor creation activity
    try {
        await logActivity(req, {
            action: 'create_vendor',
            targetModel: 'Vendor',
            targetId: vendor._id,
            targetName: vendor.name || 'Vendor',
            description: `${req.user?.role === 'admin' ? 'Admin' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) created vendor "${vendor.name}" (${vendor.storeName})`,
            changes: {
                vendorCreated: true,
                name: vendor.name,
                storeName: vendor.storeName,
                mobileNumber: vendor.mobileNumber,
                email: vendor.email,
                address: vendor.address,
                city: vendor.city,
                state: vendor.state,
                country: vendor.country,
                gstNo: vendor.gstNo,
                isActive: vendor.isActive,
                createdAt: vendor.createdAt
            },
            metadata: {
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : 'User',
                    userPhone: req.user?.phone
                },
                vendorData: {
                    vendorId: vendor._id,
                    name: vendor.name,
                    storeName: vendor.storeName,
                    mobileNumber: vendor.mobileNumber,
                    email: vendor.email,
                    address: vendor.address,
                    city: vendor.city,
                    state: vendor.state,
                    country: vendor.country,
                    gstNo: vendor.gstNo,
                    isActive: vendor.isActive,
                    createdAt: vendor.createdAt,
                    updatedAt: vendor.updatedAt
                },
                vendorCreation: {
                    vendorCreated: true,
                    createdBy: req.user?._id,
                    createdByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
                    createdAt: new Date(),
                    vendorName: vendor.name,
                    vendorStore: vendor.storeName,
                    vendorLocation: `${vendor.city}, ${vendor.state}, ${vendor.country}`,
                    vendorContact: {
                        mobile: vendor.mobileNumber,
                        email: vendor.email
                    },
                    vendorAddress: vendor.address,
                    gstProvided: !!vendor.gstNo,
                    gstNumber: vendor.gstNo
                },
                locationData: {
                    city: vendor.city,
                    state: vendor.state,
                    country: vendor.country,
                    fullAddress: vendor.address,
                    locationString: `${vendor.city}, ${vendor.state}, ${vendor.country}`
                },
                contactData: {
                    mobileNumber: vendor.mobileNumber,
                    email: vendor.email,
                    contactProvided: !!(vendor.mobileNumber && vendor.email)
                },
                businessData: {
                    storeName: vendor.storeName,
                    gstNo: vendor.gstNo,
                    gstProvided: !!vendor.gstNo,
                    isActive: vendor.isActive,
                    businessType: 'vendor'
                },
                workflow: {
                    vendorCreation: true,
                    vendorManagement: true,
                    procurementWorkflow: true,
                    vendorOnboarding: true,
                    creationComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging vendor creation:', error);
    }

    return vendor;
};

export const getVendorsService = async (query) => {
    const { page = 1, limit = 10, name, storeName, city, state, country, gstNo, isActive } = query;
    const filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (storeName) filter.storeName = { $regex: storeName, $options: 'i' };
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (state) filter.state = { $regex: state, $options: 'i' };
    if (country) filter.country = { $regex: country, $options: 'i' };
    if (gstNo) filter.gstNo = { $regex: gstNo, $options: 'i' };
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [vendors, total] = await Promise.all([
        Vendor.find(filter).skip(skip).limit(parseInt(limit)),
        Vendor.countDocuments(filter)
    ]);

    return {
        data: vendors,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    };
};

export const getVendorsDropdownService = async (query) => {
    const { name, storeName, city, state, country, gstNo, isActive } = query;
    const filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (storeName) filter.storeName = { $regex: storeName, $options: 'i' };
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (state) filter.state = { $regex: state, $options: 'i' };
    if (country) filter.country = { $regex: country, $options: 'i' };
    if (gstNo) filter.gstNo = { $regex: gstNo, $options: 'i' };
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

    return Vendor.find(filter)
        .select('_id name storeName state city')
        .sort({ name: 1 });
};

export const activateVendorService = async (req, id) => {
    const vendor = await Vendor.findByIdAndUpdate(id, { isActive: true }, { new: true });

    if (vendor) {
        // Log the vendor activation activity
        try {
            await logActivity(req, {
                action: 'activate_vendor',
                targetModel: 'Vendor',
                targetId: vendor._id,
                targetName: vendor.name || 'Vendor',
                description: `${req.user?.role === 'admin' ? 'Admin' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) activated vendor "${vendor.name}" (${vendor.storeName})`,
                changes: {
                    isActive: {
                        from: false,
                        to: true
                    },
                    activatedAt: new Date(),
                    activatedBy: req.user?._id,
                    activatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
                },
                metadata: {
                    user: {
                        userId: req.user?._id,
                        userName: req.user?.name,
                        userEmail: req.user?.email,
                        userRole: req.user?.role,
                        userType: req.user?.role === 'admin' ? 'Admin' : 'User',
                        userPhone: req.user?.phone
                    },
                    vendorData: {
                        vendorId: vendor._id,
                        name: vendor.name,
                        storeName: vendor.storeName,
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        address: vendor.address,
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        gstNo: vendor.gstNo,
                        isActive: vendor.isActive,
                        createdAt: vendor.createdAt,
                        updatedAt: vendor.updatedAt
                    },
                    vendorActivation: {
                        vendorActivated: true,
                        activatedBy: req.user?._id,
                        activatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
                        activatedAt: new Date(),
                        vendorName: vendor.name,
                        vendorStore: vendor.storeName,
                        vendorLocation: `${vendor.city}, ${vendor.state}, ${vendor.country}`,
                        previousStatus: 'inactive',
                        newStatus: 'active',
                        activationAction: 'activate'
                    },
                    locationData: {
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        fullAddress: vendor.address,
                        locationString: `${vendor.city}, ${vendor.state}, ${vendor.country}`
                    },
                    contactData: {
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        contactProvided: !!(vendor.mobileNumber && vendor.email)
                    },
                    businessData: {
                        storeName: vendor.storeName,
                        gstNo: vendor.gstNo,
                        gstProvided: !!vendor.gstNo,
                        isActive: vendor.isActive,
                        businessType: 'vendor'
                    },
                    workflow: {
                        vendorActivation: true,
                        vendorManagement: true,
                        procurementWorkflow: true,
                        vendorStatusChange: true,
                        activationComplete: true
                    }
                }
            });
        } catch (error) {
            console.error('Error logging vendor activation:', error);
        }
    }

    return vendor;
};

export const deactivateVendorService = async (req, id) => {
    const vendor = await Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (vendor) {
        // Log the vendor deactivation activity
        try {
            await logActivity(req, {
                action: 'deactivate_vendor',
                targetModel: 'Vendor',
                targetId: vendor._id,
                targetName: vendor.name || 'Vendor',
                description: `${req.user?.role === 'admin' ? 'Admin' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) deactivated vendor "${vendor.name}" (${vendor.storeName})`,
                changes: {
                    isActive: {
                        from: true,
                        to: false
                    },
                    deactivatedAt: new Date(),
                    deactivatedBy: req.user?._id,
                    deactivatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
                },
                metadata: {
                    user: {
                        userId: req.user?._id,
                        userName: req.user?.name,
                        userEmail: req.user?.email,
                        userRole: req.user?.role,
                        userType: req.user?.role === 'admin' ? 'Admin' : 'User',
                        userPhone: req.user?.phone
                    },
                    vendorData: {
                        vendorId: vendor._id,
                        name: vendor.name,
                        storeName: vendor.storeName,
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        address: vendor.address,
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        gstNo: vendor.gstNo,
                        isActive: vendor.isActive,
                        createdAt: vendor.createdAt,
                        updatedAt: vendor.updatedAt
                    },
                    vendorDeactivation: {
                        vendorDeactivated: true,
                        deactivatedBy: req.user?._id,
                        deactivatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
                        deactivatedAt: new Date(),
                        vendorName: vendor.name,
                        vendorStore: vendor.storeName,
                        vendorLocation: `${vendor.city}, ${vendor.state}, ${vendor.country}`,
                        previousStatus: 'active',
                        newStatus: 'inactive',
                        deactivationAction: 'deactivate'
                    },
                    locationData: {
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        fullAddress: vendor.address,
                        locationString: `${vendor.city}, ${vendor.state}, ${vendor.country}`
                    },
                    contactData: {
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        contactProvided: !!(vendor.mobileNumber && vendor.email)
                    },
                    businessData: {
                        storeName: vendor.storeName,
                        gstNo: vendor.gstNo,
                        gstProvided: !!vendor.gstNo,
                        isActive: vendor.isActive,
                        businessType: 'vendor'
                    },
                    workflow: {
                        vendorDeactivation: true,
                        vendorManagement: true,
                        procurementWorkflow: true,
                        vendorStatusChange: true,
                        deactivationComplete: true
                    }
                }
            });
        } catch (error) {
            console.error('Error logging vendor deactivation:', error);
        }
    }

    return vendor;
};

export const updateVendorService = async (req, id, data) => {
    // Get the original vendor data before updating
    const originalVendor = await Vendor.findById(id);
    if (!originalVendor) {
        return null;
    }

    const vendor = await Vendor.findByIdAndUpdate(id, data, { new: true, runValidators: true });

    if (vendor) {
        // Log the vendor update activity
        try {
            await logActivity(req, {
                action: 'update_vendor',
                targetModel: 'Vendor',
                targetId: vendor._id,
                targetName: vendor.name || 'Vendor',
                description: `${req.user?.role === 'admin' ? 'Admin' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) updated vendor "${vendor.name}" (${vendor.storeName})`,
                changes: {
                    name: {
                        from: originalVendor.name,
                        to: vendor.name
                    },
                    storeName: {
                        from: originalVendor.storeName,
                        to: vendor.storeName
                    },
                    mobileNumber: {
                        from: originalVendor.mobileNumber,
                        to: vendor.mobileNumber
                    },
                    email: {
                        from: originalVendor.email,
                        to: vendor.email
                    },
                    address: {
                        from: originalVendor.address,
                        to: vendor.address
                    },
                    city: {
                        from: originalVendor.city,
                        to: vendor.city
                    },
                    state: {
                        from: originalVendor.state,
                        to: vendor.state
                    },
                    country: {
                        from: originalVendor.country,
                        to: vendor.country
                    },
                    gstNo: {
                        from: originalVendor.gstNo,
                        to: vendor.gstNo
                    },
                    isActive: {
                        from: originalVendor.isActive,
                        to: vendor.isActive
                    },
                    updatedAt: {
                        from: originalVendor.updatedAt,
                        to: vendor.updatedAt
                    }
                },
                metadata: {
                    user: {
                        userId: req.user?._id,
                        userName: req.user?.name,
                        userEmail: req.user?.email,
                        userRole: req.user?.role,
                        userType: req.user?.role === 'admin' ? 'Admin' : 'User',
                        userPhone: req.user?.phone
                    },
                    vendorData: {
                        vendorId: vendor._id,
                        name: vendor.name,
                        storeName: vendor.storeName,
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        address: vendor.address,
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        gstNo: vendor.gstNo,
                        isActive: vendor.isActive,
                        createdAt: vendor.createdAt,
                        updatedAt: vendor.updatedAt
                    },
                    originalVendorData: {
                        vendorId: originalVendor._id,
                        name: originalVendor.name,
                        storeName: originalVendor.storeName,
                        mobileNumber: originalVendor.mobileNumber,
                        email: originalVendor.email,
                        address: originalVendor.address,
                        city: originalVendor.city,
                        state: originalVendor.state,
                        country: originalVendor.country,
                        gstNo: originalVendor.gstNo,
                        isActive: originalVendor.isActive,
                        createdAt: originalVendor.createdAt,
                        updatedAt: originalVendor.updatedAt
                    },
                    vendorUpdate: {
                        vendorUpdated: true,
                        updatedBy: req.user?._id,
                        updatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
                        updatedAt: new Date(),
                        vendorName: vendor.name,
                        vendorStore: vendor.storeName,
                        vendorLocation: `${vendor.city}, ${vendor.state}, ${vendor.country}`,
                        updateAction: 'update',
                        fieldsUpdated: Object.keys(data).length,
                        updateData: data
                    },
                    locationData: {
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        fullAddress: vendor.address,
                        locationString: `${vendor.city}, ${vendor.state}, ${vendor.country}`,
                        locationChanged: originalVendor.city !== vendor.city || originalVendor.state !== vendor.state || originalVendor.country !== vendor.country
                    },
                    contactData: {
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        contactProvided: !!(vendor.mobileNumber && vendor.email),
                        contactChanged: originalVendor.mobileNumber !== vendor.mobileNumber || originalVendor.email !== vendor.email
                    },
                    businessData: {
                        storeName: vendor.storeName,
                        gstNo: vendor.gstNo,
                        gstProvided: !!vendor.gstNo,
                        isActive: vendor.isActive,
                        businessType: 'vendor',
                        businessChanged: originalVendor.storeName !== vendor.storeName || originalVendor.gstNo !== vendor.gstNo || originalVendor.isActive !== vendor.isActive
                    },
                    workflow: {
                        vendorUpdate: true,
                        vendorManagement: true,
                        procurementWorkflow: true,
                        vendorModification: true,
                        updateComplete: true
                    }
                }
            });
        } catch (error) {
            console.error('Error logging vendor update:', error);
        }
    }

    return vendor;
};

export const getVendorByIdService = async (id) => {
    const vendor = await Vendor.findById(id);
    return vendor;
};

export const deleteVendorService = async (req, id) => {
    // Get the original vendor data before soft deleting
    const originalVendor = await Vendor.findById(id);
    if (!originalVendor) {
        return null;
    }

    // Soft delete - set isActive to false instead of actually deleting
    const vendor = await Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (vendor) {
        // Log the vendor deletion activity
        try {
            await logActivity(req, {
                action: 'delete_vendor',
                targetModel: 'Vendor',
                targetId: vendor._id,
                targetName: vendor.name || 'Vendor',
                description: `${req.user?.role === 'admin' ? 'Admin' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) soft deleted vendor "${vendor.name}" (${vendor.storeName})`,
                changes: {
                    isActive: {
                        from: originalVendor.isActive,
                        to: false
                    },
                    deletedAt: new Date(),
                    deletedBy: req.user?._id,
                    deletedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
                    softDeleted: true
                },
                metadata: {
                    user: {
                        userId: req.user?._id,
                        userName: req.user?.name,
                        userEmail: req.user?.email,
                        userRole: req.user?.role,
                        userType: req.user?.role === 'admin' ? 'Admin' : 'User',
                        userPhone: req.user?.phone
                    },
                    vendorData: {
                        vendorId: vendor._id,
                        name: vendor.name,
                        storeName: vendor.storeName,
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        address: vendor.address,
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        gstNo: vendor.gstNo,
                        isActive: vendor.isActive,
                        createdAt: vendor.createdAt,
                        updatedAt: vendor.updatedAt
                    },
                    originalVendorData: {
                        vendorId: originalVendor._id,
                        name: originalVendor.name,
                        storeName: originalVendor.storeName,
                        mobileNumber: originalVendor.mobileNumber,
                        email: originalVendor.email,
                        address: originalVendor.address,
                        city: originalVendor.city,
                        state: originalVendor.state,
                        country: originalVendor.country,
                        gstNo: originalVendor.gstNo,
                        isActive: originalVendor.isActive,
                        createdAt: originalVendor.createdAt,
                        updatedAt: originalVendor.updatedAt
                    },
                    vendorDeletion: {
                        vendorDeleted: true,
                        deletedBy: req.user?._id,
                        deletedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
                        deletedAt: new Date(),
                        vendorName: vendor.name,
                        vendorStore: vendor.storeName,
                        vendorLocation: `${vendor.city}, ${vendor.state}, ${vendor.country}`,
                        deletionType: 'soft_delete',
                        previousStatus: originalVendor.isActive ? 'active' : 'inactive',
                        newStatus: 'deleted',
                        deletionAction: 'soft_delete'
                    },
                    locationData: {
                        city: vendor.city,
                        state: vendor.state,
                        country: vendor.country,
                        fullAddress: vendor.address,
                        locationString: `${vendor.city}, ${vendor.state}, ${vendor.country}`
                    },
                    contactData: {
                        mobileNumber: vendor.mobileNumber,
                        email: vendor.email,
                        contactProvided: !!(vendor.mobileNumber && vendor.email)
                    },
                    businessData: {
                        storeName: vendor.storeName,
                        gstNo: vendor.gstNo,
                        gstProvided: !!vendor.gstNo,
                        isActive: vendor.isActive,
                        businessType: 'vendor'
                    },
                    workflow: {
                        vendorDeletion: true,
                        vendorManagement: true,
                        procurementWorkflow: true,
                        vendorSoftDelete: true,
                        deletionComplete: true
                    }
                }
            });
        } catch (error) {
            console.error('Error logging vendor deletion:', error);
        }
    }

    return vendor;
}; 