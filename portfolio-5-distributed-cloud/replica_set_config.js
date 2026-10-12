/**
 * Portfolio 5: Distributed and Cloud Database Exercise
 * File: replica_set_config.js
 * 
 * Description: Node.js automation script to inspect, configure, and evaluate 
 * multi-region Replica Set topology and failover policies for Disaster Recovery (DR).
 */

const { MongoClient } = require('mongodb');

// Connection string to Primary Node in Replica Set
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/admin?replicaSet=rs0';

/**
 * Generates the target 3-node multi-region replica set configuration payload.
 */
function buildReplicaSetConfig() {
  return {
    _id: 'rs0',
    members: [
      {
        _id: 0,
        host: 'db-primary-eu-west-1a.alate.internal:27017',
        priority: 2, // Preferred Primary
        tags: { region: 'eu-west-1', az: 'eu-west-1a', role: 'operational' }
      },
      {
        _id: 1,
        host: 'db-secondary-eu-west-1b.alate.internal:27017',
        priority: 1, // Standard Secondary
        tags: { region: 'eu-west-1', az: 'eu-west-1b', role: 'operational' }
      },
      {
        _id: 2,
        host: 'db-dr-us-east-1a.alate.internal:27017',
        priority: 0, // Priority 0: Passive DR Secondary (Cannot become primary automatically)
        hidden: true, // Hidden from application client routing
        votes: 1, // Holds voting quorum right
        tags: { region: 'us-east-1', az: 'us-east-1a', role: 'disaster_recovery' }
      }
    ],
    settings: {
      getLastErrorDefaults: {
        w: 'majority', // Guarantees durable write commits
        wtimeout: 5000
      }
    }
  };
}

async function inspectReplicaSetHealth() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('=== CONNECTED TO REPLICA SET PRIMARY ===\n');

    const adminDb = client.db('admin');

    // Fetch active replica set status
    const status = await adminDb.command({ replSetGetStatus: 1 });
    
    console.log(`Replica Set Name : ${status.set}`);
    console.log(`Current Primary  : ${status.members.find(m => m.stateStr === 'PRIMARY')?.name || 'UNKNOWN'}`);
    console.log(`Active Members   : ${status.members.length}`);
    
    console.log('\n--- Member Status Details ---');
    status.members.forEach(member => {
      console.log(`- Node ID [${member._id}] | Host: ${member.name}`);
      console.log(`  State: ${member.stateStr} | Health: ${member.health === 1 ? 'OK' : 'DEGRADED'}`);
      console.log(`  Uptime: ${member.uptime}s | Replication Lag: ${member.optimeDate ? new Date() - new Date(member.optimeDate) : 0}ms`);
    });

  } catch (error) {
    console.error('[DR CONFIG ERROR] Failed to inspect Replica Set:', error.message);
    console.log('\n[INFO] Generated Target DR Configuration Architecture:');
    console.dir(buildReplicaSetConfig(), { depth: null });
  } finally {
    await client.close();
  }
}

// Run Inspection Script
if (require.main === module) {
  inspectReplicaSetHealth();
}

module.exports = { buildReplicaSetConfig };
