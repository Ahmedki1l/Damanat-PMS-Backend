import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifySite(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');
  return site;
}

function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const start = from ? new Date(from + 'T00:00:00.000Z') : new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = to   ? new Date(to   + 'T23:59:59.999Z') : now;
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw ApiError.badRequest('Invalid date range');
  return { start, end };
}

function parseWindowDates(window: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  switch (window) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }
  return { start, end: now };
}

// ─── 1. Traffic Heatmap ─────────────────────────────────────────────────────

interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  entries: number;
  exits: number;
  total: number;
}

export async function getTrafficHeatmap(
  siteId: string,
  from?: string,
  to?: string,
): Promise<HeatmapCell[]> {
  await verifySite(siteId);
  const { start, end } = parseDateRange(from, to);

  const rows = await prisma.$queryRaw<{ dow: number; hr: number; entries: bigint; exits: bigint }[]>`
    SELECT
      EXTRACT(DOW FROM event_time)  AS dow,
      EXTRACT(HOUR FROM event_time) AS hr,
      COUNT(*) FILTER (WHERE gate = 'entry') AS entries,
      COUNT(*) FILTER (WHERE gate = 'exit')  AS exits
    FROM entry_exit_log
    WHERE (is_test IS NULL OR is_test = false)
      AND event_time >= ${start}
      AND event_time <= ${end}
    GROUP BY dow, hr
    ORDER BY dow, hr
  `;

  // Fill the full 7×24 grid so the frontend always gets all 168 cells
  const lookup = new Map<string, { entries: number; exits: number }>();
  for (const r of rows) {
    lookup.set(`${Number(r.dow)}-${Number(r.hr)}`, {
      entries: Number(r.entries),
      exits:   Number(r.exits),
    });
  }

  const grid: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const cell = lookup.get(`${d}-${h}`) ?? { entries: 0, exits: 0 };
      grid.push({
        dayOfWeek: d,
        hour: h,
        entries: cell.entries,
        exits:   cell.exits,
        total:   cell.entries + cell.exits,
      });
    }
  }

  return grid;
}

// ─── 2. Average Parking Duration Per Day ────────────────────────────────────

interface DurationDay {
  date: string;
  avgParkingDurationSeconds: number;
  medianParkingDurationSeconds: number;
  completedVisits: number;
}

export async function getAvgParkingDuration(
  siteId: string,
  from?: string,
  to?: string,
): Promise<DurationDay[]> {
  await verifySite(siteId);
  const { start, end } = parseDateRange(from, to);

  // Compute real duration from matched entry/exit timestamps, not the AI's parking_duration.
  // Also exclude ghost entries (exit then re-entry within 2 min for same plate).
  const rows = await prisma.$queryRaw<{
    day: Date;
    avg_secs: number;
    median_secs: number;
    visits: bigint;
  }[]>`
    WITH durations AS (
      SELECT
        DATE(ex.event_time) AS day,
        EXTRACT(EPOCH FROM (ex.event_time - en.event_time))::int AS dur_secs
      FROM entry_exit_log ex
      JOIN entry_exit_log en ON en.id = ex.matched_entry_id
      WHERE ex.gate = 'exit'
        AND (ex.is_test IS NULL OR ex.is_test = false)
        AND (en.is_test IS NULL OR en.is_test = false)
        AND ex.event_time >= ${start}
        AND ex.event_time <= ${end}
        AND EXTRACT(EPOCH FROM (ex.event_time - en.event_time)) > 0
    )
    SELECT
      day,
      ROUND(AVG(dur_secs))::int                    AS avg_secs,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dur_secs))::int AS median_secs,
      COUNT(*)                                      AS visits
    FROM durations
    GROUP BY day
    ORDER BY day
  `;

  return rows.map(r => ({
    date: r.day.toISOString().slice(0, 10),
    avgParkingDurationSeconds:    Number(r.avg_secs),
    medianParkingDurationSeconds: Number(r.median_secs),
    completedVisits:              Number(r.visits),
  }));
}

// ─── 3. Frequent Visitors ───────────────────────────────────────────────────

interface FrequentVisitor {
  plateNumber: string;
  visitCount: number;
  entryCount: number;
  exitCount: number;
  lastSeenAt: Date;
  vehicleType: string | null;
}

