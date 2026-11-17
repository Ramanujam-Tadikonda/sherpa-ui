"use client";
import { AREA_REPS, OP, SH, areaRepFor, dealNbas, ensureAccount, isNI, leadHooks, offerOf, seedSherpa, serviceLeadFor, suggestTeam, tasksOfOpp, techFor, tenderOf } from "./sherpa";
import { CT } from "./contracts";
import { AC } from "./accounts";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Alert, Draft, Input, Item, LeadInfo, Photo, PointStatus, Report, SiteVisit, State, Team, Tier } from "./types";
import { APPS, DEFAULT_CFG, GLOBAL_OWNER, PLACES, PRESETS, TRACKS, USERS, type AppId } from "./data";
import { baseInput, evaluate, presetToInput, tierOf } from "./engine";
import { STATE_VERSION } from "./version";
export { STATE_VERSION };

export const H = 3600000;
const KEY = "sherpa-demo-state";
const OLD_KEYS = ["snaplead-poc-v7"];
const USER_KEY: Record<AppId, string> = { sherpa: "sherpa-user", snap: "snaplead-user" };

export const userOf = (id?: string | null) => USERS.find((u) => u.id === id);
export const nowOf = (s: State) => Date.now() + s.clock;
export const stepsOf = (i: Item) => i.steps ?? TRACKS[i.track].steps;
export const effTier = (i: Item): Tier => i.override?.to ?? i.tier;

/* ---------- internal helpers (mutate a draft state) ---------- */
function nid(s: State, p: string) { s.seq += 1; return `${p}${s.seq}`; }
function notify(s: State, userId: string | undefined, text: string, reportId?: string) {
  if (!userId) return;
  s.alerts.unshift({ id: nid(s, "al"), userId, t: nowOf(s), text, reportId, read: false });
}
function audit(s: State, by: string, text: string) { s.audit.unshift({ t: nowOf(s), by, text }); }
function itemLog(s: State, it: Item, by: string, text: string) { it.log.push({ t: nowOf(s), by, text }); it.lastActionAt = nowOf(s); }
function sysLog(s: State, it: Item, text: string) { it.log.push({ t: nowOf(s), by: "System", text }); } // does not reset the follow-up clock
function findItem(s: State, id: string): [Report, Item] | null {
  for (const r of s.reports) { const it = r.items.find((x) => x.id === id); if (it) return [r, it]; }
  return null;
}
function addPoint(s: State, r: Report, key: string, label: string, pts: number, status: PointStatus) {
  if (r.points.some((p) => p.key === key && p.status !== "reversed") && key !== "extra") return;
  r.points.push({ id: nid(s, "pt"), key, label, pts, status, at: nowOf(s) });
}
function confirmPoint(r: Report, key: string) { r.points.forEach((p) => { if (p.key === key && p.status === "pending") p.status = "confirmed"; }); }

function routeItem(s: State, area: string, it: Item) {
  if (!it.team) { it.routed = "none"; return; }
  if (s.cfg.paused) { it.routed = "exception"; it.flags.push("Routing paused"); return; }
  const sales = it.kind === "lead" && ["NI", "EI", "MOD", "SC"].includes(it.team);
  const owner = GLOBAL_OWNER[it.team] ?? (sales ? areaRepFor(area) : undefined) ?? s.cfg.owners[area]?.[it.team];
  if (owner) { it.ownerId = owner; it.routed = "owner"; } else it.routed = "exception";
}

function closeItem(s: State, r: Report, it: Item, outcome: string, by: string) {
  it.step = stepsOf(it).length - 1; it.status = "closed"; it.outcome = outcome; itemLog(s, it, by, outcome);
  void r;
}
function toStep(s: State, r: Report, it: Item, re: RegExp, by: string, text: string): boolean {
  const idx = stepsOf(it).findIndex((x) => re.test(x));
  if (idx > it.step) {
    it.step = idx; itemLog(s, it, by, text);
    notify(s, r.reporterId, `${r.id}: ${stepsOf(it)[idx]}`, r.id);
    r.timeline.push({ t: nowOf(s), by: "System", text: `${TRACKS[it.track].label}: ${stepsOf(it)[idx]}` });
    return true;
  }
  return false;
}

function makeItems(s: State, r: Report, drafts: Draft[], at: number): Item[] {
  return drafts.map((d) => ({
    ...d, id: nid(s, "it"), reportId: r.id, routed: "none", status: d.kind === "retake" ? "waiting" : "new",
    step: d.step0 ?? 0, createdAt: at, lastActionAt: at, clockLevel: 0, nudges: 0, log: [{ t: at, by: "System", text: "Created from report" }],
  }));
}

function activate(s: State, r: Report) {
  const at = nowOf(s);
  let anyOwner = false; let anyExc = false;
  r.items.forEach((it) => {
    if (it.status === "waiting" && it.kind === "retake") return;
    it.status = "new"; it.createdAt = at; it.lastActionAt = at;
    routeItem(s, r.area, it);
    if (it.kind === "emergency") { it.step = 0; }
    if (it.autoClose) { it.step = stepsOf(it).length - 1; it.status = "closed"; it.outcome = it.autoClose; }
    else if (it.kind === "merge") { it.step = Math.max(it.step, 1); }
    if (it.routed === "owner" && it.status === "new" && !it.silent) {
      anyOwner = true;
      const u = userOf(it.ownerId);
      notify(s, it.ownerId, `${it.kind === "emergency" ? "EMERGENCY" : it.tier} · ${it.title} · ${r.placeName}`, r.id);
      if (it.also.length) it.log.push({ t: at, by: "System", text: `Also told: ${it.also.join(", ")}` });
      void u;
    }
    if (it.routed === "exception") { anyExc = true; notify(s, s.cfg.owners[r.area]?.MGR ?? "marc", `No owner: ${it.title} · ${r.placeName}`, r.id); }
    if (it.silent && it.routed === "owner") notify(s, it.ownerId, `Heads-up · ${it.title} · ${r.placeName}`, r.id);
    if (it.flags.includes("needsInfo")) notify(s, r.reporterId, `${r.id} needs info: the servicing firm sticker. You can add it later.`, r.id);
    if (it.also.includes("AM")) notify(s, s.cfg.owners[r.area]?.AM, `Key customer site: ${r.placeName}`, r.id);
    if (it.also.includes("MGR")) notify(s, s.cfg.owners[r.area]?.MGR, `${it.title} · ${r.placeName}`, r.id);
  });
  if (anyOwner && !r.cases.includes("H1")) r.cases.push("H1");
  if (anyExc && !r.cases.includes("H2")) r.cases.push("H2");
  if (r.items.some((x) => x.routed === "exception" && x.team === "NI") && !r.cases.includes("D9")) r.cases.push("D9");
  r.timeline.push({ t: at, by: "System", text: r.status === "queued" ? "Synced after signal returned" : "Report created and routed by rules" });
  OP.fromReport(s, r);
}

