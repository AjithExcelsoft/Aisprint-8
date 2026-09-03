Date created: 2026-08-30
Date last modified: 2026-09-03

# Register / Login / Logout - Technical PRD

## Overview/Problem

Teachers building a collaborative quiz test bank need a secure way to create accounts and sign in before they can contribute questions. Today the application has no user identity layer — anyone who reaches the app sees the same unauthenticated experience, and there is no database table to store teacher profiles or credentials.

Sprint #1 establishes the minimum authentication foundation: user registration, login, logout/navigation, a persistent `users` table in Cloudflare D1, and a user service with only the operations required by those flows. After signing in or registering, the user is redirected to a static placeholder page that will eventually host MCQ functionality. Nothing beyond that is built in this sprint.

---

## Hypothesis

We believe that providing simple email/username-based registration and login with securely hashed passwords will give teachers a reliable identity foundation so that future phases can attach quiz and test-bank features to authenticated users.

---

## Scope

### In Scope (Sprint #1 only)

This sprint is strictly limited to the following. Do not build adjacent functionality because it may be useful later.

**Authentication flows**

- User registration via `POST /api/auth/register`
- User login via `POST /api/auth/login`
- Logout/navigation via `POST /api/auth/logout` (redirect-only; see Authentication Model)
- Redirect-only post-auth navigation to `/mcq` after successful register or login

**Minimum user data layer**

- Cloudflare D1 `users` table with columns required for register/login (see Database Schema)
- D1 migration for the `users` schema
- `src/lib/password.ts` — hash and verify functions using Web Crypto PBKDF2
- `UserService` in `src/lib/services/` with **only** the methods required by register and login (see UserService)
- Secure password hashing before storage; plaintext passwords are never persisted

**UI (login/register and placeholder only)**

- Registration page (`/register`) with form validation
- Login page (`/login`) with form validation
- Minimal MCQ placeholder page (`/mcq`) — static content and logout button only
- Home page (`/`) redirecting or linking to login/register

**Validation and errors**

- Request validation on API routes (Zod intended — see Dependencies; requires explicit approval before install)
- Basic error handling and user-facing error messages

**Testing (required deliverable — TDD)**

- Vitest as the unit/integration test framework
- `@cloudflare/vitest-plugin` for Workers-runtime and in-memory D1 testing
- Test-driven development: write failing tests at the start of each phase, implement until green
- Automated coverage for password hashing, UserService, and all auth API routes
- Manual verification for UI flows and scenario 10 (direct `/mcq` access)

### Out of Scope

What is explicitly not being built in Sprint #1:

- MCQ creation, editing, listing, or test-bank functionality
- Multiple-choice question data model or UI beyond a static placeholder
- Teacher collaboration features (sharing, permissions, teams)
- Social / OAuth login (Google, Microsoft, etc.)
- Cookies, JWTs, server-side sessions, or any persistent auth state
- Password reset or email verification flows
- Role-based access control (admin vs teacher)
- User profile editing UI
- `UserService.updateUser` or `UserService.deleteUser`
- Route protection middleware that blocks unauthenticated access to `/mcq`
- Personalized welcome or user-specific content on `/mcq`
- `getUserById` or other read methods not required by register/login
- Playwright or other browser E2E automation
- Any feature not directly required to register, log in, log out, or navigate after auth

### Cut

Things that were considered during planning but deliberately removed (and why):

