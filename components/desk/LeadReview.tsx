"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { NAMES, OP, oppOf, reviewMin, tasksOfOpp } from "@/lib/sherpa";
import type { Opp, Tier } from "@/lib/types";
import { ago } from "../ui";
import { Drawer, Stat2, StatRow, T } from "../shared";
import { OppPage } from "./Opps";
import { OppBrowser } from "./OppBrowser";
import { Why } from "../Why";
import { leadScore } from "@/lib/scores";


export function LeadReview({ openOffer, onAsk }: { openOffer: (id: string) => void; onAsk: (o: Opp) => void }) {
  const { s, me, now, mutate } = useApp();
  const [tier, setTier] = useState<Tier | "all">("all");
  const [show, setShow] = useState<"review" | "approvals" | "approved" | "nurture" | "scouting">("review");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? oppOf(s, openId) : undefined;
  const all = s.sherpa.opps.filter((o) => o.stage === "review").sort((a, b) => b.createdAt - a.createdAt);
  const approved = s.sherpa.opps.filter((o) => ["snap", "campaign", "account"].includes(o.source.type) && o.stage !== "review").sort((a, b) => Math.max(...b.log.map((l) => l.t), b.createdAt) - Math.max(...a.log.map((l) => l.t), a.createdAt));
  const approvals = s.sherpa.opps.filter((o) => o.stage !== "review" && tasksOfOpp(s, o.id).some((x) => x.forUser === me!.id)).sort((a, b) => Math.max(...b.log.map((l) => l.t), b.createdAt) - Math.max(...a.log.map((l) => l.t), a.createdAt));
  const nurture = s.sherpa.opps.filter((o) => o.stage === "nurture").sort((a, b) => b.createdAt - a.createdAt);
  const scouting = s.sherpa.opps.filter((o) => o.stage === "scout").sort((a, b) => b.createdAt - a.createdAt);
  const rows = show === "approvals" ? approvals : show === "approved" ? approved : show === "nurture" ? nurture : show === "scouting" ? scouting : all.filter((o) => tier === "all" || o.tier === tier);
  const count = (t: Tier) => all.filter((o) => o.tier === t).length;
  const oldest = all.reduce((m, o) => Math.min(m, o.createdAt), now);
  const done = approved.length;
  return (
    <div className="@container w-full p-4 @3xl:p-6">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Lead review</h1>
      <p className="t-small mt-0.5">Leads a technician has visited and the area rep has checked, scored {reviewMin(s)} or more. Qualify each one and assign the NI, EI or MOD rep, send it back to the area rep, or reject it.</p>
      <StatRow>
        <Stat2 icon="warn" label="Waiting for review" value={all.length} tone={T.orange} active={show === "review" && tier === "all"} onClick={() => { setShow("review"); setTier("all"); }} />
        <Stat2 icon="bolt" label="Hot" value={count("Hot")} tone={T.red} active={show === "review" && tier === "Hot"} onClick={() => { setShow("review"); setTier("Hot"); }} />
        <Stat2 icon="clock" label="Warm" value={count("Warm")} tone={T.gold} active={show === "review" && tier === "Warm"} onClick={() => { setShow("review"); setTier("Warm"); }} />
        <Stat2 icon="layers" label="Cold" value={count("Cold")} tone={T.blue} active={show === "review" && tier === "Cold"} onClick={() => { setShow("review"); setTier("Cold"); }} />
        <Stat2 icon="search" label="Being scouted" value={scouting.length} tone={T.blue} active={show === "scouting"} onClick={() => setShow("scouting")} />
        <Stat2 icon="clock" label={`Nurture (below ${reviewMin(s)})`} value={nurture.length} tone={T.grey} active={show === "nurture"} onClick={() => setShow("nurture")} />
        <Stat2 icon="flag" label="Needs my approval" value={approvals.length} tone={T.purple} active={show === "approvals"} onClick={() => setShow("approvals")} />
        <Stat2 icon="check" label="Approved" value={done} tone={T.green} active={show === "approved"} onClick={() => setShow("approved")} />
      </StatRow>
      {all.length > 0 && <p className="t-small mt-3">Oldest waiting {ago(now - oldest)}.</p>}
      <OppBrowser key={show} rows={rows} onOpen={setOpenId} onAsk={onAsk} empty={show === "nurture" ? "Nothing in nurture." : show === "scouting" ? "No lead is being scouted." : show === "approvals" ? "Nothing is waiting for your approval." : show === "approved" ? "No approved leads yet." : all.length ? "No leads in this tier." : "Every lead is reviewed. New ones land here as soon as they are reported."} />
      {open && <Drawer label={`Lead review · ${open.id}`} title={open.placeName} onClose={() => setOpenId(null)}>{open.stage === "nurture" && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3 text-[13px]"><span className="flex-1">Scored {open.score}, below {reviewMin(s)}. Scouted by {NAMES[open.owner] ?? open.owner}. SHERPA scores it again when something new comes in.</span><button onClick={() => mutate((st) => OP.toReview(st, open.id, me!.id))} className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">Review it anyway</button></div>}<OppPage embedded id={open.id} onBack={() => setOpenId(null)} openOffer={openOffer} /></Drawer>}
    </div>
  );
}
