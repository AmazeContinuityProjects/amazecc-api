# VITianCC Mobile App – How It Works (Reverse-Engineering Notes)

This folder documents what the **VITianCC** Android app (`edu.vit.vitiancc`) does, how it talks to VIT’s servers, how login works, and how its main features behave. It is written from a static analysis of the app (APK + device split, including the compiled Flutter code) so you can understand the app in plain language.

**At a glance**
- **App:** VITianCC (VIT Chennai student app), Flutter-based Android app
- **Main server:** `https://vtopcc5.vit.ac.in/` (VTOP)
- **What it does:** lets a student sign in and view/manage academics (attendance, timetable, exams, marks/grades/CGPA), proctor/faculty info, grievances, hostel/leave, profile, notifications, and wallet/payments
- **How it talks to the server:** HTTPS POST requests with JSON bodies, a dynamic session-specific URL path, custom authentication headers, and (for many requests) an encrypted request payload

> **A note on confidence:** These notes come from reverse-engineering the shipped app. Action/endpoint names and the overall request/login flow are clear; exact field-by-field request/response schemas for some calls are inferred and should be confirmed with your own authorized testing.

## Document map

| Document | What you’ll find |
|---|---|
| [login-and-auth.md](login-and-auth.md) | How sign-in works, what the app sends to log in, how sessions/headers are created, MPIN/biometric/OTP, and what happens when a session expires |
| [api-client-and-networking.md](api-client-and-networking.md) | How the app builds URLs, adds authentication, encrypts/decrypts data, sends requests, caches responses, and handles errors/timeouts |
| [endpoints.md](endpoints.md) | A catalog of the server actions the app calls, what each is for, and practical guidance on using/interpreting them correctly |
| [business-logic.md](business-logic.md) | How the app’s features fit together (dashboard, academics, proctor, grievances, hostel, wallet, etc.) and the rules/flows behind them |
| [native-and-security.md](native-and-security.md) | Non-Flutter parts: payment (Paytm) integration, certificate pinning, local storage, and other security/transport details |

## Big picture

1. **You sign in** on the VTOP login endpoint with your credentials packaged inside an encrypted payload. If successful, the server returns session information the app needs for future calls.
2. **The app prepares each request** by: picking the right server action, building the full URL (using a session-specific path segment the server/app provides), adding required authentication headers and your student/application identifier, and encrypting the body when the action requires it.
3. **The server responds** with data (often encrypted/encoded in the app’s format). The app decrypts/reads it, shows it on the relevant screen, and saves a copy locally so it can be faster or work better on flaky connections.
4. **If your session expires** (or the server rejects the request as invalid), the app treats it as a sign-in problem and takes you back to the login screen so you can authenticate again.

## Tips for reading these docs

- Start with [login-and-auth.md](login-and-auth.md) to understand sessions, then [api-client-and-networking.md](api-client-and-networking.md) for the request pattern, then [endpoints.md](endpoints.md) for specific actions.
- When a detail is marked “inferred”, it means the behavior is strongly indicated by the app but the exact on-wire field names weren’t fully spelled out in the compiled app.
- Use this information only for your own account and in line with VIT/VTOP policies and applicable law.

## Technical reference (original recovered names)
For traceability to the reverse-engineered code (kept out of the main text): the central API client class is `eHa` (`asm/aAh.dart`), request helpers/methods include `orf` (login), `qrf` (standard action), `prf/nrf/srf/vrf/wrf` (encrypted/variant actions), `Hrf` (multipart upload), `zrf` (core executor, calls `_cv::XRe`), `Grf/Crf/Drf` (auth headers), `cvf` (dynamic path via `tLa`), `applNo` via `vLa::Kxf`, crypto helpers `Hxf/Ixf` (`sLa`), `Hv` (`uLa`), local cache `VitianLocalDB`/`jHa`.