export async function getFrequentVisitors(
  siteId: string,
  window = 'month',
  limit = 20,
): Promise<{ window: string; from: Date; to: Date; visitors: FrequentVisitor[] }> {
  await verifySite(siteId);
  const { start, end } = parseWindowDates(window);

  // visitCount = entry rows only (so one physical visit isn't double-counted).
  // Ghost entries (re-entry within 2 min of exit for same plate) are excluded.
  const visitors = await prisma.$queryRaw<{
    plate_number: string;
    visit_count: bigint;
    entry_count: bigint;
    exit_count: bigint;
    last_seen: Date;
    vehicle_type: string | null;
  }[]>(Prisma.sql`
    WITH non_ghost_entries AS (
      SELECT e.*
      FROM entry_exit_log e
      WHERE e.gate = 'entry'
        AND (e.is_test IS NULL OR e.is_test = false)
        AND e.event_time >= ${start}
        AND e.event_time <= ${end}
        AND NOT EXISTS (
          SELECT 1 FROM entry_exit_log prev
          WHERE prev.gate         = 'exit'
            AND prev.plate_number = e.plate_number
            AND prev.event_time  >= e.event_time - INTERVAL '2 minutes'
            AND prev.event_time  <= e.event_time
        )
    ),
    exit_counts AS (
      SELECT plate_number, COUNT(*) AS cnt
      FROM entry_exit_log
      WHERE gate = 'exit'
        AND (is_test IS NULL OR is_test = false)
        AND event_time >= ${start}
        AND event_time <= ${end}
      GROUP BY plate_number
    ),
    latest_type AS (
      SELECT DISTINCT ON (plate_number) plate_number, vehicle_type
      FROM entry_exit_log
      WHERE (is_test IS NULL OR is_test = false)
        AND event_time >= ${start}
        AND event_time <= ${end}
      ORDER BY plate_number, event_time DESC
    )
    SELECT
      nge.plate_number,
      COUNT(*)                     AS visit_count,
      COUNT(*)                     AS entry_count,
      COALESCE(ec.cnt, 0)         AS exit_count,
      MAX(nge.event_time)          AS last_seen,
      lt.vehicle_type
    FROM non_ghost_entries nge
    LEFT JOIN exit_counts ec ON ec.plate_number = nge.plate_number
    LEFT JOIN latest_type lt ON lt.plate_number = nge.plate_number
    GROUP BY nge.plate_number, ec.cnt, lt.vehicle_type
    ORDER BY visit_count DESC
    LIMIT ${limit}
  `);

  return {
    window,
    from: start,
    to: end,
    visitors: visitors.map(v => ({
      plateNumber: v.plate_number,
      visitCount:  Number(v.visit_count),
      entryCount:  Number(v.entry_count),
      exitCount:   Number(v.exit_count),
      lastSeenAt:  v.last_seen,
      vehicleType: v.vehicle_type,
    })),
  };
}

// ─── 4. Turnaround Time ────────────────────────────────────────────────────

interface TurnaroundDay {
  date: string;
  avgTurnaroundSeconds: number;
  medianTurnaroundSeconds: number;
  samples: number;
}

export async function getTurnaroundTime(
  siteId: string,
  from?: string,
  to?: string,
): Promise<TurnaroundDay[]> {
  await verifySite(siteId);
  const { start, end } = parseDateRange(from, to);

  // Turnaround = time from an exit until the next entry by any vehicle at facility level.
  // We pair each exit with the very next entry that is not a ghost.
  const rows = await prisma.$queryRaw<{
    day: Date;
    avg_secs: number;
    median_secs: number;
    samples: bigint;
  }[]>`
    WITH exits AS (
      SELECT id, event_time
      FROM entry_exit_log
      WHERE gate = 'exit'
        AND (is_test IS NULL OR is_test = false)
        AND event_time >= ${start}
        AND event_time <= ${end}
    ),
    valid_entries AS (
      SELECT e.id, e.event_time
      FROM entry_exit_log e
      WHERE e.gate = 'entry'
        AND (e.is_test IS NULL OR e.is_test = false)
        AND e.event_time >= ${start}
        AND e.event_time <= ${end}
        AND NOT EXISTS (
          SELECT 1 FROM entry_exit_log prev
          WHERE prev.gate         = 'exit'
            AND prev.plate_number = e.plate_number
            AND prev.event_time  >= e.event_time - INTERVAL '120 seconds'
            AND prev.event_time  <= e.event_time
        )
    ),
    pairs AS (
      SELECT
        ex.event_time AS exit_time,
        (SELECT ve.event_time FROM valid_entries ve
         WHERE ve.event_time > ex.event_time
         ORDER BY ve.event_time ASC LIMIT 1) AS next_entry_time
      FROM exits ex
    ),
    turnarounds AS (
      SELECT
        DATE(exit_time)                                         AS day,
        EXTRACT(EPOCH FROM (next_entry_time - exit_time))::int  AS turnaround_secs
      FROM pairs
      WHERE next_entry_time IS NOT NULL
        AND EXTRACT(EPOCH FROM (next_entry_time - exit_time)) > 0
        AND EXTRACT(EPOCH FROM (next_entry_time - exit_time)) < 86400
    )
    SELECT
      day,
      ROUND(AVG(turnaround_secs))::int                                               AS avg_secs,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY turnaround_secs))::int       AS median_secs,
      COUNT(*)                                                                        AS samples
    FROM turnarounds
    GROUP BY day
    ORDER BY day
  `;

  return rows.map(r => ({
    date: r.day.toISOString().slice(0, 10),
    avgTurnaroundSeconds:    Number(r.avg_secs),
    medianTurnaroundSeconds: Number(r.median_secs),
    samples:                 Number(r.samples),
  }));
}
