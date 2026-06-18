"use client";

import { useEffect, useState } from "react";
import { Bet, loadBets, markResult, roiSummary } from "@/lib/bets";

export default function BetsPage() {
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => { setBets(loadBets()); }, []);

  const summary = roiSummary(bets);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📒 Historial de apuestas</h1>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat title="Stakes" value={`€ ${summary.stakes.toFixed(2)}`} />
        <Stat title="Retornos" value={`€ ${summary.returns.toFixed(2)}`} />
        <Stat title="P&L" value={`€ ${summary.pnl.toFixed(2)}`} />
        <Stat title="ROI" value={`${(summary.roi*100).toFixed(1)}%`} />
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Fecha</Th><Th>Partido</Th><Th>Pick</Th><Th>Cuota</Th>
              <Th>Prob</Th><Th>Value</Th><Th>Stake</Th><Th>Resultado</Th>
            </tr>
          </thead>
          <tbody>
            {bets.map(b => (
              <tr key={b.id} className="border-t">
                <Td>{new Date(b.datetime).toLocaleString()}</Td>
                <Td>{b.homeTeam} vs {b.awayTeam}</Td>
                <Td>{b.side}</Td>
                <Td>{b.odds}</Td>
                <Td>{(b.prob*100).toFixed(1)}%</Td>
                <Td>{b.valuePct.toFixed(1)}%</Td>
                <Td>€ {b.stake.toFixed(2)}</Td>
                <Td>
                  <select
                    className="border rounded px-2 py-1"
                    value={b.result || ""}
                    onChange={(e) => setBets(markResult(b.id, e.target.value as any))}
                  >
                    <option value="">—</option>
                    <option value="win">Win</option>
                    <option value="lose">Lose</option>
                    <option value="void">Void</option>
                  </select>
                </Td>
              </tr>
            ))}
            {bets.length === 0 && (
              <tr><td colSpan={8} className="text-center p-6 text-gray-500">
                Aún no has guardado apuestas desde el probador.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: any) { return <th className="text-left font-semibold px-3 py-2">{children}</th>; }
function Td({ children }: any) { return <td className="px-3 py-2">{children}</td>; }
function Stat({ title, value }: {title:string; value:string}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
