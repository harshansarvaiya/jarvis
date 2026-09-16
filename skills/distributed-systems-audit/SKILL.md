---
name: distributed-systems-audit
description: Deep architectural review and reliability audit for Java/Spring Boot microservices, Kafka event streaming, Redis caching, and resilient distributed systems.
author: J.A.R.V.I.S. Core
version: 1.0.0
triggers: ["microservice", "distributed", "spring boot", "kafka", "redis", "concurrency", "resilience", "architecture review", "database", "deadlock", "scaling"]
---

# Enterprise Distributed Systems & Microservices Audit Playbook

## Purpose
Provides deep, senior Staff-level architectural review for enterprise backend systems, high-throughput microservices, distributed transaction boundaries, and event-driven architectures.

## Audit Checkpoints

### 1. Data Consistency & Transaction Boundaries
* Verify idempotency for all event listeners and API endpoints.
* Identify potential dual-write anomalies (e.g. database write + Kafka message without transactional outbox pattern).
* Audit isolation levels and optimistic locking configurations.

### 2. High-Throughput Caching & Redis Integration
* Check for cache stampede, dogpiling, and cache penetration risks.
* Verify TTL policies, eviction strategies, and cache-aside vs. write-through mechanics.
* Check connection pooling (`HikariCP`, `Lettuce`, `Jedis`) and circuit breaker thresholds (`Resilience4j`).

### 3. Concurrency & Thread Safety
* Audit shared mutable state, thread pools (`Executors`), virtual threads (`Project Loom`), and deadlock vectors.
* Verify non-blocking I/O paths and backpressure handling in Kafka consumer groups.

### 4. Resiliency & Failover Matrix
* Verify graceful degradation: rate limiting, fallback queues, and retry policies with exponential backoff and jitter.