export interface NewReport {
  id?: string; reporterId: string; input: Input; photos: Photo[]; placeId: string; placeName: string; area: string;
  answers: { q: string; a: string }[]; corrections: string[]; at?: number; trusted?: boolean;
}
export function createReport(s: State, p: NewReport): Report {
  const at = p.at ?? nowOf(s);
  const existing = p.id ? s.reports.find((x) => x.id === p.id) : undefined;
  if (existing) return existing; // a retry with the same report ID never creates a duplicate
  const out = evaluate(p.input, s.cfg);
  const id = p.id ?? `SL-${1000 + s.seq + 1}`; s.seq += 1;
  const queued = s.offline;
  const r: Report = {
    id, reporterId: p.reporterId, createdAt: at, status: queued ? "queued" : "sent", placeName: p.placeName, placeId: p.placeId, area: p.area,
    input: p.input, photos: p.photos, answers: p.answers, corrections: p.corrections, items: [], cases: [...out.cases], points: [],
    timeline: [{ t: at, by: queued ? "Phone" : "Reporter", text: queued ? "Saved on the phone, waiting to send" : "Report confirmed and created" }],
    extras: { photos: 0 }, headline: out.headline, verdict: out.verdict, plain: out.plain, trusted: p.trusted ?? true,
  };
  s.reports.unshift(r);
  r.items = makeItems(s, r, out.items, at);
  const sameDay = s.reports.filter((x) => x.reporterId === p.reporterId && x.id !== r.id && at - x.createdAt < 24 * H && x.points.some((q) => q.key === "sent" && q.pts > 0)).length;
  const limited = sameDay >= s.cfg.dailyLimit;
  if (limited) { r.cases.push("K6"); r.timeline.push({ t: at, by: "System", text: "Daily limit reached: report accepted, no extra points today" }); }
  out.points.forEach((pt) => {
    const pts = limited && pt.key !== "safety" ? 0 : pt.pts;
    r.points.push({ id: nid(s, "pt"), key: pt.key, label: limited && pts === 0 && pt.pts > 0 ? "Daily limit reached" : pt.label, pts, status: pt.status, at });
  });
  if (!queued) activate(s, r);
  else { r.items.forEach((it) => { it.status = "waiting"; }); r.cases.push("J1"); }
  return r;
}

/** A lift the records steward confirmed joins the installed base, so the next snap of it is found. */
function addAsset(s: State, r: Report) {
  if (r.input.number && s.sherpa.assets.some((a) => a.label.startsWith(r.input.number!))) return;
  const acc = ensureAccount(s, r, s.cfg.owners[r.area]?.EI ?? "ethan");
  if (!acc.placeIds.includes(r.placeId)) acc.placeIds.push(r.placeId);
  const c = r.input.condition;
  s.sherpa.assets.push({ id: `as-${s.sherpa.seq++}`, accountId: acc.id, placeId: r.placeId, label: `${r.input.number ?? `Unit from ${r.id}`} · ${r.placeName}`, model: r.info?.manufacturer || "Schindler, model to confirm", ageYears: r.input.age, brand: "ours", callbacks14d: 0, callbacks90d: 0, callbacksPrev90d: 0, faults90d: c === "out" ? 2 : 0, health: c === "fine" ? 80 : c === "minor" ? 60 : 40, servicer: r.input.servicer === "us" ? "Schindler" : "Unknown", owner: acc.owner });
  s.sherpa.crm.unshift({ t: nowOf(s), by: "Records", text: `Unit ${r.input.number ?? r.id} added to the installed base at ${r.placeName}` });
}

/* ---------- clock: follow-up reminders ---------- */
export function tick(s: State) {
  const now = nowOf(s);
  OP.sync(s);
  s.reports.forEach((r) => {
    if (r.status !== "sent") return;
    r.items.forEach((it) => {
      if (it.status === "snoozed" && it.snoozeUntil && it.snoozeUntil <= now) { it.status = "new"; it.lastActionAt = it.snoozeUntil; it.clockLevel = 0; }
      if (it.kind !== "lead" || it.silent || it.status !== "new" || it.team === "AM") return;
      const t = effTier(it);
      const th = t === "Hot" ? s.cfg.followUp.hot : t === "Warm" ? s.cfg.followUp.warm : null;
      if (!th) return;
      const hrs = (now - it.lastActionAt) / H;
      const lvl = hrs >= th[2] ? 3 : hrs >= th[1] ? 2 : hrs >= th[0] ? 1 : 0;
      for (let l = it.clockLevel + 1; l <= lvl; l++) {
        const mgr = s.cfg.owners[r.area]?.MGR ?? "marc";
        if (l === 1) { notify(s, it.ownerId, `Reminder: ${t} lead waiting ${th[0]}h · ${it.title} · ${r.placeName}`, r.id); sysLog(s, it, `Reminder sent to owner after ${th[0]}h`); }
        if (l === 2) { notify(s, mgr, `No action in ${th[1]}h · ${it.title} · ${r.placeName}`, r.id); sysLog(s, it, `Manager told after ${th[1]}h`); }
        if (l === 3) { notify(s, mgr, `Reassign now · ${it.title} · ${r.placeName}`, r.id); sysLog(s, it, `Manager to reassign after ${th[2]}h`); }
      }
      it.clockLevel = Math.max(it.clockLevel, lvl);
    });
  });
}
export function clockHours(it: Item, s: State) { return Math.floor((nowOf(s) - it.lastActionAt) / H); }

