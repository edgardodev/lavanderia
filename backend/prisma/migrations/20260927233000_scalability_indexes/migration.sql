-- Operational indexes for growing reservation/order/admin workloads.

CREATE INDEX `User_role_isActive_createdAt_idx`
  ON `User`(`role`, `isActive`, `createdAt`);

CREATE INDEX `Reservation_branchId_status_scheduledStart_idx`
  ON `Reservation`(`branchId`, `status`, `scheduledStart`);

CREATE INDEX `Reservation_status_scheduledStart_idx`
  ON `Reservation`(`status`, `scheduledStart`);

CREATE INDEX `MachineSlot_branchId_type_scheduledStart_idx`
  ON `MachineSlot`(`branchId`, `type`, `scheduledStart`);

CREATE INDEX `LaundryOrder_branchId_status_createdAt_idx`
  ON `LaundryOrder`(`branchId`, `status`, `createdAt`);

CREATE INDEX `LaundryOrder_status_createdAt_idx`
  ON `LaundryOrder`(`status`, `createdAt`);
