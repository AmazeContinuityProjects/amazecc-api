---
title: "VITianCC: API client and networking"
description: "How the app builds request URLs, authenticates, encrypts payloads and caches responses."
---

# How the app talks to the server (networking)

This describes the single, shared networking layer the Flutter app uses for VTOP requests: how it builds URLs, authenticates, encrypts data, sends requests, and handles responses. (Original recovered identifiers are listed in the technical reference at the end.)

## 1. Where requests go (URLs)

- **Server:** `https://vtopcc5.vit.ac.in/`
- **Most actions:** the app builds the URL as  
  **`https://vtopcc5.vit.ac.in/` + `<session path segment>` + `<action name>`**  
  The middle piece (a session/config-specific path segment) is **not hardcoded**—the app resolves it at runtime from the logged-in session/configuration. You must use the value from a valid session; don’t assume it’s empty or fixed.
- **Login (special case):** uses a fixed, full URL:  
  **`https://vtopcc5.vit.ac.in/login/vitian/appLoginProcess`**

**Action name** means the server operation being requested (e.g. fetching an exam schedule or profile). See [endpoints.md](endpoints.md) for the recovered action names.

## 2. The shared API client (what every request goes through)

All VTOP calls flow through one central service in the app that takes care of: checking connectivity, building headers, attaching authentication, formatting/encrypting the body, sending the HTTP request, reading/decrypting the response, caching results, and reacting to expired sessions.

### 2.1 Authentication headers (added to most requests)

For authenticated requests the app computes and sends two custom headers on each call:

| Header | What it represents | How it’s produced (inferred) |
|---|---|---|
| `S-API-KEY` | A session API key/token | Fetched from the app’s session/config state after login |
| `S-KEY-USER` | A time-bound, user-tied signature | Built from the current timestamp, a session/user value, and the string `vitian`, then encoded/encrypted (e.g. conceptually `encode("{timestamp_ms}|{user_value}|vitian")`) |

Because `S-KEY-USER` includes the current time and session material, **headers are effectively one-time/time-sensitive**—generate them fresh for each request in a valid session rather than reusing old ones.

### 2.2 What the request looks like on the wire

- **Method:** POST
- **Content type:** `application/json; charset=UTF-8` (for JSON actions); grievance submission with attachments uses `multipart/form-data`
- **Body formats (depending on the action):**
  - **Plain JSON parameters** – a JSON object of parameters, with the student’s **application number** automatically added by the client.
  - **Encrypted payload** – the parameters are JSON-encoded, encrypted, and sent as `{ "encData": "<encrypted_blob>" }`. (Login always uses this form.)
  - **Multipart form** – form fields plus file attachment(s) for grievance submission.
- **Timeout:** requests are given a short timeout (around 5 seconds in the recovered behavior) and may be retried/cancelled according to the call type.
- **Transport:** sent through the app’s HTTP executor over HTTPS (with certificate pinning enforced by the app).

### 2.3 How responses are handled

- The client reads the status and body, then **decrypts/decodes** the response where applicable before returning it to the app.
- On success the data is shown in the UI and **cached locally** (in an encrypted on-device database, keyed with timestamps) so it can be reused or help with intermittent connectivity.
- On failure it maps errors to user messages (e.g. network issues, timeouts, “Invalid request. Please login again.”, server errors).

### 2.4 Session expiry and re-authentication

If the server indicates the session is invalid/expired, the client stops treating it as a normal data error: it clears/refreshes the relevant state and **navigates the user back to the sign-in screen** so they can log in again. After a fresh login, the session path segment, headers, and application number are regenerated and requests work again.

## 3. Request types the app uses

The app chooses a request style based on what the action needs:

| Request style | When it’s used | URL | Body | Auth headers |
|---|---|---|---|---|
| **Login request** | Signing in | Fixed login URL | Encrypted payload `{ "encData": ... }` | No pre-existing session headers |
| **Standard data/action request** | Most “get data / do action” calls | `base + session path + action` | JSON parameters + application number | Yes (API key + signed user header) |
| **Encrypted data request** | Sensitive actions (and some data calls) | `base + session path + action` | Encrypted payload `{ "encData": ... }` | Yes |
| **File upload request** | Submitting a grievance with attachments | `base + session path + postGrievanceForm` | Multipart form data + files | Yes |
| **Other specialized variants** | Specific flows | `base + session path + action` | JSON or encrypted, per flow | Per flow |

## 4. Typical request flow (end to end)

1. **Confirm session:** have a valid logged-in session so the app knows the session path segment, can compute auth headers, and knows the student application number.
2. **Pick the action:** choose the server action name for the screen/task (e.g. exam schedule, profile, attendance).
3. **Build the body:** assemble parameters; the client adds the application number for standard calls, or encrypts the whole payload into `encData` for encrypted/login calls.
4. **Attach headers & send:** set JSON content type, add `S-API-KEY` and `S-KEY-USER` when required, POST to the composed URL.
5. **Process the result:** decrypt/parse the response, use/cache it; if the session is rejected, prompt sign-in again.

## 5. Transport security and native networking

- **Certificate pinning:** the app uses the `http_certificate_pinning` Flutter plugin so HTTPS connections to the backend are pinned (the connection is rejected if the certificate doesn’t match what the app expects).
- **Native HTTP stack:** the Android side bundles OkHttp (with support for interceptors, cookies, and certificate pinning) used by native components/plugins (e.g. payments).
- **On-device storage:** cached API data is stored in an encrypted local database (`VitianLocalDB`, table storing an id, encrypted data, and a timestamp).

## 6. Practical guidance

- **Treat the session as dynamic:** the session path segment, API key, signed user header, and application number come from a real, current login—refresh them when you re-authenticate.
- **Match the request style:** actions that expect an encrypted `encData` body or multipart upload will not work with a plain JSON body.
- **Be gentle and correct:** keep timeouts/retry behavior reasonable, don’t hammer the server, and always handle “session expired / please log in again” by re-authenticating.
- **Mind pinning:** any custom client or proxy must account for certificate pinning to connect successfully.
- **Stay authorized:** only access your own account/data and follow VIT/VTOP terms and applicable law.

## Technical reference (recovered identifiers)
Central client `eHa` (`asm/aAh.dart`): dynamic path `cvf()` (`tLa`), headers `Grf()`→`S-API-KEY`/`S-KEY-USER` via `Crf()`/`Drf()` (`tLa::Pxf/Euf`, `uLa::Hv`), core executor `zrf()`→`_cv::XRe`, wrappers `orf` (login), `qrf` (standard, injects `applNo` from `vLa::Kxf`), `prf/nrf/srf/vrf/wrf` (encrypted/variants), `Hrf` (multipart `postGrievanceForm`), helpers `Erf/_rvb`; crypto `Hxf` (encrypt) / `Ixf` (decrypt) (`sLa`); cache `jHa`/`gGa`, DB `VitianLocalDB`.
