"use client";
import { useApp } from "@/lib/store";
import { contractSteps } from "@/lib/contracts";
import { accountOf, chf, oppOf } from "@/lib/sherpa";
import type { Contract } from "@/lib/types";
import { Card, Icon, Pill, ago } from "../ui";
import { Fold, Label } from "./Action";
import { Facts } from "./Step";

const fmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ContractPill({ c }: { c: Contract }) {
  return c.status === "active" ? <Pill tone="green">Signed</Pill> : <Pill tone="blue">With the Contract agent</Pill>;
}

export function ContractStatus({ c }: { c: Contract }) {
  const { now } = useApp();
  const steps = contractSteps(c, now);
  const pct = Math.round((steps.filter((x) => x.done).length / steps.length) * 100);
  return (
    <div>
      <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div><span className="num text-[12.5px] font-semibold">{pct}%</span></div>
      <ol className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] @3xl:grid-cols-5">{steps.map((x) => (
        <li key={x.label} className="flex items-start gap-2"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${x.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line"}`}>{x.done && <Icon n="check" s={9} w={4} />}</span><span className={x.done ? "" : "text-muted"}>{x.label}{x.at && <span className="block text-[11px] text-muted">{ago(now - x.at)}</span>}</span></li>
      ))}</ol>
    </div>
  );
}

/** Everything about one contract in one place: what was agreed, then where the Contract agent is with it. */
export function ContractBox({ c, open }: { c: Contract; open?: () => void }) {
  const { s, now } = useApp();
  const acc = accountOf(s, c.accountId);
  const rows: [string, React.ReactNode][] = [
    ["Value", chf(c.value)], ["Term", c.term > 1 ? `${c.term} years` : "One-off"], ["Starts", fmt(c.start)],
    ["Payment", c.payment.map((p) => `${p.pct}% ${p.label.toLowerCase()}`).join(", ")], ["Scope", c.scope.join("; ")], ["Signer", acc?.contact.name ?? "Not known"],
  ];
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-muted">{c.id}</span><ContractPill c={c} /><b className="text-[14px]">{c.title}</b>{open && <button onClick={open} className="ml-auto text-xs font-semibold text-brand hover:underline">History</button>}</div>
      <Facts cols={3} rows={rows} />
      <div className="mt-4"><ContractStatus c={c} /></div>
      {c.status === "active" && <p className="t-small mt-3">Signed by {c.signedBy} {ago(now - (c.signedAt ?? now))}. The deal is won and the hand-over has started.</p>}
    </div>
  );
}

export function ContractPage({ id, openOpp }: { id: string; openOpp?: (id: string) => void }) {
  const { s, now } = useApp();
  const c = s.sherpa.contracts.find((x) => x.id === id);
  if (!c) return <div className="p-8 text-sm text-muted">Contract not found.</div>;
  const o = oppOf(s, c.oppId);
  return (
    <div className="space-y-5 p-4 @2xl:p-6">
      {o && <button onClick={() => openOpp?.(o.id)} className="text-xs font-semibold text-brand hover:underline">Open the deal</button>}
      <ContractBox c={c} />
      <Card className="p-5">
        <Label>History</Label>
        <ol className="space-y-3 text-[13px]">{[...c.log].reverse().map((l, k) => <li key={k} className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>{l.text}<span className="block text-xs text-muted">{l.by} · {ago(now - l.t)}</span></span></li>)}</ol>
      </Card>
    </div>
  );
}

export function Contracts({ openOffer }: { openOffer: (id: string) => void }) {
  const { s } = useApp();
  const latest = [...s.sherpa.contracts].sort((x, y) => y.log[y.log.length - 1].t - x.log[x.log.length - 1].t);
  const open = latest.filter((c) => c.status !== "active");
  const signed = latest.filter((c) => c.status === "active");
  const row = (c: Contract) => (
    <button key={c.id} onClick={() => openOffer(c.id)} className="sheet group flex w-full items-center gap-3 p-4 text-left hover:bg-surface">
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-bold text-muted">{c.id}</span><ContractPill c={c} /></span><span className="mt-1 block truncate text-[15px] font-semibold">{c.title}</span><span className="t-small">{chf(c.value)}</span></span>
      <Icon n="chev" s={16} />
    </button>
  );
  return (
    <div className="p-4 @2xl:p-8">
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Contracts</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Every accepted offer or won bid goes to the Contract agent. It drafts the contract, checks the terms and gets it signed; here you follow its progress.</p>
      <div className="mt-5 space-y-2.5">
        {open.length === 0 && <div className="sheet p-8 text-center text-sm text-muted">No contracts in progress. A contract starts when a customer accepts an offer.</div>}
        {open.map(row)}
      </div>
      {signed.length > 0 && <div className="mt-4"><Fold title="Signed" count={String(signed.length)}><div className="space-y-2.5">{signed.map(row)}</div></Fold></div>}
    </div>
  );
}
