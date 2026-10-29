# Page variations - 3 key pages x 3 layouts

Each variation is a single self-contained HTML file at `06-variations/<page-slug>/<a|b|c>.html`,
built from `${CLAUDE_PLUGIN_ROOT}/templates/variation-starter.html`. They are high-fidelity,
responsive, clickable prototypes with real copy - close enough that the client can judge the
real thing and the agency can port them to Next.js/WordPress without redesigning.

## Three strategies, not three skins

Layouts must differ in **how they persuade**. Pick 3 that fit the page and the audience, e.g.:

| Strategy | Hero | Body emphasis | Best for |
|---|---|---|---|
| Proof-led | Outcome headline + rating badge + real photo | Reviews, before/after, numbers, licences | High-trust, high-price, health |
| Offer/urgency-led | Problem -> offer -> instant CTA, phone big | Pricing guide, guarantee, response time, sticky CTA | Emergency trades, ad landing pages |
| Guided/education-led | Question or quiz entry ("What do you need?") | How it works, options compared, FAQ, process | Considered purchases, NDIS/allied health |
| Local-hero | Owner/team face + suburb | Story, community, map of areas | Owner-operated businesses |
| Visual-portfolio | Full-bleed project gallery | Projects, craft detail, process | Builders, landscapers, designers |
| Booking-first | Embedded availability / booking widget mock | Practitioners, services, prices | Clinics, salons |

Label each with `<meta name="rd:label" content="Proof-led">` and
`<meta name="rd:strategy" content="One sentence: who it's for and how it persuades">`.

## Every variation must

- Follow the page plan in `04-plan/plan.md` (sections and CTA) and fix the findings listed for
  that page. Add `<meta name="rd:fixes" content="F-001,F-004,F-012">`.
- Use **only brand tokens** for colour, fonts and radius (Tailwind classes mapped to tokens in the
  starter, or `var(--c-*)`). No hard-coded hex values except in decorative SVG you can't avoid.
  This is what lets the viewer swap brands live.
- Use the logo through `<img data-brand-logo="primary" alt="<Business> logo">` (or `mark`,
  `onDark`) and the tagline through `<span data-brand-tagline></span>`. The runtime fills them.
- Be mobile-first and fully responsive: check at 390, 834 and 1440 wide. Sticky mobile CTA for
  trades. Tap targets >= 44px.
- Meet WCAG 2.2 AA in the markup: landmarks, one H1, heading order, labels on every field, alt on
  every image, visible focus, `lang="en-AU"`.
- Use real business facts from the profile. Unknown facts -> `[TO CONFIRM: ...]` in a visible
  highlight (the starter styles `.tbc`). Never invent reviews, ratings, prices or licence numbers;
  for review blocks use real reviews from the site/GBP or a clearly marked placeholder.
- Images: prefer the client's real photos from `02-audit/crawl/images/` (referenced as
  `../../_rd/img/<file>`; the preview build copies them). Otherwise use a placeholder
  `<div class="rd-ph" style="aspect-ratio:4/3" data-label="Photo: technician with van"></div>`.
  No hotlinked stock, no AI-generated people.
- Navigation links between the 3 key pages work (`../<other-slug>/<same-letter>.html`), other nav
  items can be `#`.
- Forms are front-end only: validate, show a success state, never submit anywhere.
- Small, quality interactions only (accordion FAQ, tabs, sticky header). No heavy animation libs.
- Include header and footer so it reads as a real site, consistent within the same letter across
  pages (A pages share a header/footer, B pages share theirs, etc.).

## Quality bar

Before finishing a page, open it in a browser at mobile and desktop width (Playwright screenshot
is fine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/shoot.mjs" <file> --out <dir>`) and look at it.
Check: hierarchy obvious in 5 seconds, CTA visible above the fold on mobile, nothing overflowing,
the three letters look clearly different from each other, nothing looks like a generic template.
If the `frontend-design` skill is available, read it before building the first variation.
