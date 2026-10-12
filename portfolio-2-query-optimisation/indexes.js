/**
 * Portfolio 2: Index Declaration & Optimization Script
 * 
 * Applies Equality-Sort-Range (ESR) compound index rules across all vendor-scoped
 * collections to eliminate COLLSCAN bottlenecks.
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/alate_db";
const client = new MongoClient(uri);

async function setupDatabaseIndexes() {
  try {
    await client.connect();
    const db = client.db('alate_db');

    console.log("Creating Tenant-Scoped Compound Indexes across collections...\n");

    // 1. Orders Collection Indexes
    const ordersCollection = db.collection('orders');
    await ordersCollection.createIndex(
      { vendorId: 1, paymentStatus: 1, createdAt: -1 },
      { name: "idx_vendor_payment_created" }
    );
    await ordersCollection.createIndex(
      { vendorId: 1, customerId: 1 },
      { name: "idx_vendor_customer" }
    );
    await ordersCollection.createIndex(
      { vendorId: 1, orderNumber: 1 },
      { unique: true, name: "uniq_vendor_order_number" }
    );
    console.log("✓ Orders collection indexes created successfully.");

    // 2. Stores Collection Indexes
    const storesCollection = db.collection('stores');
    await storesCollection.createIndex(
      { vendorId: 1, _id: 1 },
      { name: "idx_vendor_store_id" }
    );
    await storesCollection.createIndex(
      { vendorId: 1, slug: 1 },
      { unique: true, name: "uniq_vendor_store_slug" }
    );
    console.log("✓ Stores collection indexes created successfully.");

    // 3. Products Collection Indexes
    const productsCollection = db.collection('products');
    await productsCollection.createIndex(
      { vendorId: 1, storeId: 1, status: 1 },
      { name: "idx_vendor_store_status" }
    );
    await productsCollection.createIndex(
      { vendorId: 1, storeId: 1, barcode: 1 },
      { name: "idx_vendor_store_barcode" }
    );
    console.log("✓ Products collection indexes created successfully.");

    // 4. Users Collection Indexes
    const usersCollection = db.collection('users');
    await usersCollection.createIndex(
      { vendorId: 1, email: 1 },
      { unique: true, name: "uniq_vendor_email" }
    );
    await usersCollection.createIndex(
      { vendorId: 1, phone: 1 },
      { unique: true, name: "uniq_vendor_phone" }
    );
    console.log("✓ Users collection indexes created successfully.");

    console.log("\nAll indexes successfully verified and applied!");

  } catch (error) {
    console.error("Index creation failed:", error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  setupDatabaseIndexes();
}

module.exports = { setupDatabaseIndexes };
