# Architecture Decision Records

Short records of **why** the API and contract behave the way they do — written so a curious reader can follow the tradeoff, not only someone who already knows the codebase.

Think of each ADR as a decision sticky note: what we chose, why, and what we accepted as a downside. Day-to-day how-to lives in Cursor skills and the root README; the [docs home](../README.md) has a plain-language glossary.

| ADR | In plain English |
| --- | --- |
| [0001](0001-cache-ttls.md) | Remember answers for a while; refresh live games more often than finished ones |
| [0002](0002-upstream-qps.md) | Cap how hard we hit MLB and Savant so we stay good neighbors |
| [0003](0003-openapi-contract.md) | One shared menu of API shapes for the website, the Go API, and public docs |

When defaults in `backend/config/config.go` or adaptive helpers in `backend/handlers/cache_ttl.go` change materially, update the matching ADR in the same change. How-to for agents: `.claude/skills/caching-and-upstream-perf/SKILL.md` and `.claude/skills/openapi-maintain/SKILL.md` (they point back here for rationale).
