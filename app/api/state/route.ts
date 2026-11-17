/** Mock backend: one JSON file on disk (.data/db.json). It holds the whole demo state so data is kept between reloads and shared
 *  between browser windows. Nothing here is real: no auth, no database. Delete the file or press "Reset demo data" to start over. */
import { promises as fs } from "fs";
import path from "path";
import { STATE_VERSION } from "@/lib/version";

/* Vercel functions can only write to /tmp, which is per-instance and wiped on cold starts. */
const FILE = process.env.VERCEL ? "/tmp/sherpa-db.json" : path.join(process.cwd(), ".data", "db.json");
type Db = { rev: number; state: unknown };

const versionOf = (x: unknown) => Number((x as { v?: number } | null)?.v ?? 0);

async function read(): Promise<Db | null> {
  try { const db = JSON.parse(await fs.readFile(FILE, "utf8")) as Db; return versionOf(db.state) === STATE_VERSION ? db : null; } catch { return null; }
}
const noStore = { headers: { "cache-control": "no-store" } };

export async function GET(req: Request) {
  void req.headers; // reading the request keeps this route dynamic
  return Response.json((await read()) ?? { rev: 0, state: null }, noStore);
}

export async function PUT(req: Request) {
  let body: { state?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (!body.state || typeof body.state !== "object") return Response.json({ error: "no state" }, { status: 400 });
  const cur = await read();
  /* A tab still running older code would overwrite the current data with its old copy. */
  if (versionOf(body.state) !== STATE_VERSION) return Response.json({ error: "stale version", v: STATE_VERSION }, { status: 409, ...noStore });
  const rev = (cur?.rev ?? 0) + 1;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ rev, state: body.state }));
  return Response.json({ rev }, noStore);
}

export async function DELETE(req: Request) {
  void req.headers;
  try { await fs.unlink(FILE); } catch { /* already gone */ }
  return Response.json({ ok: true }, noStore);
}
