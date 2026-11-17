"use client";
import { useState, type ReactNode } from "react";
import { A, useApp } from "@/lib/store";
import { USERS } from "@/lib/data";
import { AREA_NAME, GUIDE, KIND_LABEL, MANAGER, NAMES, OP, PRODUCT, SH, STAGES, SUPPORT, TECHS, AREA_REPS, rankPeople, buildingFacts, suggestBuyPath, suggestDiscount, suggestLossReason, suggestRejectReason, type CountFact, accountMatches, daysTo, dealNbas, chf, isNI, isOpen, offerOf, oppOf, reviewBrief, reviewMin, stageAt, suggestTeam, tasksOfOpp, tenderOf } from "@/lib/sherpa";
import type { Offer, Opp, SiteVisit, State, Task, Tender } from "@/lib/types";
import { Btn, Card, Empty, Icon, Pill, TierPill, ago } from "../ui";
import { Input } from "@/components/form";
import { Back, Fold, Label } from "./Action";
import { Page } from "./Common";
import { OfferPill } from "./Offers";
import { CHOICE, Facts, Field, LinkBtn, Panel, PersonPick, Q, StickyActions, Suggest } from "./Step";
import { HandoverOfferPanel, HandoverPack, JobPanel, LossMemory } from "./NewInstall";
import { ContractBox } from "./Contract";
import { CT } from "@/lib/contracts";
import { Why } from "../Why";
import { leadScore } from "@/lib/scores";


/** One line that says whose move it is. Copied from guided-buying's "next step" line. */
export function statusLine(s: State, o: Opp, me: string, now: number): { text: string; mine: boolean; late: boolean } {
  if (!isOpen(o)) return { text: o.stage === "won" ? "Won" : o.stage === "lost" ? "Lost" : "Closed", mine: false, late: false };
  const open = tasksOfOpp(s, o.id).sort((a, b) => a.due - b.due);
  const mine = open.find((t) => t.forUser === me);
  if (mine) return { text: `Your move: ${mine.title}`, mine: true, late: mine.due < now };
  const t = open[0];
  if (t) return { text: `Waiting on ${NAMES[t.forUser ?? ""] ?? "someone"} since ${ago(now - t.createdAt)}: ${t.title}`, mine: false, late: t.due < now };
  if (o.stage === "sent") return { text: "Waiting on the customer", mine: false, late: false };
  return { text: "No open step", mine: false, late: false };
}

