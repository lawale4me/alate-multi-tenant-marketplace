/**
 * Portfolio 2: Query Processing & Optimisation
 * Task: Raw Multidimensional Analytics Aggregation Pipeline
 * 
 * Target: Calculate Total Revenue, Platform Commission Earnings, and Fulfillments
 * grouped by Seller Store for a specific Vendor Tenant within a date range.
 */

const { MongoClient, ObjectId } = require('mongodb');

// Database Connection URI
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/alate_db";
const client = new MongoClient(uri);

async function runAnalyticsPipeline() {
  try {
    await client.connect();
    const db = client.db('alate_db');
    const ordersCollection = db.collection('orders');

    // Sample Active Vendor ID Context
    const targetVendorId = new ObjectId("650000000000000000000001");

    // Multidimensional Aggregation Pipeline Definition
    const pipeline = [
      // Stage 1: Filter vendor scope, payment status, and date range (Indexed Match)
      {
        $match: {
          vendorId: targetVendorId,
          paymentStatus: "SUCCESS",
          createdAt: {
            $gte: new Date("2026-01-01T00:00:00Z"),
            $lte: new Date("2026-12-31T23:59:59Z")
          }
        }
      },

      // Stage 2: Unwind embedded seller sub-orders array
      { 
        $unwind: "$suborders" 
      },

      // Stage 3: Filter for completed/delivered sub-orders only
      {
        $match: {
          "suborders.status": "DELIVERED"
        }
      },

      // Stage 4: Lookup Store Metadata for commission rate details
      {
        $lookup: {
          from: "stores",
          localField: "suborders.storeId",
          foreignField: "_id",
          as: "storeDetails"
        }
      },

      // Stage 5: Unwind store details array
      { 
        $unwind: "$storeDetails" 
      },

      // Stage 6: Group by Store ID and calculate financial metrics
      {
        $group: {
          _id: "$suborders.storeId",
          storeName: { $first: "$storeDetails.storeName" },
          totalFulfillments: { $sum: 1 },
          grossRevenue: { $sum: "$suborders.subtotal" },
          platformCommission: {
            $sum: {
              $multiply: [
                "$suborders.subtotal",
                { $divide: ["$storeDetails.commissionRate", 100] }
              ]
            }
          }
        }
      },

      // Stage 7: Sort by highest gross sales
      { 
        $sort: { grossRevenue: -1 } 
      }
    ];

    console.log("Executing Multidimensional Analytics Pipeline...");
    const results = await ordersCollection.aggregate(pipeline).toArray();
    
    console.log("\n=== Aggregation Results Output ===");
    console.table(results);

  } catch (error) {
    console.error("Pipeline Execution Error:", error);
  } finally {
    await client.close();
  }
}

// Execute function
if (require.main === module) {
  runAnalyticsPipeline();
}

module.exports = { runAnalyticsPipeline };
