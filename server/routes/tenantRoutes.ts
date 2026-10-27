import { Router, Request, Response } from 'express';
import { Tenant } from '../models';

export const tenantRouter = Router();

// GET /api/tenants - List all tenants
tenantRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const tenants = await Tenant.find().sort({ name: 1 });
    res.json({ success: true, count: tenants.length, data: tenants });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tenants - Create or update tenant
tenantRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, unitZone, meterName, demandCharge } = req.body;
    if (!name || !email || !meterName || !unitZone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, meterName, unitZone',
      });
    }

    const tenant = await Tenant.findOneAndUpdate(
      { meterName },
      {
        name,
        email,
        phone,
        unitZone,
        meterName,
        demandCharge: demandCharge ? Number(demandCharge) : 25.0,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, data: tenant });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tenants/:meterName - Get single tenant by meter name
tenantRouter.get('/:meterName', async (req: Request, res: Response) => {
  try {
    const meterName = String(req.params.meterName);
    const tenant = await Tenant.findOne({ meterName });
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.json({ success: true, data: tenant });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
