/**
 * Portfolio 5: Distributed and Cloud Database Exercise
 * File: sharding_config.js
 * 
 * Description: MongoDB Shell Configuration Script to enable Database Sharding
 * and initialize Ranged Compound Shard Keys for multi-tenant isolation.
 * 
 * Run in MongoDB Shell (mongosh) connected to a mongos router:
 * mongosh "mongodb://mongos-router.alate.internal:27017" < sharding_config.js
 */

const TARGET_DB = 'alate_db';

print('=== ALATE MARKETPLACE CLUSTER SHARDING INITIALIZATION ===');

// Step 1: Enable Sharding on the primary database
const enableShardingResult = sh.enableSharding(TARGET_DB);
printjson({ action: 'ENABLE_SHARDING', result: enableShardingResult });

// Step 2: Define Collections and Compound Shard Key Strategy
// Strategy: { vendorId: 1, _id: 1 }
// - vendorId (Prefix): Ensures queries containing vendorId hit targeted shards[cite: 1].
// - _id (Suffix): Prevents hot-spotting for ultra-large vendor tenants.
const shardedCollections = [
  { namespace: `${TARGET_DB}.orders`, key: { vendorId: 1, _id: 1 }, unique: false },
  { namespace: `${TARGET_DB}.products`, key: { vendorId: 1, _id: 1 }, unique: false },
  { namespace: `${TARGET_DB}.users`, key: { vendorId: 1, _id: 1 }, unique: false },
  { namespace: `${TARGET_DB}.stores`, key: { vendorId: 1, _id: 1 }, unique: false }
];

// Step 3: Apply Shard Keys to Collections
shardedCollections.forEach((col) => {
  print(`\n[SHARD CONFIG] Applying Compound Shard Key for collection: ${col.namespace}`);
  
  // Create supporting index prior to sharding if not already present
  db.getSiblingDB(TARGET_DB).getCollection(col.namespace.split('.')[1]).createIndex(
    col.key, 
    { name: 'idx_shard_key_vendor_id' }
  );

  const shardResult = sh.shardCollection(col.namespace, col.key, col.unique);
  printjson({ collection: col.namespace, result: shardResult });
});

// Step 4: Verify Cluster Sharding Status
print('\n=== SHARDING STATUS VERIFICATION SUMMARY ===');
printjson(sh.status());
