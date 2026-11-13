# Accessibility audit

Date: 14 November 2026. Tool: axe-core 4.14.0, rules tagged `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`, with axe's `best-practice` rules run as well. Run against the Vite dev server in a Chromium browser pane, with axe injected into the page (Playwright is not installed here). To repeat it: `npx tsx scripts/a11y-audit.ts`, or `npx tsx scripts/a11y-audit.ts --snippet` and run the printed script in an open page of the app.

## Screens checked

48 axe runs in total:

- 20 routes at 1024 px wide: `/`, `/try`, `/recorded`, `/check`, `/hearing`, `/rescore`, `/year`, `/year/stable`, `/year/practice`, `/year/decline`, `/year/hearing`, `/year/function`, `/year/urgent`, `/clinician/decline`, `/clinician/function`, `/me/decline`, `/me/urgent`, `/benchmark`, `/programme`, `/how`.
- The same 20 routes at 375 px wide with touch emulation, also checked for horizontal overflow and for tap targets under 44 by 44 px.
- 8 states reached by clicking: Arabic selected on `/try`, `/check`, `/hearing`, `/recorded` and `/rescore`; the physician's packet after "Approve" (at both widths); the home page with the sixth person picked.

Sections that fade in on scroll were forced visible before each run, so contrast was measured on what a reader sees. axe could not compute contrast for many text nodes ("unable to determine"), so a second script computed the contrast of every visible text node from its computed colours and the solid backgrounds behind it.

## Results by page

"Before" is the first run, before any change. Counts are rule (affected elements).

| Page | WCAG A/AA before | Best practice before | After |
|---|---|---|---|
| `/` | none | landmark-one-main (1), region (39) | 0 |
| `/try` | none | none | 0 |
| `/recorded` | none | none | 0 |
| `/check` | none | none | 0 |
| `/hearing` | none | none | 0 |
| `/rescore` | scrollable-region-focusable (1) | none | 0 |
| `/year` | scrollable-region-focusable (1) | none | 0 |
| `/year/stable` | scrollable-region-focusable (1) | none | 0 |
| `/year/practice` | scrollable-region-focusable (1) | none | 0 |
| `/year/decline` | scrollable-region-focusable (1) | none | 0 |
| `/year/hearing` | scrollable-region-focusable (1) | none | 0 |
| `/year/function` | scrollable-region-focusable (1) | none | 0 |
| `/year/urgent` | scrollable-region-focusable (1) | none | 0 |
| `/clinician/decline` | label (1), scrollable-region-focusable (2) | empty-table-header (1) | 0 |
| `/clinician/function` | label (1), scrollable-region-focusable (2) | empty-table-header (1) | 0 |
| `/me/decline` | none (aria-prohibited-attr flagged for review, 1) | none | 0 |
| `/me/urgent` | none (aria-prohibited-attr flagged for review, 1) | none | 0 |
| `/benchmark` | scrollable-region-focusable (9) | empty-table-header (1) | 0 |
| `/programme` | scrollable-region-focusable (2) | none | 0 |
| `/how` | scrollable-region-focusable (2) | empty-table-header (1) | 0 |

Before: 15 WCAG A/AA rule failures over 27 elements on 13 of 20 pages, and 6 best-practice failures over 45 elements on 4 pages. After: 0 on all 48 runs. At 375 px no page scrolls sideways and no control outside running text is smaller than 44 by 44 px.

Found outside axe, and fixed:

- Window title text in the mock windows on the home page measured 4.1:1 against the window bar, below 4.5:1.
- Footer links (22 px tall) and the brand link in the header (28 px tall) were under 44 px at phone width.
- Arabic text had `dir="rtl"` but no `lang="ar"`, so a screen reader would read it with an English voice.
- The trajectory chart had one fixed label for every person, so a screen reader user got none of the data.
- Focus rings on the person picker were cut off by its scrolling strip.

## What changed

- Home page content is now inside `<main>`.
- Every scrolling table wrapper, and the HL7 message block, can take keyboard focus and is a named region (`tabIndex=0`, `role="region"`, `aria-label` from the heading above it).
- Empty corner and column headers have screen-reader text. Row labels in the confusion matrix and the comparison table are `<th scope="row">`, styled to look as before.
- The invitation textarea on the physician's packet has an accessible name and points to its help text.
- The trajectory chart's `aria-label` now summarises the data: number of checks, date range, how many were scored, the baseline, the latest score and its status, and the range of scores. In the person's own view (`plain`) it gives only the count and dates, as the picture does.
- The hearing check's bar trace is `role="img"` with each set's level in dB and whether it was right. The keypad is a named group. The tick lists on the person's page and the hearing-aid question are lists.
- Arabic prompts, chips, word lists and text boxes carry `lang` with `dir`. In "Heard but not on the accepted list", only the list of words is marked Arabic; the English sentence around it is not.
- `--chrome-ink` in the cream theme is now the theme's own `--ink-3` (#6D6459), 5.1:1 on the window bar.
- Footer links and the header brand link are at least 44 px tall. The person picker's focus ring is drawn inside the card.
- New `.sr-only` utility in `src/index.css`.

No visible wording changed. `npx tsc -b`, `npx oxlint src` and `npm test` pass.

## Not verified

axe and the scripts above cannot check these, and nobody has tested them by hand:

- Using the voice check with a screen reader (`/try`, `/check`). The check speaks its prompts and listens at the same time, so a screen reader talking over it may be picked up as an answer. The one-minute animal task is timed by design, and nothing lets a person ask for more time (WCAG 2.2.1).
- The hearing check in progress and its result screen. Playing the digits needs real audio, so the keypad, the live answer slots and the result trace were checked only in the code, not in a browser run.
- The scoring stages on `/recorded` and `/rescore`, which download a speech model first.
- Real screen readers (VoiceOver, NVDA, TalkBack), including how they pronounce the Gulf Arabic text.
- Text over the hero photo on the home page. That part is `aria-hidden` and decorative, and its labels sit on near-opaque cards, but axe cannot measure contrast over an image.
- Zoom to 200% and reflow at 320 px, hover states, Windows high-contrast mode and reduced-motion behaviour beyond the existing CSS rule.
