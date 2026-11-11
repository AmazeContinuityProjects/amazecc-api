# VITianCC (VITian CC) Mobile App – Reverse-Engineering Notes

**Package:** `edu.vit.vitiancc` (main activity: `edu.vit.vitiancc.MainActivity`)  
**Platform:** Flutter (Dart AOT, release)  
**Backend host:** `https://vtopcc5.vit.ac.in/`  
**Analyzed artifacts:** base APK + device split APKs (incl. `split_config.arm64_v8a.apk` → `libapp.so`), decompiled/analyzed with Blutter (Dart 3.10.4, android arm64) plus static DEX/native analysis.

> **Scope & confidence:** Dart method bodies are recovered at the disassembly/object-pool level (Blutter `asm/`, `pp.txt`), not original source. Endpoint/action names, request shapes, headers, encryption, and flows below are derived from those artifacts and string/symbol evidence; treat them as high-confidence inferences to be validated against live traffic where exact payload schemas are needed.

## Documents

| Document | Contents |
|---|---|
| [api-client-and-networking.md](api-client-and-networking.md) | Core HTTP client (`eHa`), URL construction, headers/auth, encryption (`encData`), caching, retry/session handling, certificate pinning |
| [login-and-auth.md](login-and-auth.md) | Login endpoint & flow, token/header derivation, MPIN/biometric/OTP, session expiry & re-auth behavior |
| [endpoints.md](endpoints.md) | Catalog of recovered server actions/endpoints, how to interpret/call them, best-use guidance per domain |
| [business-logic.md](business-logic.md) | Feature modules, data domains, local storage, and app behavior/workflows |
| [native-and-security.md](native-and-security.md) | Native (DEX/OkHttp) components, Paytm assist integration, Firebase, transport/security notes |

## High-level architecture

- **UI/app logic:** Flutter/Dart (`package:vtop/main.dart`, `libapp.so`). Screens/routes cover login, dashboard, attendance, timetable, exams, grades/marks/CGPA, proctor/faculty, courses/assignments, grievance, hostel, wallet/payments, profile, calendar, notifications.
- **Networking:** Centralized Dart API client `eHa` (`asm/aAh.dart`) issuing HTTPS POST JSON requests to `base + cvf() + <action>` (login uses fixed full URL). Requests often carry encrypted payloads (`encData`) and custom auth headers (`S-API-KEY`, `S-KEY-USER`). Dart HTTP is backed by the `http_certificate_pinning` plugin; native side bundles OkHttp3.
- **State/persistence:** Encrypted local DB `VitianLocalDB` (`VitianDB.db`) for cached responses/data; runtime-derived keys/tokens; FCM token support.
- **Payments:** Native Paytm Easypay/PGSDK assist (WebView/interception + Paytm APIs) alongside in-app wallet flows that talk to VTOP.

## How to use these notes

- For **reproducing/consuming an endpoint**, start with [endpoints.md](endpoints.md) (action name, wrapper/method, request shape) and [api-client-and-networking.md](api-client-and-networking.md) (headers, encryption, `applNo`/`cvf()` behavior).
- For **auth/session**, see [login-and-auth.md](login-and-auth.md) — most actions require a valid logged-in session context and the computed `S-API-KEY`/`S-KEY-USER` headers.
- Exact on-wire schemas for some actions are not fully stringified in the snapshot; validate/confirm field names and responses via controlled, authorized testing against your own account/environment.