/* ---------- owner / desk actions ---------- */
export const A = {
  accept(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    it.status = "accepted"; it.acceptedAt = nowOf(s); itemLog(s, it, userOf(by)?.name ?? by, "Accepted");
    toStep(s, r, it, /assigned|told|checks|acknowledged/i, by, "Accepted");
    confirmPoint(r, "sent");
    if (it.kind === "lead" || it.kind === "ticket") {
      if (r.reporterId === it.ownerId) r.timeline.push({ t: nowOf(s), by: "System", text: "Reporter is the owner: no extra reward on own lead" });
      else if (!it.silent) addPoint(s, r, `accept-${it.id}`, "Lead accepted by the owner", 20, "confirmed");
    }
    notify(s, r.reporterId, `${r.id}: accepted by ${userOf(by)?.name ?? "the owner"} (+20 points)`, r.id);
  },
  decline(s: State, id: string, by: string, reason: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    it.status = "declined"; it.declineReason = reason; it.routed = "exception"; it.ownerId = undefined; itemLog(s, it, userOf(by)?.name ?? by, `Declined: ${reason}`);
    notify(s, s.cfg.owners[r.area]?.MGR ?? "marc", `Declined (${reason}) · ${it.title} · ${r.placeName}`, r.id);
    if (!r.cases.includes("H4")) r.cases.push("H4");
  },
  contact(s: State, id: string, by: string, how: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.status === "new") A.accept(s, id, by);
    itemLog(s, it, userOf(by)?.name ?? by, how);
    toStep(s, r, it, /contacted/i, by, how);
  },
  visit(s: State, id: string, by: string, note?: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.status === "new") A.accept(s, id, by);
    toStep(s, r, it, /contacted/i, by, "Contacted"); toStep(s, r, it, /visit|survey/i, by, "Visit logged");
    if (note) itemLog(s, it, userOf(by)?.name ?? by, `Visit note: ${note}`);
  },
  quote(s: State, id: string, by: string, note?: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.status === "new") A.accept(s, id, by);
    toStep(s, r, it, /contacted/i, by, "Contacted"); toStep(s, r, it, /visit|survey/i, by, "Visit"); toStep(s, r, it, /proposal/i, by, "Proposal");
    toStep(s, r, it, /quote|offer|proposal/i, by, "Quote or offer logged");
    if (note) itemLog(s, it, userOf(by)?.name ?? by, `Quote note: ${note}`);
    if (!it.quoted) { it.quoted = true; addPoint(s, r, `quote-${it.id}`, "Quote sent", 50, "confirmed"); }
  },
  opportunity(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [, it] = f;
    if (it.status === "new") A.accept(s, id, by);
    it.flags.push("Opportunity created"); itemLog(s, it, userOf(by)?.name ?? by, "Opportunity created in NewCRM");
  },
  notRelevant(s: State, id: string, by: string, reason: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    closeItem(s, r, it, `Closed: not relevant (${reason})`, userOf(by)?.name ?? by);
    notify(s, r.reporterId, `${r.id}: closed. Thank you for reporting.`, r.id);
  },
  snooze(s: State, id: string, by: string, days: number) {
    const f = findItem(s, id); if (!f) return; const [, it] = f;
    it.status = "snoozed"; it.snoozeUntil = nowOf(s) + days * 24 * H; itemLog(s, it, userOf(by)?.name ?? by, `Snoozed ${days} days`);
  },
  dataFix(s: State, id: string, by: string, text: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    const d: Draft = { kind: "records", team: "RS", track: "records", caseId: "RS", title: "Data fix requested by owner", summary: text || "Owner asks for a records correction.", score: 0, tier: "Info", reasons: [], also: [], flags: ["dataFix"] };
    const [n] = makeItems(s, r, [d], nowOf(s)); n.silent = true; routeItem(s, r.area, n); r.items.push(n);
    notify(s, n.ownerId, `Data fix request · ${r.placeName}`, r.id); itemLog(s, it, userOf(by)?.name ?? by, "Data fix requested from the records team");
  },
  outcome(s: State, id: string, by: string, kind: "won" | "lost" | "notinterested" | "invalid" | "hold") {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    const label = { won: "Won", lost: "Lost to a competitor", notinterested: "Customer not interested", invalid: "Invalid", hold: "On hold" }[kind];
    if (kind === "won") {
      A.quote(s, id, by); closeItem(s, r, it, "Won", userOf(by)?.name ?? by);
      addPoint(s, r, `won-${it.id}`, "Won", 200, "confirmed"); r.impact = true;
      notify(s, r.reporterId, `${r.id}: WON. Your report became a deal (+200 points). See the impact story.`, r.id);
    } else {
      closeItem(s, r, it, label, userOf(by)?.name ?? by);
      if (kind === "invalid") { it.flags.push("Invalid: manager review"); notify(s, s.cfg.owners[r.area]?.MGR ?? "marc", `Invalid lead to review · ${r.placeName}`, r.id); }
      notify(s, r.reporterId, `${r.id}: closed (${label}). Thank you. Earlier points stay.`, r.id);
    }
    r.timeline.push({ t: nowOf(s), by: "System", text: `${TRACKS[it.track].label}: ${label}` });
  },
  /* manager */
  reassign(s: State, ids: string[], to: string, by: string) {
    ids.forEach((id) => {
      const f = findItem(s, id); if (!f) return; const [r, it] = f;
      const prev = it.ownerId; it.ownerId = to; it.routed = "owner"; it.status = "new"; it.clockLevel = 0; it.lastActionAt = nowOf(s); it.declineReason = undefined;
      it.flags = it.flags.filter((x) => x !== "Routing paused");
      itemLog(s, it, userOf(by)?.name ?? by, `Reassigned ${prev ? userOf(prev)?.name + " → " : "to "}${userOf(to)?.name}`);
      notify(s, to, `Assigned to you: ${it.title} · ${r.placeName}`, r.id);
      audit(s, userOf(by)?.name ?? by, `Reassigned ${it.id} (${r.id}) to ${userOf(to)?.name}`);
      if (!r.cases.includes("H1")) r.cases.push("H1");
    });
  },
  nudge(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    it.nudges += 1; notify(s, it.ownerId, `Nudge from manager: ${it.title} · ${r.placeName}`, r.id); itemLog(s, it, userOf(by)?.name ?? by, "Nudged owner");
  },
  override(s: State, id: string, by: string, to: Tier, reason: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    it.override = { from: it.override?.from ?? it.tier, to, reason, by: userOf(by)?.name ?? by };
    itemLog(s, it, userOf(by)?.name ?? by, `Tier override ${it.tier} → ${to}: ${reason}`);
    audit(s, userOf(by)?.name ?? by, `Tier override on ${it.id} (${r.id}): ${it.tier} → ${to}. Reason: ${reason}`);
  },
  approveMerge(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    it.flags = it.flags.filter((x) => x !== "mergePending"); closeItem(s, r, it, "Merged", userOf(by)?.name ?? by); audit(s, userOf(by)?.name ?? by, `Approved merge ${it.id} (${r.id})`);
    toStep(s, r, it, /added|corrected/i, by, "Merged");
    notify(s, r.reporterId, `${r.id}: merged into our records`, r.id);
  },
  releasePoints(s: State, reportId: string, by: string, ok: boolean) {
    const r = s.reports.find((x) => x.id === reportId); if (!r) return;
    r.points.forEach((p) => { if (p.status === "held") p.status = ok ? "confirmed" : "reversed"; });
    if (!ok) { r.fake = true; r.trusted = false; }
    audit(s, userOf(by)?.name ?? by, `${ok ? "Released" : "Rejected"} held points on ${r.id}`);
    notify(s, r.reporterId, ok ? `${r.id}: points released. Thank you.` : `${r.id}: points were not awarded. Please follow the photo guidance.`, r.id);
  },
  /* records */
  records(s: State, id: string, by: string, action: "confirm" | "create" | "link" | "merge" | "correct" | "reject" | "scrapped" | "different", fake = false) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f; const who = userOf(by)?.name ?? by;
    it.status = it.status === "new" ? "accepted" : it.status;
    toStep(s, r, it, /checks/i, by, "Records team is checking");
    if (action === "merge") { it.flags.push("mergePending"); itemLog(s, it, who, "Merge proposed: waiting for the manager"); notify(s, s.cfg.owners[r.area]?.MGR ?? "marc", `Approve merge · ${r.placeName}`, r.id); return; }
    const text: Record<string, string> = { confirm: "Match confirmed", create: "Added to our records", link: "Linked to the existing record", correct: "Record corrected", reject: "Rejected", scrapped: "Marked scrapped", different: "Different lift: new record" };
    closeItem(s, r, it, text[action], who);
    if (action === "create" || action === "different") {
      const pend = r.points.find((p) => p.key === "added" && p.status === "pending");
      if (pend) pend.status = "confirmed"; else addPoint(s, r, `added-${it.id}`, "Missing lift added to our records", 30, "confirmed");
      addAsset(s, r);
    }
    if (action === "confirm" || action === "link" || action === "correct") confirmPoint(r, "sent");
    if (action === "reject" && fake) { r.points.forEach((p) => { if (p.status !== "reversed") p.status = "reversed"; }); r.fake = true; r.trusted = false; notify(s, s.cfg.owners[r.area]?.MGR ?? "marc", `Junk report rejected: ${r.id}`, r.id); }
    audit(s, who, `Records: ${text[action]} on ${it.id} (${r.id})`);
    notify(s, r.reporterId, action === "reject" ? `${r.id}: we could not use this report${fake ? " (points reversed)" : ""}.` : `${r.id}: ${text[action]}${action === "create" ? " (+30 points)" : ""}`, r.id);
    if (it.step < stepsOf(it).length - 1) it.step = stepsOf(it).length - 1;
    r.timeline.push({ t: nowOf(s), by: who, text: `Records: ${text[action]}` });
  },
  /* emergency */
  ack(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    it.status = "accepted"; toStep(s, r, it, /acknowledged/i, by, "Acknowledged");
    r.points.forEach((p) => { if (p.key === "safety") p.status = "confirmed"; });
    notify(s, r.reporterId, `${r.id}: emergency desk acknowledged. Thank you (+30 and a Safety First badge).`, r.id);
  },
  dispatch(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.step < 1) A.ack(s, id, by);
    it.serviceOrder = `SO-${70000 + s.seq}`; s.seq += 1; toStep(s, r, it, /engineer/i, by, `Dispatched: service order ${it.serviceOrder}`);
    notify(s, "jonas", `Service order ${it.serviceOrder} · ${r.placeName}`, r.id);
  },
  notifyBuilding(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.step < 1) A.ack(s, id, by);
    it.buildingInformed = true; toStep(s, r, it, /building informed/i, by, "Standard safety message sent to the building owner");
    audit(s, userOf(by)?.name ?? by, `Safety message sent to building owner for ${r.placeName} (${r.id})`);
  },
  closeEmergency(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    closeItem(s, r, it, "Closed", userOf(by)?.name ?? by);
    notify(s, r.reporterId, `${r.id}: emergency closed. Thank you for speaking up.`, r.id);
  },
  /* service */
  svcAccept(s: State, id: string, by: string) { A.accept(s, id, by); },
  assignEngineer(s: State, id: string, by: string, name: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.status === "new") A.accept(s, id, by);
    it.engineer = name; toStep(s, r, it, /engineer/i, by, `Engineer assigned: ${name}`);
  },
  closeTicket(s: State, id: string, by: string, outcome: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    toStep(s, r, it, /engineer/i, by, "Engineer assigned"); closeItem(s, r, it, `Fixed: ${outcome}`, userOf(by)?.name ?? by);
    notify(s, r.reporterId, `${r.id}: fixed. Thank you.`, r.id);
  },
  handBack(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    const d: Draft = { kind: "lead", team: "SC", track: "renewal", caseId: it.caseId, title: "Renewal chance from a service job", summary: "Service found a renewal chance while fixing the fault.", score: 55, tier: "Warm", reasons: [{ label: "Handed back by the service team", pts: 55 }], also: [], flags: [] };
    const [n] = makeItems(s, r, [d], nowOf(s)); routeItem(s, r.area, n); r.items.push(n);
    notify(s, n.ownerId, `Renewal chance handed back by service · ${r.placeName}`, r.id); itemLog(s, it, userOf(by)?.name ?? by, "Handed back to sales");
  },
  /* account manager */
  coordinate(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    if (it.status === "new") it.status = "accepted";
    toStep(s, r, it, /account manager told/i, by, "Reviewed");
    const rep = r.items.find((x) => x.team !== "AM" && x.ownerId && x.kind === "lead");
    if (rep) notify(s, rep.ownerId, `Account manager is coordinating on ${r.placeName}`, r.id);
    itemLog(s, it, userOf(by)?.name ?? by, "Coordinated with the local rep");
  },
  accountPlan(s: State, id: string, by: string) {
    const f = findItem(s, id); if (!f) return; const [r, it] = f;
    closeItem(s, r, it, "Added to account plan", userOf(by)?.name ?? by);
    notify(s, r.reporterId, `${r.id}: added to the account plan`, r.id);
  },
  /* reporter extras */
  extra(s: State, reportId: string, kind: "contact" | "note" | "photo" | "detail", text: string) {
    const r = s.reports.find((x) => x.id === reportId); if (!r) return;
    const log = (t: string) => r.items.forEach((it) => { if (it.status !== "closed" && it.team) it.log.push({ t: nowOf(s), by: userOf(r.reporterId)?.name ?? "Reporter", text: t }); });
    if (kind === "contact" && !r.extras.contact) {
      r.extras.contact = text; r.input.contact = true; addPoint(s, r, "x-contact", "Contact added", 5, "confirmed"); log(`Contact added: ${text}`);
      const out = evaluate(r.input, s.cfg);
      r.items.forEach((it) => {
        const nu = out.items.find((d) => d.caseId === it.caseId && d.team === it.team && d.kind === it.kind);
        if (nu && it.kind === "lead" && it.status !== "closed") { it.score = nu.score; it.tier = nu.tier; it.reasons = nu.reasons; }
      });
    }
    if (kind === "note" && !r.extras.note) { r.extras.note = text; addPoint(s, r, "x-note", "Note added", 5, "confirmed"); log(`Note: ${text}`); }
    if (kind === "photo" && r.extras.photos < 3) { r.extras.photos += 1; addPoint(s, r, `x-photo${r.extras.photos}`, "Extra photo", 3, "confirmed"); log("Extra photo added"); }
    if (kind === "detail") {
      r.input.servicer = "other";
      const re = evaluate(r.input, s.cfg); r.headline = re.headline; r.plain = re.plain;
      r.items.forEach((it) => { it.flags = it.flags.filter((x) => x !== "needsInfo"); if (it.team) it.log.push({ t: nowOf(s), by: "Reporter", text: `Detail added: ${text}` }); });
      r.extras.note = r.extras.note ?? text;
    }
    r.timeline.push({ t: nowOf(s), by: "Reporter", text: kind === "contact" ? "Added a contact" : kind === "note" ? "Added a note" : kind === "photo" ? "Added a photo" : `Added detail: ${text}` });
    r.items.forEach((it) => { if (it.ownerId && it.status !== "closed" && it.team) notify(s, it.ownerId, `${r.id}: reporter added ${kind}`, r.id); });
  },
  editInfo(s: State, reportId: string, info: LeadInfo) {
    const r = s.reports.find((x) => x.id === reportId); if (!r) return;
    const hadContact = !!(r.extras.contact || r.info?.contactName.trim());
    r.info = info;
    r.timeline.push({ t: nowOf(s), by: userOf(r.reporterId)?.name ?? "Reporter", text: "Lead details updated" });
    if (!hadContact && info.contactName.trim()) A.extra(s, reportId, "contact", [info.contactName.trim(), info.role.trim()].filter(Boolean).join(", "));
    else r.items.forEach((it) => { if (it.ownerId && it.status !== "closed" && it.team) notify(s, it.ownerId, `${r.id}: reporter updated the lead details`, r.id); });
  },
  resumeRetake(s: State, reportId: string) {
    const r = s.reports.find((x) => x.id === reportId); if (!r) return;
    r.input.quality = "brandOnly"; r.input.lowConfidence = true;
    const out = evaluate(r.input, s.cfg);
    r.items = r.items.filter((x) => x.kind !== "retake");
    r.items.push(...makeItems(s, r, out.items, nowOf(s))); r.cases = Array.from(new Set([...r.cases, ...out.cases]));
    r.headline = out.headline; r.verdict = out.verdict; r.plain = out.plain;
    out.points.forEach((p) => addPoint(s, r, p.key, p.label, p.pts, p.status));
    r.items.filter((x) => x.status === "new" && x.routed === "none").forEach((it) => { routeItem(s, r.area, it); if (it.autoClose) { it.step = stepsOf(it).length - 1; it.status = "closed"; it.outcome = it.autoClose; } else if (it.kind === "merge") it.step = 1; if (it.ownerId) notify(s, it.ownerId, `${it.title} · ${r.placeName}`, r.id); });
    r.timeline.push({ t: nowOf(s), by: "Reporter", text: "Sent a clearer photo: report resumed" });
  },
  sync(s: State) {
    s.reports.filter((r) => r.status === "queued").forEach((r) => { r.status = "sent"; activate(s, r); r.timeline.unshift({ t: nowOf(s), by: "System", text: "Report ID reused on retry: no duplicate" }); notify(s, r.reporterId, `${r.id} was sent after signal returned.`, r.id); });
  },
};

