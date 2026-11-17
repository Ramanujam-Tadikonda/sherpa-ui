/* SHERPA: mock NewCRM data for the Zurich region, region price reference, offers with approvals, effects that write back to the
   mock CRM, and the next-best-action engine for all 27 NBAs. Everything is deterministic rules. There is no AI here: the chat and the
   cards only dress these results up. */
import { PLACES, USERS } from "./data";
import { tierOf } from "./engine";
import { CT } from "./contracts";
import { unitHealth } from "./scores";
import type { Account, Alert, Asset, Campaign, ChatMsg, Config, MLead, Offer, Opp, OppStage, Past, ProductKey, QuoteBrief, Reason, Report, Sherpa, SiteVisit, State, Task, TaskKind, Tender, TenderDoc, User } from "./types";

export const DAY = 86400000;
export const HOUR = 3600000;
export const nowS = (s: State) => Date.now() + s.clock;
/** Set by the store: closes the Snap & Lead item behind a deal, so the reporter sees the result and gets the points. Kept as a hook to avoid an import cycle. */
export const leadHooks: { closed?: (s: State, itemId: string, by: string, result: "won" | "lost" | "notinterested") => void; quoted?: (s: State, itemId: string, by: string) => void; progress?: (s: State, itemId: string, steps: string[], step: number) => void } = {};

/** The reporter's tracker for a sales lead follows the deal in SHERPA step by step. */
const LEAD_HEAD = ["Submitted", "With the area rep", "Site visit", "Manager review", "Quotation or bid"];
/** The steps the reporter sees, mirroring the deal: the contract comes after the win, and the work starts after the contract. */
export function leadFlow(o: Opp): { steps: string[]; step: number } {
  if (o.stage === "lost") return { steps: [...LEAD_HEAD, "Lost"], step: 5 };
  if (o.stage === "closed") return { steps: [...LEAD_HEAD, "Closed"], step: 5 };
  const steps = [...LEAD_HEAD, "Won", "Contract", "Work initiated"];
  const step = o.stage === "scout" ? (o.site || o.technician ? 2 : 1) : o.stage === "nurture" ? 2 : o.stage === "review" ? 3
    : o.stage === "contract" ? 6 : o.stage === "won" ? 7 : 4;
  return { steps, step };
}

export const PRODUCT: Record<ProductKey, { label: string; yearly: boolean; list: number; agent: string }> = {
  renewal: { label: "Service contract renewal", yearly: true, list: 4800, agent: "Proposal Generator" },
  maintenance: { label: "Maintenance contract", yearly: true, list: 4200, agent: "Proposal Generator" },
  repair: { label: "Repair quote", yearly: false, list: 3200, agent: "Repair Lead Generation" },
  modernisation: { label: "Modernisation package", yearly: false, list: 110000, agent: "MOD Propensity Scoring" },
  newinstall: { label: "New installation proposal", yearly: false, list: 140000, agent: "Proposal Generator" },
};
/** Price level by sales area. An area not listed here is one where we do not sell. */
export const FACTOR: Record<string, number> = { ZHW: 1, ZHC: 0.98, ZHN: 0.93, WIN: 0.88 };
export const AREA_NAME: Record<string, string> = { ZHW: "Zurich West", ZHC: "Zurich City", ZHN: "Zurich North", WIN: "Winterthur", OUT: "outside Zurich" };
export const GUIDE = { seller: 10, manager: 20 };
export const chf = (n: number) => `CHF ${Math.round(n).toLocaleString("de-CH")}`;
export const chfShort = (n: number) => (n >= 1e6 ? `CHF ${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")} M` : n >= 1e4 ? `CHF ${Math.round(n / 1e3)}k` : chf(n));

export const listPrice = (area: string, product: ProductKey, term: number) => Math.round(PRODUCT[product].list * (FACTOR[area] ?? 1) * (PRODUCT[product].yearly ? term : 1));
/** Up to 10% the seller sends alone. Up to 20% the sales manager approves. Above 20% is outside this app: it needs the regional lead in writing. */
export const approversFor = (pct: number, cfg?: Pick<Config, "approveAll">): string[] => (pct > GUIDE.manager ? [] : pct > GUIDE.seller || (cfg?.approveAll ?? true) ? ["marc"] : []);
export const aboveLimit = (pct: number) => pct > GUIDE.manager;
export const MANAGER = "marc"; export const SUPPORT = "shalini";
/** The papers a tender bid usually needs. The Sales Manager builds the bid from these. */
export type BidInfo = { answers: Record<string, string>; priority?: string; rivals?: string; note?: string };
export const BID_PAPERS = [
  { key: "emd", title: "Bid security (EMD)", help: "Money or a bank guarantee that shows we are serious. Usually 2% of the bid price.", auto: false },
  { key: "company", title: "Company papers", help: "Commercial register, VAT number and tax certificate. Taken from the company file.", auto: true },
  { key: "past", title: "Similar past projects", help: "A list of lifts we installed for other customers.", auto: true },
  { key: "turnover", title: "Turnover statement", help: "Yearly sales for the last 3 years.", auto: true },
  { key: "compliance", title: "Technical compliance sheet", help: "Line by line: what the tender asks and what our lift gives.", auto: true },
  { key: "price", title: "Price sheet", help: "The price of every lift, in the tender's format.", auto: true },
  { key: "datasheets", title: "Lift datasheets and drawings", help: "Technical pages for the lift model we offer.", auto: true },
  { key: "declarations", title: "Signed declarations and authority letter", help: "Signed statements the tender asks for. The manager signs them.", auto: false },
] as const;
const PAPER_LIST = () => BID_PAPERS.map((p) => ({ t: p.title, done: false }));
export const perYear = (o: Pick<Offer, "price" | "term" | "product">) => (PRODUCT[o.product].yearly ? o.price / o.term : o.price);
export const NAMES: Record<string, string> = { ...Object.fromEntries(USERS.map((u) => [u.id, u.name])), projectfinder: "Project Lead Finder", legal: "Legal team" };

/* ------------------------------------------------------------------ region reference */
export interface RegionRef { area: string; sells: boolean; count: number; avg: number; min: number; max: number; avgDiscount: number; wins: number; winRate: number }
export function regionRef(s: State, area: string, product: ProductKey): RegionRef {
  const sells = area in FACTOR;
  const all = s.sherpa.past.filter((p) => p.area === area && p.product === product && nowS(s) - p.at < 365 * DAY);
  const n = all.length; const prices = all.map((p) => p.price); const wins = all.filter((p) => p.outcome === "won").length;
  return { area, sells, count: n, avg: n ? prices.reduce((a, b) => a + b, 0) / n : 0, min: n ? Math.min(...prices) : 0, max: n ? Math.max(...prices) : 0, avgDiscount: n ? all.reduce((a, p) => a + p.discountPct, 0) / n : 0, wins, winRate: n ? Math.round((wins / n) * 100) : 0 };
}
export function winChanceWhy(s: State, area: string, product: ProductKey, pct: number) {
  const base = s.sherpa.past.filter((p) => p.area === area && p.product === product);
  const near = base.filter((p) => Math.abs(p.discountPct - pct) <= 6);
  const close = near.length >= 3; const set = close ? near : base; const won = set.filter((p) => p.outcome === "won").length;
  return { pct: set.length ? Math.round((won / set.length) * 100) : 0, won, n: set.length, close, lo: Math.max(0, pct - 6), hi: pct + 6 };
}
export const winChance = (s: State, area: string, product: ProductKey, pct: number) => winChanceWhy(s, area, product, pct).pct;
export function variantsFor(product: ProductKey) {
  return PRODUCT[product].yearly
    ? [{ key: "A", label: "1 year, list price", term: 1, disc: 0 }, { key: "B", label: "3 years, 8% off", term: 3, disc: 8 }, { key: "C", label: "5 years, 15% off", term: 5, disc: 15 }]
    : [{ key: "A", label: "Standard scope, list price", term: 1, disc: 0 }, { key: "B", label: "Standard scope, 8% off", term: 1, disc: 8 }, { key: "C", label: "Extended scope, 15% off", term: 1, disc: 15 }];
}

/* ------------------------------------------------------------------ seed */
const CUST = ["Alpine Logistics AG", "Limmat Hospitality", "Sihl Riverside Hotels", "Zürichberg School", "Glatt Builders AG", "Uetliberg Insurance", "Hardturm Parking Services", "Seeblick Wellness"];
const DISC = [4, 8, 12, 6, 15, 9, 18, 3, 11, 22, 7];
function seedPast(now: number): Past[] {
  const out: Past[] = []; let n = 0;
  (["ZHW", "ZHC", "ZHN", "WIN"] as const).forEach((area) => (Object.keys(PRODUCT) as ProductKey[]).forEach((product) => {
    const count = product === "modernisation" || product === "newinstall" ? 5 : product === "renewal" ? 9 : 7;
    for (let i = 0; i < count; i++) {
      const d = DISC[(n + i * 3) % DISC.length];
      out.push({ id: `p${n}-${i}`, area, product, price: Math.round(PRODUCT[product].list * FACTOR[area] * (1 - d / 100)), discountPct: d, outcome: (n * 7 + i * 3 + d) % 5 < (d <= 8 ? 2 : d <= 14 ? 3 : 4) ? "won" : "lost", at: now - (20 + ((n + i) * 29) % 330) * DAY, customer: CUST[(n + i) % CUST.length] });
    }
    n++;
  }));
  return out;
}

export function seedSherpa(): Sherpa {
  const now = Date.now();
  const acc = (id: string, name: string, area: string, place: string, owner: string, ago: number, c: [string, string, string], lines: Account["lines"], key = false, lostBids?: string): Account =>
    ({ id, name, area, key, placeIds: [place], owner, lastActivity: now - ago * DAY, contact: { name: c[0], role: c[1], email: c[2] }, lines, lostBids });
  const accounts: Account[] = [
    acc("deccan", "Altstetten Tech Park AG", "ZHW", "techpark", "ethan", 71, ["Daniel Müller", "Head of Facilities", "daniel.mueller@altstettentech.example"], { ni: true, ei: true, sc: true, mod: false }, true),
    acc("cyber", "Limmat Office Park Immobilien AG", "ZHW", "riverside", "ethan", 9, ["Reto Kälin", "Facility manager", "reto.kaelin@limmatpark.example"], { ni: false, ei: true, sc: true, mod: false }),
    acc("banjara", "Bahnhofplatz Retail AG", "ZHC", "citymall", "elias", 20, ["Simone Gerber", "Centre manager", "simone.gerber@bahnhofplatzretail.example"], { ni: false, ei: true, sc: true, mod: false }),
    acc("kakatiya", "Eulach Medical Centre", "WIN", "baselhosp", "ethan", 33, ["Dr. Urs Hofmann", "Technical director", "urs.hofmann@eulachmc.example"], { ni: false, ei: true, sc: true, mod: false }),
    acc("kokapet", "Seefeld Development AG", "ZHC", "harbour", "noah", 12, ["Beat Schneider", "Project head", "beat.schneider@seefelddev.example"], { ni: true, ei: false, sc: false, mod: false }, false, "Lost the 2025 Altstetten tower bid on price: OtherLift was 14% lower with a longer lead time."),
    acc("secbiz", "Oerlikon Business Hub AG", "ZHN", "secbiz", "lena", 48, ["Laura Meyer", "Estate head", "laura.meyer@oerlikonhub.example"], { ni: true, ei: false, sc: false, mod: false }, true),
    acc("tsic", "Stadthaus Facilities Office", "ZHC", "cityhall", "noah", 26, ["S. Widmer", "Executive engineer", "s.widmer@stadthaus.example"], { ni: false, ei: true, sc: false, mod: false }),
  ];
  const ast = (id: string, accountId: string, placeId: string, label: string, model: string, age: number, o: Partial<Asset> & { owner: string }): Asset =>
    ({ id, accountId, placeId, label, model, ageYears: age, brand: "ours", callbacks14d: 0, callbacks90d: 0, callbacksPrev90d: 0, faults90d: 0, health: 80, servicer: "Schindler", ...o });
  const assets: Asset[] = [
    ast("a74821", "deccan", "techpark", "Lift 74821 · Altstetten Tech Park, Tower 2", "Schindler 3300", 12, { owner: "ethan", sc: "sofia", contractEnd: now + 38 * DAY, contractValue: 4800, callbacks14d: 2, callbacks90d: 9, callbacksPrev90d: 5, faults90d: 3, health: 38 }),
    ast("a75200", "deccan", "techpark", "Lift 75200 · Altstetten Tech Park, Tower 1", "Schindler 3300", 10, { owner: "ethan", contractEnd: now + 120 * DAY, contractValue: 4600, obr: 3, contractChangedAfterObr: true, health: 74 }),
    ast("a77300", "deccan", "techpark", "Lift 77300 · Altstetten Tech Park, Tower 3", "Schindler 3100", 14, { owner: "ethan", contractEnd: now + 240 * DAY, contractValue: 4400, callbacks90d: 3, callbacksPrev90d: 2, faults90d: 2, health: 66, techNote: "Technician visit 3 Nov: door roller worn on landings 2 and 5. Replace 4 rollers and re-align the door sill." }),
    ast("a74820", "cyber", "riverside", "Lift 74820 · Limmat Office Park, Tower A", "Schindler 3300", 9, { owner: "ethan", contractEnd: now + 200 * DAY, contractValue: 4300, callbacks14d: 1, callbacks90d: 2, callbacksPrev90d: 1, faults90d: 1, health: 82 }),
    ast("a75110", "cyber", "riverside", "Lift 75110 · Limmat Office Park, Tower B", "Schindler 3300", 11, { owner: "ethan", contractEnd: now + 160 * DAY, contractValue: 4500, callbacks90d: 8, callbacksPrev90d: 5, faults90d: 2, health: 61 }),
    ast("a90311", "kakatiya", "baselhosp", "Lift 90311 · Eulach Medical Centre", "Schindler 5500", 15, { owner: "ethan", sc: "sofia", contractEnd: now + 70 * DAY, contractValue: 7000, callbacks90d: 8, callbacksPrev90d: 3, faults90d: 2, health: 41 }),
    ast("a61102", "banjara", "citymall", "Lift 61102 · Bahnhofplatz Galerie, Block B", "Schindler 3100", 27, { owner: "elias", mod: "mia", contractEnd: now + 300 * DAY, contractValue: 5100, callbacks90d: 6, callbacksPrev90d: 6, faults90d: 5, health: 55, obsolete: "Door operator board DO-31 is discontinued. Last-time buy closes in 6 months." }),
    ast("a82010", "banjara", "citymall", "Lift 82010 · Bahnhofplatz Galerie, Block A", "Schindler 3300", 21, { owner: "elias", mod: "mia", contractEnd: now + 150 * DAY, contractValue: 4700, callbacks90d: 4, callbacksPrev90d: 3, faults90d: 2, obr: 6, health: 58 }),
    ast("a50113", "banjara", "citymall", "Lift 50113 · Bahnhofplatz Galerie, Block D", "Schindler 3100", 22, { owner: "elias", contractEnd: now + 400 * DAY, contractValue: 4300, health: 70 }),
    ast("a88002", "banjara", "citymall", "Lift 88002 · Bahnhofplatz Galerie, Block C (new)", "Schindler 5500", 0, { owner: "elias", handedOver: true, servicer: "none yet", health: 95 }),
    ast("a50112", "tsic", "cityhall", "Lift 50112 · Stadthaus Annexe", "Schindler 3100", 26, { owner: "elias", mod: "mia", contractEnd: now + 350 * DAY, contractValue: 4200, health: 62 }),
    ast("a50111", "secbiz", "secbiz", "Lift 50111 · Oerlikon Business Hub", "Schindler 3300", 24, { owner: "elias", contractEnd: now + 420 * DAY, contractValue: 4200, health: 72 }),
  ];
  assets.forEach((a) => { a.health = unitHealth(a).score; });
  const tender = (id: string, name: string, accountId: string, area: string, owner: string, line: Tender["line"], stage: Tender["stage"], eordDays: number, lifts: number, summary: string, o: Partial<Tender> = {}): Tender =>
    ({ id, name, accountId, area, owner, line, stage, eord: now + eordDays * DAY, value: lifts * PRODUCT.newinstall.list, lifts, summary, discovered: now - 12 * DAY, checklist: PAPER_LIST(), ...o });
  const tenders: Tender[] = [
    tender("T-102", "Altstetten Phase 3 Commercial Tower: 8 lifts", "deccan", "ZHW", "noah", "ni", "matched", 55, 8, "New commercial tower matched from a building permit. 24 floors, 8 lifts plus 2 service lifts. Existing key customer.", { discovered: now - 2 * DAY }),
  ];
  const offers: Offer[] = [];
  const mleads: MLead[] = [
    { id: "ML-501", name: "Frick Bau GmbH", source: "Web form: maintenance enquiry", area: "ZHW", createdAt: now - 60 * HOUR, status: "new", interest: "Service contract for 6 lifts", score: 72 },
    { id: "ML-502", name: "Residenz Hottingen", source: "Campaign reply: ageing lifts offer", area: "ZHC", createdAt: now - 55 * HOUR, status: "new", interest: "Modernisation of 2 lifts", score: 64 },
    { id: "ML-503", name: "Hotel Limmatblick", source: "Trade fair QR code", area: "ZHN", createdAt: now - 20 * HOUR, status: "new", interest: "Maintenance contract", score: 58 },
  ];
  const campaigns: Campaign[] = [{ id: "C-1", name: "Keep your lift safe: maintenance for lifts over 20 years", segment: "Ageing lifts, Zurich City", area: "ZHC", size: 9, status: "live", createdBy: "manoj", createdAt: now - 18 * DAY, leads: 3 }];
  const sh: Sherpa = { accounts, assets, tenders, opps: [], past: seedPast(now), offers, mleads, campaigns, tasks: [], contracts: [], crm: [], nba: {}, flags: { coaching: false }, seq: 913 };
  seedOpps(sh, now);
  return sh;
}