- **`UserService.updateUser` and `deleteUser`** — Not required for register, login, or logout in Sprint #1. Deferred to a future sprint when profile or account management is in scope.
- **`getUserById`, `getUserByUsername`, `getUserByEmail` as separate methods** — Login needs a single lookup by username-or-email; separate read methods add surface area with no Sprint #1 caller.
- **`updated_at` column** — Exists only to support updates; omitted from Sprint #1 schema.
- **User object in API success responses** — With no session and no personalized UI, returning user data from register/login adds complexity without a consumer. Success responses return `{ success, redirect }` only.
- **Personalized first-name welcome on `/mcq`** — Requires carrying user state across navigation; incompatible with the no-session model and out of Sprint #1 scope.
- **JWT access/refresh tokens** — Deferred to a future session-management phase.
- **HTTP cookies and server-side sessions** — Sprint #1 uses redirect-only auth; persistent sessions deferred.
- **bcrypt via new npm dependency** — Password hashing uses Web Crypto PBKDF2 (native to Workers; no new package).
- **Server Actions instead of API routes** — User requested register, login, and logout endpoints; forms POST to API routes.
- **Building CRUD or read APIs beyond auth** — User service is not a general-purpose user admin layer in this sprint.
- **Testing as a final-only phase** — Tests are written at the start of each phase (TDD), not bolted on at the end.

---

## Test-Driven Development Approach

Sprint #1 follows **test-driven development (TDD)** using **Vitest**. Tests are written at the **beginning** of each implementation phase, run while still failing (red), then implementation proceeds until those tests pass (green). Passing tests plus the acceptance criteria for that phase are the signal that the phase is complete.

### TDD workflow per phase

```
1. RED    — Write tests for the phase's deliverables; run `npm test` → tests fail
2. GREEN  — Implement the minimum code to make those tests pass
3. VERIFY — Run `npm test` again → tests pass; check phase acceptance criteria
4. NEXT   — Move to the next phase; repeat
```

### Testing stack (approved)

| Package | Purpose |
|---------|---------|
| **`vitest`** | Test runner, assertions, mocking (`vi.mock`) |
| **`@cloudflare/vitest-plugin`** | Runs tests in the Workers runtime with in-memory D1 via Miniflare |

Use `@cloudflare/vitest-plugin` (the current package name; replaces `@cloudflare/vitest-pool-workers`).

### Test infrastructure files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest + Workers pool config; in-memory D1; `@/` alias |
| `test/apply-migrations.ts` | Applies D1 migrations before tests; clears `users` between tests |
| `test/env.d.ts` | Types for `cloudflare:test` (`env.DB`, `env.TEST_MIGRATIONS`) |
| `test/tsconfig.json` | TypeScript config for test files |

### Mocking pattern for route and service tests

`getCloudflareContext()` does not work natively in Vitest. Tests mock it to inject the in-memory `env.DB`:

```typescript
import { env } from "cloudflare:test";
import { vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env })),
}));
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run full Vitest suite once (`vitest run`) |
| `npm run test:watch` | Run Vitest in watch mode during development |

### What is automated vs manual

| Area | Approach |
|------|----------|
| Password hashing/verification | Vitest (`src/lib/password.test.ts`) |
| UserService | Vitest (`src/lib/services/user-service.test.ts`) |
| Register/login/logout API routes | Vitest (`src/app/api/auth/**/route.test.ts`) |
| D1 schema | Vitest (`test/schema.test.ts`) |
| UI pages (register, login, mcq) | Manual via `npm run preview` |
| Direct `/mcq` access (scenario 10) | Manual via `npm run preview` |

---

## Technical Requirements

### Database Schema

Database binding name: `DB` (standard D1 convention for this project).

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
```

**Column notes:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Auto-generated UUID-like hex string |
| `first_name` | TEXT | Required; collected at registration |
| `last_name` | TEXT | Required; collected at registration |
| `username` | TEXT | Required, unique; may be an email address |
| `email` | TEXT | Required, unique; may match `username` |
| `password_hash` | TEXT | PBKDF2 output stored as `{salt}:{iterations}:{hash}` (base64) |
| `created_at` | DATETIME | Set on insert |

**Setup steps (implementation — not started):**

