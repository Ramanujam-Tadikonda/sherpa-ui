"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { Avatar, Card, Icon } from "../ui";
import { USERS } from "@/lib/data";
import type { PersonFit } from "@/lib/sherpa";
import { Input, Textarea } from "@/components/form";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function Panel({ title, why, does, then, aside, children }: { title: string; why: string; does?: string; then?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card className="border-brand/25">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-brand"><Icon n="sparkle" s={13} /> Your next step</div>
            <h2 className="mt-1 flex items-start gap-1.5 text-lg font-semibold leading-snug">
              <span>{title}</span>
              {(does || then) && <HowItWorks does={does} then={then} />}
            </h2>
            {why && <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-muted">{why}</p>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </Card>
  );
}

function HowItWorks({ does, then }: { does?: string; then?: string }) {
  return (
    <Popover>
      <PopoverTrigger openOnHover delay={80} aria-label="What happens next" className="mt-1 shrink-0 rounded-sm text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/30"><Info className="size-4" aria-hidden /></PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 gap-1.5 p-3 text-[13px] font-normal">
        {does && <p><b>What happens:</b> {does}</p>}
        {then && <p><b>Then:</b> {then}</p>}
      </PopoverContent>
    </Popover>
  );
}

export const Field = ({ v, set, ph, area, type }: { v: string; set: (x: string) => void; ph: string; area?: boolean; type?: string }) => area
  ? <Textarea value={v} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={ph} />
  : <Input value={v} type={type} onChange={(e) => set(e.target.value)} placeholder={ph} aria-label={ph} />;

export const CHOICE = (k: string, opts: string[], v: string, set: (x: string) => void) => (
  <div role="group" aria-label={k} className="flex flex-wrap gap-1.5">{opts.map((x) => <button key={x} type="button" aria-pressed={v === x} onClick={() => set(x)} className={`min-h-10 rounded-lg border px-3 text-[13px] font-medium ${v === x ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-surface"}`}>{x}</button>)}</div>
);

export const Q = ({ label, children }: { label: string; children: ReactNode }) => <div className="space-y-1.5"><div className="text-[13px] font-semibold">{label}</div>{children}</div>;

export const Rows = ({ rows }: { rows: [string, ReactNode][] }) => (
  <div className="rounded-xl border border-line px-4 text-[13.5px]">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line/70 py-2.5 last:border-0"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>)}</div>
);

export const Facts = ({ rows, title, cols = 3 }: { rows: [string, ReactNode][]; title?: string; cols?: 2 | 3 | 4 }) => {
  const shown = rows.filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "–");
  if (!shown.length) return null;
  return (
    <div className="rounded-xl border border-line px-3 py-2.5 text-[13px]">
      {title && <div className="t-label mb-1.5">{title}</div>}
      <dl className={`grid grid-cols-2 gap-x-4 gap-y-1.5 ${cols >= 3 ? "@2xl:grid-cols-3" : ""} ${cols === 4 ? "@4xl:grid-cols-4" : ""}`}>{shown.map(([k, v]) => <div key={k} className="min-w-0"><dt className="truncate text-[11.5px] text-muted">{k}</dt><dd className="font-medium leading-snug">{v}</dd></div>)}</dl>
    </div>
  );
};

/** Keeps a long form's main action in view while the form scrolls. */
export const StickyActions = ({ children, hint }: { children: ReactNode; hint?: ReactNode }) => (
  <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-3 flex flex-wrap items-center gap-2 rounded-b-xl border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur">{children}{hint && <span className="t-small">{hint}</span>}</div>
);

export const LinkBtn = ({ children, onClick, on }: { children: ReactNode; onClick: () => void; on?: boolean }) => (
  <button type="button" onClick={onClick} aria-pressed={on} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium hover:bg-surface ${on ? "bg-surface text-ink" : "text-muted hover:text-ink"}`}>{children}</button>
);

/** SHERPA’s pick for a person, from past results; the alternatives open only when asked. */
export function PersonPick({ label, ranked, value, onChange }: { label: string; ranked: PersonFit[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = ranked.find((p) => p.id === value) ?? ranked[0];
  const u = USERS.find((x) => x.id === cur?.id);
  if (!cur || !u) return <p className="text-[13px] text-muted">Nobody available.</p>;
  const best = cur.id === ranked[0].id;
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <Avatar initials={u.initials} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[14px] font-semibold">
            {u.name}
            <Popover>
              <PopoverTrigger openOnHover delay={80} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                <Icon n="sparkle" s={11} /> {best ? "SHERPA’s pick" : "Your choice"}
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-72 text-[13px]">
                <div className="font-semibold">Why {u.name.split(" ")[0]}</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{cur.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </PopoverContent>
            </Popover>
          </div>
          <div className="truncate text-[12px] text-muted">{cur.line}</div>
        </div>
        {ranked.length > 1 && <LinkBtn on={open} onClick={() => setOpen(!open)}>Change</LinkBtn>}
      </div>
      {open && (
        <div className="mt-2 divide-y divide-line rounded-lg border border-line">
          {ranked.map((p) => { const x = USERS.find((y) => y.id === p.id)!; return (
            <button key={p.id} type="button" onClick={() => { onChange(p.id); setOpen(false); }} className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-brand-soft/50 ${p.id === cur.id ? "bg-brand-soft/60" : ""}`}>
              <span className="font-medium">{x.name}</span>
              {p.id === ranked[0].id && <span className="text-[11px] text-brand">SHERPA’s pick</span>}
              <span className="ml-auto truncate text-[12px] text-muted">{p.line}</span>
            </button>
          ); })}
        </div>
      )}
    </div>
  );
}

export type SuggestOpt = { value: string; label: string; note?: string };
/** SHERPA's choice shown as a fact with its reasons. The alternatives appear only after Change. */
export function Suggest({ label, options, suggested, value, why, onChange, compact }: { label?: string; options: SuggestOpt[]; suggested: string; value: string; why?: string[]; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value) ?? options.find((o) => o.value === suggested) ?? options[0];
  if (!cur) return null;
  const mine = cur.value !== suggested;
  return (
    <div className="min-w-0">
      {label && <div className="text-[12px] font-medium text-muted">{label}</div>}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${label ? "mt-1" : ""}`}>
        <span className={`${compact ? "text-[13px]" : "text-[14px]"} font-semibold`}>{cur.label}</span>
        <Popover>
          <PopoverTrigger openOnHover delay={80} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${mine ? "bg-paper text-muted" : "bg-brand-soft text-brand"}`}>
            <Icon n="sparkle" s={11} /> {mine ? "Your choice" : "SHERPA suggests"}
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 text-[13px]">
            <div className="font-semibold">{mine ? `SHERPA suggested ${options.find((o) => o.value === suggested)?.label ?? suggested}` : "Why SHERPA suggests this"}</div>
            {why?.length ? <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{why.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="mt-1 text-muted">From the deal and our history.</p>}
          </PopoverContent>
        </Popover>
        {cur.note && <span className="text-[12px] text-muted">{cur.note}</span>}
        {options.length > 1 && <LinkBtn on={open} onClick={() => setOpen(!open)}>Change</LinkBtn>}
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} className={`rounded-lg border px-2.5 py-1 text-[13px] ${o.value === cur.value ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-paper"}`}>
              {o.label}{o.value === suggested && <span className="ml-1 text-[11px] text-brand">· SHERPA</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
