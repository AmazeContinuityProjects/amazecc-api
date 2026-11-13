---
title: "Response shapes: Transport & Buses"
description: "Every response body the bus directory and VTOP transport registration return, field by field."
---

# Response shapes: Transport & Buses

> **In one line:** two routes - a public bus directory that's hard to break, and a VTOP transport-registration scrape whose "errors" are usually still HTTP 200.

## POST /api/transport

**Envelope:** mixed - success enveloped; **every error is also HTTP 200** except 400 · 200 / 400 · reference: [transport](../../03-api-reference/transport-buses/transport.md)

Success:
| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `hasRegistration` | boolean | `true` iff a bus route was found AND payment status parsed |
| `registerNumber` | string? | only when the page has the label |
| `name`, `programme`, `branch` | string? | spread-in from the VTOP page's student row |
| `routeSelected` | string? | "Route Selected" cell |
| `fpReference` | string? | "FP Reference Number" |
| `paymentStatus` | string? | "Payment Status" |
| `busRouteId` | string | hidden `#busRouteId` input - `""` if absent |
| `busUrl` | string | live GPS share link from `/vtop/transport/trackMyBus` (vamosys.com); `""` on any failure - never fatal |
| `qrCode` | string | `data:image/...;base64,…` from `#qrAttendance img` - `""` if none |
| `pageCsrf` | string | `_csrf` from the transport page (falls back to request csrf) |

Failure (all **HTTP 200** unless noted): `{ hasRegistration: false, error: "Empty response from VTOP" }` · `{ hasRegistration: false, error: <msg> || "Failed to fetch transport data" }` · 400 `{ error: "Missing csrf or authorizedID" }` (**400, no success field**).
**Typed?** No - `src/types/transport.ts` types the buses feature, not this response.

<Warning>Clients **must** check `hasRegistration`/`error` in a 200 body - the HTTP status tells you nothing here.</Warning>

## GET /api/buses

**Envelope:** success-wrapped (public, no auth) · **always 200** · reference: [buses](../../03-api-reference/transport-buses/buses.md)

Success: `{ success: true, buses, rules }` - plus `{ error: "Internal server error" }` on the outer catch **with `success:true` still set** (the two keys coexist).

`buses[]` - shape varies by source, all three DB paths normalized-ish:
| Path | Row shape |
|---|---|
| `buses_v2` (preferred) | `{id (route_number, string), type, route (route_name), driverName, driverPhone, whatsappGroup, busLocation, supervisorName, supervisorPhone, driverInchargeName, driverInchargePhone, stops: JSONB[], placements: JSONB[], boardingPoints: string[] (stop names)}` |
| `bus_stops` fallback | same minus placements/supervisor fields; `stops: []` |
| legacy `buses` | `{id, type, route, boardingPoints, driverPhone, driverName, whatsappGroup, busLocation, stops: []}` |
| JSON-file fallback | raw bundled default JSON; `rules: []` |

`rules[]` - raw `transport_rules` rows ordered by `rule_number`; `[]` when the table is missing/broken.
**Typed?** Client-side mirror types only (`BusRoute`, `BusStop`, `BusPlacement`, `TransportRule` in `src/types/transport.ts`) - rows come back verbatim.
