"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { AREA_NAME, BID_PAPERS, DAY, NAMES, OP, PRODUCT, accountOf, chf, lastLoss, listPrice, offerOf, suggestDiscount, suggestTerm, tenderOf } from "@/lib/sherpa";
import type { Opp, ProductKey, Task } from "@/lib/types";
import { Btn, Card, Icon, ago } from "../ui";
import { Input } from "@/components/form";
import { Label } from "./Action";
import { Facts, Panel, Suggest } from "./Step";

const day = (t: number) => new Date(t).toLocaleDateString("en-GB");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const fromIso = (v: string) => new Date(`${v}T09:00:00`).getTime();

export function LossMemory({ o }: { o: Opp }) {
  const { s, now } = useApp();
  const l = lastLoss(s, o);
  if (!l) return null;
  return <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-[13.5px] text-amber-900"><Icon n="warn" s={16} /><span><b>Why we lost here last time:</b> {l.reason}<span className="block text-[12px] opacity-80">{l.title} · {ago(now - l.at)}</span></span></div>;
}

export function HandoverPack({ o, bare }: { o: Opp; bare?: boolean }) {
  const { s } = useApp();
  const c = s.sherpa.contracts.find((x) => x.id === o.contractId && (x.status === "active" || x.signedAt));
  if (!c) return null;
  const acc = accountOf(s, o.accountId); const tn = tenderOf(s, o.tenderId); const of = offerOf(s, o.offerId);
  const lifts = tn?.lifts ?? o.site?.lifts; const floors = o.site?.floors;
  const papers = [`${c.id}-signed.pdf`, ...(tn?.doc ? [tn.doc.name] : []), ...(tn ? BID_PAPERS.map((p) => p.title) : []), ...(of?.attachment ? [of.attachment] : [])];
  const rows: [string, string][] = [
        ["Customer", acc?.name ?? o.placeName],
        ["Site", `${o.placeName}, ${AREA_NAME[o.area] ?? o.area}`],
        ["Contact", o.contact ? `${o.contact.name}, ${o.contact.role}${o.contact.phone ? ` · ${o.contact.phone}` : ""}` : "–"],
        ["Lifts", `${lifts ?? "–"} lift${Number(lifts) === 1 ? "" : "s"}${floors ? `, ${floors}` : ""}`],
        ["Contract", `${c.id} · signed by ${c.signedBy ?? "the customer"} · start ${day(c.start)}`], ["Scope", c.scope.join("; ")], ["Price", chf(c.value)], ["Payment terms", c.payment.map((p) => `${p.pct}% ${p.label.toLowerCase()}`).join(", ")],
        ...(o.job?.acceptedAt ? [["Job", `Accepted by ${NAMES[o.job.lead]} · start ${day(o.job.start!)} · site contact ${o.job.siteContact?.name}`] as [string, string]] : o.job ? [["Job", `With ${NAMES[o.job.lead]} to accept`] as [string, string]] : []),
      ];
  const paperList = <details className="mt-2 text-[13px]"><summary className="cursor-pointer font-medium text-muted hover:text-ink">{papers.length} attached paper{papers.length === 1 ? "" : "s"}</summary><ul className="mt-1 space-y-1">{papers.map((p) => <li key={p} className="flex items-center gap-1.5"><Icon n="doc" s={13} />{p}</li>)}</ul></details>;
  if (bare) return <div><Facts title="Hand-over pack" rows={rows} cols={3} />{paperList}</div>;
  return (
    <Card className="p-4">
      <Label>Hand-over pack</Label>
      <Facts rows={rows} cols={3} />
      {paperList}
    </Card>
  );
}

