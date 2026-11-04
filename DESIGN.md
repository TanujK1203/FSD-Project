# Design direction

A mobile-first shopping app where sellers' product photos carry the colour and the interface stays quiet.

Intensity dials: layout variance 4/10, motion 5/10, density 6/10.

## Tokens

All colours live in `src/styles/tokens.css`. Light and dark themes are defined there; the theme follows the system unless the visitor picks Light or Dark (stored in `localStorage`, applied before paint).

| Role | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f7f7f6 | #121212 | page |
| `--surface` | #fdfdfc | #1a1a1a | cards, panels, inputs |
| `--ink` / `--ink-2` | #151515 / #5b5b5b | #edecea / #a6a5a2 | text, secondary text |
| `--line` | #e3e2df | #2c2c2b | hairline borders |
| `--accent` | #c8383a | #c8383a | the one primary button per screen, cart count |
| `--accent-tint` / `--accent-tint-ink` | #fcebea / #a82a2d | #3a1f1f / #f5a3a0 | selected chips, active tab, discount tag, warnings |

Contrast checked: body text 6.3:1 or better, white on red 5.1:1, red text on tint 6:1 (light) and 7.6:1 (dark).

## Type

Albert Sans, one family, weights 400 to 800. Scale steps of about 1.25 (12, 13, 15/16, 17, 21, 26, 33 px). Prices use tabular numbers.

## Shape and spacing

- Radius: 4px (tags), 6px (cards, inputs, buttons), pill only for chips and tab icons.
- No shadows, with one exception: the card pop-up has a soft silver edge (white in dark mode). Hairline borders separate everything else.
- Spacing on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64.

## Motion

All in `src/styles/motion.css`. Small and quiet: smooth page and row scrolling, rows that snap, a short page entrance, cards easing in as they scroll up, a 2px card lift on hover, a slight press on buttons and chips, and photos crossfading in the gallery. Under 250ms ease-out. Anything that travels is switched off by `prefers-reduced-motion`.

## Rules (checked by `npm run check:slop`)

Do not use: gradients or gradient text, glassmorphism blur, glows, side-stripe borders, nested cards, icon-above-heading feature grids, eyebrow labels over every section, numbering on things that are not a sequence, bounce easing, `transition: all`, pure #000/#fff, em dashes, buzzwords ("seamless", "elevate", "empower"), invented numbers. Products with no reviews show "New", never a made-up rating.

Copy: buttons say what they do ("Add to cart", "Import", "Place order and pay", "Mark as shipped").