/* ------------------------------------------------------------------ the list */
export function Opps({ openId, setOpenId, openOffer }: { openId: string | null; setOpenId: (id: string | null) => void; openOffer: (id: string) => void }) {
  const { s, me, now } = useApp();
  const mgr = me!.role === "mgr";
  const [tab, setTab] = useState<"needs" | "waiting" | "active" | "closed" | "exc">("needs");
  if (openId && oppOf(s, openId)) return <OppPage id={openId} onBack={() => setOpenId(null)} openOffer={openOffer} />;
  const involved = (o: Opp) => mgr || o.owner === me!.id || tasksOfOpp(s, o.id, false).some((t) => t.forUser === me!.id) || offerOf(s, o.offerId)?.createdBy === me!.id || o.source.reporter === me!.id;
  const needs = (o: Opp) => isOpen(o) && tasksOfOpp(s, o.id).some((t) => t.forUser === me!.id);
  const waiting = (o: Opp) => isOpen(o) && involved(o) && !needs(o) && (tasksOfOpp(s, o.id).length > 0 || o.stage === "sent");
  const exc = (o: Opp) => isOpen(o) && (!!o.unrouted || tasksOfOpp(s, o.id).some((t) => t.due < now));
  const mineAll = s.sherpa.opps.filter(involved);
  const lists = { needs: mineAll.filter(needs), waiting: mineAll.filter(waiting), active: mineAll.filter(isOpen), closed: mineAll.filter((o) => !isOpen(o)), exc: mineAll.filter(exc) };
  const tabs: [typeof tab, string][] = [["needs", "Needs my action"], ["waiting", "Waiting on others"], ["active", "All active"], ["closed", "Closed"], ...(mgr ? ([["exc", "Exceptions"]] as [typeof tab, string][]) : [])];
  const rows = lists[tab].sort((a, b) => (tasksOfOpp(s, a.id)[0]?.due ?? Infinity) - (tasksOfOpp(s, b.id)[0]?.due ?? Infinity));
  return (
    <Page title="Opportunities" sub="Every lead, tender and offer is one opportunity. Each line says whose move it is and what they are waiting on.">
      <div className="mb-4 flex flex-wrap gap-1.5">{tabs.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${tab === k ? "bg-ink text-white" : "bg-white text-ink/80 ring-1 ring-line hover:bg-surface"}`}>{l} <span className={`num ml-1 text-xs font-medium ${tab === k ? "text-white/60" : k === "needs" && lists.needs.length ? "text-brand" : "text-muted"}`}>{lists[k].length}</span></button>
      ))}</div>
      <div className="space-y-2.5">
        {rows.length === 0 && <Empty text={tab === "needs" ? "Nothing needs you right now." : "Nothing here."} />}
        {rows.map((o) => {
          const st = statusLine(s, o, me!.id, now);
          const stage = STAGES.find((x) => x[0] === o.stage)?.[1] ?? (o.stage === "lost" ? "Lost" : "Closed");
          return (
            <button key={o.id} onClick={() => setOpenId(o.id)} className="group flex w-full items-center gap-4 rounded-xl border border-line bg-white p-4 text-left transition hover:shadow-md" style={{ borderLeftWidth: 3, borderLeftColor: st.late ? "#e3001b" : st.mine ? "#f59e0b" : "#d4d4d8" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-bold text-muted">{o.id}</span><Pill tone="blue">{KIND_LABEL[o.kind]}</Pill><Pill tone={o.stage === "won" ? "green" : "gray"}>{stage}</Pill>{o.unrouted && <Pill tone="red">No owner</Pill>}{st.late && <Pill tone="red">Overdue</Pill>}</div>
                <div className="mt-1.5 truncate text-[15px] font-semibold">{o.title}</div>
                <div className="truncate text-[12.5px] text-muted">{o.placeName} · {AREA_NAME[o.area] ?? o.area} · owner {NAMES[o.owner] ?? o.owner}</div>
                <div className={`mt-2 flex items-start gap-1.5 text-[12.5px] ${st.mine ? "font-semibold text-brand" : "text-ink/75"}`}><Icon n={st.mine ? "bolt" : "clock"} s={13} /><span>{st.text}</span></div>
              </div>
              {o.value ? <div className="shrink-0 text-right"><div className="num text-sm font-semibold">{chf(o.value)}</div></div> : null}
              <span className="text-muted transition group-hover:translate-x-0.5"><Icon n="chev" s={16} /></span>
            </button>
          );
        })}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ one opportunity */
export function OppPage({ id, onBack, openOffer, embedded }: { id: string; onBack: () => void; openOffer: (id: string) => void; embedded?: boolean }) {
  const { s, me, now } = useApp();
  const o = oppOf(s, id)!;
  const offer = offerOf(s, o.offerId); const tender = tenderOf(s, o.tenderId);
  const st = statusLine(s, o, me!.id, now);
  const open = tasksOfOpp(s, id).sort((a, b) => a.due - b.due);
  const mine = open.filter((t) => t.forUser === me!.id);
  const all = tasksOfOpp(s, id, false);
  const { stages, idx: stageIdx, done: allDone } = stageAt(o);
  const reporter = o.source.reporter ? NAMES[o.source.reporter] : undefined;

  return (
    <div className={`${embedded ? "p-4" : "p-4 @2xl:p-8"}`}>
      {!embedded && <Back onClick={onBack} label="Back to opportunities" />}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-bold text-muted">{o.id}</span>{o.tier && <TierPill tier={o.tier} />}<Pill tone="blue">{KIND_LABEL[o.kind]}</Pill>{o.unrouted && <Pill tone="red">No owner</Pill>}<Pill>from {o.source.label}</Pill></div>
        {!embedded && <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{o.title}</h1>}
        <p className="mt-1 text-sm text-muted">{o.placeName} · {AREA_NAME[o.area] ?? o.area} · {o.stage === "review" ? `scouted by ${NAMES[o.owner] ?? o.owner}, waiting for the Sales Manager` : o.stage === "nurture" ? `in nurture, below ${reviewMin(s)}` : `owner ${NAMES[o.owner] ?? o.owner}`}{o.technician ? ` · visit by ${NAMES[o.technician]}` : ""}{reporter ? ` · spotted by ${reporter}` : ""}{o.value ? ` · worth ${chf(o.value)}` : ""}</p>
      </header>

      <LossMemory o={o} />
      {/* what I should do now */}
      {mine.length > 0 && <div className="mb-5 space-y-4">{mine.map((t) => <TaskPanel key={t.id} o={o} t={t} openOffer={openOffer} />)}</div>}
      {mine.length === 0 && isOpen(o) && <Card className="mb-5 p-5 text-sm text-muted">Nothing needs you on this one. {open[0] ? `${NAMES[open[0].forUser ?? ""]} has the next step: ${open[0].title}.` : o.stage === "sent" ? "The customer has the offer." : ""}</Card>}
      {!isOpen(o) && <Card className="mb-5 flex items-center gap-3 p-5"><span className={`grid h-10 w-10 place-items-center rounded-full ${o.stage === "won" ? "bg-emerald-100 text-emerald-700" : "bg-surface text-muted"}`}><Icon n={o.stage === "won" ? "trophy" : "check"} s={20} /></span><div><div className="text-[15px] font-semibold">{o.stage === "won" ? "Won" : o.stage === "lost" ? "Lost" : "Closed"}</div><div className="text-[13px] text-muted">{o.log[o.log.length - 1]?.text}</div></div></Card>}
      {/* where it is, and whose move it is */}
      <Card className="mb-5 p-5">
        <ol className="flex items-center gap-0">{stages.map(([k, l], i) => (
          <li key={k} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center"><div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : i <= stageIdx ? "bg-brand" : "bg-line"}`} /><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${i < stageIdx || allDone ? "border-brand bg-brand text-white" : i === stageIdx ? "border-brand bg-white text-brand ring-4 ring-brand/15" : "border-line bg-white"}`}>{(i < stageIdx || allDone) && <Icon n="check" s={12} w={3} />}</span><div className={`h-0.5 flex-1 ${i === stages.length - 1 ? "opacity-0" : i < stageIdx ? "bg-brand" : "bg-line"}`} /></div>
            <span className={`text-[11px] ${i === stageIdx ? "font-semibold text-ink" : "text-muted"}`}>{l}</span>
          </li>))}</ol>
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13.5px] ${st.mine ? "bg-amber-50 text-amber-900" : "bg-surface"}`}><Icon n={st.mine ? "bolt" : "clock"} s={15} /><span className="font-medium">{st.text}</span></div>
      </Card>


      <div className="grid grid-cols-1 items-start gap-5 @4xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {o.contractId && !mine.some((t) => t.kind === "contractAgent") && <ContractCard id={o.contractId} openOffer={openOffer} />}
          <Card className="p-5">
            <Label>Contact</Label>
            {o.contact ? <div className="rounded-xl border border-line px-4 text-[13.5px]">{[["Name", o.contact.name], ["Role", o.contact.role], ["Phone", o.contact.phone ?? "Not known"], ["Email", o.contact.email ?? "Not known"], ["Found by", o.contact.via]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line/70 py-2.5 last:border-0"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>)}</div>
              : <div className="rounded-xl bg-surface p-3 text-[13.5px]"><b>No contact yet.</b> {o.technician ? `${NAMES[o.technician]} meets the person in charge on the site visit and adds them here.` : `${NAMES[o.owner] ?? "The area rep"} finds the person in charge while scouting and adds them here.`}</div>}
          </Card>
          {(tender || offer) && (
            <Card className="p-5">
              <Label>Tender and offer</Label>
              <div className="space-y-3">
                {tender && <div className="rounded-xl border border-line p-3 text-[13.5px]"><div className="flex items-center justify-between gap-2"><b>{tender.id} · {tender.name}</b><Pill tone={tender.stage === "final" ? "green" : "gray"}>{tender.stage === "final" ? "Final bidding" : tender.stage}</Pill></div><div className="mt-1 text-xs text-muted">The customer&apos;s formal call for prices. Bid due in {Math.max(0, daysTo(s, tender.eord))} days. {tender.competitorSpec ? "It names a competitor’s part." : ""}</div><p className="mt-2 text-[13px]">{tender.legal ? (tender.legal.submittedAt ? "Bid submitted in the tender." : "The legal team is building the bid.") : tender.draft ? `Bid information with ${NAMES[MANAGER_ID]}, who starts the bid.` : `${NAMES[o.owner] ?? "The rep"} gathers the bid information.`}</p>{tender.legal && !mine.some((t) => t.kind === "bidResult") && <div className="mt-3"><LegalStatus t={tender} bare /></div>}</div>}
                {offer && <button onClick={() => openOffer(offer.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line p-3 text-left text-[13.5px] hover:bg-surface"><div><b>{offer.id} · {offer.title}</b><div className="text-xs text-muted">{tender ? "Our priced answer to the tender" : "Our offer to the customer"} · {chf(offer.price)} · {offer.discountPct}% off</div></div><span className="flex items-center gap-2"><OfferPill o={offer} /><Icon n="chev" s={14} /></span></button>}
              </div>
            </Card>
          )}
          {!mine.some((t) => t.kind === "job") && <HandoverPack o={o} />}
          {o.site && !mine.some((t) => t.kind === "review" || t.kind === "scout") && <SiteCard o={o} />}
          <Notes o={o} />
          <Card className="px-5 py-2"><Fold title="Timeline" count={`${o.log.length} event${o.log.length === 1 ? "" : "s"}`}><ol className="space-y-3 text-[13px]">{[...o.log].reverse().map((l, k) => <li key={k} className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>{l.text}<span className="block text-xs text-muted">{l.by} · {ago(now - l.t)}</span></span></li>)}</ol></Fold></Card>
        </div>
        <Card className="p-5 @4xl:sticky @4xl:top-4">
          <Label>Who is doing what</Label>
          {all.length === 0 && <div className="text-sm text-muted">No steps yet.</div>}
          <ul className="space-y-3 text-[13px]">{all.slice().sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt).map((t) => (
            <li key={t.id} className="flex gap-2.5"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : t.due < now ? "border-brand" : "border-line"}`}>{t.done && <Icon n="check" s={9} w={4} />}</span><span className={t.done ? "text-muted line-through" : ""}>{t.title}<span className="block text-xs text-muted">{NAMES[t.forUser ?? ""] ?? "Anyone"} · {t.done ? `done ${ago(now - (t.doneAt ?? now))}` : t.due < now ? "overdue" : `due in ${Math.max(0, daysTo(s, t.due))} day${Math.max(0, daysTo(s, t.due)) === 1 ? "" : "s"}`}</span></span></li>
          ))}</ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the step in front of me */
export function TaskPanel({ o, t, openOffer }: { o: Opp; t: Task; openOffer: (id: string) => void }) {
  const { s, me, mutate, now } = useApp();
  const by = me!.id; const iid = o.source.itemId;
  const [f, setF] = useState({ note: "", to: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const offer = offerOf(s, o.offerId);

  if (t.kind === "scout") return <ScoutPanel o={o} t={t} />;
  if (t.kind === "review") return <ReviewPanel o={o} />;
  if (t.kind === "genQuote") return <GenQuotePanel o={o} t={t} />;
  if (t.kind === "genBid") return <GenBidPanel o={o} t={t} />;
  if (t.kind === "bidResult") return <BidResultPanel o={o} t={t} />;
  if (t.kind === "followup" && by === SUPPORT) return <FollowupPanel o={o} t={t} openOffer={openOffer} />;
  if (t.kind === "handover" && /^(Offer a|Handover pack)/.test(t.title)) return <HandoverOfferPanel o={o} t={t} openOffer={openOffer} />;
  if (t.kind === "job") return <JobPanel o={o} t={t} />;
  if (t.kind === "siteVisit") return <SitePanel o={o} t={t} />;
  if (t.kind === "dealSetup") return <DealPanel o={o} t={t} />;
  if (t.kind === "tenderDoc") return <BidInfoPanel o={o} t={t} />;
  if (t.kind === "quoteBrief") return <QuotePanel o={o} t={t} />;
  if (t.kind === "contractAgent" && o.contractId) { const c = s.sherpa.contracts.find((x) => x.id === o.contractId); return c ? (
    <Panel title={t.title} why="" does="Shows the Contract agent's progress. Nothing for you to do." then="When the customer signs, the deal is won and the installation hand-over starts.">
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[13px] font-medium">The Contract agent drafts, checks and sends the contract for e-signature.</span><LinkBtn onClick={() => mutate((st) => CT.agentDone(st, c.id))}>Customer signed (demo)</LinkBtn></div>
      <ContractBox c={c} open={() => openOffer(c.id)} />
    </Panel>) : null; }
  if (t.kind === "approve") return (
    <Panel title={t.title} why={`${t.detail ?? ""} ${offer && offer.discountPct > GUIDE.manager ? `This is above the ${GUIDE.manager}% a manager can approve.` : ""}`} does="Opens the one-page brief with the price, the area check and your options." then={`${NAMES[offer?.createdBy ?? o.owner]} is told your decision. If you approve, they send it.`}>
      {offer && <Btn onClick={() => openOffer(offer.id)}>Review and decide</Btn>}
    </Panel>
  );

  if (t.kind === "revise" && offer?.pricing && now < offer.pricing.readyAt) return <PricingPanel o={o} t={t} />;
  if (t.kind === "revise" || t.kind === "send" || t.kind === "followup") return (
    <Panel title={t.title} why={t.detail ?? ""} does={t.kind === "send" ? "Opens the email to edit and send." : t.kind === "followup" ? "Opens the offer with a follow-up email ready." : "Opens the offer so you can change the price or discount and submit it."} then={by === MANAGER ? (t.kind === "send" ? `It goes as a PDF attachment. ${NAMES[SUPPORT]} follows up with the customer.` : "Mark it ready, write the email and send it. Sales support follows up.") : t.kind === "send" ? "The quotation goes as a PDF attachment. You can keep talking to the customer in the chat on the offer." : t.kind === "followup" ? "Log the result when the customer answers: won or lost." : "It goes to the Sales Manager."}>
      <div className="flex flex-wrap gap-2">{offer && <Btn onClick={() => openOffer(offer.id)}>Open {offer.id}</Btn>}</div>
    </Panel>
  );

  const areaReps = rankPeople(s, o, AREA_REPS.map((u) => u.id), "area");
  const areaRep = f.to || areaReps[0]?.id || "";
  if (t.kind === "assign") return (
    <Panel title={t.title} why={t.detail ?? ""} does="Makes the area rep the owner. They send a technician." then="The checked lead comes back to you to qualify.">
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><PersonPick label="Area rep" ranked={areaReps} value={areaRep} onChange={set("to")} /></div>
        <Btn disabled={!areaRep} onClick={() => mutate((st) => { if (iid) A.reassign(st, [iid], areaRep, by); OP.reassign(st, o.id, by, areaRep); })}>Assign {NAMES[areaRep]?.split(" ")[0] ?? ""}</Btn></div>
      <p className="mt-2 text-xs text-amber-800">No area rep covers {AREA_NAME[o.area] ?? o.area}. SHERPA suggests the one with the most room and the closest areas.</p>
    </Panel>
  );

  return (
    <Panel title={t.title} why={t.detail ?? ""}>
      <div className="space-y-2"><Field v={f.note} set={set("note")} ph="What did you do? (optional)" area /><Btn onClick={() => mutate((st) => OP.completeTask(st, t.id, by, f.note))}>Mark done</Btn></div>
    </Panel>
  );
}

const MANAGER_ID = "marc";
const TEAM_NAME = { NI: "New Installation", EI: "Existing Installation", MOD: "Modernisation" } as const;

function ReviewPanel({ o }: { o: Opp }) {
  const { s, me, mutate } = useApp();
  const by = me!.id; const iid = o.source.itemId;
  const brief = reviewBrief(s, o);
  const nba = suggestTeam(o);
  const [team, setTeam] = useState<"NI" | "EI" | "MOD">(nba.team);
  const reps = USERS.filter((u) => !u.hidden && u.team === team);
  const [pick, setPick] = useState("");
  const ranked = rankPeople(s, o, reps.map((u) => u.id), "rep");
  const owner = pick && reps.some((u) => u.id === pick) ? pick : ranked[0]?.id ?? "";
  const rejectHint = suggestRejectReason(s, o);
  const [note, setNote] = useState(""); const [reasonPick, setReason] = useState(""); const reason = reasonPick || rejectHint.value;
  const [mode, setMode] = useState<"" | "note" | "back" | "reject">("");
  const r = s.reports.find((x) => x.id === o.source.reportId);
  const first = (id: string) => NAMES[id]?.split(" ")[0] ?? "the rep";
  const canSendBack = o.owner !== MANAGER;
  const toggle = (m: typeof mode) => { setMode(mode === m ? "" : m); setNote(""); };
  const facts = [...siteFacts(o), ...(r?.answers ?? []).map((a) => [a.q, a.a] as [string, string])].filter(([k, v], i, all) => v && v !== "–" && all.findIndex(([x]) => x === k) === i).slice(0, 8);
  const link = (m: typeof mode, label: string) => <LinkBtn on={mode === m} onClick={() => toggle(m)}>{label}</LinkBtn>;
  return (
    <Panel title={`Qualify this ${KIND_LABEL[o.kind].toLowerCase()} lead?`} why="" aside={
      <Why title="Lead score" e={leadScore(o.reasons ?? [], s.cfg)} side="bottom" align="end" hover>
        <span className="flex items-center gap-2"><span className="num text-[26px] font-semibold leading-none">{o.score ?? "–"}<span className="text-[12px] font-normal text-muted">/100</span></span>{o.tier && <TierPill tier={o.tier} />}</span>
      </Why>}>
      <div className="rounded-xl border border-line p-3">
        <div className="grid grid-cols-1 items-end gap-3 @2xl:grid-cols-[minmax(0,14rem)_1fr_auto]">
          <Suggest label="Installation type" options={(["NI", "EI", "MOD"] as const).map((k) => ({ value: k, label: TEAM_NAME[k] }))} suggested={nba.team} value={team} why={nba.signals} onChange={(v) => { setTeam(v as typeof team); setPick(""); }} />
          <PersonPick label={`${team} rep`} ranked={ranked} value={owner} onChange={setPick} />
          <Btn disabled={!owner} onClick={() => mutate((st) => { if (iid) A.reassign(st, [iid], owner, by); OP.review(st, o.id, by, { team, owner, note: mode === "note" ? note : "" }); })}><Icon n="check" s={15} /> Qualify for {team}</Btn>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {link("note", "Add a note")}
          {canSendBack && link("back", `Send back to ${first(o.owner)}`)}
          {link("reject", "Reject")}
        </div>
        {mode === "note" && <div className="mt-2"><Field v={note} set={setNote} ph={`Note for ${first(owner)}`} /></div>}
        {mode === "back" && <div className="mt-2 flex flex-wrap gap-2"><div className="min-w-60 flex-1"><Field v={note} set={setNote} ph={`What is missing? ${first(o.owner)} sees this`} /></div><Btn v="ghost" disabled={!note.trim()} onClick={() => mutate((st) => OP.sendBack(st, o.id, by, note))}>Send back</Btn></div>}
        {mode === "reject" && <div className="mt-2 flex flex-wrap items-center gap-3"><Suggest compact options={["Not a real opportunity", "Duplicate of an open deal", "Outside our territory", "Customer already declined"].map((x) => ({ value: x, label: x }))} suggested={rejectHint.value} value={reason} why={rejectHint.why} onChange={setReason} /><Btn v="ghost" onClick={() => mutate((st) => { if (iid) A.notRelevant(st, iid, by, reason); OP.reviewClose(st, o.id, by, reason); })}>Reject the lead</Btn><span className="self-center t-small">The reason teaches the score.</span></div>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 text-[13px] @3xl:grid-cols-2">
        <div className="rounded-xl bg-brand-soft px-3 py-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-brand"><Icon n="sparkle" s={14} /> SHERPA suggests {TEAM_NAME[nba.team]}</div>
          <p className="mt-1">{nba.why}</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted">{[...nba.signals, ...brief.lines].filter((l, i, a) => a.indexOf(l) === i).map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
        <Facts title={o.site ? `Site visit by ${NAMES[o.site.by] ?? o.site.by}${o.scouted && o.scouted.by !== o.site.by ? `, checked by ${first(o.scouted.by)}` : ""}` : `From ${first(r?.reporterId ?? "")}`} rows={facts} cols={2} />
      </div>
    </Panel>
  );
}

/** A count SHERPA prefilled from a record. The technician confirms it, steps it, or counts it from a photo. */
function CountField({ label, fact, value, src, photo, onChange }: { label: string; fact?: CountFact; value: string; src?: string; photo: string; onChange: (v: string, src: string) => void }) {
  const [reading, setReading] = useState(false);
  const n = Number(value) || 0;
  const step = (d: number) => onChange(String(Math.max(0, n + d)), "Corrected on site");
  const fromPhoto = () => { setReading(true); setTimeout(() => { setReading(false); onChange(String(fact?.value ?? Math.max(n, 1)), `Counted from your photo (${photo.toLowerCase()})`); }, 900); };
  const shown = src ?? (fact ? fact.source : "Nothing on record. Count it or take a photo");
  const confirmed = !!src;
  return (
    <div className="rounded-xl border border-line p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] font-medium">{label}</span>
        <button type="button" aria-label={`One less: ${label}`} onClick={() => step(-1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-lg leading-none hover:bg-paper">−</button>
        <span className="num w-10 text-center text-[22px] font-semibold">{value || "–"}</span>
        <button type="button" aria-label={`One more: ${label}`} onClick={() => step(1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-lg leading-none hover:bg-paper">+</button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className={`inline-flex items-center gap-1 ${confirmed ? "text-emerald-700" : "text-muted"}`} title={!confirmed ? fact?.detail : undefined}>
          <Icon n={confirmed ? "check" : "sparkle"} s={12} /> {shown}{!confirmed && fact?.detail ? ` · ${fact.detail}` : ""}
        </span>
        <span className="ml-auto flex gap-1">
          {fact && !confirmed && <LinkBtn onClick={() => onChange(String(fact.value), `${fact.source}, confirmed on site`)}>Looks right</LinkBtn>}
          <label className="cursor-pointer rounded-md px-1.5 py-0.5 font-medium text-brand hover:bg-brand-soft">
            {reading ? "Reading the photo…" : photo}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { if (e.target.files?.length) fromPhoto(); e.target.value = ""; }} />
          </label>
        </span>
      </div>
    </div>
  );
}

/** The site-visit questions, shared by the rep's scouting and a delegated technician visit. */
function SiteForm({ o, cta, onSubmit, children }: { o: Opp; cta: string; onSubmit: (v: Omit<SiteVisit, "by" | "at">) => void; children?: ReactNode }) {
  const { s } = useApp();
  const v0 = o.site;
  const facts = buildingFacts(s, o);
  const [src, setSrc] = useState<{ lifts?: string; floors?: string }>(v0?.src ?? {});
  const [f, setF] = useState({ name: v0?.met.name ?? o.contact?.name ?? "", role: v0?.met.role ?? o.contact?.role ?? "", phone: v0?.met.phone ?? o.contact?.phone ?? "", lifts: v0?.lifts ?? String(facts.lifts?.value ?? ""), floors: v0?.floors ?? String(facts.floors?.value ?? ""), condition: v0?.condition ?? "", decision: v0?.decision ?? "", timeline: v0?.timeline ?? "", competitor: v0?.competitor ?? "", note: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const site = isNI(o);
  const buyHint = suggestBuyPath(s, o, false);
  const buyGuess = buyHint.value === "tender" ? "Formal tender" : "Direct quotation";
  const [buy, setBuy] = useState<string>(v0?.buy ?? (site && !buyHint.unsure ? buyGuess : ""));
  const [tenderFile, setTenderFile] = useState<{ name: string; size: number } | undefined>(v0?.tenderFile); const [noDoc, setNoDoc] = useState(false);
  const tenderNeeded = site && buy === "Formal tender";
  const docSrc = tenderFile ? `Tender document (${tenderFile.name})` : `${facts.lifts?.source ?? "Our records"}; the tender document will confirm`;
  const need = [["the person in charge", f.name && f.role], ["the condition", f.condition], ["who decides", f.decision], ["the timeline", f.timeline], ...(site ? [["tender or quotation", buy] as const] : []), ...(tenderNeeded ? [["the tender document, or Not shared yet", tenderFile || noDoc] as const] : [])] as const;
  const left = need.filter(([, v]) => !v).map(([k]) => k);
  return (
    <div className="space-y-3">
      <Q label="Who is the person in charge?"><div className="grid grid-cols-1 gap-2 @2xl:grid-cols-3"><Field v={f.name} set={set("name")} ph="Name" /><Field v={f.role} set={set("role")} ph="Role, e.g. Facility manager" /><Field v={f.phone} set={set("phone")} ph="Phone" /></div></Q>
      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
        <Q label={site ? "Site readiness" : "Condition of the lifts"}>{CHOICE("condition", site ? ["Early, no shafts yet", "Shafts ready", "Finishing, lifts needed soon"] : ["Good", "Wear and small faults", "Frequent breakdowns", "Out of service"], f.condition, set("condition"))}</Q>
        <Q label="Who decides?">{CHOICE("decision", ["The person I met", "Owner or board", "Developer or contractor", "Not known yet"], f.decision, set("decision"))}</Q>
        <Q label="When do they want to act?">{CHOICE("timeline", ["Now", "Within 3 months", "This year", "No plan yet"], f.timeline, set("timeline"))}</Q>
        {site && <Q label="How will they buy the lifts? Ask the person in charge">
          {CHOICE("buy", ["Formal tender", "Direct quotation", "Not known yet"], buy, setBuy)}
          {buyHint.unsure && !buy && <p className="mt-1 text-[12px] text-muted">{buyHint.why[0]}</p>}
          {!buyHint.unsure && buy === buyGuess && <p className="mt-1 flex items-start gap-1 text-[12px] text-muted"><Icon n="sparkle" s={12} /><span>SHERPA expects a <b className="text-ink">{buyGuess.toLowerCase()}</b>. {buyHint.why.join(" ")}</span></p>}
        </Q>}
        {tenderNeeded && <Q label="Upload the tender document. Ask the person in charge for it">
          {tenderFile ? (
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[13px]"><Icon n="doc" s={16} /><span className="min-w-0 flex-1 truncate"><b>{tenderFile.name}</b> · SHERPA reads it when the bid starts, so the NI rep only answers what it leaves open</span><LinkBtn onClick={() => setTenderFile(undefined)}>Remove</LinkBtn></div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium ${noDoc ? "border-line text-muted" : "border-brand text-brand"}`}>
                <Icon n="doc" s={14} /> Upload the document
                <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setTenderFile({ name: f.name, size: f.size }); setNoDoc(false); } e.target.value = ""; }} />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium">
                <Icon n="camera" s={14} /> Photograph the pages
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { const fs = e.target.files; if (fs?.length) { setTenderFile({ name: `Tender pages (${fs.length} photo${fs.length > 1 ? "s" : ""})`, size: [...fs].reduce((a, f) => a + f.size, 0) }); setNoDoc(false); } e.target.value = ""; }} />
              </label>
              <LinkBtn on={noDoc} onClick={() => setNoDoc(!noDoc)}>Not shared yet</LinkBtn>
            </div>
          )}
          {noDoc && !tenderFile && <p className="mt-1 text-[12px] text-muted">The NI rep uploads it later, when the customer publishes it.</p>}
        </Q>}
      </div>
      {!tenderNeeded && <div className="grid grid-cols-1 gap-2 @3xl:grid-cols-2">
        <CountField label={site ? "Lifts needed" : "Lifts"} fact={facts.lifts} value={f.lifts} src={src.lifts} photo={site ? "Photo of the site board" : "Photo of the lift lobby"} onChange={(v, x) => { set("lifts")(v); setSrc((y) => ({ ...y, lifts: x })); }} />
        <CountField label="Floors" fact={facts.floors} value={f.floors} src={src.floors} photo={site ? "Photo of the site board" : "Photo of the car's button panel"} onChange={(v, x) => { set("floors")(v); setSrc((y) => ({ ...y, floors: x })); }} />
      </div>}
      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
        <Q label={site ? "Any lift supplier on site?" : "Who services them? Is the owner happy?"}><Field v={f.competitor} set={set("competitor")} ph={site ? "e.g. none, or a competitor" : "e.g. local firm, owner unhappy"} /></Q>
        <Q label="Notes for the manager"><Field v={f.note} set={set("note")} ph="Optional" /></Q>
      </div>
      <StickyActions hint={left.length ? `Still needed: ${left.join(", ")}.` : undefined}>
        <Btn disabled={left.length > 0} onClick={() => onSubmit({ met: { name: f.name, role: f.role, phone: f.phone || undefined }, lifts: f.lifts, floors: f.floors, src: tenderNeeded ? { lifts: docSrc, floors: docSrc } : { lifts: src.lifts ?? (facts.lifts ? facts.lifts.source : undefined), floors: src.floors ?? (facts.floors ? facts.floors.source : undefined) }, condition: f.condition, decision: f.decision, timeline: f.timeline, buy: site && buy ? buy as SiteVisit["buy"] : undefined, tenderFile: tenderNeeded ? tenderFile : undefined, competitor: f.competitor, note: f.note })}>{cta}</Btn>{children}
      </StickyActions>
    </div>
  );
}

function ScoutPanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, mutate } = useApp();
  const by = me!.id; const iid = o.source.itemId;
  const techs = rankPeople(s, o, TECHS.map((u) => u.id), "tech");
  const [pickTech, setTech] = useState("");
  const tech = pickTech || techs[0]?.id || "";
  const [again, setAgain] = useState(false);
  const r = s.reports.find((x) => x.id === o.source.reportId);
  const told = (r?.answers ?? []).slice(0, 6).map((a) => [a.q, a.a] as [string, string]);
  const send = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1"><PersonPick label="Technician" ranked={techs} value={tech} onChange={setTech} /></div>
      <Btn disabled={!tech} onClick={() => mutate((st) => OP.delegateVisit(st, o.id, by, tech))}><Icon n="pin" s={15} /> Send {NAMES[tech]?.split(" ")[0] ?? "the technician"}</Btn>
    </div>
  );
  if (!o.site) return (
    <Panel title={t.title} why="" does="Sends a field technician to meet the person in charge and check the lifts or the site." then={`The report comes back to you. You check it and send it to ${NAMES[MANAGER_ID]}.`}>
      {send}
      {told.length > 0 && <div className="mt-3"><Facts title={`What ${NAMES[r!.reporterId]?.split(" ")[0] ?? "the reporter"} told us`} rows={told} cols={3} /></div>}
    </Panel>
  );
  return (
    <Panel title={t.title} why="" does="Saves the visit with your corrections. SHERPA scores the lead out of 100 with the reasons." then={`At ${reviewMin(s)} or more it goes to ${NAMES[MANAGER_ID]}, who decides the installation type with SHERPA's suggestion and assigns the team rep. Below that it waits in nurture.`}>
      {told.length > 0 && <div className="mb-3"><Facts title={`What ${NAMES[r!.reporterId]?.split(" ")[0] ?? "the reporter"} told us`} rows={told} cols={3} /></div>}
      <SiteForm o={o} cta="Send to the Sales Manager" onSubmit={(v) => mutate((st) => { const it = iid ? st.reports.flatMap((x) => x.items).find((x) => x.id === iid) : undefined; if (it && it.status === "new") A.accept(st, it.id, by); if (iid) A.visit(st, iid, by, v.note || `Site visit checked: met ${v.met.name}`); OP.scout(st, o.id, by, v); })}>
        <LinkBtn on={again} onClick={() => setAgain(!again)}>Send the technician again</LinkBtn>
      </SiteForm>
      {again && <div className="mt-3">{send}</div>}
    </Panel>
  );
}

function GenQuotePanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, mutate } = useApp();
  const of = offerOf(s, o.offerId); const b = of?.brief;
  if (!of) return null;
  return (
    <Panel title={t.title} why="" does="The Pricing Expert agent prices and drafts the quotation from the rep's answers and recent wins in the area." then="You follow its progress. When it is ready, you set the discount and send it.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn onClick={() => mutate((st) => OP.genQuote(st, o.id, me!.id))}><Icon n="sparkle" s={15} /> Generate quotation</Btn>
        <span className="t-small">The Pricing Expert agent drafts it. You follow its progress here.</span>
      </div>
      <Facts title={`Gathered by ${NAMES[o.owner] ?? o.owner}`} cols={4} rows={[["Offer", `${PRODUCT[of.product].label}${PRODUCT[of.product].yearly ? `, ${of.term} years` : ""}`], ...(b ? [["Floors", b.floors], ["Load", b.load], ["Speed", b.speed], [of.product === "modernisation" ? "Scope" : "Finish", b.finish], ["Needed", b.timeline], ["Also include", b.extras]] as [string, string][] : [])]} />
    </Panel>
  );
}

export function bidInfoRows(s: State, tn: Tender): [string, ReactNode][] {
  const d = tn.draft;
  return [
    ["Tender", `${tn.id} · ${tn.name}`], ["Lifts", String(tn.lifts)], ["List value", chf(tn.value)], ["Bid due", `in ${Math.max(0, daysTo(s, tn.eord))} days`],
    ["Tender document", tn.doc ? `${tn.doc.name} · ${tn.doc.found.length} facts read` : "Not shared yet"],
    ...(tn.doc?.gaps.filter((g) => g.a).map((g) => [g.q.replace(/\?$/, ""), g.a!] as [string, ReactNode]) ?? []),
    ...(d?.priority ? [["Customer cares most about", d.priority] as [string, ReactNode]] : []),
    ...(d?.rivals ? [["Also bidding", d.rivals] as [string, ReactNode]] : []),
    ...(d?.note ? [["For the legal team", d.note] as [string, ReactNode]] : []),
  ];
}

function BidInfoPanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, mutate } = useApp();
  const tn = tenderOf(s, o.tenderId);
  const [ans, setAns] = useState<Record<string, string>>(() => Object.fromEntries((tn?.doc?.gaps ?? []).map((g) => [g.key, g.a ?? ""])));
  const [f, setF] = useState({ priority: tn?.draft?.priority ?? "", rivals: tn?.draft?.rivals ?? (/^none/i.test(o.site?.competitor ?? "") ? "" : o.site?.competitor ?? ""), note: tn?.draft?.note ?? "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  if (!tn) return null;
  const upload = (file?: File) => { if (file) mutate((st) => OP.tenderDoc(st, tn.id, me!.id, { name: file.name, size: file.size })); };
  const gaps = tn.doc?.gaps ?? [];
  const left = [...(!tn.doc ? ["the tender document"] : []), ...gaps.filter((g) => !ans[g.key]).map((g) => g.q.replace(/\?$/, "").toLowerCase()), ...(!f.priority ? ["what the customer cares about"] : [])];
  return (
    <Panel title={t.title} why={t.detail ?? ""} does={`Adds your answers to the deal and tells ${NAMES[MANAGER_ID]?.split(" ")[0]} it is ready.`} then={`${NAMES[MANAGER_ID]} starts the bid. The legal team builds it from the tender document and your answers.`}>
      <div className="space-y-4">
        {!tn.doc ? (
          <Q label="Upload the tender document. SHERPA reads it and asks only what it leaves open">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-line px-3 py-3 text-[13px] font-semibold hover:bg-surface"><Icon n="upload" s={16} /> Upload the document<input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} /></label>
          </Q>
        ) : (
          <Fold title={`Already on the deal: ${tn.doc.name}, read by SHERPA`} count={`${tn.doc.found.length} facts`}><Facts cols={3} rows={tn.doc.found.map((x) => [x.label, x.value] as [string, ReactNode])} /></Fold>
        )}
        {gaps.length > 0 && <div className="space-y-3">{gaps.map((g) => <Q key={g.key} label={`${g.q} The document does not say`}>{CHOICE(g.key, g.opts, ans[g.key] ?? "", (v) => setAns((a) => ({ ...a, [g.key]: v })))}</Q>)}</div>}
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          <Q label="What does the customer care about most?">{CHOICE("priority", ["Price", "Delivery date", "Energy use", "Design", "Service after hand-over"], f.priority, set("priority"))}</Q>
          <Q label="Who else is bidding?"><Field v={f.rivals} set={set("rivals")} ph={o.site?.competitor ? "" : "Optional"} /></Q>
        </div>
        <Q label="Anything else for the legal team"><Field v={f.note} set={set("note")} ph="Optional: site access, delivery, contacts, deadlines" /></Q>
      </div>
      <StickyActions hint={left.length ? <>Still needed: {left.join(", ")}</> : undefined}>
        <Btn disabled={left.length > 0} onClick={() => mutate((st) => OP.submitBid(st, tn.id, me!.id, { answers: ans, priority: f.priority, rivals: f.rivals.trim(), note: f.note.trim() }))}><Icon n="check" s={15} /> Ready for {NAMES[MANAGER_ID]?.split(" ")[0]} to start the bid</Btn>
      </StickyActions>
    </Panel>
  );
}

const PRICING_STEPS = ["Reading the gathered information", "Comparing recent wins in the area", "Pricing the lifts and options", "Writing the quotation", "Quotation ready to check"];
export function pricingSteps(of: Offer, now: number): { label: string; done: boolean; at?: number }[] {
  const p = of.pricing!; const span = (p.readyAt - p.startedAt) / (PRICING_STEPS.length - 1);
  return PRICING_STEPS.map((label, i) => { const at = i === PRICING_STEPS.length - 1 ? p.readyAt : p.startedAt + span * i; return { label, done: now >= at, at: now >= at ? at : undefined }; });
}

export function PricingStatus({ of }: { of: Offer }) {
  const { now } = useApp(); const steps = pricingSteps(of, now);
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <Progress steps={steps} />
      <ol className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] @3xl:grid-cols-5">{steps.map((x) => <li key={x.label} className="flex items-start gap-2"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${x.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line"}`}>{x.done && <Icon n="check" s={9} w={4} />}</span><span className={x.done ? "" : "text-muted"}>{x.label}{x.at && <span className="block text-[11px] text-muted">{ago(now - x.at)}</span>}</span></li>)}</ol>
    </div>
  );
}

function PricingPanel({ o }: { o: Opp; t: Task }) {
  const { s, mutate } = useApp(); const of = offerOf(s, o.offerId);
  if (!of) return null;
  return (
    <Panel title={`The Pricing Expert agent is drafting ${of.id}`} why="" does="Shows the agent's progress. Nothing for you to do yet." then="When it is ready, set the discount and send it.">
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[13px] font-medium">Drafting the quotation from {NAMES[o.owner]?.split(" ")[0] ?? "the rep"}&rsquo;s answers.</span><LinkBtn onClick={() => mutate((st) => OP.pricingReady(st, of.id))}>Pricing agent finished (demo)</LinkBtn></div>
      <PricingStatus of={of} />
    </Panel>
  );
}

function GenBidPanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, mutate } = useApp();
  const tn = tenderOf(s, o.tenderId);
  const [discPick, setDisc] = useState(""); const [back, setBack] = useState(""); const [open, setOpen] = useState(false);
  if (!tn) return null;
  const hint = suggestDiscount(s, o, "newinstall", [0, 4, 6, 8, 10, 12, 15]);
  const disc = discPick || String(hint.value);
  return (
    <Panel title={t.title} why="" does="Start the bid hands everything below to the legal team. They build the bid outside SHERPA." then="You follow their progress here, download the final bid, take part in the tender and record the result.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Suggest compact options={["0", "4", "6", "8", "10", "12", "15"].map((d) => ({ value: d, label: `${d}% off` }))} suggested={String(hint.value)} value={disc} why={hint.why} onChange={setDisc} />
        <Btn onClick={() => mutate((st) => OP.genBid(st, tn.id, me!.id, Number(disc)))}><Icon n="sparkle" s={15} /> Start the bid</Btn>
        <LinkBtn on={open} onClick={() => setOpen(!open)}>Ask {NAMES[o.owner]?.split(" ")[0]} for more</LinkBtn>
      </div>
      {open && <div className="mb-3 flex flex-wrap gap-2"><div className="min-w-60 flex-1"><Field v={back} set={setBack} ph="What is missing?" /></div><Btn v="ghost" disabled={!back.trim()} onClick={() => mutate((st) => OP.bidChanges(st, tn.id, me!.id, back))}>Send back</Btn></div>}
      <Facts title={`Gathered by ${NAMES[tn.draft?.by ?? o.owner] ?? o.owner}`} cols={4} rows={bidInfoRows(s, tn)} />
    </Panel>
  );
}

const LEGAL_STEPS = ["Handed to the legal team", "Tender documents checked", "Technical compliance and drawings", "Price sheet and company papers", "Signed and submitted in the tender"];
export function legalSteps(t: Tender, now: number): { label: string; done: boolean; at?: number }[] {
  const l = t.legal!; const span = (l.readyAt - l.sentAt) / (LEGAL_STEPS.length - 1);
  return [
    ...LEGAL_STEPS.slice(0, -1).map((label, i) => { const at = l.sentAt + span * i; return { label, done: now >= at, at: now >= at ? at : undefined }; }),
    { label: LEGAL_STEPS[LEGAL_STEPS.length - 1], done: !!l.submittedAt, at: l.submittedAt },
  ];
}

function Progress({ steps }: { steps: { done: boolean }[] }) {
  const pct = Math.round((steps.filter((x) => x.done).length / steps.length) * 100);
  return <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div><span className="num text-[12.5px] font-semibold">{pct}%</span></div>;
}

function LegalStatus({ t, bare }: { t: Tender; bare?: boolean }) {
  const { now } = useApp();
  const body = (
    <>
      <Progress steps={legalSteps(t, now)} />
      <ol className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] @3xl:grid-cols-3">{legalSteps(t, now).map((x) => <li key={x.label} className="flex items-start gap-2"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${x.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line"}`}>{x.done && <Icon n="check" s={9} w={4} />}</span><span className={x.done ? "" : "text-muted"}>{x.label}{x.at && <span className="block text-[11px] text-muted">{ago(now - x.at)}</span>}</span></li>)}</ol>
      <p className="t-small mt-2">The legal team works outside SHERPA; their progress shows here.</p>
    </>
  );
  return bare ? <div className="rounded-xl border border-line px-3 py-2.5">{body}</div> : <Card className="p-4"><Label>Bid with the legal team</Label>{body}</Card>;
}

function BidResultPanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, mutate } = useApp();
  const tn = tenderOf(s, o.tenderId); const [lost, setLost] = useState(false); const [whyPick, setWhy] = useState("");
  const lossHint = suggestLossReason(s, o, ["Price", "Competitor spec", "Delivery time", "Relationship", "Tender cancelled"]); const why = whyPick || lossHint.value;
  if (!tn?.legal) return null;
  const submitted = !!tn.legal.submittedAt; const iid = o.source.itemId; const by = me!.id;
  return (
    <Panel title={t.title} why="" does={submitted ? "Record the tender result." : "Shows the legal team's progress. They build the bid and submit it in the tender."} then="Won: the Contract agent drafts the contract. Lost: the reason is kept for Win/Loss Insights.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!submitted && <><span className="text-[13px] font-medium">The legal team is building and submitting the bid. Nothing for you to do yet.</span><LinkBtn onClick={() => mutate((st) => OP.legalReady(st, tn.id))}>Legal submitted the bid (demo)</LinkBtn></>}
        {submitted && <>
          <Btn onClick={() => mutate((st) => { OP.bidResult(st, tn.id, by, "won"); if (iid) A.outcome(st, iid, by, "won"); })}><Icon n="trophy" s={15} /> Won</Btn>
          <Btn v="ghost" onClick={() => setLost(!lost)}>Lost</Btn>
        </>}
      </div>
      {lost && <div className="mb-3 flex flex-wrap items-center gap-3"><Suggest compact options={["Price", "Competitor spec", "Delivery time", "Relationship", "Tender cancelled"].map((x) => ({ value: x, label: x }))} suggested={lossHint.value} value={why} why={lossHint.why} onChange={setWhy} /><Btn v="ghost" onClick={() => mutate((st) => { OP.bidResult(st, tn.id, by, "lost", why); if (iid) A.outcome(st, iid, by, "lost"); })}>Record the loss</Btn><span className="t-small">Kept for Win/Loss Insights.</span></div>}
      <LegalStatus t={tn} bare />
    </Panel>
  );
}

