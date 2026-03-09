// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from './middleware/error.middleware';

// Module routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import sitesRoutes from './modules/sites/sites.routes';
import floorsRoutes from './modules/floors/floors.routes';
import zonesRoutes from './modules/zones/zones.routes';
import camerasRoutes from './modules/cameras/cameras.routes';
import pmsRoutes from './modules/pms/pms.routes';
import parkingTimesRoutes from './modules/parking-times/parking-times.routes';

const app = express();

// ── Global Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'damanat-pms-core-backend', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/sites', sitesRoutes);
app.use('/api/v1/sites/:siteId/floors', floorsRoutes);  // nested
app.use('/api/v1/floors', floorsRoutes);                 // direct
app.use('/api/v1/floors/:floorId/zones', zonesRoutes);   // nested
app.use('/api/v1/zones', zonesRoutes);                   // direct
app.use('/api/v1/sites/:siteId/cameras', camerasRoutes); // nested
app.use('/api/v1/cameras', camerasRoutes);               // direct
app.use('/api/v1/sites', pmsRoutes);                     // PMS proxy: /sites/:id/occupancy, etc.
app.use('/api/v1/sites/:siteId/parking-times', parkingTimesRoutes); // MongoDB parking times

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ── Error Handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

export default app;
