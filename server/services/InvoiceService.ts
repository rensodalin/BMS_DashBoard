import { Invoice, IInvoice, PaymentAttempt, Tenant } from '../models';
import { KhqrService } from './KhqrService';
import { EmailService } from './EmailService';
import { SupabaseSyncService } from './SupabaseSyncService';

export interface CreateInvoiceDto {
  invoiceNumber: string;
  tenantName: string;
  tenantEmail: string;
  meterName: string;
  unitZone: string;
  kwhReading: number;
  ratePerKwh?: number;
  demandCharge?: number;
  totalCostUsd?: number;
  totalCostKhr?: number;
  billingPeriod?: string;
  dueDate?: Date;
  sendEmailImmediately?: boolean;
}

export class InvoiceService {
  /**
   * Creates a new invoice, generates official Bakong KHQR, and registers an active PaymentAttempt
   */
  public static async createInvoice(dto: CreateInvoiceDto): Promise<IInvoice> {
    const ratePerKwh = dto.ratePerKwh ?? 0.15;
    const demandCharge = dto.demandCharge ?? 25.0;

    const totalCostUsd =
      dto.totalCostUsd ?? Number((dto.kwhReading * ratePerKwh + demandCharge).toFixed(2));
    const totalCostKhr = dto.totalCostKhr ?? Math.round(totalCostUsd * 4100);

    // 1. Generate Bakong KHQR payload + MD5 hash + QR code image
    const khqrResult = await KhqrService.generateInvoiceKhqr({
      invoiceNumber: dto.invoiceNumber,
      amount: totalCostUsd,
      currency: 'USD',
      tenantName: dto.tenantName,
      ttlHours: 72,
    });

    // 2. Persist Invoice in MongoDB
    const invoice = new Invoice({
      invoiceNumber: dto.invoiceNumber,
      tenantName: dto.tenantName,
      tenantEmail: dto.tenantEmail,
      meterName: dto.meterName,
      unitZone: dto.unitZone,
      kwhReading: dto.kwhReading,
      ratePerKwh,
      demandCharge,
      totalCostUsd,
      totalCostKhr,
      billingPeriod: dto.billingPeriod || 'Sep 2026',
      status: 'PENDING',
      dueDate: dto.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      khqrString: khqrResult.qr,
      md5Hash: khqrResult.md5,
      qrCodeDataUrl: khqrResult.qrCodeDataUrl,
    });

    await invoice.save();

    // 3. Register Active PaymentAttempt for the monitoring worker
    const paymentAttempt = new PaymentAttempt({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      md5Hash: khqrResult.md5,
      amount: totalCostUsd,
      currency: 'USD',
      status: 'PENDING',
      expiresAt: khqrResult.expiresAt,
    });

    await paymentAttempt.save();

    // 4. Optionally dispatch email immediately
    if (dto.sendEmailImmediately && dto.tenantEmail) {
      try {
        await EmailService.sendInvoiceWithKhqr({
          to: dto.tenantEmail,
          tenantName: dto.tenantName,
          invoiceNumber: dto.invoiceNumber,
          unitZone: dto.unitZone,
          billingPeriod: invoice.billingPeriod,
          kwhReading: dto.kwhReading,
          ratePerKwh,
          demandCharge,
          totalCostUsd,
          totalCostKhr,
          dueDate: invoice.dueDate,
          qrCodeDataUrl: khqrResult.qrCodeDataUrl,
          md5Hash: khqrResult.md5,
        });

        invoice.emailSent = true;
        invoice.emailSentAt = new Date();
        await invoice.save();
      } catch (err: any) {
        console.error(`[InvoiceService] Failed to send email for ${dto.invoiceNumber}:`, err.message);
      }
    }

    return invoice;
  }

  /**
   * Retrieves all invoices
   */
  public static async getAllInvoices() {
    return Invoice.find().sort({ createdAt: -1 });
  }

  /**
   * Retrieves invoice by Invoice Number
   */
  public static async getByInvoiceNumber(invoiceNumber: string) {
    return Invoice.findOne({ invoiceNumber });
  }

  /**
   * Sends or resends invoice email with KHQR
   */
  public static async sendInvoiceEmail(invoiceNumber: string) {
    const invoice = await Invoice.findOne({ invoiceNumber });
    if (!invoice) throw new Error(`Invoice ${invoiceNumber} not found`);

    if (!invoice.qrCodeDataUrl) {
      // Re-generate KHQR if missing
      const khqr = await KhqrService.generateInvoiceKhqr({
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalCostUsd,
        currency: 'USD',
        tenantName: invoice.tenantName,
      });
      invoice.khqrString = khqr.qr;
      invoice.md5Hash = khqr.md5;
      invoice.qrCodeDataUrl = khqr.qrCodeDataUrl;
      await invoice.save();
    }

    const emailResult = await EmailService.sendInvoiceWithKhqr({
      to: invoice.tenantEmail,
      tenantName: invoice.tenantName,
      invoiceNumber: invoice.invoiceNumber,
      unitZone: invoice.unitZone,
      billingPeriod: invoice.billingPeriod,
      kwhReading: invoice.kwhReading,
      ratePerKwh: invoice.ratePerKwh,
      demandCharge: invoice.demandCharge,
      totalCostUsd: invoice.totalCostUsd,
      totalCostKhr: invoice.totalCostKhr,
      dueDate: invoice.dueDate,
      qrCodeDataUrl: invoice.qrCodeDataUrl!,
      md5Hash: invoice.md5Hash,
    });

    invoice.emailSent = true;
    invoice.emailSentAt = new Date();
    await invoice.save();

    return emailResult;
  }
}
