# VTOP parser fixtures

HTML pages that the parser tests in `../parsers.test.ts` run against.

**These started as hand-written pages** that reproduce the markup each parser
reads (the selectors in `../*.ts`). They pin today's parsing behaviour, so a
parser change that breaks extraction fails a test.

They are not yet real VTOP output. To replace one with a real page:

1. Save the page body while logged in (DevTools → Network → the request → Response).
2. Scrub it: `node tools/scrub-vtop-fixture.mjs saved.html > src/lib/parsers/__fixtures__/<name>.html`
   (replaces register numbers, names, emails, phone numbers and inline photos).
3. Read the scrubbed file before committing. The script is a safety net, not a guarantee.
4. Update the expected values in the test.

When VTOP changes its markup, add the new page as a second fixture rather than
overwriting the old one, so both shapes stay covered.
