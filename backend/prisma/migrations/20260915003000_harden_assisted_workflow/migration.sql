-- Persist operational data that was previously kept in server memory.
ALTER TABLE `LaundryOrder`
  ADD COLUMN `branchId` VARCHAR(191) NULL,
  ADD COLUMN `pieces` INTEGER NULL,
  ADD COLUMN `stainService` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `LaundryOrder_branchId_idx` ON `LaundryOrder`(`branchId`);

ALTER TABLE `LaundryOrder`
  ADD CONSTRAINT `LaundryOrder_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Conversation/history between operations staff and the customer.
CREATE TABLE `OrderMessage` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `isInternal` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `OrderMessage_orderId_createdAt_idx`(`orderId`, `createdAt`),
  INDEX `OrderMessage_authorId_createdAt_idx`(`authorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrderMessage`
  ADD CONSTRAINT `OrderMessage_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `LaundryOrder`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrderMessage`
  ADD CONSTRAINT `OrderMessage_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Store only references and metadata for evidence images, never image binaries in MySQL.
ALTER TABLE `EvidencePhoto`
  MODIFY `imageUrl` VARCHAR(500) NOT NULL,
  ADD COLUMN `mimeType` VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN `sizeBytes` INTEGER NOT NULL DEFAULT 0;
