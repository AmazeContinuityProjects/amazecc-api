---
title: "VITianCC: native and security"
description: "Paytm integration, certificate pinning, local storage and the app's transport security."
---

# Native components and security

The VITianCC app is primarily Flutter/Dart, but it also includes native Android components and third-party SDKs. This document summarizes those parts and the security measures observed.

## 1. What’s inside the app (native side)

- **App identity:** Android package `edu.vit.vitiancc` (Flutter-based main activity).
- **Core runtime:** Flutter engine and the compiled app code (`libapp.so`) in the device-specific split, plus supporting native libraries.
- **Major libraries/SDKs:** Flutter, OkHttp (HTTP), Firebase (core, sessions, crash reporting, installations/messaging), Google Play services, Paytm Payment Gateway & Easypay Assist, and various Android/Jetpack libraries.

## 2. How connections are protected

### 2.1 In the Flutter (app) layer
- **Certificate pinning:** the app uses a certificate-pinning plugin so it only trusts the expected server certificate(s) when talking to the backend. This helps block man-in-the-middle interception on untrusted networks.
- **Encrypted request payloads:** sensitive requests (including login) send data inside an encrypted `encData` field rather than plain text; responses are decrypted by the app.
- **Per-request authentication:** authenticated calls include the session API key and a time-based, user-tied header (see [api-client-and-networking.md](api-client-and-networking.md)).

### 2.2 In the native (Android) layer
- **OkHttp:** bundled for HTTP on the native side, with support for interceptors, cookies, and certificate pinning—used by native components and SDKs such as the payment flow.

### 2.3 Data stored on the device
- **Local cache/database:** the app keeps an encrypted local database (`VitianLocalDB`) for cached responses and related data (records stored with an id, encrypted content, and a timestamp).
- **Sensitive items:** session-related values, tokens, MPIN/biometric state, and cached student data should all be treated as sensitive.

## 3. Third-party services the app talks to

### 3.1 Paytm (payments) – native integration
Used for in-app payment/assist flows (separate from the VTOP JSON actions described in [endpoints.md](endpoints.md)).

**What it does:** fetches payment-assist configuration for the app version, checks/enables assist, and reports payment events; payment may run in a WebView flow with 3DS/ACS verification.

**Observed endpoints:**
- `https://securegw.paytm.in/payassist/api/getURLByAppVersion` – get assist/config URL/info by app version
- `https://securegw-preprod.paytm.in/payassist/api/getUniqueAssist` – preprod/unique assist lookup
- `https://securegw.paytm.in/merchant-settlement-service/paytmAssist/enable` – enable/check assist
- `https://securegw.paytm.in/payassist/api/submit/event/logs` – submit payment/assist events
- `https://secure4.arcot.com/acspage/cap?RID=40147&VAA=B` – 3DS/ACS (card authentication) page

### 3.2 Firebase / Google
Used for app infrastructure such as crash reporting, sessions/diagnostics, configuration, and push/installation tokens (e.g. Crashlytics settings fetched from `https://firebase-settings.crashlytics.com/spi/v2/platforms/android/gmp/%s/settings`). These support app health and messaging, not the student’s academic data itself.

### 3.3 Other bundled code
Some general-purpose libraries (e.g. file/URL fetcher utilities) are packaged in the app but no VIT-specific server endpoints were attributed to them.

## 4. What this means in practice

| Protection | What it does | Practical implication |
|---|---|---|
| Compiled (release) app code | Ships without readable source | Understanding internals requires analysis tools (as used for these notes) |
| Certificate pinning | Rejects unexpected server certificates | A normal intercepting proxy won’t work unless pinning is properly handled in an authorized test setup |
| Encrypted payloads + custom auth headers | Requests aren’t plain/replayable as-is | Reproducing calls requires the same encryption and per-request header generation the app performs |
| Dynamic session path & tokens | URL segment and credentials are per-session | Capture/derive them from a fresh, valid login; don’t hardcode |
| Encrypted local cache | Stored data isn’t plain text | Treat any extracted app data as sensitive/confidential |

## 5. Responsible use
- These notes are intended for understanding the app, supporting your own authorized access, or legitimate security research on accounts and systems you’re permitted to test.
- Do not bypass protections to access anyone else’s data. Follow VIT/VTOP terms and applicable law.
