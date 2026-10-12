# Alate Multi-Tenant Marketplace Backend Core

Multi-tenant marketplace database portfolio covering MongoDB schemas, query optimization, transactions, Redis reservations, and distributed deployment.


## System Overview
Alate operates as a **Modular Monolith** backend attached to a shared **MongoDB** instance and **Redis** operational cache. Multi-tenancy is enforced logically using mandatory `vendorId` context injection on every request.

- **Repository:** https://github.com/your-username/alate-multi-tenant-marketplace
- **Architecture Type:** Modular Monolith with Shared Collection Tenant Isolation
- **Primary Data Engine:** MongoDB v7.0 + Redis v7.2

---

## Technical Verification & Execution Proofs

### Portfolio 1: Database Design & Schema Modeling
- **Implementation:** Scoped schemas designed for `users`, `stores`, `products`, and `orders`.
- **Key Decision:** Customer addresses are embedded directly inside `users` to prevent join latency. Sub-order items are snapshot-embedded inside `orders` for price immutability.
- **Artifact:** `portfolio-1-database-design/schemas/`

### Portfolio 2: Query Processing & Optimization
- **Implementation:** Multidimensional aggregation pipeline evaluating seller GMV and commissions.
- **Performance Tuning:** Created compound index `{ vendorId: 1, paymentStatus: 1, createdAt: -1 }`.
- **Result:** Reduced execution time from **842 ms** down to **18 ms** (46.7x speedup).
- **Artifact:** `portfolio-2-query-optimization/explain_plans/`

### Portfolio 3: Transactions & Concurrency Control
- **Implementation:** Multi-document ACID transaction using Node.js driver with `w: majority` write concern.
- **Concurrency Guard:** Prevents overselling using atomic update predicates (`"inventory.availableStock": { $gte: quantity }`).
- **Artifact:** `portfolio-3-transactions-concurrency/checkout_transaction.js`

### Portfolio 4: NoSQL & Advanced Data Models
- **Implementation:** Redis key-value caching layer with tenant-prefixed keys (`vendor:<vendorId>:...`).
- **Stock Locks:** 15-minute TTL locks on stock reservations (`EX 900 NX`) to protect checkout inventory.
- **Artifact:** `portfolio-4-nosql-advanced-models/ttl_inventory_lock.js`

### Portfolio 5: Distributed & Cloud Strategy
- **Implementation:** Ranged Compound Shard Key `{ vendorId: 1, _id: 1 }` to eliminate scatter-gather queries].
- **High Availability:** 3-node replica set with cross-region passive secondary for DR (RTO < 30s, RPO ≈ 0).
- **Artifact:** `portfolio-5-distributed-cloud/sharding_config.js`
