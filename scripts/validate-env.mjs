#!/usr/bin/env node
/**
 * Environment validation for Acquisition OS.
 * Soft warnings in development; hard failures for clearly invalid production configs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const errors = [];
const warnings = [];

const nodeMajor = Number(process.versions.node.split(".")[0]);
const engines = pkg.engines?.node ?? ">=20.9.0 <23";
if (nodeMajor < 20 || nodeMajor >= 23) {
  errors.push(`Node ${process.versions.node} does not satisfy engines.node (${engines}).`);
}

const pepper = process.env.SESSION_PEPPER;
const nodeEnv = process.env.NODE_ENV ?? "development";

if (!pepper || String(pepper).trim().length === 0) {
  if (nodeEnv === "production") {
    errors.push("SESSION_PEPPER is required in production.");
  } else {
    warnings.push(
      "SESSION_PEPPER is unset. Export a long random value before running the API (see .env.example)."
    );
  }
} else if (String(pepper).length < 16) {
  warnings.push("SESSION_PEPPER looks short (<16 chars). Use a long random secret.");
}

if (nodeEnv === "production" && !process.env.DATABASE_URL) {
  errors.push("DATABASE_URL is required in production (PGlite is not a production store).");
}

if (nodeEnv !== "production" && !process.env.DATABASE_URL) {
  warnings.push("DATABASE_URL unset — API will use embedded PGlite (dev/test only).");
}

for (const w of warnings) console.warn(`env:check WARN — ${w}`);
for (const e of errors) console.error(`env:check FAIL — ${e}`);

if (errors.length > 0) {
  console.error("env:check failed. Fix errors before deploy/verify in production mode.");
  process.exit(1);
}

console.log(
  `env:check PASS — node=${process.versions.node} env=${nodeEnv} pepper=${pepper ? "set" : "unset"} db=${process.env.DATABASE_URL ? "set" : "pglite-fallback"}`
);
