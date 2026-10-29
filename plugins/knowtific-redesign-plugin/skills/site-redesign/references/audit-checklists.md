# Audit checklists, scoring and findings schema

Audit through the lens of the business profile: a problem matters in proportion to how much it
costs enquiries, trust or rankings for the **money services** and **primary audience**.

## Dimensions

Use these exact keys in `findings.json` and `scorecard.json`.

### 1. `clarity` - message and positioning on the page
- 5-second test on hero: what / for whom + where / why them / next step.
- Headline states an outcome or the service + place, not a slogan ("Excellence in every job").
- Generic claims (quality, friendly, competitive prices) with no proof.
- Jargon the customer wouldn't use; service names the customer wouldn't search.
- Each page has one job; no page tries to say everything.
- Positioning line from the profile appears (or its absence is noted).

### 2. `conversion` - turning visitors into enquiries
- Primary CTA above the fold on desktop and mobile; one primary action, consistent wording.
- Click-to-call on mobile (tel: link), sticky call/quote on mobile for trades.
- Forms: number of fields (aim <= 5 for first contact), labels, error messages, success state,
  what happens next, response-time promise. Form actually submits (check action / JS).
- Friction: pop-ups, captchas, required fields that aren't needed, dead ends (pages without CTA).
- Objection handling near CTAs: price guidance, area, timing, guarantee, licence, reviews.
- Dedicated landing pages for ads/money services exist? (One page, one action, no nav leaks.)
- Thank-you page, tracking of conversions.
- Service page structure (hero -> results -> benefits -> how it works -> included -> proof -> team ->
  reviews -> FAQ -> final CTA): which parts are missing?

### 3. `trust` - proof
- Reviews: count, rating, source, freshness; embedded or just claimed.
- Real photos (team, vans, jobs) vs stock. Before/after. Case studies.
- Licences, insurance, memberships, awards, years, ABN. Guarantees.
- About page tells a human story; faces of the people who will turn up.
- Outdated content (old dates, "COVID" notices, dead social links, © 2019).

### 4. `ui` - visual design
- Visual hierarchy: one focal point per section; headings scale; CTA stands out.
- Consistency: colours, button styles, spacing, type sizes, icon styles across pages.
- Typography: body >= 16px, line length 50-80 chars, line height, too many fonts (see
  `brand-current.json` font counts).
- Colour use and contrast; brand colours used meaningfully.
- Imagery quality, cropping, relevance; image heavy sliders.
- Looks dated? (Name the specific pattern: carousel hero, centred everything, bevel buttons...).

### 5. `ux` - navigation and usability
- Nav labels match how customers think; money services reachable in 1 click; <= 7 top items.
- Mobile menu works, tap targets >= 44px, no horizontal scroll (check mobile screenshots).
- Search, breadcrumbs, internal links between related services and locations.
- Broken links / 404s / redirect chains (`pages.json` status, `site.json` broken).
- Footer: contact details, hours, area, key links.
- Content findability: can a user find price guidance, area, booking in under 3 clicks?

### 6. `content` - copy and information
- Thin pages (< 300 words on a service page), duplicate pages, copy-pasted location pages.
- Customer language vs owner language; benefits vs features.
- Missing pages: each money service, each key location, FAQ, pricing guide, process, warranty.
- Spelling/grammar errors (quote them), outdated info.

### 7. `seo` - technical, on-page and local
- Titles (unique, 50-60 chars, service + location + brand), meta descriptions (unique, 120-155).
- One H1 per page, logical H2/H3; headings contain the service terms.
- Indexability: robots.txt, meta robots, canonicals, sitemap.xml present and correct, noindex leaks.
- URL structure, trailing slash/www/https consistency, redirect chains.
- Structured data: LocalBusiness (or subtype), Service, FAQPage, Review where allowed, BreadcrumbList.
- Images: alt text, file names, size.
- Local: NAP consistent with GBP, location pages, embedded map, suburbs served.
- Internal linking and orphan pages.
- AI search readiness: clear entity facts (who/what/where), FAQ answers, llms.txt optional.

