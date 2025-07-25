import Vendor from '../models/vendor.model.js';

export const createVendorService = async (data) => {
    return Vendor.create(data);
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
        .select('_id name storeName')
        .sort({ name: 1 });
};

export const activateVendorService = async (id) => {
    return Vendor.findByIdAndUpdate(id, { isActive: true }, { new: true });
};

export const deactivateVendorService = async (id) => {
    return Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true });
}; 