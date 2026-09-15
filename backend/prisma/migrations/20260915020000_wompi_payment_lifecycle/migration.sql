ALTER TABLE `Payment`
  ADD COLUMN `environment` VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  ADD COLUMN `resourceType` VARCHAR(30) NOT NULL DEFAULT 'legacy',
  ADD COLUMN `resourceId` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `expiresAt` DATETIME(3) NULL,
  ADD COLUMN `processedAt` DATETIME(3) NULL;

CREATE INDEX `Payment_resourceType_resourceId_createdAt_idx`
  ON `Payment`(`resourceType`, `resourceId`, `createdAt`);

CREATE INDEX `Payment_status_expiresAt_idx`
  ON `Payment`(`status`, `expiresAt`);

CREATE INDEX `Payment_wompiTransactionId_idx`
  ON `Payment`(`wompiTransactionId`);
