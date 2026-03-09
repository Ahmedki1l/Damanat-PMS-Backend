// src/modules/parking-times/parking-times.service.ts
import { randomUUID } from 'crypto';
import { getMongo } from '../../config/mongo';
import { ApiError } from '../../utils/api-error';
import type { EntryInput, ExitInput, ParkingTimesDoc, DaySessions } from './parking-times.types';

function col() {
  return getMongo().collection<ParkingTimesDoc>('parking_times');
}

function todayKey(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── ENTRY ──────────────────────────────────────────────────────────────────

export async function recordEntry(siteId: string, input: EntryInput) {
  const now = input.entryAt || new Date().toISOString();
  const day = todayKey(now);
  const sessionId = randomUUID();

  const session = {
    sessionId,
    entryAt: now,
    exitAt: null,
    durationMinutes: null,
    entryCamera: input.entryCamera,
    exitCamera: null,
    zone: input.zone || null,
  };

  // Upsert: create doc if plate is new, push session into today's array
  await col().updateOne(
    { plate: input.plate, siteId },
    {
      $push: { [`days.${day}.sessions`]: session } as any,
      $inc: {
        [`days.${day}.totalSessions`]: 1,
        totalVisits: 1,
      },
      $set: { lastSeen: now },
      $setOnInsert: {
        plate: input.plate,
        siteId,
        firstSeen: now,
      },
    },
    { upsert: true },
  );

  return { sessionId, plate: input.plate, day, entryAt: now };
}

// ─── EXIT ───────────────────────────────────────────────────────────────────

export async function recordExit(siteId: string, input: ExitInput) {
  const now = input.exitAt || new Date().toISOString();
  const day = todayKey(now);

  const doc = await col().findOne({ plate: input.plate, siteId });
  if (!doc) {
    throw ApiError.notFound(`No record found for plate: ${input.plate}`);
  }

  const daySessions: DaySessions | undefined = (doc.days as any)?.[day];
  if (!daySessions || !daySessions.sessions.length) {
    throw ApiError.badRequest(`No sessions found for plate ${input.plate} on ${day}`);
  }

  // Find the latest open session (exitAt === null)
  const openIdx = [...daySessions.sessions]
    .reverse()
    .findIndex((s) => s.exitAt === null);

  if (openIdx === -1) {
    throw ApiError.badRequest(`No open session for plate ${input.plate} on ${day}`);
  }

  const actualIdx = daySessions.sessions.length - 1 - openIdx;
  const openSession = daySessions.sessions[actualIdx];

  const entryTime = new Date(openSession.entryAt).getTime();
  const exitTime = new Date(now).getTime();
  const durationMinutes = Math.round((exitTime - entryTime) / 60000);

  await col().updateOne(
    { plate: input.plate, siteId },
    {
      $set: {
        [`days.${day}.sessions.${actualIdx}.exitAt`]: now,
        [`days.${day}.sessions.${actualIdx}.exitCamera`]: input.exitCamera,
        [`days.${day}.sessions.${actualIdx}.durationMinutes`]: durationMinutes,
        lastSeen: now,
      },
      $inc: {
        [`days.${day}.totalDurationMinutes`]: durationMinutes,
      },
    },
  );

  return {
    plate: input.plate,
    sessionId: openSession.sessionId,
    day,
    exitAt: now,
    durationMinutes,
  };
}

// ─── GET PLATE HISTORY ──────────────────────────────────────────────────────

export async function getPlateHistory(siteId: string, plate: string) {
  const doc = await col().findOne({ plate, siteId }, { projection: { _id: 0 } });
  if (!doc) {
    throw ApiError.notFound(`No record found for plate: ${plate}`);
  }
  return doc;
}

// ─── GET PLATE DAY ──────────────────────────────────────────────────────────

export async function getPlateDay(siteId: string, plate: string, date: string) {
  const doc = await col().findOne({ plate, siteId });
  if (!doc) {
    throw ApiError.notFound(`No record found for plate: ${plate}`);
  }

  const daySessions = (doc.days as any)?.[date];
  if (!daySessions) {
    return { plate, date, sessions: [], totalSessions: 0, totalDurationMinutes: 0 };
  }

  return { plate, date, ...daySessions };
}

// ─── ACTIVE VEHICLES ────────────────────────────────────────────────────────

export async function getActiveVehicles(siteId: string) {
  const day = todayKey();

  // Find all docs for this site that have sessions today with exitAt === null
  const docs = await col()
    .find({
      siteId,
      [`days.${day}.sessions`]: { $elemMatch: { exitAt: null } },
    })
    .project({ plate: 1, [`days.${day}`]: 1, firstSeen: 1, lastSeen: 1, _id: 0 })
    .toArray();

  return docs.map((doc: any) => {
    const sessions = doc.days?.[day]?.sessions || [];
    const openSession = [...sessions].reverse().find((s: any) => s.exitAt === null);
    return {
      plate: doc.plate,
      entryAt: openSession?.entryAt,
      entryCamera: openSession?.entryCamera,
      zone: openSession?.zone,
      firstSeen: doc.firstSeen,
    };
  });
}

// ─── STATS ──────────────────────────────────────────────────────────────────

export async function getStats(siteId: string) {
  const db = getMongo();
  const collection = db.collection('parking_times');

  // Total unique plates
  const totalPlates = await collection.countDocuments({ siteId });

  // Active vehicles now
  const day = todayKey();
  const activeCount = await collection.countDocuments({
    siteId,
    [`days.${day}.sessions`]: { $elemMatch: { exitAt: null } },
  });

  // Aggregate: avg duration, total visits, repeat visitors
  const pipeline = [
    { $match: { siteId } },
    {
      $group: {
        _id: null,
        totalVisits: { $sum: '$totalVisits' },
        avgVisitsPerPlate: { $avg: '$totalVisits' },
        repeatVisitors: { $sum: { $cond: [{ $gt: ['$totalVisits', 1] }, 1, 0] } },
      },
    },
  ];

  const [agg] = await collection.aggregate(pipeline).toArray();

  return {
    totalPlates,
    activeNow: activeCount,
    totalVisits: agg?.totalVisits || 0,
    avgVisitsPerPlate: Math.round((agg?.avgVisitsPerPlate || 0) * 10) / 10,
    repeatVisitors: agg?.repeatVisitors || 0,
    date: day,
  };
}