1. `npx wrangler d1 create quiz-maker-db` (or project-specific name)
2. Add `d1_databases` block to `wrangler.jsonc` with binding `DB`
3. `npx wrangler d1 migrations create quiz-maker-db create_users_table`
4. Place the SQL above in the generated migration file
5. `npx wrangler d1 migrations apply quiz-maker-db --local`
6. `npm run cf-typegen`

---

### Authentication Model (Sprint #1 — temporary redirect-only flow)

Sprint #1 uses a **temporary redirect-only authentication flow**. It deliberately does **not** introduce cookies, JWTs, server-side sessions, or any mechanism that persists auth state across requests or browser restarts.

**How each flow works:**

1. **Register** — Validates input, hashes password, creates user in D1, returns `{ success: true, redirect: "/mcq" }`. Client navigates to `/mcq`.
2. **Login** — Looks up user by username or email, verifies password hash, returns `{ success: true, redirect: "/mcq" }`. Client navigates to `/mcq`.
3. **Logout** — Returns `{ success: true, redirect: "/login" }`. Client navigates to `/login`.

**Explicit limitations (accepted for Sprint #1):**

| Limitation | Explanation |
|------------|-------------|
| **`/mcq` is not protected** | Any visitor who knows the URL can load `/mcq` directly. There is no server-side check for prior login or registration. |
| **Logout does not invalidate a session** | No persistent session exists. Logout is navigation only — it sends the user to `/login` but does not revoke credentials or block future direct access to `/mcq`. |
| **No "logged in" state after navigation** | Closing the tab, refreshing `/mcq`, or opening `/mcq` in a new tab does not reflect whether the user previously registered or logged in. |
| **Temporary by design** | This model is a Sprint #1 scaffold. A future sprint will add session management and route protection. |

---

### API Endpoints

#### POST /api/auth/register

Creates a new user account via `UserService.createUser`.

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "jane.smith@school.edu",
  "email": "jane.smith@school.edu",
  "password": "SecurePass123"
}
```

**Validation rules:**

- `firstName`, `lastName` — required, 1–100 characters
- `username` — required, 3–100 characters, alphanumeric plus `.`, `_`, `@`, `-`
- `email` — required, valid email format
- `password` — required, minimum 8 characters

**Response:**

- Success (201): `{ "success": true, "redirect": "/mcq" }`
- Error (400): Validation failure — `{ "error": "Validation failed", "details": [...] }`
- Error (409): Username or email already exists — `{ "error": "Username or email already in use" }`
- Error (500): Server error — `{ "error": "Internal server error" }`

Password and `password_hash` are never returned.

---

#### POST /api/auth/login

Authenticates an existing user via `UserService.getUserByUsernameOrEmail` and `verifyPassword`.

**Request Body:**

```json
{
  "usernameOrEmail": "jane.smith@school.edu",
  "password": "SecurePass123"
}
```

The server looks up the user where `username = ?1 OR email = ?1`.

**Response:**

- Success (200): `{ "success": true, "redirect": "/mcq" }`
- Error (400): Validation failure
- Error (401): Invalid credentials — `{ "error": "Invalid username/email or password" }` (same message for unknown user and wrong password)
- Error (500): Server error

---

#### POST /api/auth/logout

Sign-out navigation endpoint. No server-side state to clear.

**Request Body:** none required

**Response:**

- Success (200): `{ "success": true, "redirect": "/login" }`

---

### UserService

Location: `src/lib/services/user-service.ts`

All D1 access for users in Sprint #1 goes through this service. Route handlers must not query `users` directly.

**Sprint #1 interface only — no update, delete, or extraneous read methods:**

```typescript
export type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string; // plaintext — hashed inside createUser before insert
};