### 8. `performance`
- Lighthouse mobile performance score, LCP, CLS, TBT/INP, total page weight, requests.
- Field data (CrUX via PSI) if available - this beats lab data.
- Biggest wins: unoptimised images, render-blocking scripts, heavy page builders, third-party tags,
  web fonts, no caching/CDN.

### 9. `accessibility`
- axe violations by impact (critical/serious first): contrast, missing labels, alt, landmarks,
  heading order, link names, focus visibility, keyboard traps, lang attribute.
- Reference WCAG 2.2 AA criterion for each.

### 10. `mobile`
- Mobile screenshot review: hero legibility, CTA visible, text size, images cropping, sticky bars
  covering content, horizontal overflow, phone number tappable.

### 11. `brand` - identity and consistency
- Logo: legibility at small sizes, works on dark/light, favicon, file quality (raster/blurry?),
  distinctiveness in the category, matches positioning.
- Consistency across site, GBP, socials, vans/uniforms if known.
- Palette and type support the positioning (premium vs value vs trusted local).
- Voice consistency.

### 12. `marketing` - funnel and growth readiness
- Tracking: GA4, GTM, Google Ads conversion, Meta pixel, call tracking (`pages.json` tags).
- Lead capture beyond the form: booking, chat, SMS, lead magnets.
- Landing pages ready for ads? Offer clarity? Remarketing possible?
- Email/SMS capture, review generation flow, GBP link.
- Content engine: blog freshness, topics vs customer questions.
- Speed to lead (from interview).

### 13. `compliance` - see compliance-au.md
- Privacy policy present and current, cookie notice if tracking, terms.
- AHPRA rules for health (no testimonials about clinical outcomes, no misleading claims).
- Australian Consumer Law: pricing claims, "from" prices, guarantees.
- Licence numbers shown where required (e.g. electricians, plumbers, builders in some states).

### 14. `security` - basics only
- HTTPS everywhere, mixed content, outdated CMS/plugins visible in generator meta or headers,
  exposed admin URLs, missing security headers (note, don't alarm).

## Severity rubric

For each finding set:
- `impact`: `high` (directly loses enquiries/rankings/trust on money pages, legal risk, broken
  function), `medium` (noticeable friction or missed opportunity), `low` (polish).
- `effort`: `S` (< 2 h), `M` (half day to 2 days), `L` (part of rebuild / > 2 days).
- `reach`: number of pages affected or `sitewide`.

Priority:
| | S | M | L |
|---|---|---|---|
| high | P1 quick win | P1 | P2 (rebuild) |
| medium | P2 quick win | P2 | P3 |
| low | P3 | P3 | P4 |

## findings.json schema

```json
[
  {
    "id": "F-001",
    "dimension": "conversion",
    "title": "No call button visible on mobile home screen",
    "pages": ["/", "/hot-water"],
    "evidence": "Mobile hero screenshot shows logo + slider; phone number only in footer (crawl/shots/home-mobile.png). No tel: links found on 9 of 11 pages.",
    "why": "Most hot-water leads are urgent mobile searches; hiding the number loses calls.",
    "fix": "Sticky bottom bar on mobile with Call + Get quote; tel: link in header.",
    "impact": "high",
    "effort": "S",
    "reach": 11,
    "priority": "P1",
    "service": "website",
    "clientSummary": "People on phones can't easily call you - the number is hidden at the bottom.",
    "screenshot": "02-audit/crawl/shots/home--mobile.png"
  }
]
```

`service` is one of: `website`, `seo`, `local-seo`, `ads`, `crm`, `automation`, `branding`,
`content`, `photography`, `tracking`, `hosting`.

## scorecard.json

```json
{
  "overall": 4.6,
  "dimensions": {
    "clarity": {"score": 4, "reason": "Hero says 'Quality you can trust' - no service or area."},
    "conversion": {"score": 3, "reason": "..."}
  }
}
```

Score 0-10 per dimension; overall is the mean weighted x2 for clarity, conversion, trust and
mobile (the ones that cost enquiries). Be calibrated: 5 = average small-business site, 8 = better
than every local competitor, 10 = nothing worth fixing.
