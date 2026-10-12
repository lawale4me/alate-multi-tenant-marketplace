/**
 * Portfolio 3: Transactions and Concurrency
 * File: stress_test_concurrency.js
 * 
 * Description: Concurrency stress testing script simulating simultaneous checkout 
 * requests against a single inventory item to prove isolation and race-condition safety.
 */

const { MongoClient, ObjectId } = require('mongodb');
const { processCheckoutTransaction } = require('./checkout_transaction');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alate_db?replicaSet=rs0';

async function runConcurrencyStressTest() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('=== CONNECTED TO MONGODB REPLICA SET ===');

    const db = client.db();
    const productsCollection = db.collection('products');

    // 1. SETUP TEST DATA
    const testVendorId = new ObjectId();
    const testStoreId = new ObjectId();
    const testCustomerId = new ObjectId();

    const initialStock = 3; // ONLY 3 ITEMS IN STOCK
    const productInsert = await productsCollection.insertOne({
      vendorId: testVendorId,
      storeId: testStoreId,
      name: 'High Demand Limited Product',
      price: 150.00,
      inventory: {
        availableStock: initialStock,
        reservedStock: 0,
        safetyThreshold: 1
      }
    });

    const testProductId = productInsert.insertedId;
    console.log(`\n[SETUP COMPLETE] Created Test Product ${testProductId}`);
    console.log(`[INITIAL STATE] Available Stock: ${initialStock} units.\n`);

    // 2. PREPARE 10 CONCURRENT CHECKOUT REQUESTS (Buying 1 unit each)
    // 3 requests should succeed, 7 should fail gracefully.
    const concurrentRequestsCount = 10;
    const checkoutPromises = [];

    console.log(`[STRESS TEST] Firing ${concurrentRequestsCount} simultaneous checkout requests...`);

    for (let i = 1; i <= concurrentRequestsCount; i++) {
      const payload = {
        vendorId: testVendorId.toString(),
        customerId: testCustomerId.toString(),
        orderNumber: `ORD-STRESS-${100 + i}`,
        grandTotal: 150.00,
        items: [
          { productId: testProductId.toString(), quantity: 1 }
        ],
        suborders: [
          {
            storeId: testStoreId.toString(),
            suborderNumber: `SUB-STRESS-${100 + i}`,
            subtotal: 150.00,
            deliveryFee: 10.00,
            fulfillmentType: 'DELIVERY',
            items: [
              { productId: testProductId.toString(), productName: 'High Demand Limited Product', quantity: 1, unitPrice: 150.00 }
            ],
            shippingAddress: { contactName: 'John Doe', phone: '08012345678', addressLine: '123 Main St', city: 'Lagos' }
          }
        ]
      };

      // Push asynchronous execution promise
      checkoutPromises.push(processCheckoutTransaction(client, payload));
    }

    // Execute all concurrent requests simultaneously
    const results = await Promise.all(checkoutPromises);

    // 3. ANALYZE RESULTS
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('====================================================');
    console.log('               STRESS TEST SUMMARY                  ');
    console.log('====================================================');
    console.log(`Total Requests Sent : ${concurrentRequestsCount}`);
    console.log(`Successful Checkouts: ${successful.length}`);
    console.log(`Failed Checkouts    : ${failed.length}`);

    // Verify Final Database State
    const updatedProduct = await productsCollection.findOne({ _id: testProductId });
    console.log('\n[FINAL DB STATE]');
    console.log(`Available Stock: ${updatedProduct.inventory.availableStock}`);
    console.log(`Reserved Stock : ${updatedProduct.inventory.reservedStock}`);

    // Verification check
    if (updatedProduct.inventory.availableStock === 0 && successful.length === initialStock) {
      console.log('\n[PASSED] CONCURRENCY GUARD VERIFIED: Stock correctly depleted without overselling.');
    } else {
      console.error('\n[FAILED] RACE CONDITION DETECTED: Stock counts inconsistent.');
    }

    // Cleanup Test Document
    await productsCollection.deleteOne({ _id: testProductId });

  } catch (error) {
    console.error('Stress Test Execution Error:', error);
  } finally {
    await client.close();
  }
}

// Execute Script
runConcurrencyStressTest();
