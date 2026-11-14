import { parseArgs } from "node:util";

import { doctor } from "./doctor";
import { down, downAll } from "./down";
import { assertId, isOurServer, listInstanceIds, readState } from "./instance";
import { smoke } from "./smoke";
import { up } from "./up";

/**
 * The verify harness (profile → Verify, scripts/verify/README.md):
 *
 *   npm run verify:up -- --id <id> [--ref <sha>]
 *   npm run verify:doctor -- --id <id>
 *   npm run verify:smoke -- --id <id>
 *   npm run verify:down -- --id <id>   |   npm run verify:down -- --all
 *   npm run verify:list
 */
async function main(): Promise<boolean> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      id: { type: "string" },
      ref: { type: "string" },
      all: { type: "boolean" },
      headed: { type: "boolean" },
    },
  });

  switch (positionals[0]) {
    case "up":
      await up(assertId(values.id), values.ref);
      return true;
    case "doctor":
      return doctor(assertId(values.id));
    case "smoke":
      return smoke(assertId(values.id), { headed: values.headed });
    case "down":
      if (values.all) await downAll();
      else await down(assertId(values.id));
      return true;
    case "list":
      list();
      return true;
    default:
      throw new Error("Brug: up | doctor | smoke | down | list (se scripts/verify/README.md).");
  }
}

function list(): void {
  const ids = listInstanceIds();
  if (ids.length === 0) console.log("Ingen instanser.");
  for (const id of ids) {
    const state = readState(id);
    if (!state) {
      console.log(`${id}  (ufærdig: kør verify:down -- --id ${id})`);
      continue;
    }
    const status = isOurServer(state) ? "kører" : "STOPPET";
    const source = state.pinned ? state.sha.slice(0, 8) : `arbejdstræ (${state.sha.slice(0, 8)})`;
    console.log(`${id}  ${status}  ${state.url}  ${source}  ${state.database}`);
  }
}

main().then(
  (ok) => process.exit(ok ? 0 : 1),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