function FollowupPanel({ o, t, openOffer }: { o: Opp; t: Task; openOffer: (id: string) => void }) {
  const { s, me, now, mutate } = useApp();
  const of = offerOf(s, o.offerId); const [no, setNo] = useState(false); const [whyPick, setWhy] = useState("");
  const noHint = suggestLossReason(s, o, ["Price", "Chose a competitor", "Project on hold", "No budget"]); const why = whyPick || noHint.value;
  if (!of) return null;
  const idle = of.sentAt ? Math.floor((now - of.lastActivity) / 86400000) : 0;
  const by = me!.id; const iid = o.source.itemId;
  return (
    <Panel title={t.title} why={idle >= 14 ? `Nothing for ${idle} days. SHERPA suggests a reminder, or asking ${NAMES[of.createdBy]?.split(" ")[0]} for a revised offer.` : ""} does="Record what the customer said, or send a reminder." then="Approved: the Contract agent drafts the contract. A no is kept with its reason.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn onClick={() => mutate((st) => { SH.outcome(st, of.id, by, "won"); if (iid) A.outcome(st, iid, by, "won"); })}><Icon n="check" s={15} /> Customer approved</Btn>
        <Btn v="ghost" onClick={() => mutate((st) => SH.chase(st, of.id, by))}>Send a reminder</Btn>
        <LinkBtn onClick={() => openOffer(of.id)}>Open {of.id}</LinkBtn>
        <LinkBtn on={no} onClick={() => setNo(!no)}>Customer said no</LinkBtn>
      </div>
      {no && <div className="mb-3 flex flex-wrap items-center gap-3"><Suggest compact options={["Price", "Chose a competitor", "Project on hold", "No budget"].map((x) => ({ value: x, label: x }))} suggested={noHint.value} value={why} why={noHint.why} onChange={setWhy} /><Btn v="ghost" onClick={() => mutate((st) => { SH.outcome(st, of.id, by, "lost", why); if (iid) A.outcome(st, iid, by, "lost"); })}>Record the no</Btn></div>}
      <Facts cols={4} rows={[["Offer", `${PRODUCT[of.product].label}${PRODUCT[of.product].yearly ? `, ${of.term} years` : ""}`], ["Price", chf(of.price)], ["Discount", `${of.discountPct}%`], ["Sent", of.sentAt ? `${ago(now - of.sentAt)} by ${NAMES[of.createdBy]?.split(" ")[0] ?? of.createdBy}` : "–"]]} />
    </Panel>
  );
}

function SitePanel({ o, t }: { o: Opp; t: Task }) {
  const { me, mutate } = useApp();
  return (
    <Panel title={t.title} why={`${t.detail ?? ""}`} does="Files your report on the lead." then={`${NAMES[o.owner]} checks it and sends it to ${NAMES[MANAGER_ID]}. SHERPA suggests the installation type from your report.`}>
      <SiteForm o={o} cta="File the site-visit report" onSubmit={(v) => mutate((st) => { const iid = o.source.itemId; if (iid) A.visit(st, iid, me!.id, v.note || `Site visit: met ${v.met.name}`); OP.siteVisit(st, o.id, me!.id, v); })} />
    </Panel>
  );
}

function DealPanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, mutate } = useApp();
  const matches = accountMatches(s, o);
  const [acc, setAcc] = useState(matches[0]?.id ?? "new");
  const buyHint = suggestBuyPath(s, o);
  const [pathPick, setPath] = useState<"" | "tender" | "direct">(""); const path = pathPick || buyHint.value;
    const by = me!.id;
  const newbuild = o.kind === "newbuild" || o.kind === "project";
  const nbas = newbuild ? [] : dealNbas(s, o);
  const go = (path: "tender" | "direct" | "notfit", extra: { product?: Parameters<typeof OP.setupDeal>[3]["product"]; term?: number; discountPct?: number; nba?: string } = {}) => mutate((st) => OP.setupDeal(st, o.id, by, { accountId: acc, path, eordDays: 30, ...extra }));
  const option = (key: string, title: ReactNode, why: ReactNode, action: ReactNode, top = false) => (
    <div key={key} className={`flex flex-col gap-2 rounded-xl border p-3 text-[13px] @2xl:flex-row @2xl:items-center ${top ? "border-brand/40 bg-brand-soft/40" : "border-line"}`}>
      <div className="min-w-0 flex-1"><b className="block text-[14px]">{title}</b><span className="text-muted">{why}</span></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
    </div>
  );
  return (
    <Panel title={t.title} why="" does={newbuild ? "Tender: upload the tender document and fill what it leaves open. Quotation: answer SHERPA's checklist." : "Sends the offer you pick to the Sales Manager, who generates the quotation."} then={`${NAMES[MANAGER_ID]} generates the ${newbuild ? "bid or quotation" : "quotation"} from what you gather and sends it.`}>
      <div className="space-y-2">
        {newbuild ? (() => {
          const tender = path === "tender";
          return option("path", <Suggest options={[{ value: "tender", label: "Formal tender" }, { value: "direct", label: "Quotation" }]} suggested={buyHint.value} value={path} why={buyHint.why} onChange={(v) => setPath(v as "tender" | "direct")} />,
            tender ? "Several companies bid by a last date. Upload the tender document next; SHERPA reads the due date and what it leaves open." : "We quote the customer directly. SHERPA asks only what the site visit didn't answer.",
            <Btn onClick={() => go(path)}>{tender ? "Start the bid" : "Start the quotation"}</Btn>, true);
        })()
        : o.kind === "modernisation" ? (
          option("mod", "Modernisation quotation", `SHERPA asks about floors, load, speed and scope${o.site ? `, using ${NAMES[o.site.by]?.split(" ")[0]}'s visit` : ""}.`, <Btn onClick={() => go("direct")}>Start the quotation</Btn>, true)
        ) : nbas.map((n, i) => option(n.key, n.title, <>{n.why} <span className="text-ink">{PRODUCT[n.product].label}{PRODUCT[n.product].yearly ? `, ${n.term} year${n.term > 1 ? "s" : ""}` : ""}{n.discountPct ? `, ${n.discountPct}% off` : ""}.</span></>, <Btn v={i === 0 ? "primary" : "ghost"} onClick={() => go("direct", { product: n.product, term: n.term, discountPct: n.discountPct, nba: n.title })}>Pick this offer</Btn>, i === 0))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Suggest label="Customer" options={[...matches.map((a) => ({ value: a.id, label: a.name, note: "existing customer" })), { value: "new", label: `New customer: ${o.placeName}` }]} suggested={matches[0]?.id ?? "new"} value={acc} why={matches[0] ? [`Same ${matches[0].placeIds.length ? "building" : "name"} as ${matches[0].name} in our records`, `Owner: ${NAMES[matches[0].owner] ?? matches[0].owner}`] : ["No customer at this place or with this name in our records"]} onChange={setAcc} />
        <LinkBtn onClick={() => go("notfit")}>Not a fit: close the lead</LinkBtn>
      </div>
    </Panel>
  );
}

function QuotePanel({ o, t }: { o: Opp; t: Task }) {
  const { me, mutate } = useApp();
  const mod = o.kind === "modernisation";
  const [f, setF] = useState({ floors: (o.site?.floors ?? "").replace(/\D+/g, ""), load: "", speed: "", finish: "", timeline: o.site?.timeline ?? "", extras: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const left = ([["floors", f.floors], ["load", f.load], ["speed", f.speed], [mod ? "scope" : "finish", f.finish], ["timeline", f.timeline]] as const).filter(([, v]) => !v).map(([k]) => k);
  return (
    <Panel title={t.title} why={o.site ? `Some answers come from ${NAMES[o.site.by]}'s site visit.` : ""} does="Sends your answers to the Sales Manager." then={`${NAMES[MANAGER_ID]} generates the quotation: the Pricing Expert agent prices it from your answers and recent wins.`}>
      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
        <Q label="Rated load">{CHOICE("load", ["630 kg (8 persons)", "1,000 kg (13 persons)", "1,350 kg (20 persons)"], f.load, set("load"))}</Q>
        <Q label="Speed">{CHOICE("speed", ["1.0 m/s", "1.75 m/s", "2.5 m/s"], f.speed, set("speed"))}</Q>
        <Q label={mod ? "Scope" : "Cabin finish"}>{CHOICE("finish", mod ? ["Controller and drive", "Full replacement", "Doors and cabin"] : ["Stainless steel", "Mirror steel", "Painted"], f.finish, set("finish"))}</Q>
        <Q label="When does the customer need it?">{CHOICE("timeline", ["Now", "Within 3 months", "This year", "No plan yet"], f.timeline, set("timeline"))}</Q>
        <Q label="Floors served"><Field v={f.floors} set={set("floors")} ph="e.g. 13" /></Q>
        <Q label="Anything else to include?"><Field v={f.extras} set={set("extras")} ph="e.g. 2 years free maintenance" /></Q>
      </div>
      <StickyActions hint={left.length ? `Still needed: ${left.join(", ")}.` : undefined}>
        <Btn disabled={left.length > 0} onClick={() => mutate((st) => OP.quoteBrief(st, o.id, me!.id, f))}><Icon n="send" s={15} /> Send to {NAMES[MANAGER_ID]?.split(" ")[0]}</Btn>
      </StickyActions>
    </Panel>
  );
}

function ContractCard({ id, openOffer }: { id: string; openOffer: (id: string) => void }) {
  const { s } = useApp();
  const c = s.sherpa.contracts.find((x) => x.id === id); if (!c) return null;
  return <Card className="p-5"><Label>Contract</Label><ContractBox c={c} open={() => openOffer(c.id)} /></Card>;
}

function siteFacts(o: Opp): [string, string][] {
  const v = o.site; if (!v) return [];
  const met = [v.met.name, v.met.role].filter(Boolean).join(", ");
  return ([["Met", `${met}${v.met.phone ? ` · ${v.met.phone}` : ""}`], ["Lifts", v.lifts && `${v.lifts}${v.src?.lifts ? ` · ${v.src.lifts}` : ""}`], ["Floors", v.floors && `${v.floors}${v.src?.floors ? ` · ${v.src.floors}` : ""}`], ["Condition", v.condition], ["Who decides", v.decision], ["Timeline", v.timeline], ["How they buy", v.buy ?? ""], ["Tender document", v.tenderFile ? `${v.tenderFile.name} (from the site visit)` : ""], ["Supplier or servicer", v.competitor]] as [string, string][]).filter(([, x]) => x && x.trim() && x !== "–");
}
function SiteCard({ o }: { o: Opp }) {
  const v = o.site!;
  const rows = siteFacts(o);
  return (
    <Card className="p-5">
      <Label>Site visit by {NAMES[v.by] ?? v.by}</Label>
      <div className="rounded-xl border border-line px-4 text-[13.5px]">{rows.map(([k, x]) => <div key={k} className="flex justify-between gap-4 border-b border-line/70 py-2.5 last:border-0"><span className="text-muted">{k}</span><span className="text-right font-medium">{x}</span></div>)}</div>
    </Card>
  );
}

function Notes({ o }: { o: Opp }) {
  const { me, now, mutate } = useApp();
  const [text, setText] = useState("");
  const notes = [...(o.notes ?? [])].reverse();
  return (
    <Card className="p-5">
      <Label>Notes</Label>
      <form onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; mutate((st) => OP.note(st, o.id, me!.id, text)); setText(""); }} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note for everyone on this deal" aria-label="Add a note" className="min-w-0 flex-1" />
        <Btn type="submit" disabled={!text.trim()}>Add</Btn>
      </form>
      {notes.length > 0 && <ol className="mt-3 space-y-2.5 text-[13px]">{notes.map((n, k) => <li key={k} className="rounded-lg bg-surface px-3 py-2">{n.text}<span className="block text-xs text-muted">{n.by} · {ago(now - n.t)}</span></li>)}</ol>}
    </Card>
  );
}
