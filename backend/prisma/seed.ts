import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'Cambiar1234!';
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
    { name: 'Sede Centro', address: 'Cra. 1 #10-20' },
    { name: 'Sede Norte', address: 'Av. Norte #45-90' },
    { name: 'Sede Sur', address: 'Calle 80 #20-10' },
  ];

  for (const branch of branches) {
    const created = await prisma.branch.upsert({
      where: { name: branch.name },
      update: branch,
      create: branch,
    });

    for (let machine = 1; machine <= 4; machine++) {
      await prisma.machine.upsert({
        where: { branchId_code: { branchId: created.id, code: `M-${machine}` } },
        update: { isActive: true },
        create: { branchId: created.id, code: `M-${machine}` },
      });
    }
  }

  await prisma.auditLog.create({
    data: { action: 'SEED_EXECUTED', entity: 'SYSTEM', metadata: { admins: admins.length, branches: branches.length } },
  });

  console.log('Seed completado: 5 administradores, 3 sedes y 4 máquinas por sede.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