/* ---------- seed ---------- */
function photosFor(kind: "unit" | "site"): Photo[] {
  return kind === "site"
    ? [{ id: "p1", label: "Site hoarding", kind: "site", text: "New tower, Block C" }, { id: "p2", label: "Notice board", kind: "board", text: "Lift installation: Q2" }]
    : [{ id: "p1", label: "Licence plate", kind: "plate", text: "Lift No. 74821" }, { id: "p2", label: "Button panel", kind: "panel" }, { id: "p3", label: "Service sticker", kind: "sticker", text: "Serviced by OtherLift" }, { id: "p4", label: "Cabin", kind: "cabin" }];
}
function seedReport(s: State, who: string, placeId: string, presetId: string, hoursAgo: number, edit?: (i: Input) => void) {
  const pr = PRESETS.find((x) => x.id === presetId)!; const pl = PLACES.find((x) => x.id === placeId)!;
  const input = presetToInput(pr, placeId); edit?.(input);
  const at = Date.now() - hoursAgo * H;
  const saved = s.clock; s.clock = at - Date.now();
  const r = createReport(s, { reporterId: who, input, photos: photosFor(input.subject === "site" ? "site" : "unit"), placeId, placeName: pl.name, area: pl.area, answers: [], corrections: [], at });
  s.clock = saved;
  return r;
}

