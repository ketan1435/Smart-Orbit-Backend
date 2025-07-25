import PO from '../models/po.model.js';
import storage from '../factory/storage.factory.js';
import { v4 as uuidv4 } from 'uuid';

export const createPOService = async (data, user) => {
    // 1. Create PO DB record first (documents will be empty for now)
    const { vendor, project, name, description, documents } = data;
    const po = await PO.create({ vendor, project, name, description, documents: [] });

    const copiedFiles = [];
    try {
        // 2. For each file key, copy from tmp/ to permanent S3 location
        for (const doc of documents) {
            const fileName = doc.key.split('/').pop();
            const permanentKey = `po/${po._id}/${uuidv4()}-${fileName}`;
            await storage.copyFile(doc.key, permanentKey);
            copiedFiles.push({ ...doc, key: permanentKey });
        }
    } catch (err) {
        // 3. If any copy fails, delete all copied files and rethrow
        await Promise.all(
            copiedFiles.map(f => storage.deleteFile(f.key))
        );
        throw err;
    }

    // 4. Update PO record with permanent file keys
    po.documents = copiedFiles;
    await po.save();

    // 5. Delete all tmp/ files
    await Promise.all(
        (documents || []).map(doc => storage.deleteFile(doc.key))
    );

    return po;
};

export const getPOsService = async (query) => {
    const { page = 1, limit = 10, vendor, project, name } = query;
    const filter = {};
    if (vendor) filter.vendor = vendor;
    if (project) filter.project = project;
    if (name) filter.name = { $regex: name, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [pos, total] = await Promise.all([
        PO.find(filter).skip(skip).limit(parseInt(limit)),
        PO.countDocuments(filter)
    ]);

    return {
        data: pos,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    };
};

export const activatePOService = async (id) => {
    return PO.findByIdAndUpdate(id, { isActive: true }, { new: true });
};

export const deactivatePOService = async (id) => {
    return PO.findByIdAndUpdate(id, { isActive: false }, { new: true });
}; 