/* ------------------------------------------------------------------ the opportunity: one record from sighting to won */
export const KIND_LABEL: Record<Opp["kind"], string> = { newbuild: "New installation", existing: "Existing installation", renewal: "Service contract", modernisation: "Modernisation", project: "Project" };
export const STAGES: [OppStage, string][] = [["scout", "Scout"], ["nurture", "Nurture"], ["review", "Review"], ["qualify", "Set up"], ["bid", "Bid"], ["offer", "Quotation"], ["sent", "Sent"], ["contract", "Contract"], ["won", "Won"]];
export const isNI = (o: Pick<Opp, "kind">) => o.kind === "newbuild" || o.kind === "project";
/** Rep scouts, the manager qualifies, the manager generates the quotation or bid, every win ends in a contract. */
export function stagesFor(o: Opp): [string, string][] {
  const deal: [OppStage, string] = o.tenderId ? ["bid", "Bid"] : ["offer", "Quotation"];
  const check: [OppStage, string] = o.stage === "nurture" ? ["nurture", "Nurture"] : ["review", "Review"];
  const head: [string, string][] = [["scout", "Scout"], check, ["qualify", "Set up"], deal, ["sent", "Sent"]];
  if (o.stage === "lost" || o.stage === "closed") return [...head, [o.stage, o.stage === "lost" ? "Lost" : "Closed"]];
  return [...head, ["deal-won", "Won"], ["contract", "Contract"], ["won", "Work initiated"]];
}
/** Where the deal is on its stage bar, and whether every step is done. A signed deal stays on Work initiated until the job is accepted. */
export function stageAt(o: Opp): { stages: [string, string][]; idx: number; done: boolean } {
  const stages = stagesFor(o);
  const idx = Math.max(0, stages.findIndex((x) => x[0] === o.stage));
  const done = o.stage === "lost" || o.stage === "closed" || (o.stage === "won" && (!o.job || !!o.job.acceptedAt));
  return { stages, idx, done };
}
export const TEAM_OF_KIND: Record<Opp["kind"], "NI" | "EI" | "SC" | "MOD"> = { newbuild: "NI", existing: "EI", renewal: "SC", modernisation: "MOD", project: "NI" };
/** The score a scouted lead needs to reach the Sales Manager. Below it the lead waits in nurture. */
export const reviewMin = (s: State) => s.cfg.tiers.warm;
/** The team SHERPA's next best action suggests once the rep has scouted. */
/** SHERPA's call on the installation type, from the snap, our records and the technician's visit. The Sales Manager decides. */
export function suggestTeam(o: Opp): { team: "NI" | "EI" | "MOD"; why: string; signals: string[] } {
  const v = o.site; const signals: string[] = [];
  const labels = (o.reasons ?? []).map((r) => r.label).join(" · ");
  const age = Number(/(\d+) years or older/i.exec(labels)?.[1] ?? (/Very old lift/i.test(labels) ? 25 : 0));
  const condition = v?.condition ?? "";
  if (isNI(o)) {
    signals.push("Building site, no lifts installed yet");
    if (v?.lifts) signals.push(`${v.lifts} lifts needed${v.src?.lifts ? ` (${v.src.lifts})` : ""}`);
    if (condition) signals.push(`Site readiness: ${condition.toLowerCase()}`);
    if (v?.buy && v.buy !== "Not known yet") signals.push(`Buys by ${v.buy.toLowerCase()} (${NAMES[v.by]?.split(" ")[0] ?? "technician"} on site)`);
    return { team: "NI", why: "A building going up with no lifts yet: a new installation.", signals };
  }
  const worn = /Frequent breakdowns|Out of service/i.test(condition);
  if (age) signals.push(`Unit is ${age} years or older${age >= 20 ? ", past the usual 20-year upgrade point" : ""}`);
  if (condition) signals.push(`Technician found: ${condition.toLowerCase()}`);
  if (/unhappy/i.test(`${v?.competitor ?? ""} ${v?.note ?? ""}`)) signals.push("Owner is unhappy with the current servicer");
  if (o.kind === "modernisation" || worn || age >= 20) {
    return { team: "MOD", why: worn ? `The technician found ${condition.toLowerCase()}: an upgrade fits better than a service contract.` : "An ageing lift with faults or obsolete parts: a modernisation.", signals };
  }
  return { team: "EI", why: signals.some((x) => x.includes("unhappy")) ? "A working lift whose owner is unhappy with the servicer: a win-back maintenance offer." : "A working lift: a maintenance or repair offer.", signals };
}
function scoutReasons(v: Omit<SiteVisit, "by" | "at">): Reason[] {
  const out: Reason[] = [];
  if (v.met.name) out.push({ label: "Scouting: decision-maker contact confirmed", pts: 5 });
  if (/person I met|Owner or board/i.test(v.decision)) out.push({ label: "Scouting: we know who decides", pts: 5 });
  if (v.timeline === "Now") out.push({ label: "Scouting: customer wants to act now", pts: 10 });
  else if (v.timeline === "Within 3 months") out.push({ label: "Scouting: customer acts within 3 months", pts: 5 });
  else if (v.timeline === "No plan yet") out.push({ label: "Scouting: no plan yet", pts: -15 });
  if (/Frequent breakdowns|Out of service|Finishing, lifts needed soon/i.test(v.condition)) out.push({ label: `Scouting: ${v.condition.toLowerCase()}`, pts: 5 });
  if (/unhappy/i.test(`${v.competitor} ${v.note}`)) out.push({ label: "Scouting: owner unhappy with the current servicer", pts: 5 });
  return out;
}
export const TECHS = USERS.filter((u) => u.role === "tech");
export const SERVICE_LEADS = USERS.filter((u) => u.role === "sl");
export const serviceLeadFor = (area: string) => SERVICE_LEADS.find((u) => u.areas?.includes(area))?.id ?? SERVICE_LEADS[0]?.id;
/** Why we lost this customer or place last time, so the next deal starts with it. */
export function lastLoss(s: State, o: Opp): { reason: string; at: number; title: string } | undefined {
  const prev = s.sherpa.opps.filter((x) => x.id !== o.id && x.lostReason && x.closedAt && ((o.accountId && x.accountId === o.accountId) || x.placeName === o.placeName)).sort((a, b) => b.closedAt! - a.closedAt!)[0];
  return prev ? { reason: prev.lostReason!, at: prev.closedAt!, title: prev.title } : undefined;
}
export const techFor = (area: string) => TECHS.find((u) => u.areas?.includes(area))?.id ?? TECHS[0]?.id;
export const AREA_REPS = USERS.filter((u) => u.role === "ar");
export const areaRepFor = (area: string) => AREA_REPS.find((u) => u.areas?.includes(area))?.id;
export type CountFact = { value: number; source: string; detail?: string };
const seedOf = (x: string) => [...x].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Lifts and floors from records we actually hold (tender document, our installed base, the building register), so the technician confirms instead of typing. Building sites have no record until the tender. */
export function buildingFacts(s: State, o: Opp): { lifts?: CountFact; floors?: CountFact } {
  const r = s.reports.find((x) => x.id === o.source.reportId);
  const place = PLACES.find((p) => p.id === r?.placeId);
  const t = s.sherpa.tenders.find((x) => x.id === o.tenderId);
  const h = seedOf(o.placeName);
  if (isNI(o)) return { lifts: t?.lifts ? { value: t.lifts, source: "Tender document" } : undefined };
  const ours = place ? s.sherpa.assets.filter((a) => a.placeId === place.id && a.label.endsWith(o.placeName)) : [];
  const units = ours.map((a) => a.label.split(" · ")[0]).slice(0, 4).join(", ");
  const seen = r?.input.units ?? 0; const who = NAMES[r?.reporterId ?? ""]?.split(" ")[0] ?? "The reporter";
  const lifts: CountFact | undefined = t?.lifts ? { value: t.lifts, source: "Tender document" }
    : ours.length && seen > ours.length ? { value: seen, source: `${who} on the snap`, detail: `Our records list only ${ours.length} (${units}). Please check` }
    : ours.length ? { value: ours.length, source: "Our records", detail: units }
    : seen ? { value: seen, source: `${who} on the snap`, detail: "An estimate from the street" } : undefined;
  const base = place?.type === "mall" ? [3, 4] : place?.type === "hospital" ? [5, 6] : place?.type === "office" ? [5, 12] : [4, 8];
  const floors: CountFact = { value: base[0] + (h % base[1]), source: "Federal building register (GWR)", detail: place?.addr };
  return { lifts, floors };
}
/** A discount from our history in the area: the average on similar quotes, nudged up after a loss on price. */
export function suggestDiscount(s: State, o: Opp, product: ProductKey, steps: number[], proposed?: number): { value: number; why: string[] } {
  const ref = regionRef(s, o.area, product); const why: string[] = [];
  let target = ref.count ? ref.avgDiscount : 8;
  if (ref.count) why.push(`${AREA_NAME[o.area] ?? o.area}: ${ref.wins} of ${ref.count} similar quotes won, average discount ${Math.round(ref.avgDiscount)}%`);
  else why.push(`No similar quotes in ${AREA_NAME[o.area] ?? o.area} yet: our usual opening discount`);
  const loss = lastLoss(s, o);
  if (loss && /price|lower|cheaper/i.test(loss.reason)) { target += 3; why.push(`We lost here before: ${loss.reason.toLowerCase()}`); }
  if (proposed !== undefined) why.push(`${NAMES[o.owner]?.split(" ")[0] ?? "The rep"} proposed ${proposed}%`);
  const value = steps.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), steps[0]);
  if (value > 10) why.push("Above 10% needs the Sales Manager's approval");
  return { value, why };
}
/** The most likely reason from what we lost before in this area, so recording a loss is a confirmation. */
export function suggestLossReason(s: State, o: Opp, options: string[]): { value: string; why: string[] } {
  const lost = s.sherpa.opps.filter((x) => x.area === o.area && x.lostReason && x.id !== o.id);
  const hit = (opt: string, r: string) => new RegExp(opt.split(" ")[0], "i").test(r) || (opt === "Price" && /lower|cheaper|price/i.test(r)) || (/competitor/i.test(opt) && /competitor/i.test(r));
  const counts = options.map((opt) => ({ opt, n: lost.filter((x) => hit(opt, x.lostReason!)).length }));
  const best = counts.reduce((a, b) => (b.n > a.n ? b : a), counts[0]);
  const prev = lastLoss(s, o);
  const why = [best.n ? `${best.n} of ${lost.length} losses in ${AREA_NAME[o.area] ?? o.area} were about ${best.opt.toLowerCase()}` : `No losses recorded in ${AREA_NAME[o.area] ?? o.area} yet`];
  if (prev) why.push(`Last time here: ${prev.reason}`);
  return { value: best.opt, why };
}
/** Why a lead is probably not worth pursuing, from duplicates, territory and what the customer said before. */
export function suggestRejectReason(s: State, o: Opp): { value: string; why: string[] } {
  const dup = s.sherpa.opps.find((x) => x.id !== o.id && isOpen(x) && x.placeName === o.placeName && x.kind === o.kind && x.stage !== "scout");
  if (dup) return { value: "Duplicate of an open deal", why: [`${dup.id} is already open for ${o.placeName} (${dup.stage})`] };
  if (!(o.area in FACTOR)) return { value: "Outside our territory", why: [`We do not sell in ${AREA_NAME[o.area] ?? o.area}`] };
  const prev = lastLoss(s, o);
  if (prev && /declin|said no|not pursued/i.test(prev.reason)) return { value: "Customer already declined", why: [`Last time: ${prev.reason}`] };
  const weak = (o.reasons ?? []).filter((r) => r.pts < 0).map((r) => r.label.toLowerCase());
  return { value: "Not a real opportunity", why: weak.length ? [`Weak signals: ${weak.join(", ")}`] : ["No duplicate, in our territory, no earlier refusal", "So a rejection most likely means it is not a real opportunity"] };
}
/** The contract length that won most often in the area for this product. */
export function suggestTerm(s: State, area: string, product: ProductKey): { value: number; why: string[] } {
  const ref = regionRef(s, area, product);
  return { value: 3, why: ["3 years: the yearly price drops and the customer stays with us through the next upgrade cycle", ref.count ? `${ref.wins} of ${ref.count} similar quotes in ${AREA_NAME[area] ?? area} were won` : "Our standard term for service contracts"] };
}
/** Tender or direct quotation for a building site, only from hard evidence: what the technician heard, the tender radar, an earlier tender here. */
export function suggestBuyPath(s: State, o: Opp, useVisit = true): { value: "tender" | "direct"; why: string[]; unsure?: boolean } {
  const v = useVisit ? o.site : undefined; const who = NAMES[v?.by ?? ""]?.split(" ")[0] ?? "The technician";
  if (v?.buy === "Formal tender") return { value: "tender", why: [`${who} confirmed on site that it goes to a formal tender.`] };
  if (v?.buy === "Direct quotation") return { value: "direct", why: [`${who} confirmed on site that they want a quotation from us.`] };
  if (o.tenderId || o.source.type === "tender") return { value: "tender", why: ["The tender radar found a published tender for this project."] };
  const before = s.sherpa.opps.find((x) => x.id !== o.id && x.placeName === o.placeName && x.tenderId);
  if (before) return { value: "tender", why: [`The last project here went to a formal tender (${before.tenderId}).`] };
  return { value: "direct", unsure: true, why: ["No tender found for this site yet, so SHERPA cannot tell. Ask the person in charge."] };
}
export type PersonFit = { id: string; score: number; reasons: string[]; line: string };
/** Ranks people for a deal from what they have done before: results on this kind of deal, the area, this customer, and today's workload. */
export function rankPeople(s: State, o: Opp, ids: string[], job: "rep" | "tech" | "area"): PersonFit[] {
  const area = AREA_NAME[o.area] ?? o.area;
  const kind = KIND_LABEL[o.kind].toLowerCase();
  return ids.map((id) => {
    const u = USERS.find((x) => x.id === id);
    const reasons: string[] = []; let score = 0; const bits: string[] = [];
    const covers = !!u?.areas?.includes(o.area);
    if (covers) { score += 30; reasons.push(`Covers ${area}`); } else bits.push("other area");
    const open = s.sherpa.tasks.filter((t) => !t.done && t.forUser === id).length;
    if (job === "tech") {
      const visits = s.sherpa.opps.filter((x) => x.site?.by === id);
      const here = visits.filter((x) => x.area === o.area).length;
      const same = visits.filter((x) => x.kind === o.kind).length;
      score += Math.min(20, here * 4) + Math.min(15, same * 3);
      if (visits.length) reasons.push(`${visits.length} site visits filed, ${here} in ${area}`);
      if (same) reasons.push(`${same} on ${kind} sites`);
      bits.unshift(`${visits.length} visits`);
    } else {
      const mine = s.sherpa.opps.filter((x) => x.owner === id && x.id !== o.id);
      const done = mine.filter((x) => x.kind === o.kind && (x.stage === "won" || x.stage === "lost"));
      const won = done.filter((x) => x.stage === "won").length;
      if (job === "rep" && done.length) {
        const rate = won / done.length; score += Math.round(rate * 40);
        reasons.push(`Won ${won} of ${done.length} ${kind} deals (${Math.round(rate * 100)}%)`);
        bits.unshift(`won ${won} of ${done.length}`);
      } else if (job === "rep") bits.unshift(`no ${kind} deals yet`);
      const wonHere = mine.filter((x) => x.stage === "won" && x.area === o.area).length;
      if (wonHere) { score += Math.min(15, wonHere * 5); reasons.push(`${wonHere} won in ${area}`); }
      const before = mine.some((x) => (o.accountId && x.accountId === o.accountId) || x.placeName === o.placeName);
      if (before) { score += 15; reasons.push(`Has worked with ${s.sherpa.accounts.find((x) => x.id === o.accountId)?.name ?? o.placeName} before`); bits.push("knows the customer"); }
    }
    score -= Math.min(15, open * 2);
    reasons.push(`${open} open task${open === 1 ? "" : "s"} today`);
    bits.push(`${open} open`);
    return { id, score, reasons, line: bits.join(" · ") };
  }).sort((a, b) => b.score - a.score);
}
export const oppOf = (s: State, id?: string) => s.sherpa.opps.find((o) => o.id === id);
export const oppOfOffer = (s: State, o: Offer) => s.sherpa.opps.find((x) => x.id === o.oppId);
export const tasksOfOpp = (s: State, oppId: string, open = true) => s.sherpa.tasks.filter((t) => t.oppId === oppId && (!open || !t.done));
export const isOpen = (o: Opp) => !["won", "lost", "closed"].includes(o.stage);

