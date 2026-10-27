import { Router, Request, Response } from 'express';
import { InvoiceService } from '../services/InvoiceService';
import { KhqrService } from '../services/KhqrService';

export const invoiceRouter = Router();

// GET /api/invoices - List all invoices
invoiceRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const invoices = await InvoiceService.getAllInvoices();
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/invoices/:invoiceNumber - Get single invoice
invoiceRouter.get('/:invoiceNumber', async (req: Request, res: Response) => {
  try {
    const invoiceNumber = String(req.params.invoiceNumber);
    const invoice = await InvoiceService.getByInvoiceNumber(invoiceNumber);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/invoices - Create new invoice with KHQR
invoiceRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      invoiceNumber,
      tenantName,
      tenantEmail,
      meterName,
      unitZone,
      kwhReading,
      ratePerKwh,
      demandCharge,
      totalCostUsd,
      totalCostKhr,
      billingPeriod,
      dueDate,
      sendEmailImmediately,
    } = req.body;

    if (!invoiceNumber || !tenantName || !tenantEmail || !meterName || kwhReading === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: invoiceNumber, tenantName, tenantEmail, meterName, kwhReading',
      });
    }

    const invoice = await InvoiceService.createInvoice({
      invoiceNumber,
      tenantName,
      tenantEmail,
      meterName,
      unitZone: unitZone || 'Standard Zone',
      kwhReading: Number(kwhReading),
      ratePerKwh: ratePerKwh ? Number(ratePerKwh) : undefined,
      demandCharge: demandCharge ? Number(demandCharge) : undefined,
      totalCostUsd: totalCostUsd ? Number(totalCostUsd) : undefined,
      totalCostKhr: totalCostKhr ? Number(totalCostKhr) : undefined,
      billingPeriod,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      sendEmailImmediately: Boolean(sendEmailImmediately),
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/invoices/:invoiceNumber/send-email - Send invoice email with KHQR
invoiceRouter.post('/:invoiceNumber/send-email', async (req: Request, res: Response) => {
  try {
    const invoiceNumber = String(req.params.invoiceNumber);
    const result = await InvoiceService.sendInvoiceEmail(invoiceNumber);
    res.json({ success: true, message: 'Invoice email sent successfully', result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/invoices/:invoiceNumber/generate-khqr - Regenerate KHQR
invoiceRouter.post('/:invoiceNumber/generate-khqr', async (req: Request, res: Response) => {
  try {
    const invoiceNumber = String(req.params.invoiceNumber);
    const invoice = await InvoiceService.getByInvoiceNumber(invoiceNumber);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

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

    res.json({ success: true, data: khqr });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
