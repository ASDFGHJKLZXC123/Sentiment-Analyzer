# Phase 3: UI/UX Specification

**Companion to:** `docs/phase3-frontend.md` (engineering spec)
**Scope:** Design language, layout, interaction, copy, motion, and accessibility for the dashboard.
**Out of scope:** Build tooling, state management, API client, testing, performance budgets — see the engineering spec.

The two documents are deliberately split. This one answers "what should the user experience be"; the other answers "how is it built." When they conflict, this doc wins for UX questions and the engineering spec wins for implementation questions. Cross-references mark the seams.

---

## 1. Design principles

Five principles, in priority order. When two conflict, the higher one wins.

1. **The cold start is part of the product.** Users will wait up to ~10s for the first response after the Lambda goes cold. Pretending otherwise produces a UI that feels broken. Design for the wait.
2. **One thing at a time.** A single text input, a single result, a single history list. Resist tabs, modals, side panels, and config screens.
3. **Color is decoration; text is the signal.** Sentiment and emotion are conveyed in words and numbers first; color reinforces. The product still works in grayscale.
4. **Recruiter clarity in 30 seconds.** A first-time visitor with no context understands what the product does and sees a real result before they scroll. The sample-input affordance (§7) is non-negotiable.
5. **The browser is the boundary.** History lives on this device. Nothing leaves the browser except the text being analyzed. Say so plainly.

---

## 2. Information architecture

One page. No routing. Three regions stacked on mobile, two columns at `md+`, three on `lg+`.

```
┌──────────────────────────────────────────────────────┐
│  Header: product name, one-line tagline, GitHub link │
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────────────┐    ┌────────────────────┐    │
│   │  Input region    │    │  Results region    │    │
│   │  - Textarea      │    │  - Sentiment       │    │
│   │  - Counter       │    │  - Emotions        │    │
│   │  - Sample chips  │    │  - Keywords        │    │
│   │  - Submit/Clear  │    │                    │    │
│   └──────────────────┘    └────────────────────┘    │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │  History region                              │  │
│   │  - List of past sessions, newest first       │  │
│   └──────────────────────────────────────────────┘  │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Footer: small print + a11y/privacy note            │
└──────────────────────────────────────────────────────┘
```

At `lg`, history moves to a right rail so the input + results dominate above the fold.

---

## 3. User flows

### 3.1 First-time visitor

1. Lands on page. Sees a one-line tagline and a textarea with a clear placeholder.
2. Notices three sample-input chips beneath the textarea ("Try a tweet," "Try a review," "Try a product complaint").
3. Clicks a chip → textarea fills, Submit becomes primary.
4. Clicks Submit. Sees a "warming up the model…" message after ~3s if the Lambda is cold.
5. Result appears; focus moves to the result heading; an entry is added to history.
6. Notices the privacy line in the footer and the GitHub link in the header.

The whole flow is under 30 seconds on a warm Lambda, under 15s on a cold one. Sample chips exist specifically to make this true.

### 3.2 Returning visitor

1. Lands on page. History list is populated.
2. Either types fresh text and submits, or clicks a history entry to re-render its result without an API call.
3. Optionally clears history (with confirmation).

### 3.3 Error recovery

1. User submits. Network fails or Lambda 5xx.
2. Banner appears in the results region with a plain-language explanation and a Retry button. Focus moves to the banner.
3. Retry re-runs the same input. If it succeeds, banner is replaced by results. If it fails again, banner persists with the same Retry affordance.

---

## 4. Layout system

### Breakpoints

| Token | Width | Layout |
|---|---|---|
| (default) | < 768px | Single column. Input → Results → History. |
| `--bp-md` | ≥ 768px | Two columns. Input + Results side-by-side. History full-width below. |
| `--bp-lg` | ≥ 1100px | Three regions. Input left, Results center, History right rail. |

### Grid

CSS Grid for top-level. Flexbox inside components. Container max-width 1280px, centered, with `clamp(16px, 4vw, 40px)` horizontal padding.

