import { PLACES } from "./data";
import { chfShort, isOpen, oppOf, KIND_LABEL, NAMES } from "./sherpa";
import type { Opp, State } from "./types";

/** The three things a seller wants to see on one map. */
export type Layer = "lead" | "ours" | "other";
export const LAYER_LABEL: Record<Layer, string> = { lead: "Leads", ours: "Schindler clients", other: "Other clients" };

export interface Pin {
  id: string; layer: Layer; name: string; sub: string; area: string; lat: number; lng: number;
  key?: boolean; mine?: boolean; hot?: boolean;
  /** lead: the opportunity. ours: the account. */
  oppId?: string; accountId?: string;
  facts: [string, string][];
  /** one-line reason to act, shown on the card */
  why: string;
}

/** Buildings served by other lift makers. These are the people we want to win over. Mock data. */
export const OTHER_CLIENTS: { id: string; name: string; addr: string; area: string; lat: number; lng: number; maker: string; lifts: number; age: number; contractEnds: string; note: string }[] = [
  { id: "oc1", name: "Prime Office Tower 9", addr: "Pfingstweidstrasse 60, 8005 Zurich", area: "ZHW", lat: 47.388, lng: 8.517, maker: "OtherLift", lifts: 10, age: 9, contractEnds: "Mar 2027", note: "Contract with OtherLift ends in about 4 months" },
  { id: "oc2", name: "Glattpark Business Park", addr: "Thurgauerstrasse 101, 8152 Opfikon", area: "ZHW", lat: 47.421, lng: 8.564, maker: "KoneX", lifts: 14, age: 13, contractEnds: "Aug 2027", note: "13 years old, repeated breakdowns reported" },
  { id: "oc3", name: "Hönggerberg Apartments", addr: "Limmattalstrasse 200, 8049 Zurich", area: "ZHC", lat: 47.4005, lng: 8.499, maker: "OtherLift", lifts: 6, age: 17, contractEnds: "Jan 2027", note: "Modernisation candidate: lifts are 17 years old" },
  { id: "oc4", name: "Enge Corporate Centre", addr: "Bederstrasse 51, 8002 Zurich", area: "ZHC", lat: 47.363, lng: 8.53, maker: "LocalLift", lifts: 5, age: 11, contractEnds: "Dec 2026", note: "Local service firm, contract ends next month" },
  { id: "oc5", name: "Hotel Limmatquai", addr: "Limmatquai 82, 8001 Zurich", area: "ZHC", lat: 47.3725, lng: 8.544, maker: "OtherLift", lifts: 4, age: 22, contractEnds: "Jun 2027", note: "22 years old, no recent upgrade" },
  { id: "oc6", name: "Residenz Hottingen", addr: "Hottingerstrasse 30, 8032 Zurich", area: "ZHC", lat: 47.37, lng: 8.556, maker: "KoneX", lifts: 2, age: 19, contractEnds: "Open", note: "Replied to the ageing-lifts campaign" },
  { id: "oc7", name: "Schwamendingen Plaza", addr: "Winterthurerstrasse 520, 8051 Zurich", area: "ZHN", lat: 47.405, lng: 8.572, maker: "LocalLift", lifts: 8, age: 8, contractEnds: "Sep 2027", note: "Mall with eight lifts and one service firm" },
  { id: "oc8", name: "Irchel Medical Institute", addr: "Winterthurerstrasse 190, 8057 Zurich", area: "ZHN", lat: 47.396, lng: 8.549, maker: "OtherLift", lifts: 7, age: 15, contractEnds: "Feb 2027", note: "Hospital: lift downtime is a risk for them" },
  { id: "oc9", name: "Winterthur City Centre", addr: "Marktgasse 40, 8400 Winterthur", area: "WIN", lat: 47.4995, lng: 8.729, maker: "OtherLift", lifts: 6, age: 12, contractEnds: "Apr 2027", note: "Closest competitor-served mall to Eulach Medical" },
  { id: "oc10", name: "Oberwinterthur Railway Annexe", addr: "Frauenfelderstrasse 10, 8404 Winterthur", area: "WIN", lat: 47.505, lng: 8.76, maker: "LocalLift", lifts: 3, age: 20, contractEnds: "Open", note: "Public building, no service contract on record" },
  { id: "oc11", name: "Europaallee Block C", addr: "Lagerstrasse 41, 8004 Zurich", area: "ZHW", lat: 47.377, lng: 8.53, maker: "KoneX", lifts: 12, age: 6, contractEnds: "Oct 2028", note: "Newer tower, long contract. Keep warm" },
];