export function addTask(s: State, t: { oppId?: string; forUser: string; by: string; title: string; detail?: string; days: number; kind: TaskKind; source?: string; accountId?: string }): Task {
  const task: Task = { id: `TK-${s.sherpa.seq++}`, oppId: t.oppId, title: t.title, detail: t.detail, by: t.by, forUser: t.forUser, accountId: t.accountId, kind: t.kind, due: nowS(s) + t.days * DAY, done: false, createdAt: nowS(s), source: t.source ?? "workflow" };
  s.sherpa.tasks.unshift(task);
  if (t.forUser !== t.by) ping(s, t.forUser, `${NAMES[t.by] ?? t.by} needs you: ${t.title}`);
  return task;
}
export function closeTasks(s: State, oppId: string | undefined, kinds: TaskKind[] | null, result?: string) {
  s.sherpa.tasks.forEach((t) => { if (oppId && t.oppId === oppId && !t.done && (!kinds || (t.kind && kinds.includes(t.kind)))) { t.done = true; t.doneAt = nowS(s); if (result) t.result = result; } });
}
export const olog = (s: State, o: Opp, by: string, text: string) => { o.log.push({ t: nowS(s), by: NAMES[by] ?? by, text }); };
const tenderSite = (v?: Partial<SiteVisit>) => v?.buy === "Formal tender";
function missingFacts(o: Opp, v?: Partial<SiteVisit>) {
  return [!(v?.met?.name || o.contact) && "decision-maker contact", !tenderSite(v) && !v?.lifts && "number of lifts", !tenderSite(v) && !v?.floors && "floors", !v?.timeline && "timeline"].filter(Boolean) as string[];
}
function scoreWith(o: Opp, v: Omit<SiteVisit, "by" | "at">) {
  return Math.max(0, Math.min(100, [...(o.reasons ?? []).filter((x) => !x.label.startsWith("Scouting")), ...scoutReasons(v)].reduce((a, b) => a + b.pts, 0)));
}
/** Why a filed site visit needs the area rep's eye before it goes to the manager. Empty: SHERPA sends it on by itself. */
export function visitFlags(s: State, o: Opp, v: Omit<SiteVisit, "by" | "at">): string[] {
  const score = scoreWith(o, v); const missing = missingFacts(o, v);
  return [
    ...(missing.length ? [`missing ${missing.join(", ")}`] : []),
    ...(isNI(o) && v.buy === "Not known yet" ? ["nobody knows yet if it goes to tender"] : []),
    ...(tenderSite(v) && !v.tenderFile ? ["the tender document is not shared yet"] : []),
    ...(score < reviewMin(s) ? [`it scores ${score}, below the ${reviewMin(s)} the manager reviews`] : []),
  ];
}
function scoutTask(s: State, o: Opp, by: string, why: string) {
  const todo = missingFacts(o, o.site).join(", ");
  const title = o.site ? `Check the site visit: ${o.placeName}` : `Send a technician: ${o.placeName}`;
  addTask(s, { oppId: o.id, forUser: o.owner, by, title, detail: `${why}${todo ? ` Still missing: ${todo}.` : ""}`, days: o.tier === "Hot" ? 1 : 2, kind: "scout", source: "Scouting" });
}
function toReview(s: State, o: Opp, by: string) {
  o.stage = "review";
  addTask(s, { oppId: o.id, forUser: MANAGER, by, title: `Review: ${o.title}`, detail: `${o.tier} lead, score ${o.score}. Scouted by ${NAMES[by] ?? by}.`, days: o.tier === "Hot" ? 1 : 2, kind: "review", source: "Lead review" });
}
function genQuoteTask(s: State, o: Opp, by: string, what: string) {
  addTask(s, { oppId: o.id, forUser: MANAGER, by, title: `Generate the quotation for ${o.placeName}`, detail: `${what} The Pricing Expert agent drafts it and you follow its progress. Then you check it with SHERPA and send it.`, days: 2, kind: "genQuote", source: "Quotation" });
}
const kindOfTeam = (team?: string | null): Opp["kind"] => (team === "NI" ? "newbuild" : team === "SC" ? "renewal" : team === "MOD" ? "modernisation" : "existing");

