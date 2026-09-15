import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

function validateBootstrapPassword(password: string, email: string, name: string) {
  if (password.length < 16 || password.length > 128) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD debe tener entre 16 y 128 caracteres.');
  }
  const lower = password.toLowerCase();
  const predictable = ['password', 'contraseña', '123456', 'qwerty', 'admin', 'lavanderia', 'lalavanderia'];
  if (predictable.some((value) => lower.includes(value))) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD contiene una palabra o secuencia predecible.');
  }
  const localPart = email.split('@')[0]?.toLowerCase();
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase();
  if ((localPart && localPart.length >= 4 && lower.includes(localPart)) || (firstName && firstName.length >= 4 && lower.includes(firstName))) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD no debe contener el nombre ni el correo del administrador.');
  }
  const categories = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (categories < 3) throw new Error('ADMIN_BOOTSTRAP_PASSWORD debe combinar al menos tres tipos de caracteres.');
}

async function bootstrapAdministrator() {
  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
  if (!email) {
    console.log('ADMIN_BOOTSTRAP_EMAIL no definido: no se crearán administradores automáticamente.');
    return false;
  }

  const name = String(process.env.ADMIN_BOOTSTRAP_NAME ?? '').trim();
  const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('ADMIN_BOOTSTRAP_NAME y ADMIN_BOOTSTRAP_EMAIL válido son obligatorios para crear el bootstrap.');
  }
  validateBootstrapPassword(password, email, name);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== Role.ADMIN) {
      throw new Error('ADMIN_BOOTSTRAP_EMAIL ya pertenece a una cuenta cliente. Usa otro correo administrativo.');
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: true, canManageAdmins: true },
    });
    console.log('Administrador bootstrap ya existe: no se modificó su contraseña.');
    return false;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      canManageAdmins: true,
      mustChangePassword: true,
      mfaEnabled: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: created.id,
      action: 'ADMIN_BOOTSTRAP_CREATED',
      entity: 'USER',
      entityId: created.id,
      metadata: { email: created.email },
    },
  });
  console.log('Administrador bootstrap creado. Debe cambiar su contraseña y activar MFA en el primer acceso.');
  return true;
}

async function main() {
  const bootstrapCreated = await bootstrapAdministrator();

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
      metadata: { bootstrapCreated, branches: branches.length },
    },
  });

  console.log('Seed completado con sedes y máquinas. No se crean administradores predecibles.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
