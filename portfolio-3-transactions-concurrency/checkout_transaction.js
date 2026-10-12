/**
 * Portfolio 3: Transactions and Concurrency
 * File: checkout_transaction.js
 * 
 * Description: Demonstrates multi-document ACID transaction handling in MongoDB
 * for multi-tenant checkout operations with isolation controls.
 */

const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alate_db?replicaSet=rs0';

/**
 * Executes an atomic multi-tenant checkout process within a MongoDB Transaction.
 * 
 * @param {MongoClient} client - Active MongoDB client instance
 * @param {Object} payload - Order execution details
 */
async function processCheckoutTransaction(client, payload) {
  const { vendorId, customerId, orderNumber, items, suborders, grandTotal } = payload;
  
  // Start a MongoDB Client Session
  const session = client.startSession();

  // Transaction options ensuring majority consensus for strict consistency
  const transactionOptions = {
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' },
    readPreference: 'primary'
  };

  try {
    console.log(`[TX START] Initiating transaction for Order: ${orderNumber} | Tenant: ${vendorId}`);

    await session.withTransaction(async () => {
      const db = client.db();
      const productsCollection = db.collection('products');
      const ordersCollection = db.collection('orders');

      // 1. ATOMIC INVENTORY CHECK AND RESERVATION (Optimistic Lock Guard)
      for (const item of items) {
        console.log(`[TX STEP 1] Attempting stock update for Product ID: ${item.productId}`);

        const updateResult = await productsCollection.updateOne(
          {
            _id: new ObjectId(item.productId),
            vendorId: new ObjectId(vendorId), // Multi-tenant isolation guard
            "inventory.availableStock": { $gte: item.quantity } // Guard against overselling
          },
          {
            $inc: {
              "inventory.availableStock": -item.quantity,
              "inventory.reservedStock": item.quantity
            }
          },
          { session }
        );

        // If no document matched, available stock was insufficient or product/vendor context was invalid
        if (updateResult.matchedCount === 0) {
          throw new Error(`INSUFFICIENT_STOCK_OR_INVALID_TENANT: Product ${item.productId} unavailable for required quantity (${item.quantity}).`);
        }

        console.log(`[TX STEP 1 SUCCESS] Reserved ${item.quantity} units for Product ${item.productId}`);
      }

      // 2. CREATE PARENT ORDER & SUB-ORDERS (Denormalized Snapshot Document)
      const orderDocument = {
        vendorId: new ObjectId(vendorId),
        customerId: new ObjectId(customerId),
        orderNumber: orderNumber,
        grandTotal: grandTotal,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        suborders: suborders.map(sub => ({
          _id: new ObjectId(),
          storeId: new ObjectId(sub.storeId),
          suborderNumber: sub.suborderNumber,
          subtotal: sub.subtotal,
          deliveryFee: sub.deliveryFee,
          status: 'PLACED',
          fulfillmentType: sub.fulfillmentType || 'DELIVERY',
          items: sub.items.map(i => ({
            productId: new ObjectId(i.productId),
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice
          })),
          shippingAddress: sub.shippingAddress
        })),
        createdAt: new Date()
      };

      console.log(`[TX STEP 2] Inserting Order Document...`);
      const insertResult = await ordersCollection.insertOne(orderDocument, { session });
      console.log(`[TX STEP 2 SUCCESS] Created Order ID: ${insertResult.insertedId}`);

    }, transactionOptions);

    console.log(`[TX COMMIT SUCCESS] Checkout completed atomically for Order: ${orderNumber}`);
    return { success: true, orderNumber };

  } catch (error) {
    console.error(`[TX ABORTED] Transaction aborted due to error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await session.endSession();
    console.log(`[TX END] Session closed for Order: ${orderNumber}\n`);
  }
}

module.exports = { processCheckoutTransaction };