export const OP = {
  create(s: State, p: { title: string; kind: Opp["kind"]; accountId?: string; placeName: string; area: string; owner: string; source: Opp["source"]; value?: number; contact?: Opp["contact"]; stage?: OppStage; unrouted?: boolean; geo?: Opp["geo"] }): Opp {
    const o: Opp = { id: `OP-${s.sherpa.seq++}`, geo: p.geo, title: p.title, kind: p.kind, accountId: p.accountId, placeName: p.placeName, area: p.area, owner: p.owner, unrouted: p.unrouted, stage: p.stage ?? "scout", createdAt: nowS(s), value: p.value, source: p.source, contact: p.contact, log: [] };
    olog(s, o, p.source.reporter ?? p.owner, `Opportunity created from ${p.source.label}`);
    s.sherpa.opps.unshift(o);
    return o;
  },
  /** Called when a Snap & Lead lead is routed: one opportunity per lead, with an accept task for the owner. */
  fromReport(s: State, r: Report) {
    r.items.filter((i) => i.kind === "lead" && !i.silent && i.team !== "AM").forEach((i) => {
      if (s.sherpa.opps.some((x) => x.source.itemId === i.id)) return;
      const acc = s.sherpa.accounts.find((a) => a.placeIds.includes(r.placeId));
      const contact = r.extras.contact ? { name: r.extras.contact.split("·")[0].trim(), role: "Given by the reporter", phone: r.extras.contact.split("·")[1]?.trim(), via: "the reporter" } : undefined;
      const kind = kindOfTeam(i.team);
      const ar = areaRepFor(r.area);
      const opp = OP.create(s, { title: `${KIND_LABEL[kind]}: ${r.placeName}`, kind, accountId: acc?.id, placeName: r.placeName, area: r.area, owner: ar ?? MANAGER, unrouted: !ar, source: { type: "snap", reportId: r.id, itemId: i.id, reporter: r.reporterId, label: `Snap & Lead ${r.id}` }, contact, stage: "scout" });
      opp.suggested = i.ownerId;
      const hist = historyReasons(s, opp, r.placeId);
      opp.reasons = [...i.reasons, ...hist];
      opp.score = Math.max(0, Math.min(100, i.score + hist.reduce((a, b) => a + b.pts, 0)));
      opp.tier = i.score === 0 ? i.tier : tierOf(opp.score, s.cfg);
      if (ar) scoutTask(s, opp, r.reporterId, `${NAMES[r.reporterId] ?? "Someone"} snapped it. ${i.summary}`);
      else addTask(s, { oppId: opp.id, forUser: MANAGER, by: r.reporterId, title: `Assign an area rep: ${opp.title}`, detail: `No area rep covers ${AREA_NAME[r.area] ?? r.area}. Pick someone to send a technician.`, days: 1, kind: "assign", source: "Snap & Lead" });
    });
  },
  /** The area rep checked the technician's report. SHERPA rescores and suggests the installation type; above the threshold it goes to the manager. */
  scout(s: State, id: string, by: string, v: Omit<SiteVisit, "by" | "at">) {
    const o = oppOf(s, id); if (!o || o.stage !== "scout") return;
    closeTasks(s, id, ["scout", "siteVisit"]);
    o.site = { ...v, by: o.site?.by && o.site.by !== by ? o.site.by : by, at: o.site?.at ?? nowS(s) }; o.visited = true; o.scouted = { by, at: nowS(s) };
    if (v.met.name) o.contact = { name: v.met.name, role: v.met.role, phone: v.met.phone, via: o.contact?.name === v.met.name ? o.contact.via : `${NAMES[by] ?? by} while scouting` };
    if (v.note) OP.note(s, id, by, v.note);
    o.reasons = [...(o.reasons ?? []).filter((x) => !x.label.startsWith("Scouting")), ...scoutReasons(v)];
    o.score = Math.max(0, Math.min(100, o.reasons.reduce((a, b) => a + b.pts, 0)));
    o.tier = tierOf(o.score, s.cfg);
    olog(s, o, by, `Scouted${v.met.name ? `: met ${v.met.name}, ${v.met.role}` : ""}. SHERPA scored it ${o.score}/100`);
    if (o.score < reviewMin(s)) { o.stage = "nurture"; olog(s, o, "SHERPA", `Below the ${reviewMin(s)} threshold: kept in nurture`); ping(s, by, `${o.placeName} scored ${o.score}, below ${reviewMin(s)}. It waits in nurture until something changes.`); return; }
    toReview(s, o, by);
  },
  /** The rep hands the site visit to a field technician and stays the owner. */
  delegateVisit(s: State, id: string, by: string, tech: string) {
    const o = oppOf(s, id); if (!o || o.stage !== "scout") return;
    closeTasks(s, id, ["scout"]); o.technician = tech; o.visitBy = tech;
    olog(s, o, by, `Site visit delegated to ${NAMES[tech] ?? tech}`);
    addTask(s, { oppId: id, forUser: tech, by, title: `Site visit: ${o.placeName}`, detail: `${NAMES[by]} sent you. Meet the person in charge, check the lifts or the site and file the report.`, days: o.tier === "Hot" ? 2 : 4, kind: "siteVisit", source: "Scouting" });
  },
  /** A lead found outside Snap & Lead (map, campaign) starts with the area rep scouting it. */
  startScout(s: State, id: string, by: string, why: string) { const o = oppOf(s, id); if (!o) return; o.stage = "scout"; scoutTask(s, o, by, why); },
  /** A lead in nurture goes to the manager anyway. */
  toReview(s: State, id: string, by: string) {
    const o = oppOf(s, id); if (!o || o.stage !== "nurture") return;
    olog(s, o, by, "Sent from nurture to the Sales Manager"); toReview(s, o, by);
  },
  /** The manager wants more before qualifying. */
  sendBack(s: State, id: string, by: string, note: string) {
    const o = oppOf(s, id); if (!o || o.stage !== "review") return;
    closeTasks(s, id, ["review"]); o.stage = "scout"; o.scouted = undefined;
    olog(s, o, by, `Sent back for more information: ${note}`);
    scoutTask(s, o, by, `${NAMES[by]} sent it back: ${note}`);
  },
  /** The Sales Manager qualified the lead and assigned the team rep, who sets up the deal. */
  review(s: State, id: string, by: string, p: { team: "NI" | "EI" | "MOD"; owner: string; note?: string }) {
    const o = oppOf(s, id); if (!o || o.stage !== "review") return;
    closeTasks(s, id, ["review", "assign"]);
    const kind = kindOfTeam(p.team); const moved = kind !== o.kind && !(isNI(o) && p.team === "NI");
    if (moved) { o.kind = kind; o.title = `${KIND_LABEL[kind]}: ${o.placeName}`; }
    o.owner = p.owner; o.unrouted = false; o.stage = "qualify";
    olog(s, o, by, `Qualified for ${p.team}. Owner ${NAMES[p.owner] ?? p.owner}${p.note ? `. ${p.note}` : ""}`);
    if (p.note) OP.note(s, id, by, p.note);
    const next = isNI(o) ? (o.site?.buy && o.site.buy !== "Not known yet" ? `The site visit says: ${o.site.buy.toLowerCase()}. ${o.site.buy === "Formal tender" ? "Start the bid." : "Start the quotation."}` : "Talk to the customer: formal tender or quotation?") : o.kind === "modernisation" ? "Gather what the modernisation needs." : "Pick the offer that fits.";
    const known = isNI(o) && (o.site?.buy === "Formal tender" || o.site?.buy === "Direct quotation") ? (o.site.buy === "Formal tender" ? "tender" : "direct") : null;
    if (known) {
      OP.setupDeal(s, id, p.owner, { accountId: accountMatches(s, o)[0]?.id ?? "new", path: known, eordDays: 30 });
      olog(s, o, "SHERPA", `Deal set up from ${NAMES[o.site!.by] ?? "the technician"}'s site visit: ${known === "tender" ? "formal tender" : "quotation"}, customer ${accountOf(s, o.accountId)?.name ?? o.placeName}`);
      if (p.owner !== by) ping(s, p.owner, `${NAMES[by]} qualified ${o.placeName} for ${p.team}. ${known === "tender" ? "Gather the bid information." : "Gather the quotation information."}`);
      return;
    }
    addTask(s, { oppId: id, forUser: p.owner, by, title: `Set up the deal for ${o.placeName}`, detail: `${NAMES[by]} qualified it for ${p.team}. Confirm the customer. ${next}`, days: 2, kind: "dealSetup", source: "Lead review" });
    if (p.owner !== by) ping(s, p.owner, `${NAMES[by]} qualified ${o.placeName} for ${p.team}. Set up the deal.`);
  },
  reviewClose(s: State, id: string, by: string, reason: string) {
    const o = oppOf(s, id); if (!o) return;
    closeTasks(s, id, null, reason); o.stage = "closed"; o.closedAt = nowS(s); o.lostReason = `Not pursued: ${reason}`; olog(s, o, by, `Not pursued: ${reason}`);
  },
  note(s: State, id: string, by: string, text: string) {
    const o = oppOf(s, id); if (!o || !text.trim()) return;
    const stage = STAGES.find((x) => x[0] === o.stage)?.[1] ?? o.stage;
    (o.notes ??= []).push({ t: nowS(s), by: NAMES[by] ?? by, text: `${stage}: ${text.trim()}` });
  },
  /** The technician filed the site-visit report. The owner sets up the deal next. */
  siteVisit(s: State, id: string, by: string, v: Omit<SiteVisit, "by" | "at">) {
    const o = oppOf(s, id); if (!o) return;
    closeTasks(s, id, ["siteVisit"]);
    if (o.stage === "scout") {
      o.site = { ...v, by, at: nowS(s) };
      if (v.met.name) o.contact = { name: v.met.name, role: v.met.role, phone: v.met.phone, via: `${NAMES[by] ?? by} on the site visit` };
      olog(s, o, by, `Site visit done${v.met.name ? `: met ${v.met.name}, ${v.met.role}` : ""}`);
      const flags = visitFlags(s, o, v);
      if (!flags.length) {
        OP.scout(s, id, o.owner, v);
        olog(s, o, "SHERPA", `Nothing to check on the site visit: sent to ${NAMES[MANAGER]} for ${NAMES[o.owner] ?? o.owner}`);
        ping(s, o.owner, `${NAMES[by]} visited ${o.placeName}. Nothing was missing, so SHERPA sent it to ${NAMES[MANAGER]} (score ${o.score}).`);
        return;
      }
      scoutTask(s, o, by, `${NAMES[by]} filed the site-visit report. SHERPA held it for you: ${flags.join("; ")}. Check it, then send it to ${NAMES[MANAGER]}.`);
      return;
    }
    o.site = { ...v, by, at: nowS(s) }; o.visited = true; o.stage = "qualify";
    if (v.met.name) o.contact = { name: v.met.name, role: v.met.role, phone: v.met.phone, via: `${NAMES[by] ?? by} on the site visit` };
    olog(s, o, by, `Site visit done${v.met.name ? `: met ${v.met.name}, ${v.met.role}` : ""}`);
    if (v.note) OP.note(s, id, by, v.note);
    const next = o.kind === "newbuild" || o.kind === "project" ? "tender or quotation?" : o.kind === "modernisation" ? "modernisation quotation" : "maintenance offer";
    addTask(s, { oppId: id, forUser: o.owner, by, title: `Set up the deal for ${o.placeName}`, detail: `${NAMES[by]} visited. Confirm the customer, then pick the path: ${next}`, days: 2, kind: "dealSetup", source: "Site visit" });
  },
  /** The owner confirmed the customer and picked the path. */
  setupDeal(s: State, id: string, by: string, p: { accountId: string | "new"; path: "tender" | "direct" | "notfit"; eordDays?: number; product?: ProductKey; term?: number; discountPct?: number; nba?: string }) {
    const o = oppOf(s, id); if (!o || o.stage !== "qualify") return;
    if (p.path !== "notfit") {
      const acc = p.accountId === "new" ? newAccountFor(s, o) : accountOf(s, p.accountId);
      if (acc) { o.accountId = acc.id; olog(s, o, by, p.accountId === "new" ? `New customer created: ${acc.name}` : `Linked to existing customer ${acc.name}`); }
    }
    closeTasks(s, id, ["dealSetup"]);
    OP.qualify(s, id, by, p.path, p.eordDays ?? 30, { product: p.product, term: p.term, discountPct: p.discountPct });
    if (p.nba) olog(s, o, by, `Next best action taken: ${p.nba}`);
  },
  /** The owner decides. A formal request becomes a tender with a bid and an offer. Otherwise a direct offer. */
  qualify(s: State, id: string, by: string, choice: "tender" | "direct" | "notfit", eordDays = 30, terms: { product?: ProductKey; term?: number; discountPct?: number } = {}) {
    const o = oppOf(s, id); if (!o) return;
    if (choice === "notfit") { o.stage = "closed"; o.closedAt = nowS(s); olog(s, o, by, "Not a fit. Closed"); return; }
    const product: ProductKey = terms.product ?? (o.kind === "newbuild" || o.kind === "project" ? "newinstall" : o.kind === "renewal" ? "renewal" : o.kind === "modernisation" ? "modernisation" : "maintenance");
    const accId = o.accountId ?? ensureAccountFor(s, o).id; o.accountId = accId;
    const offer = SH.makeOffer(s, { accountId: accId, area: o.area, product, term: terms.term ?? (product === "maintenance" || product === "renewal" ? 3 : 1), discountPct: terms.discountPct ?? 0, by: o.owner, oppId: o.id, source: o.source.itemId ? { reportId: o.source.reportId!, itemId: o.source.itemId } : undefined });
    o.offerId = offer.id;
    if (choice === "tender") {
      const t: Tender = { id: `T-${s.sherpa.seq++}`, name: o.title.includes(o.placeName) ? o.title : `${o.title}: ${o.placeName}`, accountId: accId, area: o.area, owner: o.owner, line: "ni", stage: "bidding", eord: nowS(s) + eordDays * DAY, value: PRODUCT[product].list * (Number(o.site?.lifts) || 1), lifts: Number(o.site?.lifts) || 0, summary: `Tender raised from ${o.source.label}.${o.site ? ` Site visit: ${o.site.lifts || "?"} lifts, ${o.site.floors || "floors not known"}.` : ""}`, discovered: nowS(s), oppId: o.id, checklist: PAPER_LIST() };
      s.sherpa.tenders.unshift(t); o.tenderId = t.id; o.stage = "bid"; olog(s, o, by, `Formal tender ${t.id} raised. Bid due in ${eordDays} days`);
      const got = o.site?.tenderFile;
      if (got) { t.oppId = t.oppId ?? o.id; OP.tenderDoc(s, t.id, o.site!.by, got); }
      addTask(s, { oppId: id, forUser: o.owner, by, title: `Gather the bid information for ${t.id}`, detail: `Bid due in ${eordDays} days. ${got ? `The tender document is already on the deal: ${NAMES[o.site!.by]?.split(" ")[0] ?? "the technician"} got ${got.name} on site and SHERPA read it. Answer only what it leaves open` : "Upload the tender document; SHERPA lists what it leaves open. Answer those"}, add what you know about the customer and the competition, and ${NAMES[MANAGER]} starts the bid.`, days: Math.max(2, eordDays - 7), kind: "tenderDoc", source: "N13" });
    } else if (product === "newinstall" || product === "modernisation") { o.stage = "offer"; olog(s, o, by, `Quotation ${offer.id} started`); addTask(s, { oppId: id, forUser: o.owner, by, title: `Gather the quotation information for ${o.placeName}`, detail: `SHERPA's checklist of what the quotation needs. ${NAMES[MANAGER]} generates the quotation from it.`, days: 3, kind: "quoteBrief" }); }
    else { o.stage = "offer"; olog(s, o, by, `${PRODUCT[product].label} picked for ${o.placeName}`); genQuoteTask(s, o, by, `${NAMES[o.owner] ?? o.owner} picked: ${PRODUCT[product].label}${PRODUCT[product].yearly ? `, ${offer.term} years` : ""}${offer.discountPct ? `, ${offer.discountPct}% off` : ""}.`); }
  },
  /** Offer events keep the opportunity and everyone's tasks in step. */
  onOffer(s: State, of: Offer, ev: "submitted" | "approved" | "changes" | "rejected" | "sent" | "chased" | "won" | "lost" | "blocked", note = "") {
    const o = oppOf(s, of.oppId); if (!o) return; const acc = accountOf(s, of.accountId)?.name ?? o.placeName;
    if (ev === "blocked") { addTask(s, { oppId: o.id, forUser: of.createdBy, by: MANAGER, title: `Lower the discount on ${of.id}`, detail: `${of.discountPct}% is above the ${GUIDE.manager}% the manager can approve. Reduce it, or get the regional lead's written approval outside this app.`, days: 2, kind: "revise" }); return; }
    if (ev === "submitted") { closeTasks(s, o.id, ["revise", "send"]); of.approvals.forEach((x) => addTask(s, { oppId: o.id, forUser: x.by, by: of.createdBy, title: `Approve ${of.discountPct}% on ${of.id} for ${acc}`, detail: `${of.title}, ${chf(of.price)}. Guideline is ${GUIDE.seller}%.`, days: 2, kind: "approve", source: "N19" })); o.stage = "offer"; olog(s, o, of.createdBy, `${of.id} sent for approval`); }
    if (ev === "approved") { closeTasks(s, o.id, ["approve", "revise"]); o.stage = o.stage === "bid" ? "bid" : "offer"; addTask(s, { oppId: o.id, forUser: of.createdBy, by: MANAGER, title: `Send ${of.id} to ${acc}`, detail: "Approved. Edit the email if you like and send it.", days: 1, kind: "send" }); olog(s, o, MANAGER, `${of.id} approved`); }
    if (ev === "changes" || ev === "rejected") { closeTasks(s, o.id, ["approve"]); addTask(s, { oppId: o.id, forUser: of.createdBy, by: MANAGER, title: ev === "changes" ? `Revise ${of.id}: ${note}` : `${of.id} was rejected: ${note}`, days: 2, kind: "revise" }); olog(s, o, MANAGER, ev === "changes" ? `Changes asked on ${of.id}: ${note}` : `${of.id} rejected: ${note}`); }
    if (ev === "sent") { if (o.source.itemId) leadHooks.quoted?.(s, o.source.itemId, of.createdBy); closeTasks(s, o.id, ["send"]); o.stage = "sent"; addTask(s, { oppId: o.id, forUser: SUPPORT, by: of.createdBy, title: `Follow up with ${acc} on ${of.id}`, detail: `${NAMES[of.createdBy] ?? of.createdBy} sent it. Ask the customer for their decision; record approval or a no. Nothing after 14 days: SHERPA suggests a follow-up or a revised offer.`, days: 14, kind: "followup", source: "N16" }); olog(s, o, of.createdBy, `${of.id} sent to the customer. ${NAMES[SUPPORT]} follows up`); if (o.tenderId) { const t = tenderOf(s, o.tenderId); if (t) t.stage = "submitted"; } }
    if (ev === "chased") { s.sherpa.tasks.forEach((t) => { if (t.oppId === o.id && t.kind === "followup" && !t.done) t.due = nowS(s) + 14 * DAY; }); olog(s, o, of.createdBy, "Follow-up sent. Next check in 14 days"); }
    if (ev === "won") {
      closeTasks(s, o.id, null); o.stage = "contract"; olog(s, o, of.createdBy, `Customer accepted ${of.id}, ${chf(of.price)}. Contract next`);
      const t = tenderOf(s, o.tenderId); if (t) t.stage = "won";
      CT.draft(s, of, o);
    }
    if (ev === "lost") { if (o.source.itemId) leadHooks.closed?.(s, o.source.itemId, o.owner, "lost"); closeTasks(s, o.id, null); o.stage = "lost"; o.closedAt = nowS(s); o.lostReason = note || "No reason given"; olog(s, o, of.createdBy, `Lost: ${of.id}${note ? `: ${note}` : ""}`); const t = tenderOf(s, o.tenderId); if (t) t.stage = "lost"; }
  },
  completeTask(s: State, taskId: string, by: string, result = "") {
    const t = s.sherpa.tasks.find((x) => x.id === taskId); if (!t) return;
    t.done = true; t.doneAt = nowS(s); t.result = result; const o = oppOf(s, t.oppId); if (o) olog(s, o, by, `${t.title}${result ? `: ${result}` : ""}`);
  },
  reassign(s: State, id: string, by: string, to: string) {
    const o = oppOf(s, id); if (!o) return; o.owner = to; o.unrouted = false;
    s.sherpa.tasks.forEach((t) => { if (t.oppId === id && !t.done && t.forUser === by && t.kind === "assign") { t.done = true; t.doneAt = nowS(s); } });
    olog(s, o, by, `Assigned to ${NAMES[to]}`);
    if (o.stage === "scout") scoutTask(s, o, by, `${NAMES[by]} assigned it to you.`);
  },
  tenderDoc(s: State, tenderId: string, by: string, file: { name: string; size: number }) {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); if (!t) return;
    if (!t.lifts) { t.lifts = 2 + (seedOf(t.name) % 5); t.value = PRODUCT.newinstall.list * t.lifts; }
    t.doc = readTenderDoc(t, file, nowS(s));
    if (o) olog(s, o, by, `Tender document ${file.name} read: ${t.doc.found.length} facts found, ${t.doc.gaps.length} questions`);
  },
  answerGaps(s: State, tenderId: string, by: string, answers: Record<string, string>) {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); if (!t?.doc) return;
    t.doc.gaps.forEach((g) => { if (answers[g.key]) g.a = answers[g.key]; });
    const of = offerOf(s, o?.offerId); if (of) { of.missing = undefined; of.log.push({ t: nowS(s), by: NAMES[by] ?? by, text: "Lift details completed from the tender document and the owner's answers" }); }
    t.value = Math.round(t.value * t.doc.gaps.reduce((f, g) => f * (FACTORS[g.a ?? ""] ?? 1), 1));
    if (o) olog(s, o, by, "Open questions from the tender document answered");
  },
  /** The NI rep sends what they gathered; the Sales Manager starts the bid from it. */
  submitBid(s: State, tenderId: string, by: string, info: BidInfo) {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); if (!t || !o) return;
    if (t.doc) OP.answerGaps(s, tenderId, by, info.answers);
    t.draft = { by, at: nowS(s), ...info };
    closeTasks(s, o.id, ["tenderDoc", "revise"]);
    olog(s, o, by, `Bid information sent to ${NAMES[MANAGER]}`);
    const extra = [info.priority && `the customer cares most about ${info.priority.toLowerCase()}`, info.rivals && `also bidding: ${info.rivals}`].filter(Boolean).join("; ");
    addTask(s, { oppId: o.id, forUser: MANAGER, by, title: `Start the bid for ${t.id}`, detail: `${NAMES[by]} gathered the bid information${extra ? `: ${extra}` : ""}. Check it, set the discount and start the bid. The legal team builds it and you follow their progress here.`, days: Math.max(1, Math.min(3, daysTo(s, t.eord) - 5)), kind: "genBid", source: "Bid" });
  },
  bidChanges(s: State, tenderId: string, by: string, note: string) {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); if (!t || !o) return;
    t.draft = undefined; closeTasks(s, o.id, ["genBid"]);
    olog(s, o, by, `Changes asked on the bid: ${note}`);
    addTask(s, { oppId: o.id, forUser: o.owner, by, title: `Add to the bid information for ${t.id}: ${note}`, days: 2, kind: "tenderDoc", source: "Bid" });
  },
  /** The owner answered the quotation questions. SHERPA prices the draft from them. */
  quoteBrief(s: State, oppId: string, by: string, b: QuoteBrief) {
    const o = oppOf(s, oppId); const of = offerOf(s, o?.offerId); if (!o || !of) return;
    of.brief = b; of.missing = undefined; of.email = undefined; of.lastActivity = nowS(s);
    closeTasks(s, oppId, ["quoteBrief"]);
    olog(s, o, by, `Quotation information gathered: ${b.floors} floors, ${b.load}, ${b.speed}, ${b.finish}`);
    genQuoteTask(s, o, by, `${NAMES[by] ?? by} gathered: ${b.floors} floors, ${b.load}, ${b.speed}, ${b.finish}, needed ${b.timeline.toLowerCase()}.`);
  },
  /** The manager clicks Generate quotation. The Pricing Expert agent (mocked) prices and drafts it while the manager follows its progress. */
  genQuote(s: State, oppId: string, by: string) {
    const o = oppOf(s, oppId); const of = offerOf(s, o?.offerId); if (!o || !of || !["draft", "changes"].includes(of.status)) return;
    of.listPrice = Math.round(listPrice(of.area, of.product, of.term) * (of.brief ? briefFactor(of.brief) : 1)); of.price = Math.round(of.listPrice * (1 - of.discountPct / 100));
    of.createdBy = by; of.missing = undefined; of.email = undefined; of.lastActivity = nowS(s);
    of.log.push({ t: nowS(s), by: "Pricing Expert agent", text: `Quotation drafted at ${chf(of.price)}${of.brief ? ` from ${NAMES[o.owner] ?? o.owner}'s answers` : ""} and recent wins in ${AREA_NAME[of.area] ?? of.area}` });
    of.pricing = { startedAt: nowS(s), readyAt: nowS(s) + 4 * 3600000 };
    o.value = of.price; closeTasks(s, oppId, ["genQuote"]);
    olog(s, o, by, `Quotation ${of.id} generated by the Pricing Expert agent: ${chf(of.price)}`);
    addTask(s, { oppId, forUser: by, by: "SHERPA", title: `Send ${of.id} to the customer`, detail: "The Pricing Expert agent is drafting it; follow its progress here. When it is ready, set the discount and send it. Sales support follows up.", days: 2, kind: "revise", source: "Quotation" });
  },
  /** The manager starts the bid. The legal team builds it outside SHERPA; the deal shows their progress. */
  genBid(s: State, tenderId: string, by: string, discountPct: number) {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); if (!t || !o || t.legal) return;
    const product: ProductKey = t.line === "ni" ? "newinstall" : t.line === "sc" ? "maintenance" : "modernisation";
    const offer = offerOf(s, o.offerId) ?? SH.makeOffer(s, { accountId: t.accountId, area: t.area, product, term: 1, discountPct: 0, by, oppId: o.id });
    offer.missing = undefined; offer.listPrice = t.value; offer.discountPct = discountPct; offer.price = Math.round(t.value * (1 - discountPct / 100));
    offer.createdBy = by; offer.status = "approved"; offer.approvals = [{ by, status: "approved", at: nowS(s) }]; offer.lastActivity = nowS(s);
    offer.log.push({ t: nowS(s), by: NAMES[by] ?? by, text: `Bid started at ${discountPct}% off, ${chf(offer.price)}. Handed to the legal team` });
    t.bid = { by, at: nowS(s), discountPct }; t.legal = { sentAt: nowS(s), readyAt: nowS(s) + 3 * DAY };
    closeTasks(s, o.id, ["genBid", "tenderDoc", "revise"]);
    o.offerId = offer.id; o.value = offer.price; o.stage = "bid";
    olog(s, o, by, `Bid started: ${t.id} handed to the legal team, ${discountPct}% off, ${chf(offer.price)}`);
    addTask(s, { oppId: o.id, forUser: by, by: "SHERPA", title: `Bid with the legal team: ${t.id}`, detail: "The legal team builds the bid and submits it in the tender. Follow their progress here, then record whether we won or lost.", days: Math.max(1, daysTo(s, t.eord)), kind: "bidResult", source: "Bid" });
  },
  /** Demo only: stands in for the Pricing Expert agent finishing the quotation. */
  pricingReady(s: State, offerId: string) { const of = offerOf(s, offerId); if (of?.pricing && of.pricing.readyAt > nowS(s)) of.pricing.readyAt = nowS(s); },
  /** Demo only: stands in for the legal team finishing and submitting the bid. */
  legalReady(s: State, tenderId: string) { const t = tenderOf(s, tenderId); if (!t?.legal) return; if (t.legal.readyAt > nowS(s)) t.legal.readyAt = nowS(s); OP.bidSubmitted(s, tenderId, "legal"); },
  bidSubmitted(s: State, tenderId: string, by: string) {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); const of = offerOf(s, o?.offerId); if (!t?.legal || !o || !of || t.legal.submittedAt) return;
    t.legal.submittedAt = nowS(s); t.stage = "submitted"; o.stage = "sent"; of.status = "sent"; of.sentAt = nowS(s); of.attachment = `${t.id}-bid.pdf`;
    if (o.source.itemId) leadHooks.quoted?.(s, o.source.itemId, by);
    olog(s, o, by, `Bid for ${t.id} submitted in the tender`);
  },
  /** The tender result: a win goes to the Contract agent; a loss keeps its reason for Win/Loss Insights. */
  bidResult(s: State, tenderId: string, by: string, r: "won" | "lost", reason = "") {
    const t = tenderOf(s, tenderId); const o = oppOf(s, t?.oppId); const of = offerOf(s, o?.offerId); if (!t || !o || !of || of.status !== "sent") return;
    SH.outcome(s, of.id, by, r, reason || undefined);
    if (r === "lost") olog(s, o, "SHERPA", "Loss reason saved for Win/Loss Insights");
  },
  /** The service lead took over the job. */
  acceptJob(s: State, id: string, by: string, p: { start: number; siteContact: { name: string; phone?: string } }) {
    const o = oppOf(s, id); if (!o) return;
    closeTasks(s, id, ["job"]);
    o.job = { lead: by, start: p.start, siteContact: p.siteContact, acceptedAt: nowS(s) };
    olog(s, o, by, `Job accepted. Planned start ${new Date(p.start).toLocaleDateString("en-GB")}, site contact ${p.siteContact.name}${p.siteContact.phone ? `, ${p.siteContact.phone}` : ""}`);
    ping(s, o.owner, `${NAMES[by]} accepted the job at ${o.placeName}. Start ${new Date(p.start).toLocaleDateString("en-GB")}.`);
  },
  /** A rep turns a handover into an offer: a new opportunity of their own, with a priced draft. */
  offerHandover(s: State, taskId: string, by: string, p: { product: ProductKey; term: number; discountPct: number }): Offer | undefined {
    const t = s.sherpa.tasks.find((x) => x.id === taskId); const won = oppOf(s, t?.oppId); const acc = won ? accountForOpp(s, won) : undefined;
    if (!t || !won || !acc) return;
    const offer = SH.makeOffer(s, { accountId: acc.id, area: won.area, product: p.product, term: p.term, discountPct: p.discountPct, by, fromNba: "N25" });
    acc.lines[p.product === "modernisation" ? "mod" : "sc"] = true; acc.lastActivity = nowS(s);
    OP.completeTask(s, taskId, by, `${PRODUCT[p.product].label} offer ${offer.id} drafted for ${acc.name}`);
    crm(s, by, `${PRODUCT[p.product].label} offer ${offer.id} drafted for ${acc.name} from ${won.contractId ?? won.id}`);
    return offer;
  },
  /** Keeps the opportunity in step with the Snap & Lead lead it came from. */
  sync(s: State) {
    s.sherpa.tenders.forEach((t) => { if (t.legal && !t.legal.submittedAt && nowS(s) >= t.legal.readyAt) OP.bidSubmitted(s, t.id, "legal"); });
    s.sherpa.contracts.forEach((c) => { if (c.agent && c.status !== "active" && nowS(s) >= c.agent.readyAt) CT.agentDone(s, c.id); });
    s.sherpa.opps.forEach((o) => {
      if (o.source.type !== "snap" || !o.source.itemId) return;
      if (o.stage === "won" || o.stage === "lost") leadHooks.closed?.(s, o.source.itemId, o.owner, o.stage);
      else if (o.stage === "closed") leadHooks.closed?.(s, o.source.itemId, o.owner, "notinterested");
      const lf = leadFlow(o); leadHooks.progress?.(s, o.source.itemId, lf.steps, lf.step);
      if (!isOpen(o)) return;
      const it = s.reports.flatMap((r) => r.items).find((x) => x.id === o.source.itemId); if (!it) return;
      if (o.stage === "review" || o.stage === "contract") return;
      if (it.ownerId && it.ownerId !== o.owner) { const prev = o.owner; o.owner = it.ownerId; s.sherpa.tasks.forEach((t) => { if (t.oppId === o.id && !t.done && t.forUser === prev) t.forUser = it.ownerId; }); }
      if (it.status === "closed" && it.kind === "lead") { o.stage = /Won/i.test(it.outcome ?? "") ? "won" : "closed"; o.closedAt = nowS(s); closeTasks(s, o.id, null); }
    });
  },
};
function ensureAccountFor(s: State, o: Opp): Account {
  const found = s.sherpa.accounts.find((a) => a.name === o.placeName);
  if (found) return found;
  const a: Account = { id: `acc-${s.sherpa.seq++}`, name: o.placeName, area: o.area, placeIds: [], owner: o.owner, lastActivity: nowS(s), lines: { ni: false, ei: false, sc: false, mod: false }, contact: { name: o.contact?.name ?? "To be confirmed", role: o.contact?.role ?? "", email: o.contact?.email ?? "contact@customer.example" } };
  s.sherpa.accounts.push(a); return a;
}

