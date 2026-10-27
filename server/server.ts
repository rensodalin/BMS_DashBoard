import mongoose from 'mongoose';
import { app } from './app';
import { config } from './config/env';
import { PaymentMonitoringWorker } from './workers/PaymentMonitoringWorker';
import { SupabaseSyncService } from './services/SupabaseSyncService';
import { Tenant, Invoice } from './models';
import { KhqrService } from './services/KhqrService';

async function bootstrap() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚡ Starting Intersys BMS Bakong KHQR Backend Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`• Bakong Account ID  : ${config.bakong.accountId}`);
  console.log(`• Bakong Merchant    : ${config.bakong.merchantName} (${config.bakong.merchantCity})`);
  console.log(`• Telegram Alerts    : ${config.telegram.chatId ? 'Configured ✅' : 'Missing ⚠️'}`);
  console.log(`• Gmail SMTP Alerts  : ${config.gmail.user ? 'Configured ✅' : 'Missing ⚠️'}`);
  console.log(`• MongoDB URI        : ${config.mongoUri}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Connect to MongoDB
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('✅ Connected to MongoDB successfully.');
  } catch (err: any) {
    console.warn('⚠️  Could not connect to external MongoDB at', config.mongoUri);
    try {
      console.log('🔄 Starting embedded MongoDB Memory Server for seamless operation...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      console.log('✅ Connected to embedded MongoDB Memory Server at:', memUri);
    } catch (memErr: any) {
      console.warn('⚠️  Embedded MongoDB fallback notice:', memErr.message);
    }
  }

  // 2. Auto-Seed Initial Tenants & Invoices if DB is empty and connected
  if (mongoose.connection.readyState === 1) {
    try {
      const tenantCount = await Tenant.countDocuments();
      if (tenantCount === 0) {
        console.log('🌱 Seeding default tenants from Supabase or default catalog...');
        const supabaseMeters = await SupabaseSyncService.fetchSupabaseMeters();

        if (supabaseMeters.length > 0) {
          for (const m of supabaseMeters) {
            await Tenant.create({
              name: m.tenant_name,
              email: (m.tenant_name.toLowerCase().replace(/[^a-z0-9]/g, '') + '@example.com'),
              unitZone: m.unit_zone,
              meterName: m.meter_name,
              demandCharge: Number(m.demand_charge || 25),
            });
          }
        } else {
          // Default fallbacks
          await Tenant.create([
            {
              name: 'Tenant Intersys Co., Ltd.',
              email: 'billing-intersys@example.com',
              unitZone: 'Floor 3 - Suite 302',
              meterName: 'TenantIntersys_kWh',
              demandCharge: 25.0,
            },
            {
              name: 'Grand Retail Zone A',
              email: 'retail-a@example.com',
              unitZone: 'Ground Floor - Retail 101',
              meterName: 'Retail_A_kWh',
              demandCharge: 45.0,
            },
            {
              name: 'Executive Office Suite',
              email: 'executive@example.com',
              unitZone: 'Floor 5 - Executive Tower',
              meterName: 'ExecSuite_kWh',
              demandCharge: 20.0,
            },
          ]);
        }
        console.log('✅ Seeded tenants into MongoDB.');
      }

      // Check if invoices exist
      const invoiceCount = await Invoice.countDocuments();
      if (invoiceCount === 0) {
        console.log('🌱 Seeding initial invoices with generated Bakong KHQR...');
        const initialInvoices = [
          {
            invoiceNumber: 'INV-2026-001',
            tenantName: 'Tenant Intersys Co., Ltd.',
            tenantEmail: 'rrensodalin@gmail.com', // User's email for testing
            meterName: 'TenantIntersys_kWh',
            unitZone: 'Floor 3 - Suite 302',
            kwhReading: 1075.0,
            ratePerKwh: 0.15,
            demandCharge: 25.0,
            totalCostUsd: 186.25,
            totalCostKhr: 763625.0,
            billingPeriod: 'Aug 2026',
            status: 'PENDING' as const,
          },
          {
            invoiceNumber: 'INV-2026-002',
            tenantName: 'Grand Retail Zone A',
            tenantEmail: 'rrensodalin@gmail.com',
            meterName: 'Retail_A_kWh',
            unitZone: 'Ground Floor - Retail 101',
            kwhReading: 2150.5,
            ratePerKwh: 0.15,
            demandCharge: 45.0,
            totalCostUsd: 367.58,
            totalCostKhr: 1507078.0,
            billingPeriod: 'Aug 2026',
            status: 'PENDING' as const,
          },
        ];

        for (const item of initialInvoices) {
          const khqr = await KhqrService.generateInvoiceKhqr({
            invoiceNumber: item.invoiceNumber,
            amount: item.totalCostUsd,
            currency: 'USD',
            tenantName: item.tenantName,
          });

          const inv = await Invoice.create({
            ...item,
            khqrString: khqr.qr,
            md5Hash: khqr.md5,
            qrCodeDataUrl: khqr.qrCodeDataUrl,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          });

          // Create payment attempt
          const { PaymentAttempt } = await import('./models');
          await PaymentAttempt.create({
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            md5Hash: khqr.md5,
            amount: inv.totalCostUsd,
            currency: 'USD',
            status: 'PENDING',
            expiresAt: khqr.expiresAt,
          });
        }
        console.log('✅ Seeded initial invoices with active KHQR & Payment Attempts.');
      }
    } catch (seedErr: any) {
      console.warn('⚠️ Seeding error:', seedErr.message);
    }
  }

  // 3. Start Payment Monitoring Worker
  if (mongoose.connection.readyState === 1) {
    PaymentMonitoringWorker.start();
  }

  // 4. Start HTTP Server
  app.listen(config.port, () => {
    console.log(`🌐 Server running at http://localhost:${config.port}`);
    console.log(`📑 Health check : http://localhost:${config.port}/health`);
    console.log(`🧾 Invoices API : http://localhost:${config.port}/api/invoices`);
    console.log(`💳 Payments API : http://localhost:${config.port}/api/payments`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
}

bootstrap().catch((err) => {
  console.error('Fatal Server Boot Error:', err);
});