const SITE: Omit<SiteVisit, "by" | "at"> = { met: { name: "Martin Frick", role: "Facility manager", phone: "+41 79 482 21 10" }, lifts: "3", floors: "12", condition: "Wear and small faults", decision: "The person I met", timeline: "Within 3 months", competitor: "Local firm, owner unhappy with response times", note: "Unhappy with response times from the current servicer." };
const SITE_NI: Omit<SiteVisit, "by" | "at"> = { met: { name: "T. Widmer", role: "Project director", phone: "+41 79 482 41 20" }, lifts: "4", floors: "14", condition: "Shafts ready", decision: "Developer or contractor", timeline: "Within 3 months", competitor: "None chosen yet", note: "Structure at floor 9. Lift supplier not chosen." };

/** Runs at a moment in the past, so seeded logs and timelines read like real history. */
function at(s: State, hoursAgo: number, fn: () => void) { const saved = s.clock; s.clock = -hoursAgo * H; fn(); s.clock = saved; }

/** How far a seeded lead gets in the flow: rep scouts, manager qualifies, manager generates, support follows up, contract, installation. */
type Goal = "scout" | "delegated" | "visited" | "nurture" | "rejected" | "review" | "setup" | "gather" | "generate" | "check" | "legal" | "legalReady" | "sent" | "lost" | "contract" | "job" | "done";
const GOALS: Goal[] = ["scout", "delegated", "visited", "review", "setup", "gather", "generate", "check", "sent", "contract", "job", "done"];

