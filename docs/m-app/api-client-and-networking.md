# API client & networking

Source of truth (recovered): Blutter `asm/aAh.dart` (`class eHa`), `asm/*Ch.dart` call sites, `pp.txt`; native: `classes*.dex` (OkHttp/Paytm), Flutter plugin `http_certificate_pinning`.

## 1. Base URL and routing

- **Backend base:** `https://vtopcc5.vit.ac.in/` (object pool string)
- **Dynamic prefix:** `cvf()` on `tLa` (`tLa._dEb` initialized lazily, awaited). Most requests target:
  - `URL = base + cvf() + action` (e.g. `https://vtopcc5.vit.ac.in/{cvf()}{action}`)
- **Login (exception):** full static URL `https://vtopcc5.vit.ac.in/login/vitian/appLoginProcess`

> `cvf()` is resolved at runtime from app/config/session state (`tLa`); capture it from a live session (or from decrypted/config responses) when replaying calls. Do not assume it is empty or constant across sessions/builds.

## 2. Core client: `eHa` (`asm/aAh.dart`)

`eHa` centralizes connectivity checks, header construction, (optional) auth, JSON encoding, request dispatch, response handling/decryption, caching, and session-expiry behavior.

### 2.1 Auth header builder — `Grf()` (async) → `Map<String,String>`
- `S-API-KEY` = `Crf()` → `await tLa::Pxf()` (instance field; API key/token material)
- `S-KEY-USER` = `Drf()` → builds and encodes a signed/time-bound value:
  - computes `timestamp_ms` via `ja::_NYa/pZa` (current epoch ms)
  - fetches user/credential component via `tLa::Euf()`
  - composes string: `"{timestamp}|{Euf()}|vitian"`
  - encodes/encrypts with `uLa::Hv(...)` → header value
- `Crf()`/`Drf()` depend on late-static `tLa._dEb` and per-session values (`Pxf/Euf`); headers are therefore **session/time-derived** and must be generated fresh per request/session context.

### 2.2 Main executor — `zrf(...)` (async)
Invoked by all wrappers; performs the actual HTTP call via `_cv::XRe(...)` (Dart HTTP client/transport wrapper).

**Key behaviors (from asm):**
- **Connectivity:** checks network via `rLa::mxf()`; aborts/fails gracefully if offline (surfaces "No proper Internet Connection..." flows).
- **Headers:** starts with `content-type: application/json; charset=UTF-8`; merges caller-supplied headers; when `Brf` (auth flag) is true, merges `Grf()` (adds `S-API-KEY`, `S-KEY-USER`).
- **Body:** JSON-encodes the parameter/body map (`dart:convert`/`Nnb`/equivalent) and attaches to request.
- **Method/type:** request object `yv` created with type `tv` indicating POST-style submission to `XRe(url, body, request, ...)`.
- **Timeout:** optional `timeout` (e.g. ~5,000,000 µs / 5s via `ka` + `_Future.timeout`) depending on `rrf`/flags.
- **Response handling:** reads status/body; on success may decode/decrypt (`sLa::Ixf`) and return parsed data; on certain failures maps to `hHa`/error states with user-facing messages (e.g. "Invalid request. Please login again.", "Request timed out...").
- **Caching (local DB):** integrates with `jHa` (e.g. `qnf`/`yrf`/`Dxf`/`Fxf`) storing entries keyed by request/action with timestamps (`gGa`) to serve cached data and/or support resilience.
- **Session expiry / re-auth:** on invalid/expired session responses, triggers navigation to sign-in (`/sign_in_page`, `package:vtop/main.dart` navigator) via closures in `Erf/_rvb` flow; retries/recursion controlled by `xrf`/`rrf`.

### 2.3 Request wrappers (public/internal API methods)

| Method | Signature (recovered) | URL | Body / params | Auth headers | Notes |
|---|---|---|---|---|---|
| `qrf` | `(this, paramsMap, path, {rrf=true})` async | `base + cvf() + path` | JSON map = `paramsMap` + injected `applNo` (`vLa::Kxf("applNo")`) | via `zrf` (default auth on) | General-purpose authenticated action call |
| `prf` | `(this, path, data)` async | `base + cvf() + path` | `{"encData": Hxf(jsonEncode(data))}` (encrypted) | via `zrf` | Sensitive/data actions using encrypted envelope |
| `nrf` | `(this, path, data, body)` async | `base + cvf() + path` | encrypted/structured (uses `encData`/`zrf` path) | via `zrf` | Variant used for specific flows |
| `orf` | `(this, loginData)` async | `https://vtopcc5.vit.ac.in/login/vitian/appLoginProcess` | `{"encData": Hxf(jsonEncode(loginData))}` | `Brf=false, rrf=false` | Login (no session headers/limited retry) |
| `Hrf` | `(this, formData, file/parts)` async | `base + cvf() + "postGrievanceForm"` | multipart/form-data (file upload + fields) | `Grf()` merged explicitly | Grievance submission with attachments |
| `srf/vrf/wrf` | (async variants) | `base + cvf() + path` (or specific composition) | JSON / `encData` depending on variant | per variant | Specialized actions; routed through `zrf` |
| `Erf/_rvb` | helpers | n/a | n/a | n/a | Error/redirect/retry & UI navigation helpers |

> `Hxf`/`Ixf` (`sLa`) perform payload encryption and response decryption/interpretation respectively. Exact cipher/mode/padding/IV and key sourcing are in Dart/native crypto helpers not fully string-lifted here; `encData` is the on-wire encrypted blob.

## 3. Common request pattern (reconstructed)

1. Ensure session/config initialized (`tLa` / `cvf`, `Pxf/Euf`, `applNo`).
2. Build action name `path` (e.g. `examScheduleView`, `myProfileInfo`) and params/body.
3. Choose wrapper:
   - `qrf` for plain JSON + `applNo` actions.
   - `prf/nrf/srf/vrf/wrf` for encrypted `encData` or special forms.
   - `orf` for login; `Hrf` for multipart grievance upload.
4. Client adds `content-type: application/json; charset=UTF-8`, derives `S-API-KEY`/`S-KEY-USER` (when required), POSTs to `base+cvf()+path`.
5. Handle decrypted response or session-expiry (re-login).

## 4. Native/network transport & pinning

- **`http_certificate_pinning` plugin** (`diefferson.http_certificate_pinning.HttpCertificatePinningPlugin`): enforces TLS certificate pinning for app HTTP(S) calls (pin set/config in Dart/app config; not exposed as plaintext in snapshot).
- **OkHttp3 (bundled):** `OkHttpClient` with interceptors, `CookieJar`, `CertificatePinner` available to native/SDK flows.
- **Connectivity & errors:** timeouts, "Server error/bad syntax", "Request timed out. Slow internet or Server is busy..." surfaced to UI.

## 5. Best-use guidance

- **Always mirror session semantics:** obtain/refresh `cvf()`, `applNo`, `S-API-KEY`/`S-KEY-USER` from a legitimate authenticated session; never reuse stale time-bound headers.
- **Respect encryption:** for `prf/nrf/orf/wrf` paths, send the same `encData` envelope (correct key/IV/algo derived as the app does) — plaintext bodies will be rejected.
- **Rate/behavior:** client enforces ~5s timeouts, retries, and caching; avoid aggressive parallel polling against VTOP.
- **Session handling:** detect "Invalid request. Please login again." / 401-like states and re-authenticate instead of blind retries.
- **Pinning:** direct replay tooling must account for certificate pinning (use the app’s pinned channel or an authorized test environment).
- **Compliance:** interact only with your own account/data and in accordance with VIT/VTOP terms of use.
