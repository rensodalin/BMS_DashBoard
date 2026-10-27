import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  email: string;
  phone?: string;
  unitZone: string;
  meterName: string;
  demandCharge: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    unitZone: { type: String, required: true },
    meterName: { type: String, required: true, unique: true },
    demandCharge: { type: Number, default: 25.0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Tenant = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);
