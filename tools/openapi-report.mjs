#!/usr/bin/env node
// Build the OpenAPI spec the way /api/docs does and report how much of it
// describes real response bodies. A generated, typed client for the frontend
// is only as useful as this number.
//
//   node tools/openapi-report.mjs                 # summary
//   node tools/openapi-report.mjs --list          # also list undocumented routes
//   node tools/openapi-report.mjs --out spec.json # also write the spec
//   node tools/openapi-report.mjs --min 10        # exit 1 below 10% coverage
//
// It also fails on any $ref that points at a missing component.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const swaggerJsdoc = require("swagger-jsdoc");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const spec = swaggerJsdoc({
  definition: { openapi: "3.0.0", info: { title: "AmazeCC API", version: "1.0.0" } },
  apis: ["./src/app/api/**/*.ts", "./src/app/api/**/*.js", "./src/lib/openapi/*.ts"],
});

const schemas = spec.components?.schemas ?? {};
const brokenRefs = new Set();
(function walk(node) {
  if (!node || typeof node !== "object") return;
  if (typeof node.$ref === "string") {
    const name = node.$ref.replace("#/components/schemas/", "");
    if (!schemas[name]) brokenRefs.add(node.$ref);
  }
  for (const v of Object.values(node)) walk(v);
})({ paths: spec.paths, schemas });

const isDescribed = (schema) =>
  !!schema && Boolean(schema.$ref || schema.properties || schema.items || schema.allOf || schema.oneOf || schema.anyOf);

const ops = [];
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(item)) {
    const ok = Object.entries(op.responses ?? {}).find(([code]) => code.startsWith("2"));
    const schema = ok?.[1]?.content?.["application/json"]?.schema;
    ops.push({ id: `${method.toUpperCase()} ${path}`, described: isDescribed(schema) });
  }
}

const described = ops.filter((o) => o.described).length;
const pct = ops.length ? Math.round((100 * described) / ops.length) : 0;
console.log(`${described} of ${ops.length} operations describe their success response (${pct}%).`);
console.log(`${Object.keys(schemas).length} shared schemas in components.`);
if (args.includes("--list")) {
  console.log("\nUndocumented:");
  for (const o of ops.filter((o) => !o.described)) console.log(`  ${o.id}`);
}

const out = opt("--out");
if (out) {
  writeFileSync(out, JSON.stringify(spec, null, 2));
  console.log(`Wrote ${out}`);
}

let failed = false;
if (brokenRefs.size) {
  console.error(`\nBroken $refs: ${[...brokenRefs].join(", ")}`);
  failed = true;
}
const min = Number(opt("--min"));
if (Number.isFinite(min) && pct < min) {
  console.error(`\nCoverage ${pct}% is below --min ${min}%.`);
  failed = true;
}
process.exit(failed ? 1 : 0);
