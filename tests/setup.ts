// Test setup
if (!process.env.DATABASE_URL && process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://psuser:pspassword@localhost:5433/premiumshare_test'
}
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.BUSINESS_MODE = process.env.BUSINESS_MODE ?? 'MANUAL'
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? 'manual'
