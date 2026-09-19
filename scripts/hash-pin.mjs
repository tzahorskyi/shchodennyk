import { createHash } from "node:crypto";

const [pepper, pin] = process.argv.slice(2);
if (!pepper || !pin || pin.length < 4) {
  console.error('Usage: node scripts/hash-pin.mjs "<PIN_PEPPER>" "<PIN>"');
  process.exit(1);
}

console.log(createHash("sha256").update(`${pepper}:${pin}`).digest("hex"));

