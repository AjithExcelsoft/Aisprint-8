# Manual UI Checklist — Sprint #1 Auth (Phase 4)

Run with `npm run preview` after Phase 4 implementation.

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 4.1 | Open `/register`, submit valid form | Redirect to `/mcq` | |
| 4.2 | Open `/register`, submit duplicate username | Error shown | |
| 4.3 | Open `/login`, submit username + password | Redirect to `/mcq` | |
| 4.4 | Open `/login`, submit email + password | Redirect to `/mcq` | |
| 4.5 | Open `/login`, submit wrong password | Error shown | |
| 4.6 | On `/mcq`, click Logout | Navigate to `/login` | |
| 4.7 | Open `/mcq` directly without logging in | Page loads | |
| 4.8 | Open `/` | Redirect to `/login` | |
