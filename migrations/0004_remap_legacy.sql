-- Orders created by the pre-GCash code between migration 0003 and the deploy. Idempotent; a no-op on a fresh DB.
UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, paid_at) WHERE status = 'paid';
UPDATE orders SET status = 'cancelled' WHERE status IN ('pending', 'expired', 'failed');
UPDATE orders SET provider = 'paymongo', reference = 'JLC-' || upper(substr(hex(randomblob(4)), 1, 6)), updated_at = COALESCE(paid_at, created_at) WHERE reference IS NULL;
INSERT OR IGNORE INTO customers (email) SELECT DISTINCT lower(customer_email) FROM orders WHERE customer_id IS NULL;
UPDATE orders SET customer_id = (SELECT id FROM customers WHERE email = lower(orders.customer_email)) WHERE customer_id IS NULL;