// Methods required by Sprint #1 auth flows
createUser(input: CreateUserInput): Promise<Omit<UserRecord, "passwordHash">>
getUserByUsernameOrEmail(identifier: string): Promise<UserRecord | null>
```

**Password handling:**

- `createUser` calls `hashPassword()` from `src/lib/password.ts` before insert.
- Login route handler calls `getUserByUsernameOrEmail`, then `verifyPassword()` from `src/lib/password.ts`.
- Plaintext passwords exist only in memory during the request lifecycle.
- `passwordHash` is internal to the service layer and is never exposed in API responses.

---

### User Interface Requirements

#### Registration Page (`/register`)

- Form fields: First Name, Last Name, Username, Email, Password, Confirm Password
- Client-side validation mirrors server rules; Confirm Password must match Password
- Submit POSTs to `/api/auth/register`
- On success: navigate to `/mcq`
- On error: display inline error message(s)
- Link to login page: "Already have an account? Log in"

#### Login Page (`/login`)

- Form fields: Username or Email, Password
- Password field uses `type="password"` (masked input)
- Submit POSTs to `/api/auth/login`
- On success: navigate to `/mcq`
- On error: display "Invalid username/email or password"
- Link to register page: "Don't have an account? Register"

#### MCQ Placeholder Page (`/mcq`)

- Static placeholder only — no user-specific content
- Heading: "MCQ Test Bank" (or similar)
- Short message: "Multiple-choice question features coming soon."
- Logout button that POSTs to `/api/auth/logout` and navigates to `/login`
- Minimal styling using existing shadcn/ui components (`Button`, `Card`, etc.)
- No welcome message, no stored user state, no client persistence

#### Home Page (`/`)

- Redirect to `/login`, or show links to Register and Login

---

## Testing and Verification Plan

Testing is a **required Sprint #1 deliverable**, integrated into every phase via TDD — not deferred to the end.

### Required test scenarios

Each scenario must pass before Sprint #1 is considered complete:

| # | Scenario | Expected result | Automated (Vitest) | Manual |
|---|----------|-----------------|-------------------|--------|
| 1 | Successful registration | 201, redirect `/mcq`, user row in D1 | Yes | Preview |
| 2 | Duplicate registration (username) | 409, no duplicate row | Yes | — |
| 3 | Duplicate registration (email) | 409, no duplicate row | Yes | — |
| 4 | Login with username | 200, redirect `/mcq` | Yes | Preview |
| 5 | Login with email | 200, redirect `/mcq` | Yes | Preview |
| 6 | Invalid credentials (wrong password) | 401, generic error | Yes | — |
| 7 | Invalid credentials (unknown user) | 401, same generic error | Yes | — |
| 8 | Logout/navigation | 200, redirect `/login` | Yes | Preview |
| 9 | Password hashing | Not plaintext; PBKDF2 format in D1 | Yes | — |
| 10 | Direct `/mcq` access | Page loads without prior login | — | Preview |

### Sprint completion verification

After all phases are green:

1. `npm test` — all Vitest tests pass
2. `npm run lint` — no errors
3. `npm run build` — succeeds
4. `npm run preview` — manual UI walkthrough for scenarios 1, 4, 5, 8, 10

### Validation dependency (requires approval)

**Zod** is the intended library for request/form validation. Per `AGENTS.md`, it must **not** be installed without explicit user approval. If Zod is not approved, implement equivalent validation with manual checks or TypeScript type guards.

---

## Implementation Phases

Each phase follows TDD: **write tests first (red) → implement (green) → verify acceptance criteria**.

---

### Phase 0: Test Infrastructure - COMPLETED

**Objective**: Install Vitest and configure the Workers test harness so subsequent phases can write failing tests immediately.

**TDD step — RED setup** (no feature tests yet; infrastructure must run):

1. Install `vitest` and `@cloudflare/vitest-plugin` as devDependencies
2. Add `vitest.config.ts`, `test/apply-migrations.ts`, `test/env.d.ts`, `test/tsconfig.json`
3. Add `test` and `test:watch` scripts to `package.json`
4. Update `eslint.config.mjs` for Vitest globals in `*.test.ts`
5. Run `npm test` — suite runs with zero tests (or placeholder skipped test); no errors

**Tests to add**: None yet — this phase establishes the harness only.

**Implementation tasks** (configuration only — no application code):

- `vitest.config.ts` — Workers pool, in-memory D1, migration binding, `@/` alias
- `test/apply-migrations.ts` — `applyD1Migrations` + per-test `users` table cleanup
- `test/env.d.ts` — `ProvidedEnv` types
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

**Phase complete when**:

- [ ] `npm test` runs without configuration errors
- [ ] Test harness is ready for Phase 1 schema tests

**Deliverables**:
- `vitest.config.ts`
- `test/apply-migrations.ts`
- `test/env.d.ts`
- `test/tsconfig.json`
- Updated `package.json`, `eslint.config.mjs`

---

### Phase 1: Database Setup - COMPLETED

**Objective**: Create the D1 database, migration, Wrangler binding, and schema tests.

**TDD step — RED (write tests first)**:

Create `test/schema.test.ts` with tests that assert:

- `users` table exists after migrations are applied
- Required columns exist: `id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `created_at`
- `username` and `email` have unique constraints (insert duplicate → error)
- `id` is auto-generated on insert

