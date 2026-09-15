-- Authoritative machine occupancy for both customer reservations and admin blocks.
CREATE TABLE `MachineSlot` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NOT NULL,
    `type` ENUM('RESERVATION', 'ADMIN_BLOCK') NOT NULL,
    `scheduledStart` DATETIME(3) NOT NULL,
    `scheduledEnd` DATETIME(3) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `adminId` VARCHAR(191) NULL,
    `reason` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MachineSlot_reservationId_key`(`reservationId`),
    UNIQUE INDEX `MachineSlot_machineId_scheduledStart_scheduledEnd_key`(`machineId`, `scheduledStart`, `scheduledEnd`),
    INDEX `MachineSlot_branchId_scheduledStart_idx`(`branchId`, `scheduledStart`),
    INDEX `MachineSlot_type_scheduledStart_idx`(`type`, `scheduledStart`),
    INDEX `MachineSlot_adminId_idx`(`adminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MachineSlot`
  ADD CONSTRAINT `MachineSlot_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MachineSlot_machineId_fkey`
    FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MachineSlot_reservationId_fkey`
    FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `MachineSlot_adminId_fkey`
    FOREIGN KEY (`adminId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing non-cancelled reservations so they immediately block their machines.
INSERT IGNORE INTO `MachineSlot`
  (`id`, `branchId`, `machineId`, `type`, `scheduledStart`, `scheduledEnd`, `reservationId`, `adminId`, `reason`, `createdAt`)
SELECT
  CONCAT('slot-', `id`),
  `branchId`,
  `machineId`,
  'RESERVATION',
  `scheduledStart`,
  `scheduledEnd`,
  `id`,
  NULL,
  'Reserva existente migrada',
  `createdAt`
FROM `Reservation`
WHERE `status` <> 'CANCELLED';
