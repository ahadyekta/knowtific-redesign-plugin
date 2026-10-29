# Discovery - understanding the business

Goal: by the end you can explain, in plain words, how this business makes money, who it serves,
why people choose it, and exactly what the website must get a visitor to do. Design comes later.

## Step 1 - Read the site before asking

From `crawl/pages.json`, `crawl/text/*.md` and screenshots, extract into `site-snapshot.md`:

| Area | What to capture |
|---|---|
| Offer | Every service/product named, which ones get the most space, any prices, packages, guarantees |
| Customer | Who the copy talks to (homeowners, builders, NDIS participants, insurers...), any niche |
| Place | Service area, suburbs mentioned, address, GBP/Maps embed, location pages |
| Action | How a visitor enquires: phone, form, booking tool, quote request, chat; where CTAs sit |
| Proof | Reviews (count, source), testimonials, photos of real jobs, licences, memberships, years |
| Story | About page: owner, team, why they started, values |
| Voice | Tone of copy, jargon level, consistency |
| Tech | CMS (from `site.json` generator/headers), booking/CRM tools, tracking tags found |
| Gaps | Anything a customer would want to know that isn't there |

Then score **clarity in 5 seconds**: looking only at the home hero screenshot, can a stranger say
(1) what they do, (2) for whom/where, (3) why them, (4) what to do next? Record yes/no for each.

## Step 2 - Competitors

Search the main service + city/suburb, the Maps pack, and any names the owner gives. For 3-5
competitors note: positioning line, offer, proof, CTA, what their site does better, what it does
worse. Finish with the **shelf test**: in a row of these results, why would someone pick our client?
If you can't answer, positioning is finding #1.

## Step 3 - Interview rounds

Use AskUserQuestion. Max 4 questions per round. Pre-fill options from what you already know so the
user can click instead of type ("From the site it looks like hot water is the main earner - right?").
The user may be the agency, not the owner; when they don't know, log it as a client question.

**Round 1 - Money and offer**
- Which 2-3 services make the most money / do they want more of?
- Typical job value and rough margin? Repeat or referral rate?
- How much more work can they take per week/month?

**Round 2 - Customers and place**
- Best recent customer and why they chose them. Who they don't want.
- Service area and where they won't travel. Residential vs commercial split.
- Common questions and worries before booking.

**Round 3 - Positioning and competition**
- Top competitors and why customers sometimes pick them instead.
- What they do that others don't or won't. One word they want to own.

**Round 4 - Proof and assets**
- Google rating and count, video testimonials, before/after photos, case studies.
- Licences, insurances, awards, years, jobs completed. Who will appear on camera.
- Existing logo files, brand guidelines, photography. Is the logo something they love or tolerate?

**Round 5 - Sales process**
- What happens after an enquiry, who responds and how fast, close rate, quote follow-up.
- CRM / job tool (ServiceM8, Tradify, Fergus, Simpro, Cliniko, Nookal, HubSpot...).

**Round 6 - Marketing and tracking**
- Lead sources by %, ad spend and cost per lead, who manages it.
- GA4 / Tag Manager / Meta pixel / Google Ads conversions installed? Search Console access?
- Social accounts and who posts.

**Round 7 - Project constraints**
- Goals for 3 and 12 months. Budget range. Deadline. Who will edit the site after launch.
- Keep or change CMS/hosting? Domain and email ownership. Must-keep pages or URLs (SEO equity).
- How much brand change is acceptable: tidy up / refresh / full rebrand?

## Step 4 - business-profile.md template

```markdown
# <Business> - business profile
_Last updated: <date> - Sources: site crawl, interview (<who>), competitor research_

## In one paragraph
<what they do, for whom, where, how they win>

## Positioning statement
For <who> who <need>, <business> is the <category> that <main benefit>.
Unlike <alternatives>, we <key difference>.
Positioning type: <performance / counter-position / niche / own one word / premium ... >

## Money map
| Service | Job value | Margin | Priority | Notes |

## Customers
- Primary audience: ... (what they search, what they fear, what convinces them)
- Secondary audience: ...
- Not a fit: ...
- Service area: ...

## Why customers choose them (evidence)
- ... (source: review / owner / site)

## Competitors (summary - details in competitors.md)

## Sales process and capacity
- Enquiry -> response time -> quote -> close rate -> follow-up
- Capacity: ...

## Marketing today
- Lead sources, spend, CPL, tracking status

## Website job
- Primary conversion: <call / quote form / online booking> for <audience>
- Secondary conversions: ...
- Must answer before booking: <price range, area, timing, trust...>

## Brand
- Current equity worth keeping: ...
- Appetite for change: tidy / refresh / rebrand

## Constraints
- Budget, deadline, CMS, who edits, URLs to preserve, compliance (AHPRA/ACL/...)

## Open questions for the client
- [ ] ...
```

Facts marked `[TO CONFIRM]` stay visible until answered.
