# Queue

One prospect per line: `- [ ] https://site.com.au | Business name | trade | suburb`.
`prospect next` processes the first unchecked line and ticks it with the result
(`done`, `skipped: <reason>`). You can add lines by hand; the business name, trade and suburb may
be left empty and will be filled from the site.

