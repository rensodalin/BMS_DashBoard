import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentTransaction extends Document {
  invoiceId: mongoose.Types.ObjectId;
  paymentAttemptId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  bakongHash: string;
  fromAccountId: string;
  toAccountId: string;
  currency: string;
  amount: number;
  description?: string;
  externalRef?: string;
  rawResponse: Record<string, any>;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema: Schema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    paymentAttemptId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentAttempt',
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, index: true },
    bakongHash: { type: String, required: true, unique: true, index: true },
    fromAccountId: { type: String, required: true },
    toAccountId: { type: String, required: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    externalRef: { type: String },
    rawResponse: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const PaymentTransaction =
  mongoose.models.PaymentTransaction ||
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
