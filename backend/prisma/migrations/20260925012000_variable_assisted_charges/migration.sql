ALTER TABLE `LaundryOrder`
  ADD COLUMN `baseAmountCents` INTEGER NULL,
  ADD COLUMN `deliveryFeeCents` INTEGER NULL,
  ADD COLUMN `stainFeeCents` INTEGER NULL;

UPDATE `LaundryOrder`
SET `baseAmountCents` = `amountCents`
WHERE `baseAmountCents` IS NULL;

ALTER TABLE `LaundryOrder`
  MODIFY `baseAmountCents` INTEGER NOT NULL;
