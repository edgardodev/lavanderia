import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD debe existir y tener al menos 12 caracteres.');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const admins = [1, 2, 3, 4, 5].map((n) => ({
    name: `Administrador ${n}`,
    email: `admin${n}@lalavanderiabakery.com`,
    phone: `300000000${n}`,
    passwordHash,
    role: Role.ADMIN,
  }));

  for (const admin of admins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: { passwordHash: admin.passwordHash, role: Role.ADMIN, isActive: true },
      create: admin,
    });
  }

  const branches = [
    { id: 'universidad-metropolitana', name: 'Universidad Metropolitana', address: 'Sede Universidad Metropolitana' },
    { id: 'cra-46', name: 'Cra 46 con 93', address: 'Sede Cra 46 con 93' },
    { id: 'villa-carolina', name: 'Villa Carolina', address: 'Sede Villa Carolina' },
  ];

  for (const branch of branches) {
    const created = await prisma.branch.upsert({
      where: { id: branch.id },
      update: { name: branch.name, address: branch.address, isActive: true },
      create: branch,
    });

    for (let machine = 1; machine <= 4; machine++) {
      const code = `Máquina ${machine}`;
      await prisma.machine.upsert({
        where: { branchId_code: { branchId: created.id, code } },
        update: { isActive: true },
        create: { branchId: created.id, code },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: 'SEED_EXECUTED',
      entity: 'SYSTEM',
      metadata: { admins: admins.length, branches: branches.length },
    },
  });

  console.log('Seed completado con administradores, sedes y máquinas alineadas al frontend.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
