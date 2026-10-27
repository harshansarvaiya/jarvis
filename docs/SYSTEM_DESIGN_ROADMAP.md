# System Design Strategic Roadmap & Atomic Query Catalog
> **Target**: SDE-2 / Senior Backend Engineer at Tier-1 Product Companies (PhonePe, Swiggy, Razorpay, Uber, Atlassian, CRED, Zepto)  
> **Timeline**: 6-Month Intensive Substrate  
> **Repository**: [github.com/harshansarvaiya/SystemDesign](https://github.com/harshansarvaiya/SystemDesign)  
> **DSA Sister Repo**: [github.com/harshansarvaiya/DSA](https://github.com/harshansarvaiya/DSA)

---

## 1. Core Philosophy: Eliminating Noise & The Senior SDE-2 Bar

* **Decouple LLD and HLD Completely**:
  * **LLD (Machine Coding)** is an **implementation and craftsmanship round** (clean, compiling, thread-safe Java code in 90 minutes).
  * **HLD (Distributed Systems)** is a **trade-off, scale, and resilience defense** (whiteboarding, API contracts, database partitioning, and failure modes in 45 minutes).
* **Zero Academic Trivia**: Skip implementing Paxos, Raft, or Byzantine Fault Tolerance from scratch. Master production-grade distributed primitives: **Transactional Outbox, Saga Orchestration, Distributed Locks, Write-Ahead Logs, B+ Trees, and Consumer Lag mitigation**.
* **The Senior SDE-2 Evaluation Bar**:
  * In LLD: Zero boilerplate hesitation, seamless application of SOLID principles, zero thread-safety bugs on shared state, and clean separation of concerns without over-engineering.
  * In HLD: Quantitative capacity estimation, calculating throughput ($QPS$), identifying single points of failure (SPOF), and defending database and consistency trade-offs ($CP$ vs. $AP$).

---

## 2. The Standard Execution Protocols

### The 90-Minute Machine Coding Protocol (LLD)
```
[00–15m] Scope & Invariants  ──> Clarify functional limits, write down entity interfaces
[15–30m] Clean Skeleton       ──> Define Models, Interfaces, Enums; establish dependency graph
[30–65m] Core Implementation  ──> Implement business services using Strategy/State patterns
[65–75m] Thread Safety Pass   ──> Lock striping, ConcurrentHashMap, atomic updates on shared state
[75–90m] Driver & Validation  ──> Write executable main() test suite covering edge cases
```

### The 45-Minute High-Level Design (HLD) Interview Formula
```
[00–05m] Scale & Requirements ──> DAU, Read:Write ratio, QPS calculation, storage sizing (5-yr)
[05–15m] High-Level Skeleton  ──> Core APIs, Data Model (SQL vs NoSQL), End-to-end box diagram
[15–25m] Deep-Dive Core Flow  ──> Write path (Kafka/Outbox) & Read path (Redis cache-aside)
[25–38m] Failure & Resilience ──> Single points of failure, network partitions, cache thundering herd
[38–45m] Production Readiness ──> Metrics (p99 latency), tracing (OpenTelemetry), circuit breakers
```

---

## 3. Part 1: Low-Level Design (LLD) & Machine Coding — Atomic Modules

### Section A: Applied Design Patterns in Modern Java

#### 01. Strategy Pattern for Dynamic Business Rules
* **`🔍 Search String`**: `Strategy pattern modern Java Spring collection wiring dynamic strategy selection`
* **Core Concepts**: Eliminating `switch`/`if-else` chains, interface-based algorithm injection, Spring `@Autowired Map<String, Strategy>` or pure Java `Map<Enum, Strategy>` registry.
* **Deliverable**: Write a dynamic `PaymentProcessor` supporting CreditCard, UPI, and NetBanking with dynamic runtime resolution.

#### 02. State Pattern for Entity Lifecycles
* **`🔍 Search String`**: `State design pattern Java order lifecycle state machine transitions`
* **Core Concepts**: State interface, concrete state implementations, context object, enforcing valid forward-only transitions, throwing `InvalidStateException`.
* **Deliverable**: Write an `OrderStateMachine` (`PLACED` $\to$ `ACCEPTED` $\to$ `DISPATCHED` $\to$ `DELIVERED`) where illegal transitions (e.g., `PLACED` $\to$ `DELIVERED`) are strictly rejected.

#### 03. Observer Pattern for In-Memory Decoupling
* **`🔍 Search String`**: `Observer pattern Java in memory pub sub event listener async execution`
* **Core Concepts**: Observable/Subject, Event object, synchronous vs. asynchronous notification using `ExecutorService`, subscriber registration/deregistration.
* **Deliverable**: Build an in-memory `StockPriceUpdateNotifier` that alerts registered user consoles when ticker prices move.

#### 04. Decorator Pattern for Dynamic Interception
* **`🔍 Search String`**: `Decorator pattern Java layered features caching logging rate limiting`
* **Core Concepts**: Component interface, base implementation, abstract decorator wrapping the component, stacking behaviors at runtime without subclass explosion.
* **Deliverable**: Build a `NotificationSender` where base SMS can be dynamically wrapped with `EmailDecorator` and `SlackDecorator`.

#### 05. Factory & Builder with Invariant Validation
* **`🔍 Search String`**: `Builder pattern Java domain invariants validation effective Java Joshua Bloch`
* **Core Concepts**: Private constructors, static inner Builder, validating mandatory fields and business constraints inside `build()`, Factory registry pattern.
* **Deliverable**: Write an immutable `UserAccount` class with Builder validation preventing negative balances or invalid email formats.

---

### Section B: Core Java Concurrency & Multithreading

#### 06. Java Memory Model & Volatile Semantics
* **`🔍 Search String`**: `Java memory model volatile semantics happens before CPU cache coherency MESI`
* **Core Concepts**: CPU L1/L2/L3 caches, cache coherency, instruction reordering, memory barriers, write-visibility, why `volatile` does not guarantee atomicity for compound operations ($i++$).
* **Deliverable**: Write a code example demonstrating how a missing `volatile` causes an infinite loop in a multi-threaded reader thread.

#### 07. Explicit Locks & Condition Variables
* **`🔍 Search String`**: `Java ReentrantLock vs synchronized ReentrantReadWriteLock condition await signal`
* **Core Concepts**: Lock fairness, `tryLock()` with timeouts, interruptible locking, read/write lock striping, replacing `wait()`/`notify()` with `Condition.await()` and `Condition.signal()`.
* **Deliverable**: Build a custom thread-safe `BoundedBlockingBuffer<T>` from scratch using `ReentrantLock` and two `Condition` instances (`notFull`, `notEmpty`).

#### 08. ConcurrentHashMap Deep Dive
* **`🔍 Search String`**: `ConcurrentHashMap internal working Java 8 CAS synchronized treeify threshold lock striping`
* **Core Concepts**: Array of nodes, table buckets, CAS for empty bucket insertion, `synchronized` on bucket head for collisions, linked list to red-black tree conversion (`TREEIFY_THRESHOLD = 8`), size calculation with `LongAdder`.
* **Deliverable**: Write a custom in-memory multi-threaded counter using `ConcurrentHashMap.compute()` to prove thread-safety under 50 concurrent threads.

#### 09. ThreadPoolExecutor Architecture & Tuning
* **`🔍 Search String`**: `ThreadPoolExecutor sizing parameters corePoolSize maxPoolSize queueCapacity rejection policy`
* **Core Concepts**: CPU-bound ($N_{\text{threads}} = N_{\text{cpu}} + 1$) vs. I/O-bound sizing ($N_{\text{threads}} = N_{\text{cpu}} \times (1 + \text{Wait Time} / \text{Service Time})$), work queue types, custom `RejectedExecutionHandler` (CallerRuns, Abort, Discard).
* **Deliverable**: Configure a resilient `ThreadPoolExecutor` with a bounded queue and custom rejection policy that logs dropped tasks to disk.

#### 10. Atomic Primitives & Non-Blocking Algorithms
* **`🔍 Search String`**: `AtomicInteger AtomicReference CAS compare and swap lock free programming Java`
* **Core Concepts**: Hardware-level CAS primitives, `VarHandle`, optimistic non-blocking loops (`compareAndSet`), ABA problem and `AtomicStampedReference`.
* **Deliverable**: Implement a lock-free thread-safe Stack using `AtomicReference` (Treiber Stack).

---

### Section C: The Top 8 Canonical Machine Coding Problems

#### 11. In-Memory Thread-Safe Cache with TTL & Eviction
* **`🔍 Search String`**: `Machine coding thread safe LRU cache with TTL Java doubly linked list concurrent hashmap`
* **Core Requirements**: `get(key)`, `put(key, value, ttlMs)`, eviction policy (LRU default, pluggable LFU via Strategy), lazy expiration vs. background sweeper daemon, thread-safe with `ReentrantReadWriteLock`.
* **Deliverable**: Full runnable Java module with concurrent test suite.

#### 12. High-Throughput Rate Limiter
* **`🔍 Search String`**: `Machine coding in memory rate limiter Java token bucket sliding window log`
* **Core Requirements**: Pluggable strategies (`TokenBucket`, `SlidingWindowLog`), multi-client support (by User ID or IP), thread-safe atomic counters, reject excess requests with custom exceptions.
* **Deliverable**: Runnable rate limiter with simulated multi-threaded traffic passing/failing rate limits.

#### 13. Splitwise / Expense Sharing Service
* **`🔍 Search String`**: `Machine coding splitwise Java low level design strategy pattern debt simplification`
* **Core Requirements**: User/Group models, expense types (`EQUAL`, `EXACT`, `PERCENT`), ledger tracking who owes whom, greedy or graph-based debt simplification algorithm.
* **Deliverable**: Executable `Driver.java` setting up 4 users, splitting multiple expenses, and printing final minimal balance settlements.

#### 14. Smart Parking Lot / Multi-Level Elevator
* **`🔍 Search String`**: `Machine coding parking lot low level design Java strategy state pattern`
* **Core Requirements**: Vehicle types (Car, Bike, Truck), parking spots, multi-level allocation strategies (Nearest to entrance, Best-fit), ticket generation, concurrent entry/exit gate synchronization.
* **Deliverable**: Executable parking lot simulator with concurrent gate threads checking in/out vehicles.

#### 15. In-Memory Pub-Sub Broker (Kafka-lite)
* **`🔍 Search String`**: `Machine coding in memory pub sub message broker Java topics partitions offsets`
* **Core Requirements**: Create Topic, Publisher publishes messages, Subscriber subscribes to topic via Consumer Group, sequential offset tracking per consumer, parallel thread pool message dispatch.
* **Deliverable**: Runnable pub-sub system demonstrating independent consumer groups consuming events at different rates.

#### 16. Ride-Sharing / Cab-Dispatch Engine
* **`🔍 Search String`**: `Machine coding ride sharing cab booking system low level design Java`
* **Core Requirements**: Rider requests trip, location coordinates, find nearby available drivers within radius $R$, matching strategy (nearest driver vs. highest rated), ride lifecycle state machine.
* **Deliverable**: Executable driver matching simulation handling concurrent ride requests.

#### 17. Food Delivery Order Lifecycle (Swiggy-lite)
* **`🔍 Search String`**: `Machine coding food delivery order management system low level design Java state pattern`
* **Core Requirements**: Restaurant menu management, cart checkout, order state transitions with strict guards, notification listeners triggered on state updates.
* **Deliverable**: Runnable order processing engine moving an order from cart to final delivery with event logs.

#### 18. Distributed Task Scheduler / Worker Pool
* **`🔍 Search String`**: `Machine coding delayed task scheduler Java priority blocking queue worker threads`
* **Core Requirements**: Schedule one-time task at timestamp $T$, schedule recurring task every $X$ seconds, priority execution, worker thread pool execution without busy-waiting.
* **Deliverable**: Executable task scheduler managing a `DelayQueue` or `PriorityBlockingQueue` executing scheduled tasks on time.

---

## 4. Part 2: High-Level Design (HLD) & Distributed Systems — Atomic Modules

### Section A: Storage Engines & Relational Database Mechanics

#### 19. B+Tree Index Internals & Index Optimization
* **`🔍 Search String`**: `MySQL InnoDB B+Tree index internals clustered vs secondary composite index left prefix rule`
* **Core Concepts**: Page layout (16KB), leaf nodes linked list, branching factor, why B+Tree beats binary trees for disk I/O, covering index (`USING INDEX`), avoiding full table scans.
* **Deliverable**: One-page Markdown note detailing index tree traversal and why `WHERE b = 2 AND a = 1` uses an index on `(a, b)` but `WHERE b = 2` does not.

#### 20. Database Isolation Levels & Concurrency Anomalies
* **`🔍 Search String`**: `PostgreSQL MySQL transaction isolation levels dirty read non repeatable read phantom read write skew`
* **Core Concepts**: Read Uncommitted, Read Committed, Repeatable Read, Serializable; MVCC (Multi-Version Concurrency Control) implementation; Undo logs; Write Skew anomaly under Repeatable Read.
* **Deliverable**: Comparison matrix table of isolation levels vs. anomalies with real SQL execution trace examples.

#### 21. Pessimistic vs. Optimistic Locking
* **`🔍 Search String`**: `Pessimistic locking SELECT FOR UPDATE vs optimistic locking version column Spring Data JPA`
* **Core Concepts**: Database row locks, lock timeouts, deadlocks; Optimistic concurrency control using `@Version`, handling `OptimisticLockingFailureException` with retries.
* **Deliverable**: Architecture diagram showing when to pick Optimistic Locking (low collision, web carts) vs. Pessimistic Locking (high contention, flash sale inventory).

#### 22. LSM-Trees vs. B+Trees for Write-Heavy Systems
* **`🔍 Search String`**: `LSM tree vs B tree write amplification MemTable SSTable compaction Cassandra RocksDB`
* **Core Concepts**: Sequential disk writes vs. random disk writes, Write-Ahead Log (WAL), in-memory MemTable, immutable SSTables, Leveled vs. Size-Tiered compaction, Bloom filters for fast key lookups.
* **Deliverable**: Trade-off breakdown explaining why Cassandra/ClickHouse use LSM-trees for ingestion while PostgreSQL/MySQL use B+Trees.

#### 23. Database Sharding & Consistent Hashing
* **`🔍 Search String`**: `Database sharding strategies range based vs hash based consistent hashing virtual nodes`
* **Core Concepts**: Horizontal vs. vertical partitioning, shard key selection, rebalancing problem with naive modulo hashing, Consistent Hashing ring, virtual nodes for uniform distribution.
* **Deliverable**: Architectural diagram showing client request routing across 4 database shards via a Consistent Hashing ring.

---

### Section B: Caching & Distributed Streaming

#### 24. Distributed Caching Topologies & Invalidation
* **`🔍 Search String`**: `Distributed caching topologies cache aside write through write behind cache invalidation strategies`
* **Core Concepts**: Read path (Cache-Aside), write path (Write-Through vs. Write-Behind buffer), dual-write race conditions, why updating cache causes stale reads vs. deleting cache on DB update.
* **Deliverable**: Sequence diagram of the Cache-Aside pattern with cache deletion on write.

#### 25. Mitigating Production Cache Failures
* **`🔍 Search String`**: `Cache stampede thundering herd cache avalanche cache penetration solutions Redis`
* **Core Concepts**: Cache Stampede (probabilistic early expiration / XFetch algorithm or distributed lock on miss), Cache Avalanche (jittered random TTLs), Cache Penetration (Bloom filter or caching empty/null values with low TTL).
* **Deliverable**: Markdown incident runbook on how to recover a database when Redis cache completely flushes.

#### 26. Apache Kafka Architecture & Consumer Mechanics
* **`🔍 Search String`**: `Kafka partition key hashing consumer group rebalance protocol consumer lag mitigation`
* **Core Concepts**: Topic partitioning, order guarantees strictly within a partition, consumer offset management (`enable.auto.commit=false`), cooperative sticky rebalancing, handling consumer lag.
* **Deliverable**: Deep-dive architecture spec on preventing out-of-order event processing across Kafka partitions.

---

### Section C: Distributed Transactions & Reliability

#### 27. The Saga Pattern (Orchestration vs. Choreography)
* **`🔍 Search String`**: `Saga pattern microservices orchestration vs choreography compensating transactions temporal`
* **Core Concepts**: Why Two-Phase Commit (2PC) is an anti-pattern in distributed microservices (blocking, low availability); Choreography (event-driven) vs. Orchestration (central orchestrator); executing compensating actions on downstream failures.
* **Deliverable**: Mermaid sequence diagram of an Order-Payment-Inventory Saga with a compensating rollback when payment fails.

#### 28. The Transactional Outbox Pattern with CDC
* **`🔍 Search String`**: `Transactional outbox pattern Debezium Kafka connect change data capture dual write problem`
* **Core Concepts**: The dual-write failure mode (DB succeeds, message queue publish fails); inserting events into a local DB `outbox` table within the same ACID transaction; streaming outbox events to Kafka via Debezium CDC.
* **Deliverable**: End-to-end architectural flow diagram: Spring Boot $\to$ PostgreSQL `outbox` $\to$ Debezium $\to$ Kafka topic.

#### 29. Distributed Idempotency Architectures
* **`🔍 Search String`**: `Distributed idempotency keys API design Redis SETNX unique database constraint`
* **Core Concepts**: Network retries causing duplicate requests, Client-generated `Idempotency-Key` header, atomic key acquisition via Redis `SET key val NX EX 120`, storing response payload, handling concurrent in-flight duplicates.
* **Deliverable**: Complete flowchart of an Idempotent Payment API from gateway entry to database execution.

#### 30. Distributed Locks: Redis vs. ZooKeeper
* **`🔍 Search String`**: `Distributed locks Redis Lua script lease expiration Redlock algorithm Martin Kleppmann critique`
* **Core Concepts**: Single-node Redis lock with unique token and Lua release script, automatic lease renewal (heartbeat/watchdog), Redlock multi-node consensus, why Martin Kleppmann argues against Redlock under GC pauses.
* **Deliverable**: Markdown trade-off analysis comparing Redis distributed locks vs. ZooKeeper ephemeral sequential nodes.

---

### Section D: The Top 5 Canonical HLD Case Studies

#### 31. Flash-Sale & High-Concurrency Ticket Booking (BookMyShow / Hotstar)
* **`🔍 Search String`**: `System design flash sale ticket booking BookMyShow high concurrency inventory reservation`
* **Core Focus**: Preventing overselling, Redis Lua script for atomic seat reservation with 10-minute hold TTL, asynchronous payment confirmation via Kafka, database write-behind queue, handling webhook drops.
* **Deliverable**: Complete HLD document with capacity estimation, API contracts, and Mermaid architecture diagram.

#### 32. Hyperlocal Delivery & Geolocation Dispatch (Swiggy / Uber)
* **`🔍 Search String`**: `System design Uber Swiggy hyperlocal delivery geolocation dispatch Geohash Uber H3`
* **Core Focus**: Driver location ingestion via WebSockets/Kafka, spatial indexing (Geohash vs. Uber H3 hexagonal cells), matching algorithm under high driver/order density, dynamic surge pricing.
* **Deliverable**: Architecture blueprint detailing real-time driver tracking and dispatch matchmaking.

#### 33. Resilient Payment Gateway & Financial Ledger (Razorpay / Stripe)
* **`🔍 Search String`**: `System design payment gateway double entry ledger Razorpay Stripe idempotency reconciliation`
* **Core Focus**: Double-entry bookkeeping (credits = debits), zero loss of transactions, distributed idempotency keys, handling bank timeouts with exponential backoff and circuit breakers, daily settlement reconciliation batch jobs.
* **Deliverable**: Architectural spec of a high-reliability payment gateway with state transition diagram.

#### 34. Real-time Telemetry & Metrics Streaming Pipeline
* **`🔍 Search String`**: `System design real time metrics telemetry pipeline Kafka ClickHouse time series downsampling`
* **Core Focus**: High write throughput ($1\text{M}+ \text{events/sec}$), Kafka partition key strategy, streaming aggregation via Apache Flink / Kafka Streams, LSM-tree time-series storage (ClickHouse/Cassandra), rollup views for dashboards.
* **Deliverable**: High-throughput ingestion architecture blueprint with storage tiering breakdown.

#### 35. High-Throughput Read-Heavy URL Shortener / Pastebin
* **`🔍 Search String`**: `System design URL shortener high throughput read heavy Base62 Key Generation Service`
* **Core Focus**: 100:1 read-to-write ratio, Base62 encoding from 64-bit integer, dedicated Key Generation Service (KGS) with pre-allocated token blocks, multi-tier Redis caching, global CDN cache-aside.
* **Deliverable**: Full capacity math ($QPS$, bandwidth, storage for 5 years) and complete component architecture doc.

---

## 5. The 4-Phase Progression (6-Month Horizon)

```
Phase 1: Foundations & Concurrent Primitives (Months 1–2)
├── LLD: SOLID in Java 21, ReentrantLock, ConcurrentHashMap, ThreadPoolExecutor
├── HLD: Storage Engines (B+ Trees vs LSM), Caching Topologies, Redis internals
└── Deliverable: Thread-Safe In-Memory Cache with TTL + High-Throughput URL Shortener HLD

Phase 2: Event-Driven Systems & Core Engines (Months 3–4)
├── LLD: State Pattern, Strategy Pattern, Rate Limiter & Parking Lot implementations
├── HLD: Apache Kafka deep dive, Saga Pattern, Transactional Outbox, Idempotency keys
└── Deliverable: Distributed Rate Limiter repo module + Resilient Payment Gateway HLD

Phase 3: Complex Multi-Component Architectures (Month 5)
├── LLD: Splitwise, In-Memory Pub-Sub Broker, Cab Matching Engine
├── HLD: Hyperlocal Geolocation Dispatch (Swiggy/Uber) + Flash-Sale Booking (BookMyShow)
└── Deliverable: Executable Splitwise with Debt Simplification + Flash Sale Architecture doc

Phase 4: Timed Live Interview Simulation & Polish (Month 6)
├── LLD: Timed 90-minute blind machine coding drills (0 to executable code)
├── HLD: 45-minute whiteboarding simulations defending trade-offs under constraints
└── Deliverable: 8 complete LLD modules + 5 complete HLD architectural blueprints in repo
```

---

## 6. Weekly Execution Protocol (Synced with Office & Commute)

* **Office Days (Mon / Wed / Fri — High Commute Fatigue):**
  * Morning / Evening Commute: Listen to distributed system deep dives (Kafka internals, B+ Tree indexing, Saga patterns).
  * Evening (30–45 mins): Review flashcards on JVM memory model, GC tuning (G1 vs ZGC), and database isolation levels.
* **WFH Days (Tue / Thu — High Energy Reserves):**
  * Dedicated Evening Deep-Work Block (6:30 PM – 8:30 PM): Code **1 LLD component or pattern** in IntelliJ from scratch. Commit clean code with JUnit tests.
* **Weekends (Sat / Sun — Peak Cognitive Output):**
  * **Saturday Morning (9:00 AM – 11:30 AM):** Timed 90-minute Machine Coding drill on a full canonical problem.
  * **Sunday Morning (9:00 AM – 10:30 AM):** End-to-end HLD architecture sprint. Draft the architectural spec and Mermaid sequence diagrams.

---

## 7. Deliverable Checklist per Problem (The Commit Standard)

### For LLD Modules:
1. **Zero Raw Types**: Strict generic typing and idiomatic modern Java.
2. **Separation of Concerns**: Strict package boundaries (`model`, `repository`, `service`, `strategy`, `Driver.java`).
3. **Thread Safety Verification**: Multi-threaded test case simulating concurrent readers/writers without deadlocks or race conditions.

### For HLD Documents:
1. **Quantitative Math**: Clear $QPS$, bandwidth, and storage projections.
2. **Mermaid Architectural Diagram**: Scannable visual data flow.
3. **Failure Domain Table**: Explicit matrix detailing failure modes (Redis down, Kafka consumer lag, DB replication lag).
