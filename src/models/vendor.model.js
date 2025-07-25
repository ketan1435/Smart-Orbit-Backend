import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    storeName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    gstNo: { type: String }, // optional
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

const Vendor = mongoose.model('Vendor', vendorSchema);
export default Vendor; 