function newAccountFor(s: State, o: Opp): Account {
  const a: Account = { id: `acc-${s.sherpa.seq++}`, name: o.placeName, area: o.area, placeIds: [], owner: o.owner, lastActivity: nowS(s), lines: { ni: false, ei: false, sc: false, mod: false }, contact: { name: o.contact?.name ?? "To be confirmed", role: o.contact?.role ?? "", email: o.contact?.email ?? "contact@customer.example" } };
  const r = s.reports.find((x) => x.id === o.source.reportId); if (r) a.placeIds.push(r.placeId);
  s.sherpa.accounts.push(a); return a;
}
/** Accounts that could be this customer: same place first, then a shared word in the name. */
export function accountMatches(s: State, o: Opp): Account[] {
  const r = s.reports.find((x) => x.id === o.source.reportId);
  const words = o.placeName.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !["tower", "block", "building", "site"].includes(w));
  const byPlace = s.sherpa.accounts.filter((a) => (r && a.placeIds.includes(r.placeId)) || a.id === o.accountId);
  const byName = s.sherpa.accounts.filter((a) => !byPlace.includes(a) && words.some((w) => a.name.toLowerCase().includes(w)));
  return [...byPlace, ...byName].slice(0, 3);
}
const productOfKind = (k: Opp["kind"]): ProductKey => (k === "newbuild" || k === "project" ? "newinstall" : k === "renewal" ? "renewal" : k === "modernisation" ? "modernisation" : "maintenance");
/** Score reasons from history: the win rate in the area, the customer and earlier deals at the place. */
function historyReasons(s: State, o: Opp, placeId: string): Reason[] {
  const out: Reason[] = [];
  const ref = regionRef(s, o.area, productOfKind(o.kind));
  if (ref.count >= 3 && ref.winRate >= 60) out.push({ label: `History: we won ${ref.winRate}% of similar quotes in ${AREA_NAME[o.area] ?? o.area}`, pts: 5 });
  if (ref.count >= 3 && ref.winRate <= 30) out.push({ label: `History: only ${ref.winRate}% won in ${AREA_NAME[o.area] ?? o.area}`, pts: -5 });
  const acc = s.sherpa.accounts.find((a) => a.placeIds.includes(placeId));
  if (acc) out.push({ label: `History: ${acc.name} is already a customer`, pts: 5 });
  const before = s.sherpa.opps.filter((x) => x.id !== o.id && x.placeName === o.placeName);
  if (before.some((x) => x.stage === "won")) out.push({ label: "History: we won a deal at this place before", pts: 5 });
  if (before.some((x) => isOpen(x))) out.push({ label: "History: another deal is already open here", pts: -5 });
  return out;
}
export interface Insight { lines: string[]; nba: { title: string; why: string } }
/** What the manager sees next to a lead under review. Mock AI: rules over the same data. */
export function reviewBrief(s: State, o: Opp): Insight {
  const r = s.reports.find((x) => x.id === o.source.reportId); const i = r?.input;
  const ref = regionRef(s, o.area, productOfKind(o.kind));
  const acc = accountOf(s, o.accountId) ?? (r ? s.sherpa.accounts.find((a) => a.placeIds.includes(r.placeId)) : undefined);
  const assets = acc ? s.sherpa.assets.filter((a) => a.accountId === acc.id) : [];
  const lines: string[] = [];
  lines.push(acc ? `${acc.name} is an existing customer${assets.length ? ` with ${assets.length} unit${assets.length > 1 ? "s" : ""} on record` : ""}.` : "No customer record yet. One is created when the deal is set up.");
  if (ref.count) lines.push(`${AREA_NAME[o.area] ?? o.area}: ${ref.wins} of ${ref.count} similar quotes won in the last year, average discount ${Math.round(ref.avgDiscount)}%.`);
  else lines.push(`No similar quotes in ${AREA_NAME[o.area] ?? o.area} in the last year.`);
  if (i) {
    if (i.brand === "other") lines.push(`Serviced by ${i.servicer === "maker" ? "its maker" : i.servicer === "staff" ? "building staff" : i.servicer === "nobody" ? "nobody" : "another company"}, about ${i.age} years old.`);
    if (i.condition === "minor" || i.condition === "out") lines.push(`The reporter saw ${i.condition === "out" ? "it out of service" : "minor issues"}.`);
    if (i.subject === "site") lines.push(`Building site${i.stage ? `, ${i.stage === "early" ? "early stage" : i.stage === "structure" ? "structure going up" : "finishing"}` : ""}. ${i.competitorInstalling ? "A competitor is on site." : "No lift supplier seen yet."}`);
  }
  const nba = o.kind === "newbuild" || o.kind === "project"
    ? { title: "Pursue: the NI rep calls the developer", why: "Building sites are won before the tender. Ask for the timeline and whether a tender is planned." }
    : o.kind === "modernisation" ? { title: "Book a modernisation survey", why: "An old unit with problems. A survey gives the facts for the quotation." }
    : o.kind === "renewal" ? { title: "Visit, then offer a 3-year renewal", why: "The contract ended or is ending. Renewals close fastest after a visit." }
    : i?.brand === "other" ? { title: "Competitor-serviced unit: approach the owner with a maintenance offer (NBA 9)", why: "The owner already pays for service. A visit and a first-year discount win most of these." }
    : { title: "Visit and offer a maintenance contract", why: "Our lift without an active contract." };
  return { lines, nba };
}
export interface DealNba { key: string; title: string; why: string; product: ProductKey; term: number; discountPct: number }
/** Next best actions for an existing installation, from the report and the unit. */
export function dealNbas(s: State, o: Opp): DealNba[] {
  const i = s.reports.find((x) => x.id === o.source.reportId)?.input;
  const out: DealNba[] = [];
  if (i?.brand === "other" || o.kind === "existing") out.push({ key: "N9", title: "Win the service: 3-year maintenance, 10% off", why: i?.servicer === "nobody" ? "Nobody services it today. A contract is an easy yes." : "Serviced by someone else. A first-year discount is the usual way in.", product: "maintenance", term: 3, discountPct: 10 });
  if (o.kind === "renewal" || i?.contract === "ended" || i?.contract === "ending" || i?.contract === "cancelled") out.push({ key: "N3", title: "Renew the contract for 3 years", why: "The contract has ended or is ending.", product: "renewal", term: 3, discountPct: 5 });
  out.push({ key: "N23", title: "1-year maintenance trial at list price", why: "A low-risk first step for a cautious owner.", product: "maintenance", term: 1, discountPct: 0 });
  if ((i?.age ?? 0) >= 20 || i?.condition === "out") out.push({ key: "N11", title: "Offer a modernisation instead", why: `About ${i?.age ?? 20} years old${i?.condition === "out" ? " and out of service" : ""}. A new drive and controller may cost less than years of repairs.`, product: "modernisation", term: 1, discountPct: 0 });
  return out;
}

/* ------------------------------------------------------------------ tender document: mock reading */
const pick = <T,>(xs: T[], seed: string, k = 0) => xs[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7 + k) % xs.length];

export function readTenderDoc(t: Tender, file: { name: string; size: number }, at: number): TenderDoc {
  const g = /(\d+) floors/.exec(t.summary); const speed = /(\d\.\d) m\/s/.exec(t.summary)?.[1]; const months = /(\d+) months/.exec(t.summary)?.[1];
  return {
    name: file.name, size: file.size, at,
    found: [
      { label: "Lifts asked for", value: `${t.lifts} passenger lift${t.lifts > 1 ? "s" : ""}`, page: 3 },
      { label: "Building", value: g ? `${g[1]} floors, ${Number(g[1]) + 1} stops` : "20 stops", page: 3 },
      { label: "Speed", value: `${speed ?? "1.75"} m/s`, page: 4 },
      { label: "Delivery", value: months ? `${months} months from order` : "12 months from order", page: 6 },
      { label: "Last date to submit", value: new Date(t.eord).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), page: 1 },
      { label: "Bid security (EMD)", value: "2% of the bid price, bank guarantee", page: 2 },
      ...(t.competitorSpec ? [{ label: "Named spec", value: t.competitorSpec, page: 5 }] : []),
    ],
    gaps: [
      { key: "load", q: "The document gives no rated load. What should we offer?", opts: ["1,000 kg (13 persons)", "1,350 kg (20 persons)", "1,600 kg (21 persons)"] },
      { key: "door", q: "Which door type?", opts: ["Centre-opening, 2 panels", "Side-opening, 2 panels", "Telescopic, 3 panels"] },
      { key: "finish", q: "Cabin finish?", opts: ["Stainless steel, hairline", "Mirror steel", "Painted, customer colour"] },
      { key: "service", q: "Include free maintenance after handover?", opts: ["12 months", "24 months", "Not included"] },
    ],
  };
}
const FACTORS: Record<string, number> = { "1,600 kg (21 persons)": 1.04, "Telescopic, 3 panels": 1.02, "Mirror steel": 1.02, "24 months": 1.03 };
export function briefFactor(b?: QuoteBrief) {
  if (!b) return 1;
  const floors = Number(b.floors) || 10;
  return Math.max(0.85, Math.min(1.4, 1 + (floors - 10) * 0.015)) * (/2\.5|3\.0/.test(b.speed) ? 1.1 : 1) * (/mirror|glass/i.test(b.finish) ? 1.03 : 1);
}
const CUSTOMER_LINES = [
  "Thanks for the quotation. Can you confirm the delivery time for all the lifts?",
  "Does the price include the first year of maintenance?",
  "That works for us. Please send the order form and we will sign this week.",
];
const SERVICE_LINES = [
  "Thanks for the offer. How fast do you respond when a lift breaks down?",
  "Our current contract ends next month. Can you start straight after?",
  "That works for us. Please send the contract and we will sign this week.",
];

/** Opportunities and tasks for the seeded tenders and offers, so every offer and tender already belongs to one record. */
function seedOpps(sh: Sherpa, now: number) {
  const st = { sherpa: sh, clock: 0, cfg: undefined } as unknown as State;
  const mk = (title: string, kind: Opp["kind"], accountId: string, place: string, area: string, owner: string, stage: OppStage, label: string, createdAgo: number) => {
    const o: Opp = { id: `OP-${sh.seq++}`, title, kind, accountId, placeName: place, area, owner, stage, createdAt: now - createdAgo * DAY, source: { type: "nba", label }, log: [{ t: now - createdAgo * DAY, by: NAMES[owner] ?? owner, text: `Opportunity created from ${label}` }] };
    sh.opps.push(o); return o;
  };
  const task = (o: Opp, forUser: string, by: string, title: string, kind: TaskKind, dueDays: number, ageH = 0, detail?: string) => { sh.tasks.push({ id: `TK-${sh.seq++}`, oppId: o.id, title, detail, by, forUser, kind, due: now + dueDays * DAY, done: false, createdAt: now - ageH * HOUR, source: "workflow" }); };
  const acc = (id: string) => sh.accounts.find((a) => a.id === id)!;
  sh.tenders.forEach((t) => {
    const scouting = t.stage === "matched"; const ar = AREA_REPS.find((u) => u.areas?.includes(t.area))?.id ?? t.owner;
    const o = mk(t.name, t.line === "ni" ? "newbuild" : t.line === "sc" ? "renewal" : "modernisation", t.accountId, acc(t.accountId).name, t.area, scouting ? ar : t.owner, scouting ? "scout" : "bid", `tender ${t.id}`, 12);
    t.oppId = o.id; o.tenderId = t.id; o.value = t.value; o.contact = { name: acc(t.accountId).contact.name, role: acc(t.accountId).contact.role, email: acc(t.accountId).contact.email, via: "the account record" }; o.visited = t.stage !== "matched";
    if (scouting) task(o, ar, "projectfinder", `Send a technician: ${t.name}`, "scout", 2, 20, `${t.summary} Send a technician to check the site, then propose the team to ${NAMES[MANAGER]}.`);
    else task(o, t.owner, "projectfinder", `Gather the bid information for ${t.id}`, "tenderDoc", Math.max(2, Math.round((t.eord - now) / DAY) - 5), 30, `Bid due ${Math.round((t.eord - now) / DAY)} days from now. Upload the tender document; SHERPA lists what it leaves open. Add what you know about the customer and the competition, then send it to ${NAMES[MANAGER]}, who starts the bid.`);
  });
  sh.offers.forEach((of) => {
    const t = sh.tenders.find((x) => x.accountId === of.accountId && of.product === "newinstall");
    if (t?.oppId) { of.oppId = t.oppId; const o = sh.opps.find((x) => x.id === t.oppId)!; o.offerId = of.id; return; }
    const kind: Opp["kind"] = of.product === "modernisation" ? "modernisation" : of.product === "renewal" ? "renewal" : "existing";
    const o = mk(`${of.title}: ${acc(of.accountId).name}`, kind, of.accountId, acc(of.accountId).name, of.area, of.createdBy, of.status === "sent" ? "sent" : "offer", `offer ${of.id}`, 20);
    of.oppId = o.id; o.offerId = of.id; o.value = of.price; o.visited = true; o.contact = { name: acc(of.accountId).contact.name, role: acc(of.accountId).contact.role, email: acc(of.accountId).contact.email, via: "the account record" };
    if (of.status === "sent" && of.sentAt) task(o, of.createdBy, of.createdBy, `Follow up with ${acc(of.accountId).name} on ${of.id}`, "followup", Math.round((of.sentAt + 14 * DAY - now) / DAY), 0);
    if (of.status === "awaiting") of.approvals.filter((x) => x.status === "pending").forEach((x) => task(o, x.by, of.createdBy, `Approve ${of.discountPct}% on ${of.id} for ${acc(of.accountId).name}`, "approve", -0.5, 60, `${of.title}, ${chf(of.price)}. Guideline is ${GUIDE.seller}%.`));
  });
  void st;
}

