# Supabase Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom file-backed authentication with Supabase Auth email/OTP and server-validated bearer sessions on Agri-Sort authentication and QC/history APIs.

**Architecture:** FastAPI calls Supabase Auth REST using server-configured project URL and anon key. Signup confirmation and password recovery use Supabase email OTP verification; successful login returns Supabase access/refresh tokens. FastAPI validates access tokens with Supabase before serving protected endpoints. Frontend stores only the returned session and user profile, removes local-password fallbacks, restores/clears sessions through backend calls, and attaches bearer tokens to protected API requests. Scan history includes Supabase user ownership and RLS policies restrict each user to their own records.

**Tech Stack:** FastAPI, Python stdlib urllib, Supabase Auth REST API, React/Vite, Node test runner, unittest.

## Global Constraints

- Never commit or expose `SUPABASE_SERVICE_ROLE_KEY`; authentication requests use the project anon/publishable key.
- Authentication must fail closed when Supabase is unconfigured or unreachable.
- No fallback to browser-only password validation or authentication.
- Email ownership verification and password recovery are enforced by Supabase Auth.
- Keep endpoint payloads compatible with the current login/register page flows where practical.

---

### Task 1: Supabase Auth REST service and API tests

**Files:**
- Modify: `server/services/auth_service.py`
- Modify: `server/routers/auth.py`
- Modify: `server/tests/test_auth_api.py`
- Modify: `.env.example`
- Modify: `server/requirements.txt` only if tests prove an external client dependency is needed (prefer stdlib).

**Interfaces:**
- `AuthService.register_gmail_user(full_name, email, password)` initiates Supabase signup and returns confirmation-required response.
- `AuthService.verify_otp(email, token, purpose)` verifies Supabase `signup` or `recovery` OTP and returns session/user.
- `AuthService.login_gmail_user(email, password)` returns user and Supabase tokens.
- `AuthService.authenticate_google(id_token)` exchanges a Google ID token via Supabase Auth.
- `AuthService.get_user(access_token)` validates token remotely.
- `AuthService.reset_password(access_token, new_password)` updates the password after recovery OTP verification.
- API routes return 503 when configuration is missing and 401 for invalid credentials/tokens.

- [x] Write tests proving unconfigured auth fails closed, register cannot return an authenticated session without email verification, valid OTP yields session, and invalid bearer token is rejected.
- [x] Run focused tests and verify they fail on existing file-backed implementation.
- [x] Implement minimal Supabase Auth REST wrapper with injectable request transport for offline tests.
- [x] Add `/session` verification and adapt `/register`, `/login`, `/google`, `/send-otp`, `/verify-otp`, `/reset-password` to Supabase Auth flows. Never return a session before OTP verification.
- [x] Run focused backend tests and full auth test module.
- [x] Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` deployment configuration documentation to `.env.example`.

### Task 2: Protect QC/history routes with validated Supabase sessions

**Files:**
- Create: `server/utils/auth.py`
- Modify: `server/routers/qc.py`
- Modify: `server/routers/history.py`
- Modify: `server/tests/test_auth_api.py` or create `server/tests/test_auth_dependencies.py`

**Interfaces:**
- `get_current_user(authorization: HTTPAuthorizationCredentials)` calls `auth_service.get_user(token)` and returns the verified Supabase user; absent/invalid bearer tokens return 401.

- [x] Add tests proving missing and invalid bearer tokens receive 401 and a verified token reaches a protected route.
- [x] Run focused tests and verify they fail before route protection exists.
- [x] Require the dependency on QC scan, multi-scan, and history endpoints; leave public pricing and health routes unauthenticated.
- [x] Run focused route tests and existing QC/history tests.

### Task 3: Frontend session integration and test coverage

**Files:**
- Modify: `src/business/authStorage.js`
- Modify: `src/App.jsx`
- Modify: `src/services/scanService.js`
- Modify: `src/pages/LoginPage.jsx`
- Modify: `src/pages/RegisterPage.jsx`
- Modify: `tes/authStorage.test.js`

**Interfaces:**
- `readActiveUser()` remains a synchronous local profile read for rendering only.
- `restoreAuthSession()` validates persisted access token against `/api/v1/auth/session` and clears stale sessions.
- `getAuthHeaders()` returns bearer authorization only for protected API calls.
- `loginWithGmailBackend`, OTP verification, and Google auth persist Supabase access/refresh tokens with user profile; failures never call local auth fallback.
- Logout clears local session and calls Supabase logout/revocation endpoint.

- [x] Write tests proving failed backend login does not authenticate from localStorage and no password hash is stored locally.
- [x] Run frontend tests and verify they fail against current fallback behavior.
- [x] Implement session persistence/restoration and update register/login/recovery flows for Supabase token and OTP responses.
- [x] Attach bearer token to QC and history requests and require backend session restoration on app startup before treating a cached profile as authenticated.
- [x] Run frontend tests and production build.

### Task 4: Configuration and final verification

**Files:**
- Modify: `.env.example`
- Modify: existing deployment setup documentation only if needed.

- [x] Document required Supabase Auth settings: enable email confirmation, configure email OTP template to display `{{ .Token }}`, enable Google provider and matching OAuth client, set `SUPABASE_URL`/`SUPABASE_ANON_KEY` in local and Vercel backend environments, and run updated scan-table DDL to enable per-user RLS.
- [x] Run frontend test suite, production build, and backend test suite available in the environment.
- [x] Review final diff for service-role leakage, file-backed auth remnants, unprotected QC/history routes, and accidental changes.
