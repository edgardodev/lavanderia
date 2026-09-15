ALTER TABLE `Reservation`
  ADD COLUMN `requestKey` VARCHAR(80) NULL;

CREATE UNIQUE INDEX `Reservation_requestKey_key`
  ON `Reservation`(`requestKey`);

ALTER TABLE `LaundryOrder`
  ADD COLUMN `requestKey` VARCHAR(80) NULL;

CREATE UNIQUE INDEX `LaundryOrder_requestKey_key`
  ON `LaundryOrder`(`requestKey`);