/* ------------------------------------------------------------------ helpers */
export function ping(s: State, userId: string, text: string, offerId?: string, reportId?: string) {
  const a: Alert = { id: `al${Date.now()}${Math.floor(Math.random() * 1e5)}`, userId, t: nowS(s), text, offerId, reportId, read: false };
  s.alerts.unshift(a);
}
const log = (s: State, o: Offer, by: string, text: string) => { o.log.push({ t: nowS(s), by: NAMES[by] ?? by, text }); o.lastActivity = nowS(s); };
const crm = (s: State, by: string, text: string) => { s.sherpa.crm.unshift({ t: nowS(s), by: NAMES[by] ?? by, text }); };
export const accountOf = (s: State, id?: string) => s.sherpa.accounts.find((a) => a.id === id);
export const assetOf = (s: State, id?: string) => s.sherpa.assets.find((a) => a.id === id);
export const offerOf = (s: State, id?: string) => s.sherpa.offers.find((o) => o.id === id);
export const tenderOf = (s: State, id?: string) => s.sherpa.tenders.find((t) => t.id === id);
export const daysTo = (s: State, t: number) => Math.round((t - nowS(s)) / DAY);

/** An account for a Snap & Lead place that is not in the mock CRM yet. */
/** The customer record for an opportunity. A new building site has none until it is won, so it is made here. */
export function accountForOpp(s: State, o: Opp): Account | undefined {
  const found = accountOf(s, o.accountId) ?? s.sherpa.accounts.find((a) => a.name === o.placeName);
  if (found) { o.accountId = found.id; return found; }
  const r = s.reports.find((x) => x.id === o.source.reportId); if (!r) return;
  const acc = ensureAccount(s, r, o.owner); o.accountId = acc.id; return acc;
}
export function ensureAccount(s: State, r: Report, owner: string): Account {
  const found = s.sherpa.accounts.find((a) => a.placeIds.includes(r.placeId));
  if (found) return found;
  const a: Account = { id: `acc-${r.placeId}-${s.sherpa.seq++}`, name: r.placeName, area: r.area, placeIds: [r.placeId], owner, lastActivity: nowS(s), lines: { ni: false, ei: false, sc: false, mod: false }, contact: { name: r.extras.contact?.split("·")[0]?.trim() || "Building contact", role: "To be confirmed", email: "contact@customer.example" } };
  s.sherpa.accounts.push(a);
  return a;
}

/* ------------------------------------------------------------------ effects: what a chip does when pressed */
export type Effect =
  | { t: "task"; title: string; days: number; accountId?: string; to?: string; nba?: string }
  | { t: "note"; text: string; nba?: string }
  | { t: "tenderStage"; id: string; stage: Tender["stage"]; nba?: string }
  | { t: "tenderQualify"; id: string; nba?: string }
  | { t: "tenderDrop"; id: string; nba?: string }
  | { t: "offerFix"; id: string; nba?: string }
  | { t: "offerContract"; id: string; nba?: string }
  | { t: "escalate"; id: string; nba?: string }
  | { t: "obr"; assetId: string; nba?: string }
  | { t: "alertOwners"; assetId: string; nba?: string }
  | { t: "customerAlert"; assetId: string; nba?: string }
  | { t: "handover"; accountId: string; to: string; line: "ni" | "ei" | "sc" | "mod"; nba?: string }
  | { t: "campaign"; name: string; segment: string; area: string; size: number; subject: string; body: string; nba?: string }
  | { t: "assign"; mleadId: string; to: string; nba?: string }
  | { t: "nudgeLeads"; nba?: string }
  | { t: "ack"; nba?: string };

/* ------------------------------------------------------------------ offer actions */
export const SH = {
  makeOffer(s: State, p: { id?: string; accountId: string; assetId?: string; area: string; product: ProductKey; term: number; discountPct: number; by: string; fromNba?: string; source?: Offer["source"]; oppId?: string }): Offer {
    const lp = listPrice(p.area, p.product, p.term);
    const num = p.id ? Number(p.id.slice(3)) : s.sherpa.seq; s.sherpa.seq = Math.max(s.sherpa.seq, num + 1);
    const o: Offer = { id: p.id ?? `OF-${num}`, accountId: p.accountId, assetId: p.assetId, area: p.area, product: p.product, title: PRODUCT[p.product].label, term: p.term, listPrice: lp, price: Math.round(lp * (1 - p.discountPct / 100)), discountPct: p.discountPct, status: "draft", createdBy: p.by, createdAt: nowS(s), lastActivity: nowS(s), approvals: [], fromNba: p.fromNba, source: p.source, log: [] };
    log(s, o, p.by, "Draft created by SHERPA from the account data and the region price reference");
    s.sherpa.offers.unshift(o);
    let opp = oppOf(s, p.oppId) ?? (p.source ? s.sherpa.opps.find((x) => x.source.itemId === p.source!.itemId) : undefined);
    if (!opp) {
      const acc = accountOf(s, p.accountId); const kind: Opp["kind"] = p.product === "modernisation" ? "modernisation" : p.product === "renewal" ? "renewal" : p.product === "newinstall" ? "newbuild" : "existing";
      opp = OP.create(s, { title: PRODUCT[p.product].label, kind, accountId: p.accountId, placeName: acc?.name ?? "Customer", area: p.area, owner: p.by, source: { type: "nba", label: p.fromNba ? `next best action ${p.fromNba.split(":")[0]}` : "Ask SHERPA" }, stage: "offer", contact: acc ? { name: acc.contact.name, role: acc.contact.role, email: acc.contact.email, via: "the account record" } : undefined });
    }
    o.oppId = opp.id; opp.offerId = o.id; opp.value = o.price; if (opp.stage === "scout" || opp.stage === "qualify") opp.stage = "offer";
    return o;
  },
  setTerms(s: State, id: string, by: string, t: { term?: number; discountPct?: number }) {
    const o = offerOf(s, id); if (!o || !["draft", "changes"].includes(o.status)) return;
    if (t.term !== undefined) o.term = t.term;
    if (t.discountPct !== undefined) o.discountPct = Math.max(0, Math.min(40, Math.round(t.discountPct)));
    o.listPrice = Math.round(listPrice(o.area, o.product, o.term) * briefFactor(o.brief)); o.price = Math.round(o.listPrice * (1 - o.discountPct / 100));
    o.email = undefined; o.approvals = [];
    log(s, o, by, `Terms changed: ${PRODUCT[o.product].yearly ? `${o.term} year${o.term > 1 ? "s" : ""}, ` : ""}${o.discountPct}% off`);
  },
  submit(s: State, id: string, by: string) {
    const o = offerOf(s, id); if (!o || !["draft", "changes"].includes(o.status)) return;
    if (o.missing?.length) { log(s, o, by, "Cannot be sent yet: configuration data is missing"); return; }
    if (aboveLimit(o.discountPct)) { log(s, o, by, `Blocked: ${o.discountPct}% is above the ${GUIDE.manager}% a manager can approve`); OP.onOffer(s, o, "blocked"); return; }
    const need = approversFor(o.discountPct, s.cfg).filter((u) => u !== by);
    if (!need.length) { o.status = "approved"; o.approvals = []; log(s, o, by, by === MANAGER ? "Checked by the Sales Manager: ready to send" : `Within guideline (${o.discountPct}% is up to ${GUIDE.seller}%): no approval needed`); OP.onOffer(s, o, "approved"); return; }
    o.approvals = need.map((u) => ({ by: u, status: "pending" as const }));
    o.status = "awaiting";
    log(s, o, by, `Sent for approval to ${need.map((u) => NAMES[u] ?? u).join(" then ")}: ${o.discountPct > GUIDE.seller ? `${o.discountPct}% is above the ${GUIDE.seller}% guideline` : "every quotation is approved by the Sales Manager"}`);
    OP.onOffer(s, o, "submitted");
  },
  decide(s: State, id: string, by: string, d: "approved" | "changes" | "rejected", reason: string, discountPct?: number) {
    const o = offerOf(s, id); if (!o || o.status !== "awaiting") return;
    const step = o.approvals.find((x) => x.status === "pending" && x.by === by); if (!step) return;
    if (d === "approved" && discountPct !== undefined && discountPct !== o.discountPct && discountPct <= GUIDE.manager) {
      log(s, o, by, `Discount changed from ${o.discountPct}% to ${discountPct}% by ${NAMES[by] ?? by}`);
      o.discountPct = discountPct; o.price = Math.round(o.listPrice * (1 - discountPct / 100));
      const op = oppOf(s, o.oppId); if (op) op.value = o.price;
    }
    step.status = d; step.reason = reason; step.at = nowS(s);
    const who = NAMES[by] ?? by;
    if (d === "approved") {
      log(s, o, by, `Approved${reason ? `: ${reason}` : ""}`);
      const next = o.approvals.find((x) => x.status === "pending");
      if (next) ping(s, next.by, `Approval needed: ${o.title} for ${accountOf(s, o.accountId)?.name} at ${o.discountPct}% off (above ${GUIDE.manager}%)`, o.id);
      else { o.status = "approved"; ping(s, o.createdBy, `${o.id} approved by ${who}. You can send it now.`, o.id); OP.onOffer(s, o, "approved"); }
    } else if (d === "changes") { o.status = "changes"; log(s, o, by, `Asked for changes: ${reason}`); ping(s, o.createdBy, `${who} asked for changes on ${o.id}: ${reason}`, o.id); OP.onOffer(s, o, "changes", reason); }
    else { o.status = "rejected"; log(s, o, by, `Rejected: ${reason}`); ping(s, o.createdBy, `${who} rejected ${o.id}: ${reason}`, o.id); OP.onOffer(s, o, "rejected", reason); }
  },
  send(s: State, id: string, by: string, email: { subject: string; body: string }) {
    const o = offerOf(s, id); if (!o || o.status !== "approved") return;
    o.email = email; o.status = "sent"; o.sentAt = nowS(s); o.attachment = `${o.id}-${o.product === "newinstall" || o.product === "modernisation" ? "quotation" : "offer"}.pdf`;
    o.chat = [{ from: "us", by: NAMES[by] ?? by, t: nowS(s), text: email.subject, file: o.attachment }];
    log(s, o, by, `Email sent to the customer with ${o.attachment}. Follow-up set for 14 days`);
    const a = accountOf(s, o.accountId); if (a) a.lastActivity = nowS(s);
    if (o.fromNba) s.sherpa.nba[o.fromNba] = { status: "done", at: nowS(s) };
    crm(s, by, `Quote ${o.id} logged on the account with the email attached`);
    OP.onOffer(s, o, "sent");
  },
  /** A message to the customer. The mock customer answers straight away. */
  chat(s: State, id: string, by: string, text: string) {
    const o = offerOf(s, id); if (!o || !text.trim()) return;
    const msgs = (o.chat ??= []); const acc = accountOf(s, o.accountId);
    msgs.push({ from: "us", by: NAMES[by] ?? by, t: nowS(s), text: text.trim() });
    const n = msgs.filter((m) => m.from === "customer").length;
    const reply = /discount|price|cost|cheaper/i.test(text) && n < 2 ? "We have one more quote that is a little lower. Can you do anything on the price?" : (PRODUCT[o.product].yearly ? SERVICE_LINES : CUSTOMER_LINES)[Math.min(n, CUSTOMER_LINES.length - 1)];
    const m: ChatMsg = { from: "customer", by: acc?.contact.name ?? "Customer", t: nowS(s) + 60000, text: reply };
    msgs.push(m); log(s, o, by, "Message to the customer. The customer replied"); if (acc) acc.lastActivity = nowS(s);
  },
  remind(s: State, id: string, by: string) {
    const o = offerOf(s, id); if (!o || o.status !== "awaiting") return;
    o.approvals.filter((x) => x.status === "pending").forEach((x) => { ping(s, x.by, `Reminder: ${o.id} for ${accountOf(s, o.accountId)?.name} at ${o.discountPct}% off is waiting for you`, o.id); log(s, o, by, `Reminded ${NAMES[x.by] ?? x.by}`); });
  },
  chase(s: State, id: string, by: string) {
    const o = offerOf(s, id); if (!o || o.status !== "sent") return;
    log(s, o, by, "Follow-up sent to the customer"); const a = accountOf(s, o.accountId); if (a) a.lastActivity = nowS(s);
    OP.onOffer(s, o, "chased");
  },
  outcome(s: State, id: string, by: string, r: "won" | "lost", reason?: string) {
    const o = offerOf(s, id); if (!o || o.status !== "sent") return;
    o.status = r; log(s, o, by, r === "won" ? "Customer accepted. Won" : `Customer declined${reason ? `: ${reason}` : ""}. Lost`);
    s.sherpa.past.push({ id: `p${s.sherpa.seq++}`, area: o.area, product: o.product, price: perYear(o), discountPct: o.discountPct, outcome: r, at: nowS(s), customer: accountOf(s, o.accountId)?.name ?? "Customer" });
    const a = accountOf(s, o.accountId); if (a) a.lastActivity = nowS(s);
    crm(s, by, `Opportunity ${o.id} closed ${r === "won" ? "won" : "lost"}`);
    OP.onOffer(s, o, r, reason);
  },
  setNba(s: State, key: string, status: "snoozed" | "dismissed" | "done", days = 1) {
    s.sherpa.nba[key] = { status, at: nowS(s), until: status === "snoozed" ? nowS(s) + days * DAY : undefined };
  },
  /** Run a chip's effect against the mock CRM. Always writes a line to the CRM log so the back office can see it. */
  apply(s: State, by: string, e: Effect) {
    const sh = s.sherpa; const now = nowS(s); const who = NAMES[by] ?? by;
    switch (e.t) {
      case "task": { const t: Task = { id: `TK-${sh.seq++}`, title: e.title, by, forUser: e.to ?? by, accountId: e.accountId, kind: "other", due: now + e.days * DAY, done: false, createdAt: now, source: e.nba ?? "chat" }; sh.tasks.unshift(t); crm(s, by, `Task created: ${e.title}`); if (e.to && e.to !== by) ping(s, e.to, `${who} assigned you a task: ${e.title}`); break; }
      case "note": crm(s, by, e.text); break;
      case "tenderStage": { const t = tenderOf(s, e.id); if (t) { t.stage = e.stage; crm(s, by, `Tender ${t.id} moved to ${e.stage === "final" ? "final bidding" : e.stage}`); } break; }
      case "tenderQualify": { const t = tenderOf(s, e.id); if (t) { t.stage = "qualifying"; const a = accountOf(s, t.accountId); if (a) a.lastActivity = now; crm(s, by, `Tender ${t.id} qualified as a lead and assigned to ${NAMES[t.owner]}`); } break; }
      case "tenderDrop": { const t = tenderOf(s, e.id); if (t) { t.stage = "lost"; crm(s, by, `Tender ${t.id} dismissed: not a fit`); } break; }
      case "offerFix": { const o = offerOf(s, e.id); if (o) { o.missing = undefined; log(s, o, by, "Configuration completed by Sales support: rated load 1,350 kg, 34 floors, centre-opening doors"); const op = oppOf(s, o.oppId); if (op) { olog(s, op, by, "Configuration completed by Sales support"); addTask(s, { oppId: op.id, forUser: o.createdBy, by, title: `Price and submit ${o.id} for approval`, detail: "The configuration is complete. Set the discount and send it for approval.", days: 2, kind: "revise" }); } ping(s, o.createdBy, `${who} completed the configuration for ${o.id}. You can send it for approval.`, o.id); crm(s, by, `Quote ${o.id} completed with configuration data`); } break; }
      case "offerContract": { const o = offerOf(s, e.id); if (o) { o.contractChange = undefined; o.listPrice = Math.round(o.listPrice * 1.08); o.price = Math.round(o.listPrice * (1 - o.discountPct / 100)); log(s, o, by, "Offer updated for the amended contract: price raised 8% for 24x7 cover and a 2-hour response"); crm(s, by, `Offer ${o.id} updated for the amended contract`); } break; }
      case "escalate": { const o = offerOf(s, e.id); if (o) { o.approvals.filter((x) => x.status === "pending").forEach((x) => ping(s, x.by, `Escalation from Sales support: ${o.id} (${accountOf(s, o.accountId)?.name}, ${chf(o.price)}) has waited ${Math.round((now - o.lastActivity) / HOUR)} hours and is blocking the deal`, o.id)); log(s, o, by, "Escalated to the approver with context by Sales support"); crm(s, by, `Approval escalation sent on ${o.id}`); } break; }
      case "obr": { const a = assetOf(s, e.assetId); if (a) { a.contractChangedAfterObr = false; crm(s, by, `Corrected OBR for ${a.label.split(" · ")[0]} sent to the back office`); } break; }
      case "alertOwners": { const a = assetOf(s, e.assetId); if (a) { [a.owner, a.mod].filter(Boolean).forEach((u) => ping(s, u!, `Joint EI and MOD plan for ${a.label.split(" · ")[0]}: ${who} proposes a bundled offer`)); crm(s, by, `EI and MOD owners alerted for ${a.label.split(" · ")[0]}`); } break; }
      case "customerAlert": { const a = assetOf(s, e.assetId); if (a) { crm(s, by, `Customer alerted about obsolete parts on ${a.label.split(" · ")[0]}`); const acc = accountOf(s, a.accountId); if (acc) acc.lastActivity = now; } break; }
      case "handover": { const acc = accountOf(s, e.accountId); if (acc) { acc.lines[e.line] = true; sh.tasks.unshift({ id: `TK-${sh.seq++}`, title: `Handover pack: pursue ${e.line.toUpperCase()} at ${acc.name}`, by, forUser: e.to, accountId: acc.id, kind: "handover", due: now + 7 * DAY, done: false, createdAt: now, source: e.nba ?? "handover" }); ping(s, e.to, `${who} sent you a handover pack for ${acc.name} (${e.line.toUpperCase()})`); crm(s, by, `Handover pack sent to ${NAMES[e.to]} for ${acc.name}`); } break; }
      case "campaign": { sh.campaigns.unshift({ id: `C-${sh.seq++}`, name: e.name, segment: e.segment, area: e.area, size: e.size, status: "live", createdBy: by, createdAt: now, message: { subject: e.subject, body: e.body }, leads: 0 }); crm(s, by, `Campaign created: ${e.name} (${e.size} contacts)`); break; }
      case "assign": { const l = sh.mleads.find((x) => x.id === e.mleadId); if (l) { l.owner = e.to; l.status = "working"; crm(s, by, `Lead ${l.id} assigned to ${NAMES[e.to]}`); const o = OP.create(s, { title: l.interest, kind: "existing", placeName: l.name, area: l.area, owner: areaRepFor(l.area) ?? e.to, source: { type: "campaign", label: `campaign lead ${l.id} (${l.source})` } }); OP.startScout(s, o.id, by, `Campaign lead: ${l.source}. Score ${l.score}.`); } break; }
      case "nudgeLeads": { sh.mleads.filter((l) => l.status === "new" && now - l.createdAt > 48 * HOUR).forEach((l) => { if (l.owner) ping(s, l.owner, `Lead ${l.id} (${l.name}) has waited over 48 hours. Please follow up.`); }); crm(s, by, "Owners nudged for leads waiting over 48 hours"); break; }
      case "ack": break;
    }
    if (e.nba) sh.nba[e.nba] = { status: "done", at: now };
  },
};

