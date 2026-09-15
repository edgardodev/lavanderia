-- Add PRE_WASH while preserving all existing order status values.
ALTER TABLE `LaundryOrder`
  MODIFY `status` ENUM(
    'QUEUED',
    'PRE_WASH',
    'WASHING',
    'DRYING',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'QUEUED';

ALTER TABLE `StatusHistory`
  MODIFY `status` ENUM(
    'QUEUED',
    'PRE_WASH',
    'WASHING',
    'DRYING',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ) NOT NULL;
