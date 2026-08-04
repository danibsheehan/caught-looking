# Architecture Decision Records

Short records of **why** the API and contract behave the way they do. Operational how-to lives in Cursor skills and the root README; ADRs capture tradeoffs.

| ADR | Title |
| --- | --- |
| [0001](0001-cache-ttls.md) | Adaptive and named cache TTLs |
| [0002](0002-upstream-qps.md) | Per-process MLB and Savant QPS caps |
| [0003](0003-openapi-contract.md) | OpenAPI as the FE/BE contract |

When defaults in `backend/config/config.go` or adaptive helpers in `backend/handlers/cache_ttl.go` change materially, update the matching ADR in the same change.
