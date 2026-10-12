/**
 * Portfolio 4: NoSQL and Advanced Data Models
 * File: redis_client.js
 * 
 * Description: Redis client wrapper enforcing tenant-prefixed key namespacing
 * for high-throughput caching and ephemeral stock lease locks.
 */

const { createClient } = require('redis');

// Redis Connection URL (Defaults to local instance)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: REDIS_URL
});

redisClient.on('error', (err) => console.error('[REDIS ERROR]', err));
redisClient.on('connect', () => console.log('[REDIS CONNECTED] Connected to Redis instance.'));

/**
 * Ensures the client is connected before executing commands.
 */
async function getConnectedClient() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Helper to construct tenant-scoped key paths.
 * Pattern: vendor:<vendorId>:<domain>:<resourceId>
 * 
 * @param {string} vendorId - Tenant ID
 * @param {string} domain - Domain boundary (e.g., 'cart', 'lock', 'product')
 * @param {string} resourceId - Unique resource identifier
 * @returns {string} Tenant-scoped Redis key
 */
function buildTenantKey(vendorId, domain, resourceId) {
  if (!vendorId || !domain || !resourceId) {
    throw new Error('INVALID_KEY_PARAMS: vendorId, domain, and resourceId are required.');
  }
  return `vendor:${vendorId}:${domain}:${resourceId}`;
}

module.exports = {
  redisClient,
  getConnectedClient,
  buildTenantKey
};