Run `npm test` → **tests fail** (no migration file yet, or table missing).

**TDD step — GREEN (implement)**:

1. Create D1 database via Wrangler
2. Add `d1_databases` binding to `wrangler.jsonc`
3. Write migration `migrations/0001_create_users_table.sql`
4. Apply migration locally: `npx wrangler d1 migrations apply quiz-maker-db --local`
5. Run `npm run cf-typegen`

Run `npm test` → **schema tests pass**.

**Phase complete when**:

- [ ] All `test/schema.test.ts` tests pass
- [ ] `wrangler.jsonc` has `DB` binding
- [ ] Local migration applied

**Deliverables**:
- `test/schema.test.ts`
- `migrations/0001_create_users_table.sql`
- Updated `wrangler.jsonc`
- Regenerated `cloudflare-env.d.ts`

---

### Phase 2: Password Utilities and UserService - COMPLETED

**Objective**: Build the minimum data layer for register and login, driven by failing tests.

**TDD step — RED (write tests first)**:

Create `src/lib/password.test.ts`:

- `hashPassword` returns a string in `{salt}:{iterations}:{hash}` format
- `hashPassword` produces different output for the same input (random salt)
- `verifyPassword` returns `true` for correct password
- `verifyPassword` returns `false` for incorrect password
- Hash output is not equal to plaintext input

Create `src/lib/services/user-service.test.ts`:

- `createUser` inserts a row and returns user without `passwordHash`
- `createUser` stores a hashed password in D1 (not plaintext)
- `createUser` rejects duplicate username (throws or returns error)
- `createUser` rejects duplicate email
- `getUserByUsernameOrEmail` finds user by username
- `getUserByUsernameOrEmail` finds user by email
- `getUserByUsernameOrEmail` returns `null` for unknown identifier

Run `npm test` → **tests fail** (modules do not exist).

**TDD step — GREEN (implement)**:

1. Create `src/lib/password.ts` with `hashPassword` and `verifyPassword` (Web Crypto PBKDF2)
2. Create `src/lib/services/user-service.ts` with `createUser` and `getUserByUsernameOrEmail`
3. Map snake_case DB columns to camelCase TypeScript types

Run `npm test` → **password and user-service tests pass**.

**Phase complete when**:

- [ ] All `src/lib/password.test.ts` tests pass (scenario 9)
- [ ] All `src/lib/services/user-service.test.ts` tests pass (scenarios 1–3 foundation)
- [ ] Phase 1 schema tests still pass

**Deliverables**:
- `src/lib/password.test.ts`
- `src/lib/password.ts`
- `src/lib/services/user-service.test.ts`
- `src/lib/services/user-service.ts`

---

### Phase 3: API Routes - COMPLETED

