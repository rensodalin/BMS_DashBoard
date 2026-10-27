import { Router, Request, Response } from 'express';
import { BakongService } from '../services/BakongService';
import { PaymentAttempt, PaymentTransaction } from '../models';
import { PaymentMonitoringWorker } from '../workers/PaymentMonitoringWorker';

export const paymentRouter = Router();

// GET /api/payments/status/:md5 - Check real-time Bakong payment status by MD5
paymentRouter.get('/status/:md5', async (req: Request, res: Response) => {
  try {
    const md5 = String(req.params.md5);
    const result = await BakongService.checkTransactionByMd5(md5);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments/attempts - List payment attempts
paymentRouter.get('/attempts', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const query = status ? { status } : {};
    const attempts = await PaymentAttempt.find(query).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, count: attempts.length, data: attempts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments/transactions - List settled transactions
paymentRouter.get('/transactions', async (_req: Request, res: Response) => {
  try {
    const transactions = await PaymentTransaction.find().sort({ paidAt: -1 }).limit(50);
    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/poll-now - Trigger immediate worker check
paymentRouter.post('/poll-now', async (_req: Request, res: Response) => {
  try {
    await PaymentMonitoringWorker.pollPendingPayments();
    res.json({ success: true, message: 'Poll cycle executed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/simulate-success/:invoiceNumber - Test endpoint to simulate payment & trigger Telegram alert
paymentRouter.post('/simulate-success/:invoiceNumber', async (req: Request, res: Response) => {
  try {
    const invoiceNumber = String(req.params.invoiceNumber);
    const { fromAccount } = req.body;
    const result = await PaymentMonitoringWorker.simulatePaymentSuccess(invoiceNumber, fromAccount);
    res.json({ success: true, message: 'Payment simulated and Telegram alert dispatched', data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
