#!/usr/bin/env node
// Scrub a saved VTOP page before committing it as a parser fixture.
//
//   node tools/scrub-vtop-fixture.mjs saved.html > src/lib/parsers/__fixtures__/name.html
//
// Replaces register numbers, emails, phone numbers, inline (base64) photos,
// CSRF tokens and hidden-input values. Names cannot be detected reliably:
// pass them with --name "FULL NAME" (repeatable) and READ THE OUTPUT before
// committing it.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--name");
if (!file) {
  console.error('usage: scrub-vtop-fixture.mjs <saved.html> [--name "FULL NAME" ...]');
  process.exit(1);
}
const names = args.flatMap((a, i) => (args[i - 1] === "--name" ? [a] : []));

let html = readFileSync(file, "utf8");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

html = html
  .replace(/\b\d{2}[A-Z]{3}\d{4}\b/g, "21BCE0000") // register numbers
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "someone@example.edu") // emails
  .replace(/(?<!\d)(\+91[\s-]?)?[6-9]\d{9}(?!\d)/g, "9000000000") // Indian mobiles
  .replace(/src=(["'])data:image\/[^"']+\1/g, 'src="data:image/png;base64,AAAA"') // photos
  .replace(/(name=["']_csrf["'][^>]*value=["'])[^"']*/g, "$1CSRF") // csrf
  .replace(/(<input[^>]*type=["']hidden["'][^>]*value=["'])[^"']*/g, "$1HIDDEN"); // hidden inputs

for (const n of names) html = html.replace(new RegExp(escapeRe(n), "gi"), "TEST STUDENT");

process.stdout.write(html);