/* ------------------------------------------------------------------ generated text */
export function emailFor(s: State, o: Offer, seller: string): { subject: string; body: string } {
  const a = accountOf(s, o.accountId); const asset = assetOf(s, o.assetId);
  const first = (oppOf(s, o.oppId)?.contact ?? a?.contact)?.name.split(" ")[0] ?? "there";
  const what = asset ? asset.label.split(" · ")[0] + (asset.label.split(" · ")[1] ? ` at ${asset.label.split(" · ")[1]}` : "") : (a?.name ?? "your building");
  const tn = s.sherpa.tenders.find((t) => t.oppId === o.oppId && t.bid);
  if (tn) {
    const body = `Dear ${first},

Please find our bid for ${tn.name}.

- Lifts: ${tn.lifts}
- Bid price: ${chf(o.price)}${o.discountPct ? `, including ${o.discountPct}% off the list price` : ""}. VAT extra.
- Papers attached: ${BID_PAPERS.map((p) => p.title.toLowerCase()).join(", ")}.

Please tell me if you need anything else before the last date. I will call you to check that you received it.

Best regards,
${seller}`;
    return { subject: `Our bid for ${tn.name}`, body };
  }
  const yearly = PRODUCT[o.product].yearly;
  const price = yearly ? `${chf(o.price / o.term)} per year (${chf(o.price)} over ${o.term} year${o.term > 1 ? "s" : ""})` : chf(o.price);
  const body = `Dear ${first},\n\nThank you for your time. Following our conversation about ${what}, here is our proposal: ${o.title.toLowerCase()}${yearly ? `, ${o.term} year${o.term > 1 ? "s" : ""}` : ""}.\n\nPrice: ${price}${o.discountPct ? `, including ${o.discountPct}% off the list price` : ""}. VAT extra.\n\nI will call you in two weeks to answer any questions. If it helps, I can come by and walk through it on site.\n\nBest regards,\n${seller}`;
  return { subject: `${o.title} for ${what}`, body };
}
export function chaseEmail(s: State, o: Offer, seller: string) {
  const a = accountOf(s, o.accountId); const first = a?.contact.name.split(" ")[0] ?? "there";
  return { subject: `Following up: ${o.title}`, body: `Dear ${first},\n\nI wanted to follow up on the ${o.title.toLowerCase()} we sent on ${new Date(o.sentAt ?? o.createdAt).toLocaleDateString("en-GB")}. Is there anything I can clarify, or a decision I can help you prepare?\n\nIf timing is the issue, I am happy to adjust the start date.\n\nBest regards,\n${seller}` };
}

/* ------------------------------------------------------------------ the 27 next best actions */
export interface NbaCard {
  key: string; no: number; title: string; why: string; sources: string[]; urgency: "high" | "med" | "low"; value?: number; agent: string; cta: string;
  prompt: string; accountId?: string; assetId?: string; offerId?: string; reportId?: string; itemId?: string; tenderId?: string; mleadId?: string; segment?: string;
  kind: "offer" | "brief" | "email" | "approval" | "review" | "lead" | "team" | "doc";
}
export const CATALOG: { no: number; title: string; persona: string; status: "live" | "coming" | "off"; trigger: string; agent: string }[] = ([
  [1, "Recent callback on assets", "REP, SC, MOD", "A callback on a unit in the last 14 days", "Sales Assistant, CRM Agent"],
  [2, "Contract changed after OBR", "REP", "Contract amended after an open OBR", "CRM Agent"],
  [3, "Contract cancelled or ending", "REP, SC, MOD", "Contract ends within 60 days", "CRM Agent, Churn Prediction"],
  [4, "High OBR with open MOD offer", "MOD", "5+ OBR in 90 days and an open MOD offer on the unit", "Price Pilot, MOD Propensity Scoring"],
  [5, "MOD on the same asset", "REP", "An open MOD offer exists on a unit the REP owns", "CRM Agent"],
  [6, "SC contract changes in offer", "SC", "Contract terms changed while an offer is open", "Contract Risk Reviewer"],
  [7, "Renewal at risk", "REP, SC", "Health below 45 and the contract ends within 90 days", "Customer Health Score, Churn Prediction"],
  [8, "Rising callbacks", "REP", "Callbacks up 40% on the 90 days before", "Customer Health Score, Sales Assistant"],
  [9, "Competitor-serviced units", "REP", "Snap & Lead found a lift serviced by another company", "Snap & Lead, CRM Agent"],
  [10, "Repair need in tech notes", "REP", "A technician note mentions a repair or part", "Repair Lead Generation"],
  [11, "Ageing units, frequent faults", "MOD", "25+ years old and 4+ faults in 90 days", "MOD Propensity Scoring, Price Pilot"],
  [12, "Obsolete parts or code change", "MOD", "A part on the unit is discontinued", "MOD Propensity Scoring"],
  [13, "EORD near, not final bidding", "NI, MOD, SC", "End of order date within 14 days, stage not final", "Tender Insight, CRM Agent"],
  [14, "Loss history with account", "NI", "We lost a bid at this account before", "Sales Assistant"],
  [15, "Matched tender or permit", "NI", "A new tender or permit matches the territory", "Project Lead Finder, Tender Insight"],
  [16, "Quote idle 14+ days", "NI, REP, SC, MOD", "Quote sent, no activity for 14 days", "Proposal Generator, CRM Agent"],
  [17, "Competitor spec in tender", "NI", "The tender names a competitor spec", "Tender Insight"],
  [18, "Stalled deals in pipeline", "Sales manager", "3+ deals with no movement for 21 days", "CRM Agent"],
  [19, "Discount above guideline", "Sales manager", "A quote's discount is above the guideline", "Price Pilot"],
  [20, "Coaching need on win rate", "Sales manager", "Team win-rate drivers. Off until works-council review", "CRM Agent"],
  [21, "Quote missing data", "Sales support", "A quote is missing configuration data", "Configuration Assistant"],
  [22, "Approval blocking a deal", "Sales support", "An approval waits more than 48 hours", "CRM Agent"],
  [23, "New unit handed over", "REP, Account manager", "New unit with no maintenance contract", "Conversion Alerts"],
  [24, "Key account silent too long", "Account manager", "No activity for 60 days", "CRM Agent, Customer Health Score"],
  [25, "Cross-sell NI, Service, MOD", "Account manager", "Active in one line, not in the others", "Handover Pack Generator, Conversion Alerts"],
  [26, "Ageing-portfolio cluster", "Marketing", "3+ units over 20 years in one area", "Customer Segmentation, Personalized Outreach"],
  [27, "Leads not followed up 48h", "Sales manager, Marketing", "Leads without action for 48 hours", "CRM Agent"],
] as [number, string, string, string, string][]).map(([no, title, persona, trigger, agent]) => ({ no, title, persona, trigger, agent, status: (no === 20 ? "off" : "live") as "live" | "off" }));

export const AGENTS: { name: string; group: string; status: "live" | "hold" | "new"; does: string; serves: string }[] = [
  { name: "Snap & Lead", group: "Opportunity", status: "live", does: "Reads lift photos and creates the right lead", serves: "REP, all employees" },
  { name: "Project Lead Finder", group: "Opportunity", status: "new", does: "Matches tenders and permits to the territory", serves: "NI" },
  { name: "MOD Propensity Scoring", group: "Opportunity", status: "new", does: "Ranks ageing, fault-prone units for modernisation", serves: "MOD" },
  { name: "Tender Insight", group: "Commercial", status: "live", does: "Summarises tenders, checks the EORD and competitor specs", serves: "NI, MOD, SC" },
  { name: "Price Pilot", group: "Commercial", status: "live", does: "Checks price and discount against the guideline and the area", serves: "All sellers, manager" },
  { name: "Configuration Assistant", group: "Commercial", status: "new", does: "Completes lift configurations and flags missing data", serves: "Sales support" },
  { name: "Proposal Generator", group: "Commercial", status: "new", does: "Drafts offers and follow-up emails", serves: "NI, REP, SC" },
  { name: "Contract Risk Reviewer", group: "Commercial", status: "new", does: "Explains contract changes and their price effect", serves: "SC" },
  { name: "Sales Assistant", group: "Engagement", status: "live", does: "Briefs sellers before visits and calls", serves: "All sellers" },
  { name: "Customer Segmentation", group: "Engagement", status: "live", does: "Builds audiences from the installed base", serves: "Marketing" },
  { name: "Personalized Outreach", group: "Engagement", status: "new", does: "Drafts campaign messages per segment", serves: "Marketing" },
  { name: "CRM Agent", group: "Retention and handover", status: "live", does: "Reads and writes NewCRM: pipeline, tasks, approvals", serves: "All personas" },
  { name: "Customer Health Score", group: "Retention and handover", status: "new", does: "Scores account and unit health", serves: "REP, SC, Account manager" },
  { name: "Conversion Alerts", group: "Retention and handover", status: "new", does: "Flags new units that need a contract", serves: "REP, Account manager" },
  { name: "Handover Pack Generator", group: "Retention and handover", status: "new", does: "Builds the pack when a lead moves to the next line", serves: "Account manager" },
  { name: "Churn Prediction", group: "Retention and handover", status: "hold", does: "Predicts which contracts will not renew", serves: "REP, SC" },
  { name: "Repair Lead Generation", group: "Retention and handover", status: "hold", does: "Turns technician notes into repair quotes", serves: "REP" },
];