### Targets

- Tap targets: minimum 44×44px.
- Focus rings: 2px solid, offset 2px, using `--color-focus`. Visible on every interactive element. Never `outline: none` without a replacement.

---

## 5. Visual design system

### 5.1 Color tokens

Defined as CSS custom properties in `src/styles/tokens.css`. Components reference variables only — no inline hex.

```css
:root {
  /* Surface */
  --color-bg:        #fafafa;
  --color-surface:   #ffffff;
  --color-border:    #e0e0e0;
  --color-text:      #1a1a1a;
  --color-text-mute: #5a5a5a;

  /* Sentiment — WCAG AA against white */
  --color-positive:  #2e7d32;
  --color-negative:  #c62828;
  --color-neutral:   #546e7a;

  /* Emotion — distinct, color-blind safe (verified via Sim Daltonism) */
  --color-emotion-joy:      #f9a825;
  --color-emotion-sadness:  #1565c0;
  --color-emotion-anger:    #d84315;
  --color-emotion-fear:     #6a1b9a;
  --color-emotion-surprise: #00838f;
  --color-emotion-disgust:  #558b2f;

  /* Feedback */
  --color-error:     #b71c1c;
  --color-warning:   #ef6c00;
  --color-focus:     #1976d2;
}
```

**Verification step:** before tagging the phase, run the palette through a color-blind simulator (deuteranopia, protanopia, tritanopia). If any two emotion colors collapse, swap one. Document the check in `docs/phase3-results.md`.

### 5.2 Typography