export function JobPanel({ o, t }: { o: Opp; t: Task }) {
  const { s, me, now, mutate } = useApp();
  const [f, setF] = useState({ start: iso(s.sherpa.contracts.find((c) => c.id === o.contractId)?.start ?? now + 30 * DAY), name: o.contact?.name ?? "", phone: o.contact?.phone ?? "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Panel title={t.title} why="" does="Accepts the job. The rep and the customer's contact are told the planned start." then="Your team plans the installation.">
      <div className="grid grid-cols-1 items-end gap-2 @2xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-[12px] font-medium text-muted">Planned start<Input type="date" value={f.start} onChange={(e) => set("start")(e.target.value)} className="mt-1 text-ink" /></label>
        <label className="text-[12px] font-medium text-muted">Site contact<Input value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="Name" className="mt-1 text-ink" /></label>
        <label className="text-[12px] font-medium text-muted">Phone<Input value={f.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="Phone" className="mt-1 text-ink" /></label>
        <Btn disabled={!f.start || !f.name.trim()} onClick={() => mutate((st) => OP.acceptJob(st, o.id, me!.id, { start: fromIso(f.start), siteContact: { name: f.name.trim(), phone: f.phone.trim() || undefined } }))}><Icon n="check" s={15} /> Accept the job</Btn>
      </div>
      <div className="mt-3"><HandoverPack o={o} bare /></div>
    </Panel>
  );
}

export function HandoverOfferPanel({ o, t, openOffer }: { o: Opp; t: Task; openOffer: (id: string) => void }) {
  const { s, me, mutate } = useApp();
  const acc = accountOf(s, o.accountId) ?? s.sherpa.accounts.find((a) => a.name === o.placeName);
  const defaultProduct: ProductKey = /\bMOD\b/i.test(t.title) ? "modernisation" : "maintenance";
  const [productPick, setProduct] = useState(""); const [termPick, setTerm] = useState(""); const [discPick, setDisc] = useState("");
  const product = (productPick || defaultProduct) as ProductKey;
  const termHint = suggestTerm(s, o.area, product); const discHint = suggestDiscount(s, o, product, [0, 5, 10, 15]);
  const term = termPick || String(termHint.value); const disc = discPick || String(discHint.value);
  const productWhy = defaultProduct === "modernisation" ? ["The hand-over flagged this as a modernisation"] : ["A new installation leaves warranty: maintenance keeps the unit with us", "Conversion Alerts: offer before the warranty ends"];
  const yearly = PRODUCT[product].yearly; const termUsed = yearly ? Number(term) : 1;
  const list = listPrice(o.area, product, termUsed); const price = Math.round(list * (1 - Number(disc) / 100));
  return (
    <Panel title={t.title} why={`${acc?.name ?? o.placeName} · ${AREA_NAME[o.area] ?? o.area}`} does="Drafts an offer for this customer, priced from the area price list. It becomes your own opportunity." then="You review the draft, get any approval it needs, and send it to the customer.">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Suggest label="Offer" options={(["maintenance", "modernisation"] as ProductKey[]).map((p) => ({ value: p, label: PRODUCT[p].label }))} suggested={defaultProduct} value={product} why={productWhy} onChange={setProduct} />
        {yearly && <Suggest label="Term" options={["1", "3", "5"].map((y) => ({ value: y, label: `${y} year${y === "1" ? "" : "s"}` }))} suggested={String(termHint.value)} value={term} why={termHint.why} onChange={setTerm} />}
        <Suggest label="Discount" options={["0", "5", "10", "15"].map((d) => ({ value: d, label: `${d}%` }))} suggested={String(discHint.value)} value={disc} why={discHint.why} onChange={setDisc} />
        <div className="px-1 pb-1.5 text-[13px]"><span className="text-muted">Offer price </span><b className="num text-[15px]">{chf(price)}</b>{Number(disc) > 0 && <span className="text-muted"> · list {chf(list)}</span>}</div>
        <Btn onClick={() => { let id: string | undefined; mutate((st) => { id = OP.offerHandover(st, t.id, me!.id, { product, term: termUsed, discountPct: Number(disc) })?.id; }); if (id) openOffer(id); }}><Icon n="sparkle" s={15} /> Draft the offer</Btn>
      </div>
      {Number(disc) > 10 && <p className="mt-2 text-xs text-amber-800">Above 10% the Sales Manager has to approve before it is sent.</p>}
    </Panel>
  );
}