/** Moves one Snap & Lead lead and its opportunity through the flow, the way the desk screens do. */
function flow(s: State, r: Report, goal: Goal, opt: { tender?: boolean; track?: string } = {}) {
  const it = r.items.find((i) => i.kind === "lead" && !i.silent && i.team !== "AM" && (!opt.track || i.track === opt.track)); if (!it) return;
  const opp0 = s.sherpa.opps.find((o) => o.source.itemId === it.id); if (!opp0) return;
  const id = opp0.id; const o = () => s.sherpa.opps.find((x) => x.id === id)!; const of = () => offerOf(s, o().offerId); const tn = () => tenderOf(s, o().tenderId);
  const tender = !!opt.tender;
  const end = goal === "nurture" ? 3 : goal === "rejected" ? 4 : goal === "lost" ? GOALS.indexOf("sent") + 2 : goal === "legal" ? GOALS.indexOf("generate") + 1 : goal === "legalReady" ? GOALS.indexOf("check") + 1 : GOALS.indexOf(goal);
  const span = (Date.now() - r.createdAt) / H;
  let k = 0; const step = (fn: () => void) => { k++; if (k > end) return false; at(s, Math.max(0.2, span - (span * k) / (end + 1)), fn); return true; };
  if (o().unrouted) { const to = areaRepFor(r.area) ?? AREA_REPS[0]?.id; if (!to) return; at(s, span * 0.95, () => { A.reassign(s, [it.id], to, "marc"); OP.reassign(s, id, "marc", to); }); }
  const rep = () => o().owner;
  const ni = isNI(o());
  const niVisit = { ...SITE_NI, buy: tender ? "Formal tender" as const : "Direct quotation" as const };
  const visit = goal === "nurture" ? { ...(ni ? SITE_NI : SITE), met: { name: "", role: "" }, timeline: "No plan yet", decision: "Not known yet", competitor: "", note: "Site office closed; nobody to talk to yet." } : ni ? niVisit : SITE;
  const tech = techFor(r.area) ?? "teja";
  if (!step(() => OP.delegateVisit(s, id, rep(), tech))) return;
  if (!step(() => OP.siteVisit(s, id, tech, goal === "visited" && ni ? { ...visit, buy: "Not known yet" as const, note: "The developer decides next month between a tender and a direct quotation." } : visit))) return;
  if (!step(() => { if (it.status === "new") A.accept(s, it.id, rep()); A.visit(s, it.id, rep(), "Site visit checked"); OP.scout(s, id, rep(), visit); if (o().stage === "nurture" && goal !== "nurture") OP.toReview(s, id, "marc"); })) return;
  if (goal === "rejected") { step(() => { A.notRelevant(s, it.id, "marc", "Customer already declined"); OP.reviewClose(s, id, "marc", "Customer already declined"); }); return; }
  if (!step(() => { const team = suggestTeam(o()).team; const owner = s.cfg.owners[r.area]?.[team] ?? USERS.find((u) => u.team === team)?.id ?? rep(); A.reassign(s, [it.id], owner, "marc"); OP.review(s, id, "marc", { team, owner }); })) return;
  if (!step(() => { const nba = isNI(o()) || o().kind === "modernisation" ? undefined : dealNbas(s, o())[0]; OP.setupDeal(s, id, rep(), { accountId: o().accountId ?? "new", path: tender ? "tender" : "direct", eordDays: 30, product: nba?.product, term: nba?.term, discountPct: nba?.discountPct, nba: nba?.title }); })) return;
  if (!step(() => {
    if (tender) { const t = tn(); if (!t) return; OP.tenderDoc(s, t.id, rep(), { name: "tender-document.pdf", size: 820000 }); OP.submitBid(s, t.id, rep(), { answers: Object.fromEntries((t.doc?.gaps ?? []).map((g) => [g.key, g.opts[0]])), priority: "Price", rivals: /^none/i.test(o().site?.competitor ?? "") ? "" : o().site?.competitor ?? "" }); }
    else if (tasksOfOpp(s, id).some((t) => t.kind === "quoteBrief")) OP.quoteBrief(s, id, rep(), { floors: "15", load: "1,000 kg (13 persons)", speed: "1.75 m/s", finish: o().kind === "modernisation" ? "Controller and drive" : "Stainless steel", timeline: "Within 3 months", extras: "" });
  })) return;
  if (!step(() => { if (tender) { const t = tn(); if (t) OP.genBid(s, t.id, "marc", 8); } else { OP.genQuote(s, id, "marc"); const of = o().offerId; if (of) OP.pricingReady(s, of); } })) return;
  if (!step(() => {
    if (tender) { const t = tn(); if (!t) return; OP.legalReady(s, t.id); return; }
    const f = of(); if (!f) return; SH.setTerms(s, f.id, "marc", { discountPct: 8 }); SH.submit(s, f.id, "marc"); SH.send(s, f.id, "marc", { subject: `Our quotation for ${r.placeName}`, body: "Please find it attached." });
  })) return;
  if (goal === "lost") { step(() => { const t = tn(); if (tender && t) OP.bidResult(s, t.id, "marc", "lost", "Price"); else { const f = of(); if (f) SH.outcome(s, f.id, "shalini", "lost", "Competitor offer was 9% lower"); } }); return; }
  if (!step(() => { const t = tn(); if (tender && t) OP.bidResult(s, t.id, "marc", "won"); else { const f = of(); if (f) SH.outcome(s, f.id, "shalini", "won"); } })) return;
  const ct = () => o().contractId!;
  if (!step(() => CT.agentDone(s, ct()))) return;
  step(() => OP.acceptJob(s, id, serviceLeadFor(r.area) ?? "srikanth", { start: Date.now() + s.clock + 60 * 86400000, siteContact: { name: "B. Ammann", phone: "+41 78 900 31 41" } }));
}

/** A building-site report under its own name, so new-installation deals are spread over the map. */
function siteReport(s: State, who: string, name: string, area: string, geo: { lat: number; lng: number }, preset: string, hoursAgo: number, edit?: (i: Input) => void) {
  const pr = PRESETS.find((x) => x.id === preset)!;
  const input = presetToInput(pr, "harbour"); edit?.(input);
  const at = Date.now() - hoursAgo * H; const saved = s.clock; s.clock = at - Date.now();
  const r = createReport(s, { reporterId: who, input, photos: photosFor("site"), placeId: "harbour", placeName: name, area, answers: [], corrections: [], at });
  s.clock = saved;
  s.sherpa.opps.filter((o) => o.source.reportId === r.id).forEach((o) => { o.geo = geo; o.accountId = undefined; });
  return r;
}

