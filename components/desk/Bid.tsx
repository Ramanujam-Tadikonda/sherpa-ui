"use client";
import { useApp } from "@/lib/store";
import { AREA_NAME, chfShort, regionRef, winChance } from "@/lib/sherpa";
import type { ProductKey } from "@/lib/types";

/** Earlier quotes of the same kind in the same area: what we charged and whether we won. */
export function PastQuotes({ area, product, price, discountPct }: { area: string; product: ProductKey; price?: number; discountPct?: number }) {
  const { s, now } = useApp();
  const ref = regionRef(s, area, product);
  const rows = s.sherpa.past.filter((p) => p.area === area && p.product === product).sort((a, b) => b.at - a.at).slice(0, 6);
  const diff = price && ref.avg ? Math.round(((price - ref.avg) / ref.avg) * 100) : null;
  if (!rows.length) return <p className="t-small">No earlier quotes of this kind in {AREA_NAME[area] ?? area}.</p>;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-[13px]">
        <div className="rounded-md bg-surface px-3 py-2"><div className="t-small">Average price</div><b className="num">{chfShort(ref.avg)}</b></div>
        <div className="rounded-md bg-surface px-3 py-2"><div className="t-small">Average discount</div><b className="num">{ref.avgDiscount.toFixed(0)}%</b></div>
        <div className="rounded-md bg-surface px-3 py-2"><div className="t-small">We won</div><b className="num">{ref.wins} of {ref.count}</b></div>
      </div>
      {diff !== null && <p className="mt-3 text-[13.5px]">Your price is <b className={Math.abs(diff) > 12 ? "text-amber-700" : "text-emerald-700"}>{Math.abs(diff)}% {diff <= 0 ? "below" : "above"}</b> the average{discountPct !== undefined ? <>. At {discountPct}% off, <b>{winChance(s, area, product, discountPct)}%</b> of similar quotes were won.</> : "."}</p>}
      <div className="mt-3 overflow-hidden rounded-md border border-line">
        <div className="grid grid-cols-[1fr_5rem_5.5rem_3.5rem_4rem] gap-2 border-b border-line bg-surface px-3 py-2 t-label"><span>Customer</span><span>When</span><span className="text-right">Price</span><span className="text-right">Off</span><span className="text-right">Result</span></div>
        {rows.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_5rem_5.5rem_3.5rem_4rem] items-center gap-2 border-b border-line px-3 py-2 text-[13px] last:border-0">
            <span className="truncate">{p.customer}</span><span className="text-muted">{Math.max(1, Math.round((now - p.at) / 86400000 / 30))} mo ago</span><span className="num text-right font-medium">{chfShort(p.price)}</span><span className="num text-right">{p.discountPct}%</span>
            <span className="text-right"><span className="rounded px-1.5 py-0.5 text-[11.5px] font-semibold" style={p.outcome === "won" ? { background: "#e2f4ea", color: "#1d7a45" } : { background: "#eeeef1", color: "#4a4a55" }}>{p.outcome === "won" ? "Won" : "Lost"}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
