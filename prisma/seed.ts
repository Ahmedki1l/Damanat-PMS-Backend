// prisma/seed.ts
/**
 * Seeds the database with an initial SUPER_ADMIN user.
 * Run with: npm run prisma:seed
 */
import { PrismaClient, GlobalRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_ADMIN = {
  email: 'admin@damanat.com',
  password: 'admin123',
  name: 'System Admin',
  role: 'SUPER_ADMIN' as GlobalRole,
};

async function main() {
  console.log('🌱 Seeding database...');

  // Create SUPER_ADMIN user
  const existing = await prisma.user.findUnique({ where: { email: SEED_ADMIN.email } });

  if (existing) {
    console.log(`⚠️  Admin user already exists: ${SEED_ADMIN.email}`);
  } else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN.password, 12);
    const user = await prisma.user.create({
      data: {
        email: SEED_ADMIN.email,
        passwordHash,
        name: SEED_ADMIN.name,
        role: SEED_ADMIN.role,
      },
    });
    console.log(`✅ Created SUPER_ADMIN: ${user.email} (id: ${user.id})`);
    console.log(`   Password: ${SEED_ADMIN.password}`);
    console.log(`   ⚠️  Change this password immediately in production!`);
  }

  console.log('🌱 Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
