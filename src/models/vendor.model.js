import mongoose, { Schema } from 'mongoose';
import productSchema from './schema/product.schema.js';

const VendorSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    storeName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phoneNo: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    products: [productSchema],
    isActive: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// VendorSchema.virtual('incomeRecords', {
//   ref: 'Income',
//   localField: '_id',
//   foreignField: 'store',
// });
//
// VendorSchema.virtual('expenseRecords', {
//   ref: 'Expense',
//   localField: '_id',
//   foreignField: 'store',
// });

const Vendor = mongoose.model('Vendor', VendorSchema);

export { Vendor, VendorSchema };
