// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient, GlobalRole, CameraRole, ZoneType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ─── Encryption (mirrors src/utils/crypto.ts) ────────────────────────────────
function encryptPassword(plaintext: string): string {
  const key = Buffer.from(process.env.CAMERA_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_ADMIN = {
  email: 'admin@damanat.com',
  password: 'admin123',
  name: 'System Admin',
  role: 'SUPER_ADMIN' as GlobalRole,
};

const SITE_ID = '0843a455-5720-4d90-80b9-e3a859bba9ce';

const SEED_SITE = {
  id: SITE_ID,
  name: 'Damanat HQ',
  code: 'DAM-01',
  location: 'Riyadh, Saudi Arabia',
  pmsAiBaseUrl: 'http://5.5.5.3:8080',
};

// Floors: GF = 0, B1 = -1, B2 = -2
const FLOORS = [
  { name: 'Ground Floor', level: 0  },
  { name: 'Basement 1',   level: -1 },
  { name: 'Basement 2',   level: -2 },
];

// Zones per floor (matched by floor name)
const ZONES: Record<string, { name: string; type: ZoneType; maxCapacity: number }[]> = {
  'Ground Floor': [
    { name: 'GF-WAITING', type: 'OTHER',    maxCapacity: 20 },
    { name: 'GF-GATES',   type: 'OTHER',    maxCapacity: 2  },
  ],
  'Basement 1': [
    { name: 'B1-PARKING',     type: 'PARKING',    maxCapacity: 50 },
    { name: 'B1-DATA CENTER', type: 'RESTRICTED',  maxCapacity: 0  },
  ],
  'Basement 2': [
    { name: 'B2-PARKING', type: 'PARKING', maxCapacity: 50 },
  ],
};

// Cameras: ip, username, password, name, zone name, floor name, role
const CAMERAS: {
  ip: string;
  username: string;
  password: string;
  name: string;
  zoneName: string;
  floorName: string;
  role: CameraRole;
}[] = [
  // ── B1-PARKING ──────────────────────────────────────────────────────────────
  { ip: '10.1.13.63', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-04', zoneName: 'B1-PARKING',     floorName: 'Basement 1',   role: 'OCCUPANCY' },
  { ip: '10.1.13.64', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-05', zoneName: 'B1-PARKING',     floorName: 'Basement 1',   role: 'OCCUPANCY' },
  { ip: '10.1.13.65', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-06', zoneName: 'B1-PARKING',     floorName: 'Basement 1',   role: 'OCCUPANCY' },
  { ip: '10.1.13.66', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-07', zoneName: 'B1-PARKING',     floorName: 'Basement 1',   role: 'OCCUPANCY' },
  // ── B2-PARKING ──────────────────────────────────────────────────────────────
  { ip: '10.1.13.68', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-09', zoneName: 'B2-PARKING',     floorName: 'Basement 2',   role: 'OCCUPANCY' },
  { ip: '10.1.13.70', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-11', zoneName: 'B2-PARKING',     floorName: 'Basement 2',   role: 'OCCUPANCY' },
  { ip: '10.1.13.71', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-12', zoneName: 'B2-PARKING',     floorName: 'Basement 2',   role: 'OCCUPANCY' },
  { ip: '10.1.13.72', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-13', zoneName: 'B2-PARKING',     floorName: 'Basement 2',   role: 'OCCUPANCY' },
  { ip: '10.1.13.73', username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-14', zoneName: 'B2-PARKING',     floorName: 'Basement 2',   role: 'OCCUPANCY' },
  // ── Ground floor ────────────────────────────────────────────────────────────
  { ip: '10.1.13.20',  username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-02',    zoneName: 'GF-WAITING', floorName: 'Ground Floor', role: 'OCCUPANCY' },
  { ip: '10.1.13.100', username: 'kloudspott', password: 'Kloudspot@321', name: 'CAM-ENTRY', zoneName: 'GF-GATES',   floorName: 'Ground Floor', role: 'ENTRY'     },
  { ip: '10.1.13.101', username: 'kloudspot1', password: 'Kloudspot@321', name: 'CAM-EXIT',  zoneName: 'GF-GATES',   floorName: 'Ground Floor', role: 'EXIT'      },
  // ── B1-DATA CENTER ──────────────────────────────────────────────────────────
  { ip: '10.1.13.54',  username: 'kloudspot',  password: 'Kloud@123',     name: 'CAM-35',    zoneName: 'B1-DATA CENTER', floorName: 'Basement 1', role: 'INTRUSION' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin user ──────────────────────────────────────────────────────────────
  const existingUser = await prisma.user.findUnique({ where: { email: SEED_ADMIN.email } });
  if (existingUser) {
    console.log(`⚠️  Admin user already exists: ${SEED_ADMIN.email}`);
  } else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN.password, 12);
    const user = await prisma.user.create({
      data: { email: SEED_ADMIN.email, passwordHash, name: SEED_ADMIN.name, role: SEED_ADMIN.role },
    });
    console.log(`✅ Created SUPER_ADMIN: ${user.email} (id: ${user.id})`);
    console.log(`   Password: ${SEED_ADMIN.password}`);
  }

  // ── Site ────────────────────────────────────────────────────────────────────
  let site = await prisma.site.findUnique({ where: { id: SEED_SITE.id } });
  if (site) {
    console.log(`⚠️  Site already exists: ${site.name} (id: ${site.id})`);
  } else {
    site = await prisma.site.create({ data: SEED_SITE });
    console.log(`✅ Created site: ${site.name} (id: ${site.id})`);
  }

  // ── Floors & Zones ──────────────────────────────────────────────────────────
  const floorMap: Record<string, string> = {}; // floor name → floor id
  const zoneMap: Record<string, string> = {};  // zone name  → zone id

  for (const f of FLOORS) {
    let floor = await prisma.floor.findFirst({ where: { siteId: SITE_ID, name: f.name } });
    if (!floor) {
      floor = await prisma.floor.create({ data: { siteId: SITE_ID, name: f.name, level: f.level } });
      console.log(`✅ Created floor: ${floor.name} (level ${f.level}, id: ${floor.id})`);
    } else {
      console.log(`⚠️  Floor already exists: ${floor.name}`);
    }
    floorMap[f.name] = floor.id;

    for (const z of ZONES[f.name] ?? []) {
      let zone = await prisma.zone.findFirst({ where: { floorId: floor.id, name: z.name } });
      if (!zone) {
        zone = await prisma.zone.create({
          data: { floorId: floor.id, name: z.name, type: z.type, maxCapacity: z.maxCapacity },
        });
        console.log(`   ✅ Created zone: ${zone.name} (id: ${zone.id})`);
      } else {
        console.log(`   ⚠️  Zone already exists: ${zone.name}`);
      }
      zoneMap[z.name] = zone.id;
    }
  }

  // ── Cameras ─────────────────────────────────────────────────────────────────
  console.log('\n📷 Seeding cameras...');
  for (const cam of CAMERAS) {
    const existing = await prisma.cameraConfig.findFirst({ where: { siteId: SITE_ID, ip: cam.ip } });
    if (existing) {
      console.log(`⚠️  Camera already exists: ${cam.name} (${cam.ip})`);
      continue;
    }

    const floorId = floorMap[cam.floorName];
    const zoneId  = zoneMap[cam.zoneName];

    await prisma.cameraConfig.create({
      data: {
        siteId:            SITE_ID,
        floorId,
        zoneId,
        name:              cam.name,
        ip:                cam.ip,
        username:          cam.username,
        passwordEncrypted: encryptPassword(cam.password),
        role:              cam.role,
        isActive:          true,
      },
    });
    console.log(`✅ Created camera: ${cam.name} (${cam.ip}) → ${cam.zoneName} [${cam.role}]`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n📋 Summary:');
  console.log(`   SITE_ID = ${SITE_ID}`);
  Object.entries(floorMap).forEach(([name, id]) => console.log(`   FLOOR ${name} = ${id}`));
  Object.entries(zoneMap).forEach(([name, id])  => console.log(`   ZONE  ${name} = ${id}`));
  console.log('\n🌱 Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
