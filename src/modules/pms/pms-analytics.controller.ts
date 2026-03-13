import { Request, Response } from 'express';
import * as analyticsService from './pms-analytics.service';

export async function getTrafficHeatmap(req: Request, res: Response) {
  const data = await analyticsService.getTrafficHeatmap(
    req.params.id as string,
    req.query.from as string | undefined,
    req.query.to   as string | undefined,
  );
  res.json({ status: 'success', data });
}

export async function getAvgParkingDuration(req: Request, res: Response) {
  const data = await analyticsService.getAvgParkingDuration(
    req.params.id as string,
    req.query.from as string | undefined,
    req.query.to   as string | undefined,
  );
  res.json({ status: 'success', data });
}

export async function getFrequentVisitors(req: Request, res: Response) {
  const window = (req.query.window as string) || 'month';
  const limit  = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const data = await analyticsService.getFrequentVisitors(
    req.params.id as string,
    window,
    limit,
  );
  res.json({ status: 'success', data });
}

export async function getTurnaroundTime(req: Request, res: Response) {
  const data = await analyticsService.getTurnaroundTime(
    req.params.id as string,
    req.query.from as string | undefined,
    req.query.to   as string | undefined,
  );
  res.json({ status: 'success', data });
}
