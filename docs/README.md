# Docs

Welcome. These pages explain **how Caught Looking thinks** — why we cache, how we treat public baseball APIs kindly, and how we keep the site and API honest with each other.

If you just want to **use the app**, open [caught-looking.com](https://caught-looking.com/standings). If you want to **run it on your machine**, start with the [Run locally](../README.md#run-locally) section in the root README.

## Start here by curiosity

| I’m wondering… | Read this |
| :--- | :--- |
| Why don’t we ask MLB for the same standings every second? | [ADR 0001 — cache TTLs](adr/0001-cache-ttls.md) |
| How do we avoid overwhelming league APIs? | [ADR 0002 — upstream QPS](adr/0002-upstream-qps.md) |
| How do the website and API stay in sync? | [ADR 0003 — OpenAPI contract](adr/0003-openapi-contract.md) |
| What “fast enough” means for us | [Service level objectives](slo.md) |
| What we protect, and what we deliberately don’t | [Threat model](threat-model.md) |
| How to contribute or ship a change | [Contributing](../README.md#contributing) in the root README |

Design decisions live as short **Architecture Decision Records (ADRs)** under [`adr/`](adr/). Day-to-day how-to for contributors and agents lives in [`.cursor/skills/`](../.cursor/skills/).

## A few terms, in plain words

| Term | Meaning here |
| :--- | :--- |
| **Cache / TTL** | We remember an answer for a set time so we ask upstream less often. TTL = how long that memory lasts. |
| **QPS** | Requests per second — how hard we allow ourselves to hit MLB or Baseball Savant. |
| **Singleflight** | If many people ask at once for something we don’t have cached, we fetch **once** and share the result. |
| **OpenAPI** | The shared menu of API paths and response shapes. The website’s TypeScript types and the public Redoc docs come from it. |
| **Statcast** | Pitch- and hit-tracking data (speed, launch angle, spray) from Baseball Savant. |
| **Cloud Run / Pages** | Where the API and the website live in production (Google Cloud Run and Cloudflare Pages). |

## What’s in this folder

| Path | Role |
| :--- | :--- |
| [`adr/`](adr/) | Why we chose cache TTLs, outbound rate caps, and an OpenAPI contract |
| [`slo.md`](slo.md) | Informal latency and cache-hit targets (not a paid SLA) |
| [`threat-model.md`](threat-model.md) | Assets, threats, controls, and residual risks |

The root [README](../README.md) is the front door: product tour, local setup, stack, and contribution path.
