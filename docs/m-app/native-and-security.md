# Native components & security

Sources: base APK `classes*.dex` (DEX strings/method tables), Flutter plugins/assets, device split libs, Blutter outputs.

## 1. Native app surface

- **Package/activity:** `edu.vit.vitiancc` / `edu.vit.vitiancc.MainActivity` (Flutter embedding: `FlutterActivity` / delegates).
- **Flutter engine/libs (arm64 split):** `libapp.so` (Dart AOT), `libflutter.so`, `libdatastore_shared_counter.so`, `libtoolChecker.so`.
- **Frameworks/SDKs present:** Flutter, OkHttp3, Firebase (Core/Installations/Crashlytics/Sessions), Google Play Services, Paytm PGSDK + Easypay Assist, Apache Tika fetcher classes (bundled), AndroidX/Jetpack.

## 2. Networking stack & security controls

### 2.1 Dart/Flutter
- **HTTP:** Dart `dart:_http` usage with centralized `eHa` client (`_cv::XRe` executor).
- **Certificate pinning:** plugin `http_certificate_pinning` (`diefferson.http_certificate_pinning.HttpCertificatePinningPlugin`). Registration observed in DEX; pin configuration consumed in Dart layer — protects VTOP/API calls against MITM on untrusted networks (subject to pin set in build).
- **Payload protection:** request bodies for sensitive/login flows encrypted as `encData` (`sLa::Hxf`), responses decrypted/parsed (`sLa::Ixf`).
- **Request signing:** custom headers `S-API-KEY`, `S-KEY-USER` (time-bound derivation) per `eHa::Grf`.

### 2.2 Native (OkHttp3)
- Bundled `okhttp3.*`: `OkHttpClient`/builder, interceptors & network interceptors, `Cookie`/`CookieJar`, `CertificatePinner` (SHA-1/256 pinning primitives), HTTP/1.1 & HTTP/2, TLS/connection specs.
- Used by native SDKs/plugins (e.g. Paytm/Easypay) and available to platform channels.

### 2.3 Local data at rest
- **DB:** `VitianLocalDB` / `VitianDB.db`, table `VitianLocalDB(id INTEGER PRIMARY KEY, encryptedData TEXT, lastDate INTEGER)` — stores encrypted records (cached responses/session-related data).
- **Auth artifacts:** MPIN/biometric flows and tokens (FCM/session) handled in app; treat device storage as sensitive.

## 3. Third-party/service integrations

### 3.1 Paytm Easypay / PGSDK (native)
- **Classes/methods:** `easypay.appinvoke.manager.PaytmAssist` → `fetchAPIByAppVersion()`, `accessCheckApi()`, `getNetworkType()`; `EasypayWebViewClient.shouldInterceptRequest`; `com.paytm.pgsdk.PaytmPGActivity` (+ inner), `AioMatchUserActivity`.
- **Endpoints:**
  - `https://securegw.paytm.in/payassist/api/getURLByAppVersion`
  - `https://securegw-preprod.paytm.in/payassist/api/getUniqueAssist`
  - `https://securegw.paytm.in/merchant-settlement-service/paytmAssist/enable`
  - `https://securegw.paytm.in/payassist/api/submit/event/logs`
  - `https://secure4.arcot.com/acspage/cap?RID=40147&VAA=B` (3DS/ACS)
- **Role:** payment assist/config, eligibility/enablement checks, event logging, WebView interception for gateway/ACS flows.

### 3.2 Firebase / Google
- Firebase Installations/Auth tokens, Sessions, Crashlytics (e.g. settings fetch `https://firebase-settings.crashlytics.com/spi/v2/platforms/android/gmp/%s/settings`), Play Services — telemetry, diagnostics, config; FCM messaging tokens observed in app strings.

### 3.3 Embedded libraries (not app-owned endpoints)
- Apache Tika pipes/fetchers (`UrlFetcher`, `FileSystemFetcher`, `FetcherManager`, `FETCH_URL_API`) present as bundled library code; no VIT-specific remote endpoints attributed to them.

## 4. Observed protections vs. analysis implications

| Control | Effect | Implication for analysis/use |
|---|---|---|
| Dart AOT (release) | No Dart source/symbols in APK | Requires snapshot tooling (Blutter) for method/string recovery |
| TLS cert pinning | Rejects non-pinned certs | Traffic interception needs pin-aware approach or authorized test setup |
| Encrypted `encData` + custom headers | Non-trivial replay | Must reproduce `Hxf` encryption and `S-API-KEY`/`S-KEY-USER` derivation |
| Dynamic `cvf()`/session tokens | Endpoint prefix/creds rotate | Capture per session; avoid hardcoding |
| Local encrypted DB/cache | Sensitive data at rest | Handle extracts as confidential |

## 5. Responsible use
- These notes are for understanding/maintaining authorized integrations or security research on accounts and systems you are permitted to test.
- Do not bypass controls to access others’ data; comply with VIT/VTOP policies and applicable law.
