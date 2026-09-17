Date created: 2026-09-17
Date last modified: 2026-09-17 (Phase 3 complete)

# Multiple Questions (MCQ) - Technical PRD

## Overview/Problem

Teachers who completed Sprint #1 authentication land on a static `/mcq` placeholder with no way to create, list, edit, preview, or delete multiple-choice questions. Without a question data model and CRUD UI, the collaborative quiz test bank cannot store questions, choices, or answer attempts.

Sprint #2 replaces the placeholder with a working MCQ list page, create/edit flows, preview and delete actions, and a D1-backed service layer. Three related tables (`mcqs`, `choices`, `attempts`) persist questions, answer options, and attempt results. Work follows the same TDD approach established in Sprint #1.

---

## Hypothesis

We believe that giving teachers a shadcn-based MCQ list with create, edit, preview, and delete — backed by a service layer and D1 tables for questions, choices, and attempts — will let them build and manage a reusable multiple-choice question bank without leaving the app.

---

## Scope

### In Scope

What will be built in this feature (Sprint #2):

**Data model**

- Cloudflare D1 tables: `mcqs`, `choices`, and `attempts` (see Database Schema)
- D1 migration(s) for the new schema
- Foreign keys from `choices` and `attempts` to `mcqs`
- Default of **2 choices** per new question; maximum of **6 choices** per question
- Exactly one correct choice per question (enforced in service/validation)

**Service layer**

- `McqService` in `src/lib/services/` with create, read (list + by id), update, and delete for MCQs (and nested choices)
- Attempt recording via the service (create attempt + result correct/incorrect)
- All D1 access for MCQ domain goes through the service — route handlers must not query tables directly

**API routes**

- List, get, create, update, and delete MCQ endpoints
- Record attempt endpoint (stores selected choice and whether the answer was correct)

**UI (shadcn/ui)**

- Replace Sprint #1 `McqPlaceholder` with an MCQ list/stub page at `/mcq`
- Table of questions showing name, description, created, and updated
- **Create** button → navigates to create page
- Create page with Save and Cancel
- Edit page (from context menu) with Save and Cancel
- Per-row context menu (⋮) with **Edit**, **Preview**, and **Delete**
- Preview view of a question and its choices
- Delete confirmation (shadcn `Dialog`) before permanent removal
- Logout control retained on the list page (same redirect-only auth model as Sprint #1)

**Testing (required — TDD)**

- Vitest + `@cloudflare/vitest-plugin` (already installed)
- Failing tests written at the start of each phase; implement until green
- Automated coverage for schema, `McqService`, and MCQ API routes
- Manual verification for list/create/edit/preview/delete UI flows

### Out of Scope

What is explicitly not being built in Sprint #2:

- Session cookies, JWTs, or route protection (Sprint #1 redirect-only model remains)
- Ownership / “created by user” filtering (no persistent auth state to attach)
- Full quiz assembly (bundling multiple MCQs into a timed quiz)
- Teacher collaboration, sharing, or permissions
- Bulk import/export of questions
- Rich text / image attachments on questions or choices
- Soft delete / recycle bin
- Playwright or other browser E2E automation
- Changing Sprint #1 auth APIs or `users` schema
- AI-generated questions

### Cut

Things considered during planning but deliberately removed (and why):

- **User foreign key on `mcqs` / `attempts`** — Sprint #1 has no session; attaching `user_id` would be unused until a future auth sprint. Deferred.
- **Separate “quiz” and “quiz_items” tables** — This sprint manages individual MCQs, not assembled quizzes.
- **Server Actions instead of API routes** — Keep parity with Sprint #1 auth routes; forms/clients call `/api/mcq/*`.
- **Zod** — Sprint #1 used manual validation; continue that pattern unless the user explicitly asks to add Zod.
- **Unlimited choices** — Cap at 6 to keep UI and grading simple; default 2 on create.
- **Partial credit / multiple correct answers** — Exactly one correct choice per question.

---

## Test-Driven Development Approach

Sprint #2 follows **test-driven development (TDD)** using **Vitest**, same as Sprint #1.

### TDD workflow per phase

```
1. RED    — Write tests for the phase's deliverables; run `npm test` → tests fail
2. GREEN  — Implement the minimum code to make those tests pass
3. VERIFY — Run `npm test` again → tests pass; check phase acceptance criteria
4. NEXT   — Move to the next phase; repeat
```

### Testing stack (already approved)

| Package | Purpose |
|---------|---------|
| **`vitest`** | Test runner, assertions, mocking |
| **`@cloudflare/vitest-plugin`** | Workers runtime + in-memory D1 |

### Mocking pattern (reuse from Sprint #1)

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
| `npm test` | Run full Vitest suite once |
| `npm run test:watch` | Watch mode during development |

### What is automated vs manual

| Area | Approach |
|------|----------|
| D1 schema (`mcqs`, `choices`, `attempts`) | Vitest |
| `McqService` | Vitest |
| MCQ API routes | Vitest |
| List / create / edit / preview / delete UI | Manual via `npm run preview` |

---

## Technical Requirements

### Database Schema

Database binding name: `DB` (existing `quiz-maker-db` from Sprint #1).

New migration: `migrations/0002_create_mcq_tables.sql`

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  label TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES choices(id) ON DELETE CASCADE
);

CREATE INDEX idx_choices_mcq_id ON choices (mcq_id);
CREATE INDEX idx_attempts_mcq_id ON attempts (mcq_id);
CREATE INDEX idx_attempts_choice_id ON attempts (choice_id);
CREATE INDEX idx_mcqs_updated_at ON mcqs (updated_at);
```

**Column notes:**

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `mcqs` | `id` | TEXT PK | Auto-generated hex id |
| `mcqs` | `name` | TEXT | Short title shown in the list table |
| `mcqs` | `description` | TEXT | Question stem / body |
| `mcqs` | `created_at` | DATETIME | Set on insert |
| `mcqs` | `updated_at` | DATETIME | Set on insert; refreshed on update |
| `choices` | `id` | TEXT PK | Auto-generated hex id |
| `choices` | `mcq_id` | TEXT FK | References `mcqs.id`; cascade delete |
| `choices` | `label` | TEXT | Choice text shown to the user |
| `choices` | `is_correct` | INTEGER | `0` or `1`; exactly one `1` per MCQ |
| `choices` | `position` | INTEGER | Display order `1..n` (n between 2 and 6) |
| `attempts` | `id` | TEXT PK | Auto-generated hex id |
| `attempts` | `mcq_id` | TEXT FK | Question that was attempted |
| `attempts` | `choice_id` | TEXT FK | Choice the user selected |
| `attempts` | `is_correct` | INTEGER | `1` if selected choice was correct, else `0` |
| `attempts` | `created_at` | DATETIME | When the attempt was recorded |

**Business rules (enforced in `McqService` / validation, not only SQL):**

1. New MCQ must include **2–6** choices.
2. On create UI, start with **exactly 2** empty choice fields; user may add up to **6**.
3. Exactly **one** choice may have `is_correct = 1`.
4. Deleting an MCQ deletes its choices and attempts (`ON DELETE CASCADE`).
5. Recording an attempt sets `is_correct` from the selected choice’s `is_correct` flag.

**Setup steps:**

1. Write migration `migrations/0002_create_mcq_tables.sql`
2. Apply locally: `npx wrangler d1 migrations apply quiz-maker-db --local`
3. Extend `test/apply-migrations.ts` cleanup to clear `attempts`, `choices`, then `mcqs` between tests (order matters for FKs)
4. Remote migration is the project owner’s decision (agents must not apply `--remote`)

---

### API Endpoints

All MCQ mutations and reads go through these routes. Handlers validate input, then call `McqService`.

#### GET /api/mcq

Lists all MCQs for the stub/list page (no pagination in Sprint #2).

**Response:**

- Success (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "name": "Photosynthesis basics",
      "description": "Which organelle performs photosynthesis?",
      "createdAt": "2026-09-17T10:00:00.000Z",
      "updatedAt": "2026-09-17T10:00:00.000Z"
    }
  ]
}
```
- Error (500): `{ "error": "Internal server error" }`

List responses do **not** include choices (keeps the table payload small).

---

#### GET /api/mcq/[id]

Fetches one MCQ with its choices (for edit and preview).

**Response:**

- Success (200):
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "Photosynthesis basics",
    "description": "Which organelle performs photosynthesis?",
    "createdAt": "...",
    "updatedAt": "...",
    "choices": [
      { "id": "c1", "label": "Mitochondria", "isCorrect": false, "position": 1 },
      { "id": "c2", "label": "Chloroplast", "isCorrect": true, "position": 2 }
    ]
  }
}
```
- Error (404): `{ "error": "MCQ not found" }`
- Error (500): `{ "error": "Internal server error" }`

---

#### POST /api/mcq

Creates an MCQ and its choices in one request.

**Request Body:**

```json
{
  "name": "Photosynthesis basics",
  "description": "Which organelle performs photosynthesis?",
  "choices": [
    { "label": "Mitochondria", "isCorrect": false },
    { "label": "Chloroplast", "isCorrect": true }
  ]
}
```

**Validation rules:**

- `name` — required, 1–200 characters
- `description` — required, 1–2000 characters
- `choices` — array length 2–6
- each `choices[].label` — required, 1–500 characters
- exactly one `choices[].isCorrect === true`

**Response:**

- Success (201): `{ "success": true, "data": { "id": "...", "redirect": "/mcq" } }`
- Error (400): Validation failure — `{ "error": "Validation failed", "details": [...] }`
- Error (500): Server error

---

#### PUT /api/mcq/[id]

Updates an MCQ and replaces its choice set (full replace of choices for simplicity).

**Request Body:** same shape as create.

**Response:**

- Success (200): `{ "success": true, "data": { "id": "...", "redirect": "/mcq" } }`
- Error (400): Validation failure
- Error (404): MCQ not found
- Error (500): Server error

On success, `updated_at` is refreshed. Existing attempts remain tied to prior choice rows only if those choice ids are preserved; Sprint #2 uses full choice replace (delete old choices for that MCQ, insert new ones). Attempts that referenced deleted choices are removed by cascade — accepted limitation (see Risks).

---

#### DELETE /api/mcq/[id]

Deletes an MCQ and cascades to choices and attempts.

**Response:**

- Success (200): `{ "success": true }`
- Error (404): MCQ not found
- Error (500): Server error

---

#### POST /api/mcq/[id]/attempts

Records an attempt against a question (used by Preview when the user selects a choice and submits).

**Request Body:**

```json
{
  "choiceId": "c2"
}
```

**Response:**

- Success (201):
```json
{
  "success": true,
  "data": {
    "id": "att1",
    "mcqId": "abc123",
    "choiceId": "c2",
    "isCorrect": true
  }
}
```
- Error (400): Missing/invalid `choiceId`, or choice does not belong to this MCQ
- Error (404): MCQ not found
- Error (500): Server error

---

### McqService

Location: `src/lib/services/mcq-service.ts`

All D1 access for the MCQ domain goes through this service.

```typescript
export type ChoiceRecord = {
  id: string;
  mcqId: string;
  label: string;
  isCorrect: boolean;
  position: number;
  createdAt: string;
};

export type McqRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type McqWithChoices = McqRecord & {
  choices: ChoiceRecord[];
};

export type AttemptRecord = {
  id: string;
  mcqId: string;
  choiceId: string;
  isCorrect: boolean;
  createdAt: string;
};

export type ChoiceInput = {
  label: string;
  isCorrect: boolean;
};

export type CreateMcqInput = {
  name: string;
  description: string;
  choices: ChoiceInput[]; // length 2–6, exactly one isCorrect
};

export type UpdateMcqInput = CreateMcqInput;

// Methods required by Sprint #2
listMcqs(): Promise<McqRecord[]>
getMcqById(id: string): Promise<McqWithChoices | null>
createMcq(input: CreateMcqInput): Promise<McqWithChoices>
updateMcq(id: string, input: UpdateMcqInput): Promise<McqWithChoices>
deleteMcq(id: string): Promise<boolean> // false if not found
recordAttempt(mcqId: string, choiceId: string): Promise<AttemptRecord>
```

**Implementation notes:**

- Use `getCloudflareContext()` for `env.DB` (same pattern as `UserService`).
- Map snake_case DB columns to camelCase TypeScript types.
- `createMcq` / `updateMcq` should use a D1 batch or sequential prepared statements inside a logical unit of work (insert MCQ, then insert choices with `position` 1..n).
- `recordAttempt` loads the choice, verifies it belongs to `mcqId`, and sets `is_correct` from the choice row.
- Throw domain errors (e.g. `McqNotFoundError`, `ValidationError`) that routes map to HTTP status codes.

---

### User Interface Requirements

UI uses **shadcn/ui** (`base-nova`) with Tailwind CSS v4. Prefer existing components; add missing ones via `npx shadcn@latest add @shadcn/<name>`.

**Already available:** `button`, `card`, `table`, `dialog`, `field`, `input`, `label`, `separator`, `badge`

**Likely needed (ask before adding if unclear):** `dropdown-menu` (row context menu), optionally `textarea` for description / choice labels.

#### MCQ List / Stub Page (`/mcq`)

- Replaces Sprint #1 static `McqPlaceholder`
- Page: `src/app/mcq/page.tsx`
- Heading: “MCQ Test Bank” (or equivalent)
- **Create** button (shadcn `Button`) → navigates to `/mcq/create`
- shadcn `Table` columns: Name, Description, Created, Updated, Actions
- Actions column: context menu trigger (⋮) with:
  - **Edit** → `/mcq/[id]/edit`
  - **Preview** → `/mcq/[id]/preview`
  - **Delete** → opens confirm `Dialog`; on confirm DELETE `/api/mcq/[id]`, then refresh list
- Empty state when no questions exist
- Logout button retained (POST `/api/auth/logout` → `/login`)
- Fetch list via `GET /api/mcq` (client fetch or server component + refresh after mutations)

#### Create Page (`/mcq/create`)

- Form fields: Name, Description, Choices (start with **2**; Add Choice until **6**; Remove Choice if > 2)
- Radio / checkbox pattern to mark exactly one choice as correct
- **Save** → POST `/api/mcq` → on success navigate to `/mcq`
- **Cancel** → navigate to `/mcq` without saving
- Inline validation errors via `FieldError`
- Use shadcn `Button`, `Input`, `Field`, and `Textarea` (if added)

#### Edit Page (`/mcq/[id]/edit`)

- Same form as create, prefilled from `GET /api/mcq/[id]`
- **Save** → PUT `/api/mcq/[id]` → `/mcq`
- **Cancel** → `/mcq`
- 404-friendly message if id missing

#### Preview Page (`/mcq/[id]/preview`)

- Read-only question name + description
- Choices as selectable options (correctness hidden until submit)
- Submit selection → POST `/api/mcq/[id]/attempts`
- Show result: Correct / Incorrect
- Back link/button to `/mcq`
- Context menu **Preview** navigates here

---

## Implementation Phases

Each phase follows TDD: **write tests first (red) → implement (green) → verify**.

---

### Phase 0: Planning & PRD - COMPLETED

**Objective**: Capture Sprint #2 requirements in this PRD before coding.

**Deliverables**:
- `ai-workspace/Multiple_Questions_PRD.md` (this document)

---

### Phase 1: Database Schema - COMPLETED

**Objective**: Add `mcqs`, `choices`, and `attempts` tables with schema tests.

**TDD step — RED** (completed 2026-09-17):

Added `test/mcq-schema.test.ts` asserting:

- Tables `mcqs`, `choices`, `attempts` exist after migrations
- Required columns exist on each table
- Choice/attempt insert and cascade-delete behavior
- `is_correct` CHECK constraints (0/1 only)
- Indexes exist as defined

Run `npm test` → **15 failed** (no `mcqs` table yet); Sprint #1 suite still 28/28 green.

**TDD step — GREEN** (completed 2026-09-17):

1. Created `migrations/0002_create_mcq_tables.sql`
2. Applied locally: `npx wrangler d1 migrations apply quiz-maker-db --local`
3. Updated `test/apply-migrations.ts` cleanup: `attempts` → `choices` → `mcqs` → `users`

Run `npm test` → **43/43 passed**.

**Phase complete when**:

- [x] Schema tests pass (`test/mcq-schema.test.ts` — 15 tests)
- [x] Local migration applied

**Deliverables**:
- `migrations/0002_create_mcq_tables.sql`
- `test/mcq-schema.test.ts`
- Updated `test/apply-migrations.ts` cleanup

---

### Phase 2: McqService - COMPLETED

**Objective**: Implement the MCQ service layer driven by failing tests.

**TDD step — RED** (completed 2026-09-17):

Created `src/lib/services/mcq-service.test.ts` covering:

- `createMcq` inserts MCQ + 2 choices; returns with ids
- `createMcq` allows up to 6 choices
- `createMcq` rejects fewer than 2 or more than 6 choices
- `createMcq` rejects zero or multiple correct choices
- `listMcqs` returns rows ordered by `updated_at` DESC
- `getMcqById` returns MCQ with choices ordered by `position`
- `getMcqById` returns `null` for unknown id
- `updateMcq` updates name/description/choices and refreshes `updated_at`
- `deleteMcq` removes MCQ and cascaded rows
- `recordAttempt` stores attempt with correct `is_correct`
- `recordAttempt` rejects choice that does not belong to the MCQ

Run `npm test -- src/lib/services/mcq-service.test.ts` → **fail** (module missing).

**TDD step — GREEN** (completed 2026-09-17):

1. Implemented `src/lib/services/mcq-service.ts`
2. Added `src/lib/validations/mcq.ts` (shared create/update validation + choice limits)

Run `npm test` → **60/60 passed**.

**Phase complete when**:

- [x] All `mcq-service` tests pass (17 tests)
- [x] Phase 1 schema tests still pass

**Deliverables**:
- `src/lib/services/mcq-service.ts`
- `src/lib/services/mcq-service.test.ts`
- `src/lib/validations/mcq.ts`

---

### Phase 3: API Routes - COMPLETED

**Objective**: Expose list/get/create/update/delete and attempt endpoints.

**TDD step — RED** (completed 2026-09-17):

Added route tests under `src/app/api/mcq/`:

| File | Coverage |
|------|----------|
| `route.test.ts` | GET list, POST create (valid, validation errors, invalid JSON) |
| `[id]/route.test.ts` | GET one, PUT update, DELETE |
| `[id]/attempts/route.test.ts` | POST attempt success / bad choice / missing MCQ |

Run `npm test -- src/app/api/mcq` → **fail** (route modules missing).

**TDD step — GREEN** (completed 2026-09-17):

Implemented:

- `src/app/api/mcq/route.ts` — GET, POST
- `src/app/api/mcq/[id]/route.ts` — GET, PUT, DELETE
- `src/app/api/mcq/[id]/attempts/route.ts` — POST
- Extended `src/lib/validations/mcq.ts` with `validateAttemptBody`

Run `npm test` → **77/77 passed**.

**Phase complete when**:

- [x] All MCQ route tests pass (17 route tests)
- [x] Prior phases still green

**Deliverables**:
- API route handlers + Vitest route tests
- `validateAttemptBody` helper

---

### Phase 4: UI Pages - PLANNED

**Objective**: Replace the placeholder with list, create, edit, preview, and delete UX using shadcn.

**TDD step — RED (manual checklist first)**:

Document in `test/MANUAL_MCQ_UI_CHECKLIST.md` (or extend existing checklist):

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Open `/mcq` with empty DB | Empty state + Create + Logout |
| 4.2 | Click Create | Navigate to `/mcq/create` with Save + Cancel |
| 4.3 | Cancel on create | Return to `/mcq`, no new row |
| 4.4 | Save valid MCQ (2 choices, one correct) | Redirect `/mcq`, row visible |
| 4.5 | Add choices up to 6; try 7th | Cannot exceed 6 |
| 4.6 | Context menu → Edit | Prefills; Save updates row/`updated` |
| 4.7 | Context menu → Preview | Shows question; submit correct/incorrect result |
| 4.8 | Context menu → Delete → confirm | Row removed |
| 4.9 | Context menu → Delete → cancel | Row remains |
| 4.10 | Logout | Navigate `/login` |

**TDD step — GREEN**:

1. Add shadcn components if missing (`dropdown-menu`, `textarea`, etc.) — ask first per `AGENTS.md` if new deps/components are unclear
2. Build list, create, edit, preview components
3. Wire pages under `src/app/mcq/`
4. Remove or replace `McqPlaceholder` usage

**Phase complete when**:

- [ ] Manual checklist documented and executable
- [ ] `npm test` still passes
- [ ] UI uses shadcn `Button`, `Table`, `Dialog`, etc.
- [ ] `npm run lint` and `npm run build` pass

**Deliverables**:
- List/create/edit/preview UI
- Manual checklist
- Updated `/mcq` routes

---

### Phase 5: Sprint Verification - PLANNED

**Objective**: Confirm Sprint #2 is complete.

**Tasks**:

1. [ ] `npm test` — full suite green (Sprint #1 + Sprint #2)
2. [ ] `npm run lint` — no errors
3. [ ] `npm run build` — succeeds
4. [ ] Manual UI walkthrough of checklist
5. [ ] Mark acceptance criteria complete
6. [ ] Optional: `npm run preview` for Workers-runtime smoke test

---

## Technical Implementation Details

### Key Files (planned)

| Layer | File | Purpose |
|-------|------|---------|
| Migration | `migrations/0002_create_mcq_tables.sql` | `mcqs`, `choices`, `attempts` |
| Service | `src/lib/services/mcq-service.ts` | CRUD + attempts |
| Validation | `src/lib/validations/mcq.ts` | Request/body validation |
| API | `src/app/api/mcq/route.ts` | List + create |
| API | `src/app/api/mcq/[id]/route.ts` | Get + update + delete |
| API | `src/app/api/mcq/[id]/attempts/route.ts` | Record attempt |
| UI | `src/components/mcq/mcq-list.tsx` | Table + Create + context menu |
| UI | `src/components/mcq/mcq-form.tsx` | Shared create/edit form (Save/Cancel) |
| UI | `src/components/mcq/mcq-preview.tsx` | Preview + attempt submit |
| UI | `src/components/mcq/mcq-row-actions.tsx` | Edit / Preview / Delete menu |
| Pages | `src/app/mcq/page.tsx` | List |
| Pages | `src/app/mcq/create/page.tsx` | Create |
| Pages | `src/app/mcq/[id]/edit/page.tsx` | Edit |
| Pages | `src/app/mcq/[id]/preview/page.tsx` | Preview |
| Tests | `src/lib/services/mcq-service.test.ts` | Service TDD |
| Tests | `src/app/api/mcq/**/route.test.ts` | Route TDD |
| Tests | `test/schema.test.ts` or `test/mcq-schema.test.ts` | Schema TDD |

### Implementation Patterns

**Service DB access (same as UserService):**

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getDb() {
  const { env } = await getCloudflareContext();
  return env.DB;
}
```

**Choice count guard:**

```typescript
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;
```

### Important Notes

- Do not import `mcq-service` into `'use client'` components.
- Keep Sprint #1 auth tests green; do not break redirect to `/mcq`.
- Apply migrations locally only (`--local`).
- Prefer shadcn components over raw HTML controls for buttons, table, and dialogs.
- Write tests at the start of each phase; do not skip RED.

---

## Acceptance Criteria

- [ ] Teachers can open `/mcq` and see a table of MCQs (name, description, created, updated)
- [ ] Create button navigates to a create page with **Save** and **Cancel**
- [ ] Cancel returns to `/mcq` without creating a question
- [ ] Save creates an MCQ with 2–6 choices and redirects to `/mcq`
- [ ] New questions default to **2** choice fields in the UI
- [ ] Users cannot add more than **6** choices
- [ ] Exactly one choice must be marked correct (validated client + server)
- [ ] Row context menu offers **Edit**, **Preview**, and **Delete**
- [ ] Edit updates the MCQ and refreshes `updated_at`
- [ ] Preview shows the question; submitting a choice records an attempt with correct/incorrect
- [ ] Delete removes the MCQ (and cascaded choices/attempts) after confirmation
- [ ] `choices.mcq_id` and `attempts.mcq_id` / `attempts.choice_id` foreign keys are in place
- [ ] All MCQ D1 access goes through `McqService`
- [ ] API routes exist for create, update, delete, list/get, and record attempt
- [ ] All Vitest tests pass (`npm test`), including Sprint #1 suite
- [ ] `npm run lint` and `npm run build` succeed
- [ ] UI uses shadcn for buttons, table, dialog, and form fields

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Automated tests | 100% pass | `npm test` |
| Create MCQ | Pass create scenarios | Vitest + manual |
| Update / delete | Pass update/delete scenarios | Vitest + manual |
| Choice limits | Reject &lt;2 or &gt;6 | Vitest |
| Attempt result | Correct/incorrect stored | Vitest + preview UI |
| UI checklist | All steps pass | Manual preview |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — persistence for MCQs, choices, attempts

### Internal Dependencies

- **Sprint #1 auth foundation** — login/register still redirect to `/mcq`; logout remains on list page
- **`@opennextjs/cloudflare`** — `getCloudflareContext()` for D1
- **shadcn/ui** — `Button`, `Table`, `Dialog`, `Field`, `Input`, etc.
- **Vitest + `@cloudflare/vitest-plugin`** — already installed

### Components to add (as needed)

- shadcn `dropdown-menu` for row actions
- shadcn `textarea` for description / long labels (if not using multiline `Input`)

Ask before adding any new npm package per `AGENTS.md`.

### Environment / Configuration

- Existing D1 binding `DB` in `wrangler.jsonc`
- No new secrets required for Sprint #2

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Full choice replace on update cascades and deletes prior attempts
- **Mitigation**: Document as Sprint #2 limitation; future sprint can preserve choice ids or soft-delete

- **Risk**: Foreign key enforcement differs between local SQLite and remote D1
- **Mitigation**: Enforce ownership of `choiceId` → `mcqId` in `McqService` regardless of DB FK behavior; cover in tests

- **Risk**: UI built before service/API tests
- **Mitigation**: Phases require RED tests first; Phase 4 UI only after Phase 3 green

### User Experience Risks

- **Risk**: Users expect questions to be private / owned
- **Mitigation**: Out of scope until sessions exist; list shows all MCQs in the DB

- **Risk**: Delete is irreversible
- **Mitigation**: Confirm dialog before DELETE

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Schema tests fail: no `mcqs` table | Migration not applied in test harness | Ensure `0002_*.sql` is picked up by `TEST_MIGRATIONS` / `apply-migrations` |
| FK cleanup errors between tests | Wrong delete order | Delete `attempts` → `choices` → `mcqs` |
| `getCloudflareContext` undefined in Vitest | Missing mock | Mock `@opennextjs/cloudflare` to inject `env` from `cloudflare:test` |
| Create works in `npm run dev` but fails in preview | D1 binding / migration only local Node issue | Use `npm run preview`; apply migration `--local` |
| Context menu missing | Dropdown component not installed | `npx shadcn@latest add @shadcn/dropdown-menu` |

---

## Notes for AI Agents

When working with this PRD:

1. **Follow TDD** — RED tests first each phase, then GREEN, then verify
2. Build only what is In Scope; do not add sessions, ownership, or quiz assembly
3. Put all MCQ/choice/attempt D1 access in `McqService`
4. Enforce 2–6 choices and exactly one correct choice in validation + service
5. Use shadcn components for buttons, table, dialog, and form controls
6. Do not apply remote D1 migrations; local only
7. Do not deploy unless explicitly asked
8. Keep Sprint #1 auth tests green
9. Ask before adding npm dependencies
10. Update phase status markers and acceptance criteria as work progresses
11. Prefer the URL for list→create→edit→preview navigation

---

## Current Status

**Last Updated**: 2026-09-17  
**Current Phase**: Phase 3 — API Routes  
**Status**: PHASE 3 COMPLETE — awaiting user verification before commit  
**Branch**: `feature/sprint2-multiple-questions`  
**Depends on**: Sprint #1 auth foundation (`register-login-logout_PRD.md`)  

**Verification results (Phase 3)**:

| Command | Result |
|---------|--------|
| `npm test -- src/app/api/mcq` (RED) | 3 suites failed — route modules missing |
| `npm test` (GREEN) | **77/77 passed** (11 files) |

**Note**: Phase 2 service files are still uncommitted on this branch along with Phase 3.

**Next Steps**:

1. User verifies Phase 3 (and optionally commit Phase 2 + 3 together or separately)
2. Begin Phase 4: UI pages (list/create/edit/preview/delete)
3. Proceed Phase 5 verification
