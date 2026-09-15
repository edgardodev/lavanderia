-- Harden authentication state and preserve proof of consent.
ALTER TABLE `User`
  ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil` DATETIME(3) NULL,
  ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
  ADD COLUMN `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `mfaSecretEncrypted` TEXT NULL,
  ADD COLUMN `mfaPendingSecretEncrypted` TEXT NULL,
  ADD COLUMN `mfaRecoveryHashes` JSON NULL;

CREATE INDEX `User_lockedUntil_idx` ON `User`(`lockedUntil`);

CREATE TABLE `UserConsent` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `consentType` VARCHAR(50) NOT NULL,
  `policyVersion` VARCHAR(40) NOT NULL,
  `accepted` BOOLEAN NOT NULL,
  `textHash` VARCHAR(64) NOT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'WEB',
  `userAgent` VARCHAR(300) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `UserConsent_userId_consentType_createdAt_idx`(`userId`, `consentType`, `createdAt`),
  INDEX `UserConsent_consentType_policyVersion_idx`(`consentType`, `policyVersion`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserConsent`
  ADD CONSTRAINT `UserConsent_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Invalidate all existing administrator sessions and require a secure re-enrollment.
UPDATE `User`
SET `mustChangePassword` = true,
    `sessionVersion` = `sessionVersion` + 1
WHERE `role` = 'ADMIN';

-- Disable the old predictable seed accounts. A production administrator must be bootstrapped explicitly.
UPDATE `User`
SET `isActive` = false
WHERE `email` IN (
  'admin1@lalavanderiabakery.com',
  'admin2@lalavanderiabakery.com',
  'admin3@lalavanderiabakery.com',
  'admin4@lalavanderiabakery.com',
  'admin5@lalavanderiabakery.com'
);