const jit = (k: string) => { let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0; return [((h & 255) / 255 - 0.5) * 0.0026, (((h >> 8) & 255) / 255 - 0.5) * 0.0026] as const; };

export function locateOpp(s: State, o: Opp): { lat: number; lng: number } | null {
  if (o.geo) { const [dy, dx] = jit(o.id); return { lat: o.geo.lat + dy, lng: o.geo.lng + dx }; }
  const rep = o.source.reportId ? s.reports.find((r) => r.id === o.source.reportId) : undefined;
  const pid = rep?.placeId ?? (o.tenderId ? s.sherpa.accounts.find((a) => a.id === s.sherpa.tenders.find((t) => t.id === o.tenderId)?.accountId)?.placeIds[0] : undefined)
    ?? PLACES.find((p) => p.name === o.placeName)?.id ?? s.sherpa.accounts.find((a) => a.id === o.accountId)?.placeIds[0];
  const p = PLACES.find((x) => x.id === pid);
  if (!p) return null;
  const [dy, dx] = jit(o.id);
  return { lat: p.lat + dy, lng: p.lng + dx };
}

const DAY = 86400000;
export function buildPins(s: State, meId: string, mineIds: Set<string>, now: number): Pin[] {
  const out: Pin[] = [];
  /* leads: every open opportunity with a place on the map */
  for (const o of s.sherpa.opps) {
    if (!isOpen(o)) continue;
    const at = locateOpp(s, o); if (!at) continue;
    const early = ["new", "contact", "visit", "qualify"].includes(o.stage);
    out.push({
      id: o.id, layer: "lead", name: o.placeName, sub: `${KIND_LABEL[o.kind]} · ${o.id}`, area: o.area, ...at, oppId: o.id, accountId: o.accountId, mine: mineIds.has(o.id), hot: early,
      key: !!s.sherpa.accounts.find((a) => a.id === o.accountId)?.key,
      facts: [["Opportunity", o.id], ["Stage", o.stage[0].toUpperCase() + o.stage.slice(1)], ["Value", o.value ? chfShort(o.value) : "Not priced yet"], ["Owner", NAMES[o.owner] ?? o.owner], ["Source", o.source.label]],
      why: ({ new: "New lead: waiting to be accepted", contact: "Accepted: needs a first contact", visit: "Site visit to plan", qualify: "Ready to qualify", bid: "Bid being prepared", offer: "Offer being prepared", sent: "Offer sent: waiting for the customer" } as Record<string, string>)[o.stage] ?? "In progress",
    });
  }
  /* Schindler clients: one pin per account site */
  for (const a of s.sherpa.accounts) {
    for (const pid of a.placeIds) {
      const p = PLACES.find((x) => x.id === pid); if (!p) continue;
      const lifts = s.sherpa.assets.filter((x) => x.accountId === a.id && x.placeId === pid);
      if (!lifts.length) continue;
      const soon = lifts.map((x) => x.contractEnd).filter((x): x is number => !!x).sort()[0];
      const days = soon ? Math.round((soon - now) / DAY) : undefined;
      const weak = lifts.filter((x) => x.health < 50).length;
      const [dy, dx] = jit(a.id);
      out.push({
        id: "acc-" + a.id, layer: "ours", name: a.name, sub: p.addr, area: p.area, lat: p.lat - 0.0016 + dy, lng: p.lng + 0.0016 + dx, accountId: a.id, key: a.key,
        mine: lifts.some((x) => x.owner === meId || x.sc === meId || x.mod === meId) || a.owner === meId,
        hot: days !== undefined && days < 60,
        facts: [["Lifts we service", String(lifts.length)], ["Next contract end", days === undefined ? "None" : days < 0 ? "Ended" : `${days} days`], ["Lifts needing care", String(weak)], ["Contact", `${a.contact.name}, ${a.contact.role}`]],
        why: days !== undefined && days < 60 ? `Contract ends in ${days} days: time to renew` : weak ? `${weak} lift${weak > 1 ? "s" : ""} in poor health` : "Healthy account: keep in touch",
      });
    }
  }
  /* other clients: served by another maker */
  for (const c of OTHER_CLIENTS) {
    if (s.sherpa.opps.some((o) => o.source.itemId === c.id)) continue; // already a lead
    out.push({
      id: c.id, layer: "other", name: c.name, sub: c.addr, area: c.area, lat: c.lat, lng: c.lng,
      facts: [["Served by", c.maker], ["Lifts", String(c.lifts)], ["Lift age", `${c.age} years`], ["Contract ends", c.contractEnds]],
      why: c.note, hot: c.age >= 15 || /next month|4 months/.test(c.note),
    });
  }
  return out;
}
void oppOf;
