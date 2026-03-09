// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient, GlobalRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const SEED_ADMIN = {
  email: 'admin@damanat.com',
  password: 'admin123',
  name: 'System Admin',
  role: 'SUPER_ADMIN' as GlobalRole,
};

const SEED_SITE = {
  name: 'Damanat HQ',
  code: 'DAM-01',
  location: 'Riyadh, Saudi Arabia',
  pmsAiBaseUrl: 'http://5.5.5.3:8080',
};

async function main() {
  console.log('🌱 Seeding database...');

  // Create SUPER_ADMIN user
  const existing = await prisma.user.findUnique({ where: { email: SEED_ADMIN.email } });
  let user;
  if (existing) {
    console.log(`⚠️  Admin user already exists: ${SEED_ADMIN.email}`);
    user = existing;
  } else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN.password, 12);
    user = await prisma.user.create({
      data: {
        email: SEED_ADMIN.email,
        passwordHash,
        name: SEED_ADMIN.name,
        role: SEED_ADMIN.role,
      },
    });
    console.log(`✅ Created SUPER_ADMIN: ${user.email} (id: ${user.id})`);
    console.log(`   Password: ${SEED_ADMIN.password}`);
  }

  // Create default site
  let site = await prisma.site.findFirst({ where: { code: SEED_SITE.code } });
  if (site) {
    console.log(`⚠️  Site already exists: ${SEED_SITE.name} (id: ${site.id})`);
  } else {
    site = await prisma.site.create({ data: SEED_SITE });
    console.log(`✅ Created site: ${site.name} (id: ${site.id})`);
  }

  // Create default floor
  let floor = await prisma.floor.findFirst({ where: { siteId: site.id, name: 'Ground Floor' } });
  if (!floor) {
    floor = await prisma.floor.create({ data: { siteId: site.id, name: 'Ground Floor', level: 0 } });
    console.log(`✅ Created floor: ${floor.name} (id: ${floor.id})`);
  }

  // Create default zone
  let zone = await prisma.zone.findFirst({ where: { floorId: floor.id, name: 'parking-row-A' } });
  if (!zone) {
    zone = await prisma.zone.create({ data: { floorId: floor.id, name: 'parking-row-A', type: 'PARKING', maxCapacity: 25 } });
    console.log(`✅ Created zone: ${zone.name} (id: ${zone.id})`);
  }

  console.log('\n📋 Summary:');
  console.log(`   SITE_ID = ${site.id}`);
  console.log(`   FLOOR_ID = ${floor.id}`);
  console.log(`   ZONE_ID = ${zone.id}`);
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