/** Leads at every stage of both pipelines, so each screen has realistic work in it. */
function seedPipeline(s: State) {
  const item = (r: Report, kind: string) => r.items.find((i) => i.kind === kind)!;
  const add = (place: string, preset: string, h: number, edit?: (i: Input) => void) => seedReport(s, "alex", place, preset, h, edit);
  const fine = (i: Input) => { i.condition = "fine"; };
  const site = (name: string, area: string, lat: number, lng: number, h: number, preset = "D1") => siteReport(s, "alex", name, area, { lat, lng }, preset, h, (i) => { if (preset === "D1") { i.stage = "structure"; i.ordered = false; i.contact = true; } });

  // New installations: one building site at each step, in flow order
  flow(s, site("Sihl Riverfront (building site)", "ZHC", 47.363, 8.523, 480), "lost");
  site("Sihl Riverfront (building site)", "ZHC", 47.364, 8.524, 6, "D4");
  flow(s, site("Schlieren Grand (building site)", "ZHW", 47.397, 8.447, 30), "delegated");
  flow(s, site("Albisrieden Gardens (building site)", "ZHW", 47.375, 8.485, 20, "D4"), "visited");
  flow(s, site("Grünau Heights (building site)", "ZHW", 47.392, 8.472, 70, "D4"), "nurture");
  flow(s, site("Höngg Residenz (building site)", "ZHW", 47.403, 8.497, 44), "review");
  flow(s, site("Uitikon Villas (building site)", "ZHW", 47.369, 8.455, 140), "rejected");
  flow(s, site("Dietikon Crest (building site)", "ZHW", 47.404, 8.4, 60), "gather");
  flow(s, site("Glattbrugg Metro Plaza (building site)", "ZHN", 47.432, 8.563, 96), "generate");
  flow(s, add("harbour", "M15", 240, () => undefined), "sent");
  flow(s, site("Zurich West Tower 4 (building site)", "ZHW", 47.389, 8.512, 52), "gather", { tender: true });
  flow(s, site("Hardbrücke One (building site)", "ZHW", 47.385, 8.517, 110), "generate", { tender: true });
  flow(s, site("Stadelhofen Square (building site)", "ZHC", 47.366, 8.548, 150), "legal", { tender: true });
  flow(s, site("Wallisellen Signature (building site)", "ZHN", 47.415, 8.594, 300), "sent", { tender: true });
  flow(s, site("Wollishofen Gateway (building site)", "ZHC", 47.345, 8.531, 360), "contract");
  flow(s, site("Wiedikon Meadows (building site)", "ZHW", 47.368, 8.517, 500), "job", { tender: true });

  // Existing lifts: one existing-installation deal in review, one quotation with the customer, one modernisation
  flow(s, add("baselhosp", "C8", 130, fine), "review");
  flow(s, add("secbiz", "C2", 210, fine), "sent");
  flow(s, add("riverside", "B12", 150, (i) => { i.condition = "minor"; i.age = 26; }), "generate", { track: "modernisation" });

  // One of each non-sales lead: a fault, an emergency, a records update
  const f1 = add("station", "B3", 20, (i) => { i.condition = "out"; });
  at(s, 18, () => A.assignEngineer(s, item(f1, "ticket").id, "jonas", "Reto K."));
  const e1 = add("cityhall", "M2", 7, (i) => { i.condition = "unsafe"; i.hurt = "no"; });
  at(s, 6.8, () => A.dispatch(s, item(e1, "emergency").id, "dimitri"));
  add("secbiz", "B16", 3, fine);
}

leadHooks.quoted = (s, itemId, by) => { const f = findItem(s, itemId); if (f && f[1].status !== "closed") A.quote(s, itemId, by); };
leadHooks.progress = (s, itemId, steps, step) => {
  const f = findItem(s, itemId); if (!f) return; const [r, it] = f;
  if (it.kind !== "lead") return;
  it.steps = steps;
  if (it.step === step) return;
  const up = step > it.step; it.step = step;
  if (up) { notify(s, r.reporterId, `${r.id}: ${steps[step]}`, r.id); r.timeline.push({ t: nowOf(s), by: "System", text: `${TRACKS[it.track].label}: ${steps[step]}` }); }
};
leadHooks.closed = (s, itemId, by, result) => { const f = findItem(s, itemId); if (f && f[1].status !== "closed") A.outcome(s, itemId, by, result); };

export function seed(): State {
  const s: State = { reports: [], alerts: [], audit: [], cfg: structuredClone(DEFAULT_CFG), clock: 0, offline: false, userId: null, seq: 100, sherpa: seedSherpa(), v: STATE_VERSION };
  const adv = (h: number) => { s.clock += h * H; };
  AC.setGoal(s, "deccan", "lena", "Keep all three lines and win the Tower 2 modernisation before the contract ends.");
  AC.addAction(s, "deccan", "lena", "Quarterly review with Daniel Müller", "lena", 5);
  AC.addAction(s, "deccan", "lena", "Survey Tower 2 lift for modernisation", "ethan", 10);
  seedPipeline(s);
  s.clock = 0; adv(0); tick(s);
  s.alerts.forEach((a) => { if (a.t < Date.now() - 4 * H) a.read = true; });
  return s;
}

/* ---------- context ---------- */
interface Ctx {
  app: AppId; s: State; ready: boolean; me: ReturnType<typeof userOf>; now: number;
  mutate: (fn: (s: State) => void) => void;
  login: (id: string) => void; reset: () => void;
  setOffline: (b: boolean) => void;
}
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error("no store"); return c; };

