-- Script para MySQL Workbench - La Lavanderia Bakery
-- Base de datos usada por Prisma: mysql://usuario:clave@localhost:3306/lavanderia_bakery

CREATE DATABASE IF NOT EXISTS `lavanderia_bakery`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lavanderia_bakery`;

CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('CLIENT', 'ADMIN') NOT NULL DEFAULT 'CLIENT',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key` (`email`),
  INDEX `User_role_idx` (`role`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Branch` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NOT NULL,
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Bogota',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Branch_name_key` (`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Machine` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Machine_branchId_idx` (`branchId`),
  UNIQUE INDEX `Machine_branchId_code_key` (`branchId`, `code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Machine_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Payment` (
  `id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL DEFAULT 'WOMPI',
  `externalReference` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR') NOT NULL DEFAULT 'PENDING',
  `amountCents` INTEGER NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'COP',
  `checkoutUrl` VARCHAR(1000) NULL,
  `wompiTransactionId` VARCHAR(120) NULL,
  `rawResponse` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Payment_externalReference_key` (`externalReference`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Reservation` (
  `id` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `machineId` VARCHAR(191) NOT NULL,
  `serviceMode` ENUM('SELF_SERVICE', 'DONE_FOR_YOU') NOT NULL DEFAULT 'SELF_SERVICE',
  `cycleType` ENUM('WASH', 'DRY', 'FULL') NOT NULL,
  `scheduledStart` DATETIME(3) NOT NULL,
  `scheduledEnd` DATETIME(3) NOT NULL,
  `status` ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `amountCents` INTEGER NOT NULL,
  `notes` VARCHAR(500) NULL,
  `paymentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Reservation_clientId_createdAt_idx` (`clientId`, `createdAt`),
  INDEX `Reservation_machineId_scheduledStart_scheduledEnd_idx` (`machineId`, `scheduledStart`, `scheduledEnd`),
  INDEX `Reservation_status_idx` (`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Reservation_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reservation_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reservation_machineId_fkey`
    FOREIGN KEY (`machineId`) REFERENCES `Machine` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reservation_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `Payment` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LaundryOrder` (
  `id` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `serviceMode` ENUM('SELF_SERVICE', 'DONE_FOR_YOU') NOT NULL DEFAULT 'DONE_FOR_YOU',
  `cycleType` ENUM('WASH', 'DRY', 'FULL') NOT NULL,
  `status` ENUM('QUEUED', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `amountCents` INTEGER NOT NULL,
  `pickupType` VARCHAR(191) NOT NULL DEFAULT 'STORE',
  `address` VARCHAR(250) NULL,
  `notes` VARCHAR(500) NULL,
  `paymentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `LaundryOrder_clientId_createdAt_idx` (`clientId`, `createdAt`),
  INDEX `LaundryOrder_status_idx` (`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `LaundryOrder_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `LaundryOrder_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `Payment` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StatusHistory` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL,
  `adminId` VARCHAR(191) NULL,
  `message` VARCHAR(300) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StatusHistory_orderId_createdAt_idx` (`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `StatusHistory_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `LaundryOrder` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StatusHistory_adminId_fkey`
    FOREIGN KEY (`adminId`) REFERENCES `User` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EvidencePhoto` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `uploadedById` VARCHAR(191) NOT NULL,
  `imageUrl` VARCHAR(191) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `EvidencePhoto_orderId_createdAt_idx` (`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `EvidencePhoto_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `LaundryOrder` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EvidencePhoto_uploadedById_fkey`
    FOREIGN KEY (`uploadedById`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PushToken` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `token` VARCHAR(500) NOT NULL,
  `deviceType` VARCHAR(50) NULL,
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PushToken_userId_idx` (`userId`),
  UNIQUE INDEX `PushToken_userId_token_key` (`userId`, `token`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PushToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `entity` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_actorId_createdAt_idx` (`actorId`, `createdAt`),
  INDEX `AuditLog_entity_entityId_idx` (`entity`, `entityId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AuditLog_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Holiday` (
  `id` VARCHAR(191) NOT NULL,
  `date` DATE NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Holiday_date_key` (`date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Datos iniciales.
-- Usuarios admin:
--   admin1@lalavanderiabakery.com / Cambiar1234!
--   admin2@lalavanderiabakery.com / Cambiar1234!
--   admin3@lalavanderiabakery.com / Cambiar1234!
--   admin4@lalavanderiabakery.com / Cambiar1234!
--   admin5@lalavanderiabakery.com / Cambiar1234!

SET @admin_password_hash = '$argon2id$v=19$m=65536,t=3,p=4$JC00IR8jY326OW4bvkvhCg$SR2X2OFCUaUdgt4KqtU6r0bs9P7icPCVql7w9Kai+gQ';

INSERT IGNORE INTO `User`
  (`id`, `name`, `email`, `phone`, `passwordHash`, `role`, `isActive`, `createdAt`, `updatedAt`)
VALUES
  ('admin-1', 'Administrador 1', 'admin1@lalavanderiabakery.com', '3000000001', @admin_password_hash, 'ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('admin-2', 'Administrador 2', 'admin2@lalavanderiabakery.com', '3000000002', @admin_password_hash, 'ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('admin-3', 'Administrador 3', 'admin3@lalavanderiabakery.com', '3000000003', @admin_password_hash, 'ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('admin-4', 'Administrador 4', 'admin4@lalavanderiabakery.com', '3000000004', @admin_password_hash, 'ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('admin-5', 'Administrador 5', 'admin5@lalavanderiabakery.com', '3000000005', @admin_password_hash, 'ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO `Branch` (`id`, `name`, `address`, `timezone`, `isActive`, `createdAt`)
VALUES
  ('branch-centro', 'Sede Centro', 'Cra. 1 #10-20', 'America/Bogota', true, CURRENT_TIMESTAMP(3)),
  ('branch-norte', 'Sede Norte', 'Av. Norte #45-90', 'America/Bogota', true, CURRENT_TIMESTAMP(3)),
  ('branch-sur', 'Sede Sur', 'Calle 80 #20-10', 'America/Bogota', true, CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO `Machine` (`id`, `code`, `branchId`, `isActive`, `createdAt`)
VALUES
  ('machine-centro-1', 'M-1', 'branch-centro', true, CURRENT_TIMESTAMP(3)),
  ('machine-centro-2', 'M-2', 'branch-centro', true, CURRENT_TIMESTAMP(3)),
  ('machine-centro-3', 'M-3', 'branch-centro', true, CURRENT_TIMESTAMP(3)),
  ('machine-centro-4', 'M-4', 'branch-centro', true, CURRENT_TIMESTAMP(3)),
  ('machine-norte-1', 'M-1', 'branch-norte', true, CURRENT_TIMESTAMP(3)),
  ('machine-norte-2', 'M-2', 'branch-norte', true, CURRENT_TIMESTAMP(3)),
  ('machine-norte-3', 'M-3', 'branch-norte', true, CURRENT_TIMESTAMP(3)),
  ('machine-norte-4', 'M-4', 'branch-norte', true, CURRENT_TIMESTAMP(3)),
  ('machine-sur-1', 'M-1', 'branch-sur', true, CURRENT_TIMESTAMP(3)),
  ('machine-sur-2', 'M-2', 'branch-sur', true, CURRENT_TIMESTAMP(3)),
  ('machine-sur-3', 'M-3', 'branch-sur', true, CURRENT_TIMESTAMP(3)),
  ('machine-sur-4', 'M-4', 'branch-sur', true, CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO `AuditLog` (`id`, `actorId`, `action`, `entity`, `entityId`, `metadata`, `createdAt`)
VALUES (
  'audit-seed-executed',
  NULL,
  'SEED_EXECUTED',
  'SYSTEM',
  NULL,
  JSON_OBJECT('admins', 5, 'branches', 3),
  CURRENT_TIMESTAMP(3)
);
