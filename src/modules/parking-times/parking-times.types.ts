// src/modules/parking-times/parking-times.types.ts

export interface ParkingSession {
  sessionId: string;
  entryAt: string;
  exitAt: string | null;
  durationMinutes: number | null;
  entryCamera: string;
  exitCamera: string | null;
  zone: string | null;
}

export interface DaySessions {
  sessions: ParkingSession[];
  totalSessions: number;
  totalDurationMinutes: number;
}

export interface ParkingTimesDoc {
  plate: string;
  siteId: string;
  days: Record<string, DaySessions>;
  firstSeen: string;
  lastSeen: string;
  totalVisits: number;
}

export interface EntryInput {
  plate: string;
  entryAt?: string;
  entryCamera: string;
  zone?: string;
}

export interface ExitInput {
  plate: string;
  exitAt?: string;
  exitCamera: string;
}