System font stack — no web font loading, no FOIT.

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, Menlo, monospace;
```

Type scale, all px, line-height in parens:

| Token | Size | Use |
|---|---|---|
| `--text-xs`  | 12 (1.4) | Helper text, counter |
| `--text-sm`  | 14 (1.5) | Body small, captions |
| `--text-base`| 16 (1.5) | Body |
| `--text-lg`  | 20 (1.4) | Subheads, sentiment label |
| `--text-xl`  | 28 (1.2) | Section headings |
| `--text-2xl` | 36 (1.1) | Page heading |

Headings use `font-weight: 600`; body 400; numbers in result panel use `font-variant-numeric: tabular-nums` for stable column alignment.

### 5.3 Spacing

4px base. Tokens `--space-1` (4) through `--space-6` (64). Avoid arbitrary pixel values in component styles.

### 5.4 Radii and elevation

- `--radius-sm: 4px` for chips and inputs.
- `--radius-md: 8px` for cards.
- `--radius-lg: 16px` for the main results container.
- One elevation level: `box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)`. No multi-level shadow system.

---

## 6. Component visual specs

### 6.1 TextInput

- Textarea, `min-height: 140px`, resizable vertically only.
- Floating character counter bottom-right of the textarea: `123 / 2000`. Color `--color-text-mute` until 90% of max, then `--color-warning`, then `--color-error` at 100%.
- Sample chips appear below the textarea when it is empty. Each chip is a button with the prompt label; click fills the textarea and focuses Submit.
- Two buttons: **Analyze** (primary, right) and **Clear** (tertiary text button, left). Analyze is disabled when the textarea is empty, over the limit, or a request is in flight.

### 6.2 SentimentBadge

- Pill containing the label (`Positive` / `Negative` / `Neutral`) and confidence as percent.
- Background uses the sentiment color at 12% alpha; text uses the full sentiment color.
- Includes an SVG icon (✓ / ✗ / ‒) so the badge reads without color.

### 6.3 EmotionChart

- Horizontal bar chart, six bars, sorted by score descending.
- Each bar: emotion name (left, fixed width), bar (fills remaining width), score as percent (right).
- Bar color from the emotion token set. Track color `--color-border`.
- Below the chart, a `<details>` element ("Show as table") reveals the same data in a `<table>` for screen readers and as a sighted fallback. Keep this expanded by default at narrow widths where the bars feel cramped.

### 6.4 KeywordCloud

Not a true word cloud. A wrap-flowing row of "keyword chips" sized by score:

- Top 1–3 keywords: `--text-lg`.
- Next 4–7: `--text-base`.
- Rest: `--text-sm`.

Each chip has a subtle background and full text contrast. Chips are non-interactive in v1.

### 6.5 HistoryList

- Vertical list. Each item shows: timestamp (relative — "2 min ago"), input preview (first ~80 chars, truncated with ellipsis), sentiment badge.
- Hover state lightens the background; active/selected state uses `--color-focus` border-left (4px).
- Empty state: "Your past analyses will appear here." with mute text.
- Header row contains the title "History" and a Clear button (text-only, mute color, with confirm dialog).

### 6.6 ResultsPanel

The wrapper that switches between empty / loading / success / error. See §7 for the state copy.

---

## 7. UI states and copy

The state-machine plumbing lives in `useAnalysis` (engineering spec §5). Below is the **UX surface** of each state — what the user sees and reads.

### 7.1 Empty (idle)

- Centered illustration or icon (simple, single-color, ~80px).
- Heading: **"Paste some text to get started."**
- Body: "We'll analyze sentiment, detect emotions, and pull out keywords."
- The sample-input chips beneath the textarea are the primary affordance to leave this state.

### 7.2 Loading

A three-tier ladder, because cold starts are real:

| Elapsed | Treatment |
|---|---|
| 0 – 1.5s   | Subtle spinner only. No text. |
| 1.5 – 3s   | Skeleton placeholders for sentiment, chart, keywords. |
| 3 – 10s    | Skeleton + caption: **"Warming up the model — this happens on the first request."** |
| > 10s      | Skeleton + caption: **"Still working… almost there."** |

The 3s caption is the most important piece of microcopy in the product. It reframes a cold start from "broken" to "expected."

### 7.3 Success

- Skeleton dissolves into result content.
- Focus moves to the results region heading.
- The results region is an `aria-live="polite"` landmark; the sentiment label is announced.
- A new entry appears at the top of the history list with a brief highlight (200ms background fade).

### 7.4 Error

| Class | Message | Action |
|---|---|---|
| Network / offline | **"Can't reach the server.** Check your connection and try again." | Retry button |
| Timeout | **"That took longer than expected.** The model may be cold — try again." | Retry button |
| HTTP 4xx | **"Your input couldn't be analyzed."** + server-provided detail | No retry; user edits input |
| HTTP 5xx | **"Something went wrong on our end.** This is rare — please try again." | Retry button |

Error banners appear inside the results region (not as toasts), use `--color-error` for the icon and heading, and receive focus on appearance.

### 7.5 History selection (no API call)

When a user clicks a history item, the results region renders that entry's stored result. A small mute caption appears: "Showing saved result from 14 minutes ago." Submitting new input clears this state.

---

## 8. Microcopy guidelines

- **Plain language.** "Analyze" not "Process input." "Try again" not "Reattempt request."
- **Active voice, present tense.** "We couldn't reach the server" not "The server could not be reached."
- **Sentence case** for headings, labels, and buttons. Not Title Case.
- **No emoji in product copy.** They look fine in screenshots and bad in screen readers.
- **Errors name what happened, then what to do.** Two sentences max. Skip apologies.
- **Privacy line, verbatim** (footer): "History is saved on this device only. Text you analyze is sent to a serverless function and not stored."

---

## 9. Motion

Motion is functional, not decorative. Three rules.

1. **Reduced motion is a hard requirement.** Honor `prefers-reduced-motion: reduce` by reducing all transitions to fade-only at 50ms.
2. **Default duration is 150ms** with `ease-out`. State changes feel snappy; nothing crosses 250ms.
3. **No bouncing, no spring physics, no looping idle animations.** The skeleton shimmer is the only animated element on the page during loading.

Specific transitions:

- Skeleton shimmer: 1.6s linear infinite, low-contrast.
- Result reveal: 150ms opacity fade.
- History entry insertion: 200ms background highlight, then settle.
- Button hover: 100ms background change, no transform.

---

## 10. Responsive behavior

- **< 768px:** Single column, input first, results second, history last. History items show timestamp + preview + sentiment badge inline.
- **768–1099px:** Input and results side-by-side, equal width. History full-width below.
- **≥ 1100px:** Three columns at 1fr 1.5fr 1fr. Results region is the visual center of gravity.
- **Touch:** Tap targets ≥ 44px. No hover-only affordances; everything is reachable by tap.
- **Orientation change:** Layout reflows without losing input state.

---

## 11. Accessibility

Treated as a first-class requirement. Every non-negotiable below is verified before tagging the phase.

### 11.1 Structure

- One `<h1>` (the page heading). Section headings use `<h2>`/`<h3>` in order, no skipped levels.
- Landmarks: `<header>`, `<main>`, `<footer>`. Results region is a labeled `<section aria-labelledby="results-heading">`.
- All form controls have associated `<label>`s. The textarea label can be visually hidden but must exist in the DOM.

### 11.2 Live regions

- Results region: `aria-live="polite"` so successful results announce.
- Error banner: `role="alert"` so errors interrupt and announce immediately.
- Loading captions: `aria-live="polite"` so the "warming up" message is read.

### 11.3 Keyboard

- Tab order matches visual order: header → textarea → sample chips → Clear → Analyze → results → history items → Clear history → footer.
- Enter inside the textarea inserts a newline; Cmd/Ctrl+Enter submits. (A textarea Enter-to-submit would block multi-line input.)
- Escape inside the textarea clears the input only when there is no in-flight request.
- Focus is always visible. Focus moves deliberately on result, error, and history selection (see §7).

### 11.4 Color and contrast

- All text meets WCAG AA (4.5:1 for body, 3:1 for large text).
- No state is conveyed by color alone — sentiment has icon + text + color; emotion bars have labels + values.

### 11.5 Charts

- The emotion chart has a sibling accessible data table (visually hidden by default, exposed via the `<details>` toggle described in §6.3). Screen reader users get the same information.

### 11.6 Tooling

- ESLint `jsx-a11y` plugin at error level.
- `@axe-core/playwright` runs against empty, loading, success, and error states with zero violations to pass.
- A manual keyboard pass is performed and documented in `docs/phase3-results.md` before tagging.

---

## 12. Open questions to resolve during the build

These are flagged here so they don't get hand-waved. Each gets a `decision-log.md` entry when resolved.

1. **History selection — should it allow re-running analysis on the saved input?** Pro: useful for comparing model versions later. Con: scope creep. Default to no.
2. **Sample input chips — how many and what content?** Three is the working assumption. Need to pick prompts that produce visibly different sentiment + emotion mixes; otherwise the demo lands flat.
3. **Empty-state illustration vs. icon vs. nothing?** A small icon is the safe default. An illustration is recruiter-bait but adds asset weight. Decide during build, defer if undecided.
4. **Animation for the emotion chart bars — slide in or static?** Lean static. Reduced motion + simplicity. Revisit if it feels lifeless.

---

## 13. Acceptance checklist (UX-side)

Before tagging `phase-3-complete`:

- [ ] All five states (empty, loading-tier-1, loading-tier-3, success, error) match the visual specs.
- [ ] Sample chips fill the textarea and focus Submit.
- [ ] Color-blind simulator check completed for all three vision types; result recorded.
- [ ] Reduced-motion preference respected; verified in DevTools.
- [ ] Keyboard-only run-through completed end-to-end.
- [ ] Screen reader pass with VoiceOver or NVDA on the success and error states; results announce correctly.
- [ ] Privacy line present in footer, verbatim.
- [ ] All open questions in §12 either resolved (with decision-log entry) or deferred deliberately.