**Objective**: Expose register, login, and logout endpoints, driven by failing route tests.

**TDD step — RED (write tests first)**:

Create `src/app/api/auth/register/route.test.ts`:

- Valid body → 201, `{ success: true, redirect: "/mcq" }`, user in D1
- Duplicate username → 409
- Duplicate email → 409
- Invalid body (missing fields, short password) → 400
- Response never includes password or `password_hash`

Create `src/app/api/auth/login/route.test.ts`:

- Valid username + password → 200, `{ success: true, redirect: "/mcq" }`
- Valid email + password → 200, `{ success: true, redirect: "/mcq" }`
- Wrong password → 401, generic error message
- Unknown user → 401, same generic error message
- Invalid body → 400

Create `src/app/api/auth/logout/route.test.ts`:

- POST → 200, `{ success: true, redirect: "/login" }`

Run `npm test` → **route tests fail** (handlers do not exist).

**TDD step — GREEN (implement)**:

1. Add validation (Zod if approved; otherwise manual validation in `src/lib/validations/auth.ts`)
2. Implement `POST /api/auth/register`
3. Implement `POST /api/auth/login`
4. Implement `POST /api/auth/logout`

Run `npm test` → **all route tests pass** (scenarios 1–8 automated).

**Phase complete when**:

- [ ] All register route tests pass (scenarios 1–3)
- [ ] All login route tests pass (scenarios 4–7)
- [ ] Logout route test passes (scenario 8)
- [ ] Phase 1 and Phase 2 tests still pass

**Deliverables**:
- `src/app/api/auth/register/route.test.ts`
- `src/app/api/auth/login/route.test.ts`
- `src/app/api/auth/logout/route.test.ts`
- `src/lib/validations/auth.ts` (or inline validation)
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`

---

### Phase 4: UI Pages - PLANNED

**Objective**: Build registration, login, and static MCQ placeholder pages. UI is verified manually; API behavior is already covered by Phase 3 Vitest tests.

**TDD step — RED (manual test checklist first)**:

Document manual verification steps before building UI (stored in PRD Current Status or a `test/MANUAL_UI_CHECKLIST.md`):

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Open `/register`, submit valid form | Redirect to `/mcq` |
| 4.2 | Open `/register`, submit duplicate username | Error shown |
| 4.3 | Open `/login`, submit username + password | Redirect to `/mcq` |
| 4.4 | Open `/login`, submit email + password | Redirect to `/mcq` |
| 4.5 | Open `/login`, submit wrong password | Error shown |
| 4.6 | On `/mcq`, click Logout | Navigate to `/login` |
| 4.7 | Open `/mcq` directly without logging in | Page loads (scenario 10) |
| 4.8 | Open `/` | Redirect or links to login/register |

Run manual checklist via `npm run preview` → **steps fail** (pages do not exist).

**TDD step — GREEN (implement)**:

1. Create `/register` page with form and API integration
2. Create `/login` page with form and API integration
3. Create `/mcq` static placeholder with logout button
4. Update `/` to redirect or link to auth pages

Run manual checklist via `npm run preview` → **all steps pass**.

Run `npm test` → **all automated tests still pass** (no regressions).

**Phase complete when**:

- [ ] All manual UI checklist steps pass
- [ ] `npm test` still passes (no regressions)
- [ ] Pages use shadcn/ui components consistently

**Deliverables**:
- `src/app/register/page.tsx`
- `src/app/login/page.tsx`
- `src/app/mcq/page.tsx`
- Updated `src/app/page.tsx`
- Manual UI checklist (documented)

---

### Phase 5: Sprint Verification - PLANNED

**Objective**: Confirm the full sprint is complete — all automated tests green, build/lint pass, manual UI verified.

**No new tests written** — this phase validates everything built in Phases 0–4.

**Tasks**:

1. `npm test` — full Vitest suite passes (all scenarios 1–9 automated)
2. `npm run lint` — no errors
3. `npm run build` — succeeds
4. `npm run preview` — execute manual UI checklist (scenarios 1, 4, 5, 8, 10)
5. Mark acceptance criteria complete in this PRD
6. Update Current Status with test results

**Phase complete when**:

- [ ] All acceptance criteria checked
- [ ] All 10 PRD scenarios verified (9 automated + 1 manual)
- [ ] Lint, build, and test commands pass

**Deliverables**:
- Passing test run recorded in Current Status
- All acceptance criteria marked complete

---

## Technical Implementation Details

### Key Files

**Test infrastructure**
- `vitest.config.ts` — Vitest + Workers pool configuration
- `test/apply-migrations.ts` — D1 migration setup for tests
- `test/env.d.ts` — Workers test environment types
- `test/schema.test.ts` — D1 schema tests (Phase 1)

**Application**
- `wrangler.jsonc` — D1 database binding configuration
- `migrations/0001_create_users_table.sql` — Users table schema
- `src/lib/password.ts` — PBKDF2 hash and verify functions
- `src/lib/password.test.ts` — Password tests (Phase 2)
- `src/lib/services/user-service.ts` — `createUser` and `getUserByUsernameOrEmail`
- `src/lib/services/user-service.test.ts` — UserService tests (Phase 2)
- `src/lib/validations/auth.ts` — Request validation (pending Zod approval)
- `src/app/api/auth/register/route.ts` + `route.test.ts` — Registration (Phase 3)
- `src/app/api/auth/login/route.ts` + `route.test.ts` — Login (Phase 3)
- `src/app/api/auth/logout/route.ts` + `route.test.ts` — Logout (Phase 3)
- `src/app/register/page.tsx` — Registration UI (Phase 4)
- `src/app/login/page.tsx` — Login UI (Phase 4)
- `src/app/mcq/page.tsx` — Static MCQ placeholder UI (Phase 4)

### Implementation Patterns

**Accessing D1 from the UserService:**

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb() {
  const { env } = await getCloudflareContext();
  return env.DB;
}
```

