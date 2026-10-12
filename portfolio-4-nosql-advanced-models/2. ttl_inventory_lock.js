/**
 * Portfolio 4: NoSQL and Advanced Data Models
 * File: ttl_inventory_lock.js
 * 
 * Description: Demonstrates 15-minute TTL stock lease locks and release mechanisms
 * using tenant-scoped Redis keys.
 */

const { getConnectedClient, buildTenantKey } = require('./redis_client');

// Default stock lease duration: 15 minutes (900 seconds)[cite: 2]
const LEASE_TTL_SECONDS = 900;

/**
 * Acquires a 15-minute stock lease lock for a user during checkout.
 * 
 * @param {string} vendorId - Tenant Object ID[cite: 1]
 * @param {string} storeId - Seller Store Object ID[cite: 1]
 * @param {string} productId - Product Object ID[cite: 1]
 * @param {string} userId - Customer User Object ID[cite: 1]
 * @param {number} ttlSeconds - Lease duration in seconds (Default: 900)
 * @returns {Promise<Object>} Lock acquisition result
 */
async function acquireStockLease(vendorId, storeId, productId, userId, ttlSeconds = LEASE_TTL_SECONDS) {
  const client = await getConnectedClient();
  
  // Construct key: vendor:<vendorId>:lock:store:<storeId>:product:<productId>[cite: 2]
  const lockKey = buildTenantKey(vendorId, 'lock', `store:${storeId}:product:${productId}`);
  const lockValue = JSON.stringify({
    userId,
    acquiredAt: new Date().toISOString()
  });

  console.log(`[REDIS LOCK] Attempting lock on key: ${lockKey}`);

  // NX: Only set key if it does not already exist (Atomic Lock Acquisition)
  // EX: Set expire time in seconds (15-minute TTL)[cite: 2]
  const result = await client.set(lockKey, lockValue, {
    NX: true,
    EX: ttlSeconds
  });

  if (result === 'OK') {
    console.log(`[LOCK ACQUIRED] Reserved product ${productId} for user ${userId}. Expires in ${ttlSeconds}s.`);
    return { success: true, lockKey, ttlSeconds };
  } else {
    console.warn(`[LOCK FAILED] Product ${productId} is currently reserved by another active session.`);
    return { success: false, reason: 'PRODUCT_LOCKED_BY_ANOTHER_SESSION' };
  }
}

/**
 * Safely releases a stock lock if owned by the requesting user.
 * 
 * @param {string} vendorId - Tenant Object ID[cite: 1]
 * @param {string} storeId - Seller Store Object ID[cite: 1]
 * @param {string} productId - Product Object ID[cite: 1]
 * @param {string} userId - Customer User Object ID[cite: 1]
 */
async function releaseStockLease(vendorId, storeId, productId, userId) {
  const client = await getConnectedClient();
  const lockKey = buildTenantKey(vendorId, 'lock', `store:${storeId}:product:${productId}`);

  const lockDataRaw = await client.get(lockKey);
  if (!lockDataRaw) {
    console.log(`[LOCK RELEASE] Key ${lockKey} already expired or non-existent.`);
    return { success: true, state: 'EXPIRED' };
  }

  const lockData = JSON.parse(lockDataRaw);

  // Ensure only lock owner can release the lease
  if (lockData.userId === userId) {
    await client.del(lockKey);
    console.log(`[LOCK RELEASED] Lock ${lockKey} successfully removed for user ${userId}.`);
    return { success: true, state: 'RELEASED' };
  } else {
    console.error(`[LOCK RELEASE DENIED] User ${userId} does not own lock on key ${lockKey}.`);
    return { success: false, reason: 'UNAUTHORIZED_LOCK_RELEASE' };
  }
}

// ==========================================
// DEMO EXECUTION SCRIPT
// ==========================================
async function runDemo() {
  const sampleVendorId = '650000000000000000000001';
  const sampleStoreId = '650000000000000000000088';
  const sampleProductId = '650000000000000000000099';
  
  const userA = 'user_101';
  const userB = 'user_102';

  console.log('=== PORTFOLIO 4: REDIS TTL STOCK LOCK DEMONSTRATION ===\n');

  // Step 1: User A acquires 15-minute lease
  const res1 = await acquireStockLease(sampleVendorId, sampleStoreId, sampleProductId, userA, 15);
  console.log('User A Result:', res1, '\n');

  // Step 2: User B attempts to lock the same item (Should Fail)
  const res2 = await acquireStockLease(sampleVendorId, sampleStoreId, sampleProductId, userB, 15);
  console.log('User B Result:', res2, '\n');

  // Step 3: User A completes checkout and releases the lease
  const releaseRes = await releaseStockLease(sampleVendorId, sampleStoreId, sampleProductId, userA);
  console.log('Release Result:', releaseRes, '\n');

  // Step 4: User B attempts lock again (Should Succeed)
  const res3 = await acquireStockLease(sampleVendorId, sampleStoreId, sampleProductId, userB, 15);
  console.log('User B Second Attempt Result:', res3, '\n');

  // Clean up demo lock
  await releaseStockLease(sampleVendorId, sampleStoreId, sampleProductId, userB);
  
  const client = await getConnectedClient();
  await client.quit();
}

// Run file directly if executed via `node ttl_inventory_lock.js`
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = {
  acquireStockLease,
  releaseStockLease
};