/** Talks to the mock server (app/api/state). The server keeps one JSON file, so data survives reloads and is shared between browser windows. */
const api = {
  async get(): Promise<{ rev: number; state: State | null } | null> { try { const r = await fetch("/api/state", { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; } },
  async put(state: State): Promise<number | null> {
    try {
      const r = await fetch("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
      if (r.status === 409) { location.reload(); return null; }
      return r.ok ? ((await r.json()) as { rev: number }).rev : null;
    } catch { return null; }
  },
};
const mineOf = (st: State, prev: State | null): State => ({ ...st, userId: prev?.userId ?? null, offline: prev?.offline ?? false });

const inApp = (app: AppId, id: string | null | undefined) => APPS[app].users.some((u) => u.id === id);

/** Each app keeps its own signed-in user, so SHERPA and Snap & Lead never sign each other out in the same browser. */
export function Provider({ app, children }: { app: AppId; children: ReactNode }) {
  const [s, setS] = useState<State | null>(null);
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rev = useRef(0); const dirty = useRef(false); const lv = useRef(0);
  /** States that came from the server. They are not saved back, so a real local change is never mistaken for one. */
  const fromServer = useRef(new WeakSet<object>());
  const [nowTick, setNowTick] = useState(0);

  /* load: the server first, then this browser's cache, then fresh seed data */
  useEffect(() => {
    let dead = false;
    (async () => {
      let init: State | null = null;
      const remote = await api.get();
      if (remote?.state && remote.state.v === STATE_VERSION) { init = remote.state; rev.current = remote.rev; }
      try { OLD_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
      if (!init) { try { const raw = localStorage.getItem(KEY); if (raw) { const j = JSON.parse(raw) as State; if (j.v === STATE_VERSION) init = j; } } catch { /* ignore */ } }
      const st = init ?? seed();
      let saved: string | null = null;
      try { saved = localStorage.getItem(USER_KEY[app]); } catch { /* ignore */ }
      st.userId = inApp(app, saved) ? saved : APPS[app].home;
      if (!dead) setS(st);
    })();
    return () => { dead = true; };
  }, [app]);
  /* save: this browser's cache at once, the server after a short pause */
  useEffect(() => {
    if (!s) return;
    if (s.v !== STATE_VERSION) { location.reload(); return; }
    if (fromServer.current.has(s)) return;
    const mine = ++lv.current; dirty.current = true;
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
      const r = await api.put(s); if (r !== null) rev.current = r;
      if (lv.current === mine) dirty.current = false;
    }, 300);
  }, [s]);
  /* listen: pick up changes made in another window, without touching who is signed in here */
  useEffect(() => {
    const i = setInterval(async () => {
      if (dirty.current) return;
      const before = lv.current;
      const j = await api.get();
      if (j?.state && j.state.v !== STATE_VERSION) { location.reload(); return; }
      if (!j?.state || j.rev <= rev.current || j.state.v !== STATE_VERSION || dirty.current || lv.current !== before) return;
      rev.current = j.rev;
      setS((prev) => { const n = mineOf(j.state!, prev); fromServer.current.add(n); return n; });
    }, 4000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => { const i = setInterval(() => setNowTick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (!s) return;
    const t = setTimeout(() => setS((p) => { if (!p) return p; const n = structuredClone(p); tick(n); return n; }), 0);
    return () => clearTimeout(t);
  }, [nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = useCallback((fn: (st: State) => void) => {
    setS((p) => { if (!p) return p; const n = structuredClone(p); fn(n); tick(n); return n; });
  }, []);
  const login = useCallback((id: string) => {
    if (!inApp(app, id)) return;
    try { localStorage.setItem(USER_KEY[app], id); } catch { /* ignore */ }
    setS((p) => (p ? { ...p, userId: id } : p));
  }, [app]);
  const reset = useCallback(() => { setS((p) => { const n = seed(); n.userId = p?.userId ?? null; return n; }); }, []);
  const setOffline = useCallback((b: boolean) => mutate((st) => { st.offline = b; if (!b) A.sync(st); }), [mutate]);

  const value = useMemo<Ctx | null>(() => s ? ({ app, s, ready: true, me: userOf(s.userId), now: nowOf(s), mutate, login, reset, setOffline }) : null, [app, s, mutate, login, reset, setOffline]);
  if (!value) return <div className="grid h-screen place-items-center text-sm text-muted">Loading {APPS[app].name}…</div>;
  return <C.Provider value={value}>{children}</C.Provider>;
}

/* ---------- selectors ---------- */
export function pointsOf(s: State, userId: string) {
  let confirmed = 0, pending = 0;
  s.reports.filter((r) => r.reporterId === userId).forEach((r) => r.points.forEach((p) => { if (p.status === "confirmed") confirmed += p.pts; else if (p.status === "pending" || p.status === "held") pending += p.pts; }));
  return { confirmed, pending };
}
/** Most recent activity on a report: creation, any timeline entry, or any action on its items. */
export function reportActivity(r: Report): number {
  let t = r.createdAt;
  for (const e of r.timeline) if (e.t > t) t = e.t;
  for (const it of r.items) { t = Math.max(t, it.createdAt, it.lastActionAt); for (const l of it.log) if (l.t > t) t = l.t; }
  return t;
}
/** Most recent activity on a single item. */
export function itemActivity(it: Item): number {
  let t = Math.max(it.createdAt, it.lastActionAt);
  for (const l of it.log) if (l.t > t) t = l.t;
  return t;
}
/** Newest-activity-first comparator for { r, it } rows. */
export const byRecent = (a: { r: Report; it: Item }, b: { r: Report; it: Item }) => Math.max(itemActivity(b.it), b.r.createdAt) - Math.max(itemActivity(a.it), a.r.createdAt);
export function itemsFor(s: State, user: { id: string; team?: Team }) {
  const out: { r: Report; it: Item }[] = [];
  s.reports.forEach((r) => { if (r.status !== "sent") return; r.items.forEach((it) => { if (it.ownerId === user.id || (!it.ownerId && user.team && it.team === user.team)) out.push({ r, it }); }); });
  return out.sort(byRecent);
}
export function exceptions(s: State) {
  const now = nowOf(s); const ex: { r: Report; it: Item; why: string }[] = [];
  s.reports.forEach((r) => {
    if (r.status !== "sent") return;
    r.items.forEach((it) => {
      if (it.status === "closed") return;
      if (it.routed === "exception" && it.status !== "declined") ex.push({ r, it, why: it.flags.includes("Routing paused") ? "Routing paused" : "No owner found" });
      else if (it.status === "declined") ex.push({ r, it, why: `Declined: ${it.declineReason}` });
      else if (it.clockLevel >= 2 && it.status === "new") ex.push({ r, it, why: it.clockLevel >= 3 ? `No action for ${Math.floor((now - it.lastActionAt) / H)}h: reassign` : `No action in ${s.cfg.followUp[effTier(it) === "Hot" ? "hot" : "warm"][1]}h` });
      else if (it.kind === "records" && it.status === "new" && now - it.createdAt > 48 * H) ex.push({ r, it, why: "Records task stuck 2 days" });
      if (it.flags.includes("mergePending")) ex.push({ r, it, why: "Merge waiting for approval" });
      if (it.flags.includes("possibleDuplicate")) ex.push({ r, it, why: "Possible duplicate" });
      if (it.flags.some((f) => f.startsWith("Invalid"))) ex.push({ r, it, why: "Invalid lead to review" });
    });
  });
  return ex;
}
export { baseInput, tierOf };
export type { Alert };