**Prepared statement with numbered placeholders:**

```typescript
const result = await db
  .prepare(
    "SELECT id, first_name, last_name, username, email, password_hash, created_at FROM users WHERE username = ?1 OR email = ?1"
  )
  .bind(identifier)
  .all<UserRow>();

const user = result.results[0] ?? null;
```

**Password hash format (stored in `password_hash`):**

```
{base64Salt}:{iterations}:{base64Hash}
```

Use PBKDF2 with SHA-256, 100,000 iterations, 16-byte random salt, 32-byte derived key.

### Important Notes

- D1 is only accessible from server code. Never import `user-service` in a `'use client'` component.
- Use `result.results[0]` instead of `.first()` for consistent behavior across local and remote D1.
- Never log or return plaintext passwords or password hashes in API responses.
- Vitest is approved; Zod still requires explicit approval before install.
- Apply migrations locally only (`--local`). Remote migration is the user's decision.
- Verify auth flows with `npm run preview`, not just `npm run dev`.
- Write tests at the start of each phase; do not skip ahead to implementation.

---

## Acceptance Criteria

- [ ] A new user can register with first name, last name, username, email, and password
- [ ] Duplicate username or email returns 409 with a clear message
- [ ] Passwords are stored as PBKDF2 hashes in D1 — never as plaintext
- [ ] A registered user can log in with username plus password
- [ ] A registered user can log in with email plus password
- [ ] Invalid credentials return 401 with a generic error message
- [ ] Successful registration redirects the user to `/mcq`
- [ ] Successful login redirects the user to `/mcq`
- [ ] Logout navigates the user to `/login` (no session to invalidate)
- [ ] `/mcq` is accessible without prior login (redirect-only auth limitation confirmed)
- [ ] `/mcq` shows static placeholder content only — no personalized welcome
- [ ] `UserService` exposes only `createUser` and `getUserByUsernameOrEmail`
- [ ] All API inputs are validated before processing
- [ ] All Vitest tests pass (`npm test`)
- [ ] All 10 PRD test scenarios verified (9 automated + 1 manual)
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` completes successfully

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Automated test suite | 100% pass | `npm test` |
| Registration | Pass scenario 1 | Vitest + manual preview |
| Duplicate registration | Pass scenarios 2–3 | Vitest |
| Login with username/email | Pass scenarios 4–5 | Vitest + manual preview |
| Invalid login | Pass scenarios 6–7 | Vitest |
| Password storage | Pass scenario 9 | Vitest |
| Logout | Pass scenario 8 | Vitest + manual preview |
| No route protection on `/mcq` | Pass scenario 10 | Manual preview |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — SQLite database for user storage
- **Web Crypto API** — Native PBKDF2 password hashing (no npm package required)

### Internal Dependencies

- **`@opennextjs/cloudflare`** — `getCloudflareContext()` for D1 binding access
- **shadcn/ui components** — Form UI (`Button`, `Input`, `Field`, `Label`, `Card`)

### Approved devDependencies

- **`vitest`** — Test runner (approved)
- **`@cloudflare/vitest-plugin`** — Workers-runtime and in-memory D1 testing (approved)

### Pending Approval (do not install without explicit consent)

- **Zod** — Intended for request/form validation

### Environment / Configuration

- D1 binding `DB` in `wrangler.jsonc`
- No secrets required for Sprint #1 auth

---

## Risks and Mitigation

### Technical Risks

- **Risk**: D1 binding unavailable during `npm run dev` (Node runtime)
- **Mitigation**: Test auth flows with `npm run preview`; Vitest uses in-memory D1

- **Risk**: PBKDF2 hashing adds latency on register/login
- **Mitigation**: 100k iterations is a reasonable balance; monitor during preview testing

- **Risk**: Redirect-only auth is mistaken for full session auth
- **Mitigation**: Limitations documented explicitly in Authentication Model and acceptance criteria

- **Risk**: TDD skipped — implementation written before tests
- **Mitigation**: Each phase in this PRD starts with RED step; agents must write tests first

### User Experience Risks

- **Risk**: Users expect to stay logged in after closing the browser
- **Mitigation**: Accepted Sprint #1 limitation; sessions deferred to future sprint

- **Risk**: Users expect `/mcq` to be private after login
- **Mitigation**: `/mcq` is intentionally unprotected in Sprint #1; documented in scope and test scenario 10

---

## Troubleshooting Guide

_(To be populated during implementation and testing.)_

---

## Notes for AI Agents

When working with this PRD:

1. **Follow TDD** — write failing tests at the start of each phase (RED), implement until green (GREEN), then verify acceptance criteria
2. Sprint #1 scope is strict — build only register, login, logout/navigation, minimum user data layer, UI, and testing
3. Do not add `updateUser`, `deleteUser`, or read methods beyond `getUserByUsernameOrEmail`
4. Vitest and `@cloudflare/vitest-plugin` are approved; do not install Playwright
5. Do not install Zod without explicit user approval
6. Do not apply D1 migrations to remote — local only
7. Do not deploy unless explicitly asked
8. Run `npm test` after each phase to confirm no regressions
9. Update phase status markers and acceptance criteria as work progresses
10. Record test results in Current Status when Phase 5 completes

---

## Current Status

**Last Updated**: 2026-09-04
**Current Phase**: Phase 3 complete — awaiting review before Phase 4
**Status**: IN PROGRESS
**Approvals**: Vitest + `@cloudflare/vitest-plugin` approved; Zod pending (manual validation used)
**Test Results**: `npm test` — 28/28 passing (5 schema, 5 password, 7 user-service, 11 API routes)
**Next Steps**: Phase 4 — UI pages (manual checklist red) → register/login/mcq pages (green)
