# Brand directions - 3 options

Inputs: `business-profile.md` (positioning, audience, appetite for change), `crawl/brand-current.json`
(current colours, fonts, logo), `competitors.md` (what to stand apart from), brand findings.

## The spread

Three directions that are genuinely different choices, so the client is choosing a strategy,
not a shade of blue. Default spread (rename to fit the client):

| | A - Evolve | B - Refresh | C - Bold |
|---|---|---|---|
| Change level | Low: keep recognisable equity | Medium: same values, modern execution | High: new identity led by positioning |
| Logo | Redraw/clean the existing mark, fix legibility | New logo keeping one link to the old (colour or symbol) | New concept |
| Colour | Current hues, fixed for contrast and given a system | Shifted palette, cleaner neutrals | Distinctive in the category (check competitors) |
| Type | Close to current, better hierarchy | Modern pair | Characterful heading face |
| Best when | Strong local recognition, vans/signage costly to change | Dated look, decent reputation | Repositioning, new niche, crowded category |

If the owner said "no rebrand", make all three Evolve-level but with different emphasis
(e.g. trustworthy / warm / premium).

## Each direction must include

1. **Concept** - one paragraph: the idea and how it expresses the positioning.
2. **Positioning angle** - which proof/benefit it puts first.
3. **Tagline** - short, specific, true. No "Excellence in..." filler.
4. **Voice** - 3 adjectives + one do / one don't line, plus an example headline.
5. **Palette** - the 11 tokens below. Every text pair must pass WCAG AA (4.5:1 normal text);
   `primary` on `bg` should reach 3:1 for UI. `build-preview.mjs` checks this and warns.
6. **Type** - heading + body from Google Fonts (exact family names), heading weight.
7. **Shape language** - radius and how it's used (sharp/technical, soft/friendly, pill/modern).
8. **Imagery direction** - what photos to shoot/choose (real team, job close-ups, before/after,
   lifestyle outcome), treatment (colour overlay, duotone, plain), what to avoid.
9. **Logo set** - original SVGs written by you (no copying other brands, no traced clip-art):
   - `logos/<id>-primary.svg` horizontal lockup (mark + wordmark), viewBox height ~ 64
   - `logos/<id>-mark.svg` square symbol / favicon, viewBox 0 0 64 64
   - `logos/<id>-on-dark.svg` lockup for dark backgrounds
   Use simple geometry, the brand colours as literal hex, text converted to paths is not required
   but set `font-family` to the heading font with a generic fallback. Test at 32px: the mark must
   still read. Keep the business name spelled exactly as registered.
10. **Rationale** - why this fits the audience and beats competitors; risks.

## brands.json schema

```json
{
  "client": "Example Plumbing",
  "brands": [
    {
      "id": "a",
      "name": "Evolve",
      "concept": "Keeps the familiar navy and the drop symbol...",
      "positioningAngle": "Same-day hot water, fixed price",
      "tagline": "Hot water back today. Fixed price, no surprises.",
      "voice": {"adjectives": ["Direct", "Reassuring", "Local"],
                "do": "Lead with the outcome and the timeframe",
                "dont": "Use trade jargon or vague superlatives",
                "exampleHeadline": "No hot water? We'll have it running today."},
      "colors": {
        "primary": "#0B4F6C", "onPrimary": "#FFFFFF",
        "accent": "#F2A541",  "onAccent": "#1B1B1B",
        "bg": "#FFFFFF", "surface": "#F3F6F8",
        "text": "#14212B", "muted": "#55646E", "border": "#DCE3E7",
        "dark": "#0E2733", "onDark": "#FFFFFF"
      },
      "fonts": {"heading": "Manrope", "body": "Inter", "headingWeight": 800},
      "radius": "12px",
      "shape": "Soft rounded cards, pill buttons",
      "imagery": "Real technicians, van in driveway, close-ups of clean installs. No stock handshakes.",
      "logo": {"primary": "logos/a-primary.svg", "mark": "logos/a-mark.svg", "onDark": "logos/a-on-dark.svg"},
      "rationale": "..."
    }
  ]
}
```

These tokens become CSS variables in every variation (set by `_rd/brand-runtime.js`):
`--c-primary --c-on-primary --c-accent --c-on-accent --c-bg --c-surface --c-text --c-muted
--c-border --c-dark --c-on-dark --f-heading --f-body --fw-heading --rd-radius`, and Tailwind
utilities in the starter (`bg-primary`, `text-ink`, `font-heading`, `rounded-brand`...).

Optional font fields: `headingFallback` / `bodyFallback` (CSS fallback stack), and
`headingIsSystem` / `bodyIsSystem: true` for fonts that are not on Google Fonts.

The viewer automatically adds a 4th option, **Current**, from `crawl/brand-current.json`, so the
client can see a new layout in their existing colours too.