const URG = { high: 0, med: 1, low: 2 } as const;
export function computeNbas(s: State, u: User): NbaCard[] {
  const now = nowS(s); const out: NbaCard[] = []; const sh = s.sherpa;
  if (!sh || !sh.tenders) return out;
  const hidden = (key: string) => { const st = sh.nba[key]; return !!st && (st.status !== "snoozed" || (st.until ?? 0) > now); };
  const add = (c: Omit<NbaCard, "kind"> & { kind?: NbaCard["kind"] }) => { if (!hidden(c.key)) out.push({ kind: "doc", ...c }); };
  const days = (t: number) => Math.round((t - now) / DAY);
  const openOffer = (assetId: string) => sh.offers.some((o) => o.assetId === assetId && ["draft", "awaiting", "changes", "approved", "sent"].includes(o.status));
  const name = (accId?: string) => accountOf(s, accId)?.name ?? "the customer";
  const unit = (a: Asset) => a.label.split(" · ")[0];
  const role = u.role;
  const mine = (a: Asset) => (role === "ei" ? a.owner === u.id : role === "sc" ? a.sc === u.id : role === "mod" ? a.mod === u.id : false);
  const modOpen = (a: Asset) => sh.offers.some((o) => o.assetId === a.id && o.product === "modernisation" && ["draft", "awaiting", "approved", "sent"].includes(o.status));

  /* ---- unit-based actions for EI/REP, SC and MOD ---- */
  if (role === "ei" || role === "sc" || role === "mod") {
    sh.assets.filter(mine).forEach((a) => {
      const left = a.contractEnd ? days(a.contractEnd) : undefined; const nm = name(a.accountId);
      const ending = left !== undefined && left <= 60 && left >= -30;
      const risk = !ending && a.health < 45 && left !== undefined && left <= 90;
      if (ending && !openOffer(a.id)) add({ key: `N3:${a.id}:${role}`, no: 3, title: `Contract ends in ${left} days: ${nm}`, why: `${unit(a)} is under contract until ${new Date(a.contractEnd!).toLocaleDateString("en-GB")}. ${a.callbacks14d ? `${a.callbacks14d} callbacks in the last 14 days. ` : ""}Renew before the customer asks others.`, sources: ["NewCRM contract", "SAP service history"], urgency: left <= 45 ? "high" : "med", value: (a.contractValue ?? 0) * 3, agent: "CRM Agent · Churn Prediction", cta: "Draft the renewal", prompt: `Draft the renewal for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id, kind: "offer" });
      if (risk && !openOffer(a.id)) add({ key: `N7:${a.id}:${role}`, no: 7, title: `Renewal at risk: ${nm}`, why: `Health score ${a.health} of 100. Callbacks ${a.callbacks90d} in 90 days (${a.callbacksPrev90d} before). Contract ends in ${left} days. Act early.`, sources: ["Customer Health Score", "NewCRM contract", "SAP service history"], urgency: "high", value: (a.contractValue ?? 0) * 3, agent: "Customer Health Score · Churn Prediction", cta: "Plan the renewal", prompt: `Plan the renewal for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (a.callbacks14d >= 1 && !ending && !risk) add({ key: `N1:${a.id}:${role}`, no: 1, title: `Recent callback: ${nm}`, why: `${a.callbacks14d} callback${a.callbacks14d > 1 ? "s" : ""} on ${unit(a)} in the last 14 days. A short call now builds trust.`, sources: ["SAP service callbacks"], urgency: "low", agent: "Sales Assistant · CRM Agent", cta: "Brief me", prompt: `Brief me on lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (a.callbacksPrev90d > 0 && a.callbacks90d / a.callbacksPrev90d >= 1.4 && a.callbacks90d >= 6 && !ending && !risk && role === "ei") add({ key: `N8:${a.id}`, no: 8, title: `Rising callbacks: ${nm}`, why: `${a.callbacks90d} callbacks in 90 days against ${a.callbacksPrev90d} before (up ${Math.round((a.callbacks90d / a.callbacksPrev90d - 1) * 100)}%) on ${unit(a)}. A retention visit now is cheaper than a lost contract.`, sources: ["SAP service callbacks", "Customer Health Score"], urgency: "med", value: (a.contractValue ?? 0) * 3, agent: "Customer Health Score · Sales Assistant", cta: "Prepare the visit", prompt: `Prepare the retention visit for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (a.contractChangedAfterObr && role === "ei") add({ key: `N2:${a.id}`, no: 2, title: `Contract changed after the OBR: ${nm}`, why: `The contract for ${unit(a)} was amended after the open OBR was raised. The back office needs a corrected OBR.`, sources: ["NewCRM contract history", "OBR"], urgency: "med", agent: "CRM Agent", cta: "Prepare the corrected OBR", prompt: `Correct the OBR for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (a.techNote && role === "ei") add({ key: `N10:${a.id}`, no: 10, title: `Repair need in a technician note: ${nm}`, why: `"${a.techNote.slice(0, 110)}…" This can become a repair quote today.`, sources: ["SAP service notes"], urgency: "med", value: 3200, agent: "Repair Lead Generation", cta: "Draft the repair quote", prompt: `Turn the notes for lift ${a.id.slice(1)} into a repair quote`, accountId: a.accountId, assetId: a.id });
      if (role === "ei" && modOpen(a)) add({ key: `N5:${a.id}`, no: 5, title: `Modernisation offer open on your unit: ${nm}`, why: `${unit(a)} has an open MOD offer. Align with ${NAMES[a.mod ?? "mia"]} so the customer sees one bundled plan.`, sources: ["NewCRM opportunities"], urgency: "med", agent: "CRM Agent", cta: "Align with MOD", prompt: `Align with MOD on lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (role === "mod" && (a.obr ?? 0) >= 5 && modOpen(a)) add({ key: `N4:${a.id}`, no: 4, title: `High OBR volume with an open MOD offer: ${nm}`, why: `${a.obr} OBRs in 90 days on ${unit(a)} while your modernisation offer is open. Use the service history as the argument and agree it with the EI rep.`, sources: ["OBR history", "NewCRM opportunities"], urgency: "high", value: 110000, agent: "Price Pilot · MOD Propensity Scoring", cta: "Build the joint plan", prompt: `Build the joint EI and MOD plan for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (role === "mod" && a.ageYears >= 25 && a.faults90d >= 4) add({ key: `N11:${a.id}`, no: 11, title: `Ageing unit with frequent faults: ${nm}`, why: `${unit(a)} is ${a.ageYears} years old with ${a.faults90d} faults in 90 days. A modernisation case has a strong argument.`, sources: ["Installed base", "SAP service history", "MOD Propensity Scoring"], urgency: "high", value: 110000, agent: "MOD Propensity Scoring · Price Pilot", cta: "Build the MOD case", prompt: `Build the MOD case for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
      if (role === "mod" && a.obsolete) add({ key: `N12:${a.id}`, no: 12, title: `Obsolete part: ${nm}`, why: a.obsolete, sources: ["Parts lifecycle list", "Installed base"], urgency: "med", value: 110000, agent: "MOD Propensity Scoring", cta: "Alert the customer", prompt: `Alert the customer about the obsolete part on lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id });
    });
  }
  if (role === "ei") {
    sh.assets.filter((a) => a.owner === u.id && a.handedOver && !a.contractEnd && !openOffer(a.id)).forEach((a) => add({ key: `N23:${a.id}`, no: 23, title: `New unit handed over: ${name(a.accountId)}`, why: `${unit(a)} has no maintenance contract yet. Offer one while the building is being handed over.`, sources: ["Installed base", "Handover record"], urgency: "med", value: 4200 * 3, agent: "Conversion Alerts", cta: "Offer maintenance", prompt: `Draft a maintenance offer for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id, kind: "offer" }));
  }
  if (role === "am") {
    sh.assets.filter((a) => a.handedOver && !a.contractEnd && !openOffer(a.id)).forEach((a) => add({ key: `N23:${a.id}:am`, no: 23, title: `New unit handed over: ${name(a.accountId)}`, why: `${unit(a)} has no maintenance contract. The EI rep ${NAMES[a.owner]} owns it; check the offer is on its way.`, sources: ["Installed base", "Handover record"], urgency: "low", agent: "Conversion Alerts", cta: "Offer maintenance", prompt: `Draft a maintenance offer for lift ${a.id.slice(1)}`, accountId: a.accountId, assetId: a.id, kind: "offer" }));
    sh.accounts.filter((a) => a.key && now - a.lastActivity >= 60 * DAY).forEach((a) => add({ key: `N24:${a.id}`, no: 24, title: `Key account silent ${Math.floor((now - a.lastActivity) / DAY)} days: ${a.name}`, why: `No activity for ${Math.floor((now - a.lastActivity) / DAY)} days. ${sh.assets.filter((x) => x.accountId === a.id).length} units, ${sh.assets.filter((x) => x.accountId === a.id && x.health < 45).length} at risk. Review the whole account before a customer review.`, sources: ["NewCRM account", "Customer Health Score"], urgency: "high", agent: "CRM Agent · Customer Health Score", cta: "One view of the account", prompt: `One view of ${a.name}`, accountId: a.id }));
    sh.accounts.filter((a) => a.key && Object.values(a.lines).filter(Boolean).length === 1).forEach((a) => add({ key: `N25:${a.id}`, no: 25, title: `Cross-sell opportunity: ${a.name}`, why: `Active in ${Object.entries(a.lines).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(", ")} only. Service and modernisation are untouched. A handover pack gets the next line started.`, sources: ["NewCRM account", "Installed base"], urgency: "med", value: 4200 * 3, agent: "Handover Pack Generator · Conversion Alerts", cta: "Create the handover pack", prompt: `Create the handover pack for ${a.name}`, accountId: a.id }));
  }

  /* ---- tenders for NI, SC and MOD ---- */
  if (role === "ni" || role === "sc" || role === "mod") {
    sh.tenders.filter((t) => t.owner === u.id && !["submitted", "won", "lost"].includes(t.stage)).forEach((t) => {
      const left = days(t.eord);
      if (t.stage !== "final" && t.stage !== "matched" && left <= 14) add({ key: `N13:${t.id}`, no: 13, title: `End of order date in ${left} days: ${t.name}`, why: `Stage is "${t.stage}", not final bidding. ${t.checklist.filter((c) => !c.done).length} checklist items are still open.`, sources: ["Tender Insight", "NewCRM opportunity"], urgency: left <= 7 ? "high" : "med", value: t.value, agent: "Tender Insight · CRM Agent", cta: "Open the bid checklist", prompt: `Open the bid checklist for ${t.id}`, tenderId: t.id });
      if (role === "ni" && t.lossNote && t.stage !== "matched") add({ key: `N14:${t.id}`, no: 14, title: `We lost here before: ${name(t.accountId)}`, why: t.lossNote, sources: ["NewCRM loss history", "Sales Assistant"], urgency: "med", value: t.value, agent: "Sales Assistant", cta: "Why we lost", prompt: `Why did we lose at ${name(t.accountId)}?`, tenderId: t.id, accountId: t.accountId });
      if (role === "ni" && t.stage === "matched") add({ key: `N15:${t.id}`, no: 15, title: `Matched tender: ${t.name}`, why: `${t.summary} Found ${Math.abs(days(t.discovered))} days ago.`, sources: ["Project Lead Finder", "Building permits"], urgency: "high", value: t.value, agent: "Project Lead Finder · Tender Insight", cta: "Summarize and qualify", prompt: `Summarize ${t.id}`, tenderId: t.id });
      if (role === "ni" && t.competitorSpec && t.stage !== "matched") add({ key: `N17:${t.id}`, no: 17, title: `Competitor spec in the tender: ${name(t.accountId)}`, why: t.competitorSpec, sources: ["Tender Insight"], urgency: "med", value: t.value, agent: "Tender Insight", cta: "Prepare the counter-argument", prompt: `Prepare the counter-argument for ${t.id}`, tenderId: t.id });
    });
  }

  /* ---- my offers: approved, changes, idle, blocked ---- */
  if (["ei", "sc", "mod", "ni"].includes(role)) {
    sh.offers.filter((o) => o.createdBy === u.id).forEach((o) => {
      const acc = name(o.accountId);
      if (o.status === "sent" && o.sentAt && now - o.lastActivity >= 14 * DAY) add({ key: `N16:${o.id}`, no: 16, title: `Quote idle ${Math.floor((now - o.lastActivity) / DAY)} days: ${acc}`, why: `${o.id} (${chf(o.price)}) was sent and nothing has happened since. A short follow-up usually restarts it.`, sources: ["NewCRM quote", "Email log"], urgency: "med", value: o.price, agent: "Proposal Generator · CRM Agent", cta: "Draft follow-up", prompt: `Draft a follow-up email for ${o.id}`, offerId: o.id, kind: "email" });
      if (role === "sc" && o.contractChange && ["draft", "sent", "awaiting"].includes(o.status)) add({ key: `N6:${o.id}`, no: 6, title: `Contract changed while ${o.id} is open: ${acc}`, why: o.contractChange, sources: ["Contract Risk Reviewer", "NewCRM contract history"], urgency: "high", value: o.price, agent: "Contract Risk Reviewer", cta: "What changed?", prompt: `What changed in the contract for ${o.id}?`, offerId: o.id });
    });
  }

  /* ---- sales support ---- */
  if (role === "ss") {
    sh.offers.filter((o) => o.missing?.length).forEach((o) => add({ key: `N21:${o.id}`, no: 21, title: `Quote ${o.id} is missing data: ${name(o.accountId)}`, why: `Missing: ${o.missing!.join(", ")}. ${NAMES[o.createdBy]} cannot send it for approval until these are filled.`, sources: ["NewCRM quote", "Configuration Assistant"], urgency: "high", value: o.price, agent: "Configuration Assistant", cta: "Complete the configuration", prompt: `Complete the configuration for ${o.id}`, offerId: o.id }));
    sh.offers.filter((o) => o.status === "awaiting" && now - o.lastActivity > 48 * HOUR).forEach((o) => add({ key: `N22:${o.id}:ss`, no: 22, title: `Approval blocking a deal: ${name(o.accountId)}`, why: `${o.id} (${chf(o.price)}) has waited ${Math.round((now - o.lastActivity) / HOUR)} hours for ${o.approvals.filter((x) => x.status === "pending").map((x) => NAMES[x.by]).join(", ")}. Escalate with the context so it is a one-click decision.`, sources: ["Approval log", "Price Pilot"], urgency: "high", value: o.price, agent: "CRM Agent", cta: "Escalate with context", prompt: `Escalate ${o.id} with context`, offerId: o.id }));
  }

  /* ---- marketing ---- */
  if (role === "mkt") {
    const byArea: Record<string, Asset[]> = {};
    sh.assets.filter((a) => a.ageYears >= 20).forEach((a) => { (byArea[accountOf(s, a.accountId)?.area ?? "ZHC"] ??= []).push(a); });
    Object.entries(byArea).filter(([area, l]) => l.length >= 3 && !sh.campaigns.some((c) => c.area === area && c.status === "live" && now - c.createdAt < 10 * DAY)).forEach(([area, l]) => add({ key: `N26:${area}`, no: 26, title: `Ageing-portfolio cluster in ${AREA_NAME[area]}`, why: `${l.length} lifts over 20 years old across ${new Set(l.map((x) => x.accountId)).size} customers, none with a campaign in the last 10 days. Ready for a targeted campaign.`, sources: ["Customer Segmentation", "Installed base"], urgency: "med", value: l.length * 3200000, agent: "Customer Segmentation · Personalized Outreach", cta: "Build the audience", prompt: `Build an audience for ${AREA_NAME[area]} ageing lifts`, segment: area }));
    const idle = sh.mleads.filter((l) => l.status === "new" && now - l.createdAt > 48 * HOUR);
    if (idle.length) add({ key: "N27M", no: 27, title: `${idle.length} lead${idle.length > 1 ? "s" : ""} not followed up in 48 hours`, why: `${idle.map((l) => l.name).join(", ")}. Nudge the owner or reassign so they do not go cold.`, sources: ["CRM Agent", "Campaign leads"], urgency: "high", agent: "CRM Agent", cta: "Chase these leads", prompt: "Which leads have not been followed up?", mleadId: idle[0].id });
  }

  /* ---- manager ---- */
  if (role === "mgr") {
    const stalled = sh.offers.filter((o) => o.status === "sent" && now - o.lastActivity >= 21 * DAY);
    if (stalled.length >= 3) add({ key: "N18", no: 18, title: `${stalled.length} deals have stalled`, why: `No movement for 21+ days on ${stalled.map((o) => name(o.accountId)).join(", ")}. Worth ${chf(stalled.reduce((a, o) => a + o.price, 0))}.`, sources: ["NewCRM pipeline"], urgency: "high", value: stalled.reduce((a, o) => a + o.price, 0), agent: "CRM Agent", cta: "Show where to step in", prompt: "Summarize pipeline risk for my team", kind: "team" });
    const idle = s.reports.filter((r) => r.status === "sent").flatMap((r) => r.items.filter((i) => i.kind === "lead" && !i.silent && i.status === "new" && now - i.createdAt > 48 * HOUR).map((i) => ({ r, i })));
    if (idle.length) add({ key: "N27", no: 27, title: `${idle.length} lead${idle.length > 1 ? "s" : ""} not followed up in 48 hours`, why: `${idle.map((x) => x.r.placeName).slice(0, 3).join(", ")}${idle.length > 3 ? " and more" : ""}. Nudge the owners or reassign.`, sources: ["Snap & Lead", "NewCRM leads"], urgency: "med", agent: "CRM Agent", cta: "Open exceptions", prompt: "Which leads have not been followed up?", kind: "team" });
    if (sh.flags.coaching) add({ key: "N20", no: 20, title: "Coaching theme for the team", why: "Team level only, after works-council review: quotes followed up within 3 days win about twice as often as quotes left for 14 days.", sources: ["CRM Agent", "Team win-rate drivers"], urgency: "low", agent: "CRM Agent", cta: "Show the coaching prompt", prompt: "Show me the coaching theme for my team", kind: "team" });
  }
  return out.sort((a, b) => URG[a.urgency] - URG[b.urgency] || (b.value ?? 0) - (a.value ?? 0));
}

/* ------------------------------------------------------------------ briefs */
export function assetBrief(s: State, a: Asset) {
  const now = nowS(s); const acc = accountOf(s, a.accountId);
  const left = a.contractEnd ? Math.round((a.contractEnd - now) / DAY) : undefined;
  const trend = a.callbacksPrev90d ? Math.round(((a.callbacks90d - a.callbacksPrev90d) / a.callbacksPrev90d) * 100) : 0;
  const ref = regionRef(s, acc?.area ?? "ZHW", a.contractEnd ? "renewal" : "maintenance");
  const rows: [string, string][] = [
    ["Customer", `${acc?.name}${acc?.key ? " (key account)" : ""} · ${acc?.contact.name}, ${acc?.contact.role}`],
    ["Unit", `${a.label.split(" · ")[0]} · ${a.model} · ${a.ageYears ? `${a.ageYears} years old` : "new"}`],
    ["Contract", a.contractEnd ? `ends in ${left} days (${chf(a.contractValue ?? 0)} per year)` : "none yet"],
    ["Service calls", `${a.callbacks14d} in 14 days · ${a.callbacks90d} in 90 days${a.callbacksPrev90d ? ` (${trend >= 0 ? "up" : "down"} ${Math.abs(trend)}% on the 90 days before)` : ""}`],
    ["Health score", `${a.health} of 100${a.health < 45 ? " · at risk" : ""}`],
    ["Open offers", s.sherpa.offers.filter((o) => o.assetId === a.id && !["won", "lost", "rejected"].includes(o.status)).map((o) => o.id).join(", ") || "none"],
    ["In this area", ref.sells ? `We sell this in ${AREA_NAME[ref.area]}: ${ref.count} offers in 12 months, ${ref.winRate}% won` : `We do not sell this in ${AREA_NAME[ref.area]}`],
  ];
  return { title: a.label, rows, sources: ["NewCRM account and contract", "SAP service history", "Installed base"] };
}
