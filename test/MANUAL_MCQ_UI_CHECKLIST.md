# Manual MCQ UI Checklist (Phase 4)

Run with `npm run preview` (preferred) or `npm run dev`. Mark each step after verifying.

| Step | Action | Expected | Status |
|------|--------|----------|--------|
| 4.1 | Open `/mcq` with empty DB | Empty state + Create + Logout | Verified (prod after remote migration) |
| 4.2 | Click Create | Navigate to `/mcq/create` with Save + Cancel | Implemented |
| 4.3 | Cancel on create | Return to `/mcq`, no new row | Implemented |
| 4.4 | Save valid MCQ (2 choices, one correct) | Redirect `/mcq`, row visible | Implemented |
| 4.5 | Add choices up to 6; try 7th | Cannot exceed 6 | Implemented |
| 4.6 | Context menu → Edit | Prefills; Save updates row/`updated` | Implemented |
| 4.7 | Context menu → Preview | Shows question; submit correct/incorrect result | Implemented |
| 4.8 | Context menu → Delete → confirm | Row removed | Implemented |
| 4.9 | Context menu → Delete → cancel | Row remains | Implemented |
| 4.10 | Logout | Navigate `/login` | Implemented |

## Notes

- List columns: Name, Description, Created, Updated, Actions
- Create defaults to **2** choice fields
- Exactly one choice must be marked correct before Save
