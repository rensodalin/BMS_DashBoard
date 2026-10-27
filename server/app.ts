import express from 'express';
import cors from 'cors';
import { invoiceRouter } from './routes/invoiceRoutes';
import { paymentRouter } from './routes/paymentRoutes';
import { tenantRouter } from './routes/tenantRoutes';
import { config } from './config/env';

export const app = express();

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check & System Status
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'BMS Bakong KHQR Billing Server',
    environment: config.nodeEnv,
    bakongAccount: config.bakong.accountId,
    telegramConfigured: Boolean(config.telegram.botToken && config.telegram.chatId),
    gmailConfigured: Boolean(config.gmail.user && config.gmail.appPassword),
  });
});

// API Routes
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/tenants', tenantRouter);
