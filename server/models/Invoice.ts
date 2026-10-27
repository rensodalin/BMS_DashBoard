import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface IInvoice extends Document {
  invoiceNumber: string;
  tenantName: string;
  tenantEmail: string;
  meterName: string;
  unitZone: string;
  kwhReading: number;
  ratePerKwh: number;
  demandCharge: number;
  totalCostUsd: number;
  totalCostKhr: number;
  billingPeriod: string;
  status: InvoiceStatus;
  dueDate?: Date;
  khqrString?: string;
  md5Hash?: string;
  qrCodeDataUrl?: string;
  emailSent: boolean;
  emailSentAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema: Schema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    tenantName: { type: String, required: true },
    tenantEmail: { type: String, required: true },
    meterName: { type: String, required: true, index: true },
    unitZone: { type: String, required: true },
    kwhReading: { type: Number, required: true },
    ratePerKwh: { type: Number, default: 0.15 },
    demandCharge: { type: Number, default: 0.0 },
    totalCostUsd: { type: Number, required: true },
    totalCostKhr: { type: Number, required: true },
    billingPeriod: { type: String, required: true, default: 'Sep 2026' },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    dueDate: { type: Date },
    khqrString: { type: String },
    md5Hash: { type: String, index: true },
    qrCodeDataUrl: { type: String },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export const Invoice = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);
