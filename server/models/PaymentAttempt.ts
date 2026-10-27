import mongoose, { Schema, Document } from 'mongoose';

export type PaymentAttemptStatus = 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'FAILED';

export interface IPaymentAttempt extends Document {
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  md5Hash: string;
  amount: number;
  currency: 'USD' | 'KHR';
  status: PaymentAttemptStatus;
  checkCount: number;
  lastCheckedAt?: Date;
  nextCheckAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAttemptSchema: Schema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    md5Hash: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['USD', 'KHR'], default: 'USD' },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'EXPIRED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    checkCount: { type: Number, default: 0 },
    lastCheckedAt: { type: Date },
    nextCheckAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const PaymentAttempt =
  mongoose.models.PaymentAttempt ||
  mongoose.model<IPaymentAttempt>('PaymentAttempt', PaymentAttemptSchema);
