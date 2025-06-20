import mongoose, { Schema } from 'mongoose';
import ProductType from '../../config/enums/productType.enum.js';

const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      enum: Object.values(ProductType),
    },
    upcNo: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      validator(value) {
        return this.type !== ProductType.FIX || (value !== null && value !== undefined);
      },
      message: "Quantity is required when type is 'Fix'.",
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
export default productSchema;
