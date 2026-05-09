# Phase 3 Frontend Audit

Use this file before making Phase 3 changes. The goal is to decide whether to preserve, migrate, or replace the existing low-fi frontend.

## 1. Current frontend summary

- Framework:
- Build tool:
- Language mode:
- Package manager:
- Current entry point:
- Current run command:

## 2. Existing folder structure

```text
Paste current frontend tree here.
```

## 3. Existing user flow

Describe the current low-fi flow:

1.
2.
3.

Working behavior to preserve:

- 

Confusing or broken behavior to change:

- 

## 4. Current components

| Component/file | Current responsibility | Keep/refactor/replace | Notes |
|---|---|---|---|
| | | | |

## 5. Current API behavior

- Does the frontend call an API today?
- Endpoint or env var used:
- Request shape:
- Response shape:
- Error handling:
- Loading handling:

## 6. Current UI states

| State | Exists today? | Quality | Required Phase 3 action |
|---|---:|---|---|
| idle | | | |
| typing | | | |
| loading | | | |
| success | | | |
| error | | | |
| retry-after-error | | | |
| selected history | | | |

## 7. Current history behavior

- localStorage used?
- Storage key:
- Max entries:
- Clear all supported?
- Known problems:

## 8. Styling and layout

- Styling approach:
- Responsive behavior:
- Hardcoded colors/spacing:
- Components that need design cleanup:

## 9. Accessibility baseline

- Labels present for form fields?
- Keyboard navigation works?
- Focus visible?
- Results announced or focus-managed?
- Color-only meaning exists?
- Main issues:

## 10. Testing baseline

- Existing test runner:
- Existing tests:
- Missing critical tests:

## 11. Decision

Choose one:

- [ ] Preserve and refactor incrementally
- [ ] Migrate in place to target Vite + React + TypeScript structure
- [ ] Replace frontend after documenting reason in `decision-log.md`

Reason:

## 12. Phase 3 refactor targets

Highest-priority changes:

1.
2.
3.

Deferred to Phase 4 or later:

- 
