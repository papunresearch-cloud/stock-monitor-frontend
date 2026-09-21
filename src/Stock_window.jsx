import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from './firebase';

export default function Stock_window({ 
  stockKey, 
  stockData = {}, 
  detailedDb = {}, 
  isAutoMode, 
  isFrozen 
}) {
  // =========================================================================
  // 1. THEME PALETTE & STYLING CONSTANTS
  // =========================================================================
  const THEME = {
    cardBg: "#0a0f1d",
    panelBg: "#040814",
    labels: "#B5C3FF",       // Static labels / parameter names
    values: "#FCC105",       // Standard values & scores
    green: "#00cc00",        // Positive returns / deltas
    red: "#e62e00",          // Negative returns / deltas
    border: "#1e293b",       // Subtle grid separators
    subText: "#94a3b8",
    accentAmber: "#f59e0b",
    accentCyan: "#06b6d4"
  };

  // =========================================================================
  // 2. DATA RESOLUTION & NORMALIZATION
  // =========================================================================
  // Resolve root metadata across varying case structures
  const stockName = stockData.Name || stockData.name || stockKey || "UNKNOWN";
  const ticker = stockData.Ticker || stockData.ticker || stockData.NSE || stockKey;
  const cmp = stockData.cmp || stockData.CMP || "0.00";
  const chgT = stockData.chgT || stockData.pct_change || stockData.tdy_chg || 0;
  const chgY = stockData.chgY || stockData.ydy_chg || 0;

  // Resolve detailed fundamentals from detailedDb prop or stockData
  const details = detailedDb[stockKey] || detailedDb[stockName] || detailedDb[ticker] || stockData.details || {};

  // Formatter helpers
  const fmt = (val, fallback = "N/A") => (val !== undefined && val !== null && val !== "" ? val : fallback);
  const numFmt = (val, decimals = 2) => {
    if (val === undefined || val === null || val === "" || isNaN(val)) return "N/A";
    return parseFloat(val).toFixed(decimals);
  };
  const getDiffColor = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return THEME.values;
    return num >= 0 ? THEME.green : THEME.red;
  };

  // Funda values extraction
  const pe = details.PE || details.pe;
  const dpe = details["DPE%"] || details.DPE || details.dpe;
  const dy = details.DY || details.dy;
  const bvgr = details.BVgr || details.bvgr;

  const pb = details.PB || details.pb;
  const dpb = details["DPB%"] || details.DPB || details.dpb;
  const ps = details.PS || details.ps;
  const payout = details.advdp || details.Payout || details.payout;

  const roe0 = details["roe-0"] || details.roe;
  const roe3y = details["roe-3y"] || details.roe_3y;
  const roa0 = details["roa-0"] || details.roa;
  const roa3y = details["roa-3y"] || details.roa_3y;
  const roce0 = details["roce-0"] || details.roce;
  const roce3y = details["roce-3y"] || details.roce_3y;

  const mcap = details.mcap || details.MCAP;
  const pcap = details.PCCAP || details.pcap;
  const de = details.DE || details.de;

  const ysg = details.YSG || details.ysg;
  const sgTtm = details["sg-ttm"] || details.sg_ttm;
  const sg3y = details["sg-3y"] || details.sg_3y;
  const lastQtr = details["Last Qtr"] || details.last_qtr || details.LastQtr || "JUNE, 2026";

  const ypg = details.YPG || details.ypg;
  const pg1 = details["pg-1"] || details.pg_1;
  const pg3 = details["pg-3"] || details.pg_3;

  const tScore = details["T-score"] || details.tScore;
  const gScore = details["G-score"] || details.gScore;
  const fScore = details["F-score"] || details.fScore;

  const prmtr = details.PRH || details.prmtr;
  const dprmtr = details.DPRH || details.dprmtr || "0.00";
  const fii = details.FII || details.fii;
  const dfii = details.DFII || details.dfii || "0.00";
  const dii = details.DII || details.dii;
  const ddii = details.DDII || details.ddii || "0.00";

  // Returns array for Main Window 8-column return block
  const returnsGrid = [
    { label: "Tdy-%chng", val: chgT },
    { label: "Ydy-%chng", val: chgY },
    { label: "1W", val: stockData["1WR"] || details["1WR"] || "0.0" },
    { label: "1M", val: stockData["1MR"] || details["1MR"] || "0.0" },
    { label: "3M", val: stockData["3MR"] || details["3MR"] || "0.0" },
    { label: "1YR", val: stockData["1YR"] || details["1YR"] || "0.0" },
    { label: "3YR", val: stockData["3YR"] || details["3YR"] || "0.0" },
    { label: "RSI", val: stockData.RSI || details.RSI || "50" }
  ];

  return (
    <div className="stock-window-card">
      {/* Dynamic Scoped CSS for Breakpoint Responsiveness */}
      <style>{`
        .stock-window-card {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          background-color: ${THEME.cardBg};
          border: 1px solid ${THEME.border};
          border-radius: 8px;
          margin-bottom: 12px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 100%;
          box-sizing: border-box;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .main-sub-window {
          width: 65%;
          padding: 10px 14px;
          box-sizing: border-box;
          border-right: 1px solid ${THEME.border};
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .extended-sub-window {
          width: 35%;
          background-color: ${THEME.panelBg};
          padding: 6px 8px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .ext-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid ${THEME.border};
          padding: 4px 0;
          font-size: 11px;
        }
        .ext-row:last-child {
          border-bottom: none;
        }
        .ext-cell-3col {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          overflow: hidden;
          white-space: nowrap;
          padding: 0 3px;
        }
        .ext-cell-stacked {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2px 3px;
        }

        /* MOBILE AND COMPACT VIEWPORTS (< 1024px) */
        @media (max-width: 1024px) {
          .stock-window-card {
            flex-direction: column !important;
            height: auto !important;
          }
          .main-sub-window {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid ${THEME.border};
          }
          .extended-sub-window {
            width: 100% !important;
          }
          .ext-row {
            padding: 6px 0;
          }
        }
      `}</style>

      {/* =================================================================== */}
      {/* 3. MAIN WINDOW (65% on Desktop, 100% on Mobile)                    */}
      {/* =================================================================== */}
      <div className="main-sub-window">
        {/* Header: Company Name, Ticker, LAST QTR metadata, and Rating */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "15px", fontWeight: "900", color: "#ffffff", letterSpacing: "0.5px" }}>
                {stockName}
              </span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: THEME.accentCyan }}>
                [{ticker}]
              </span>
              {/* LAST QTR Data relocated cleanly to Main Window Header */}
              <span style={{ fontSize: "11px", fontWeight: "800", color: THEME.accentAmber, marginLeft: "4px" }}>
                (LAST QTR: {lastQtr})
              </span>
            </div>
          </div>
          <div style={{ color: "#eab308", fontSize: "13px", letterSpacing: "2px" }} title="Rating">
            ★★★★★
          </div>
        </div>

        {/* 8-Column Returns Mini-Matrix */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px", margin: "6px 0", textAlign: "center" }}>
          {returnsGrid.map((item, idx) => {
            const isRsi = item.label === "RSI";
            const valNum = parseFloat(item.val);
            const color = isRsi ? THEME.values : (valNum >= 0 ? THEME.green : THEME.red);
            return (
              <div key={idx} style={{ background: "#0f172a", border: `1px solid ${THEME.border}`, borderRadius: "4px", padding: "3px 1px" }}>
                <div style={{ fontSize: "9px", color: THEME.subText, fontWeight: "bold" }}>{item.label}</div>
                <div style={{ fontSize: "11px", fontWeight: "900", color }}>
                  {isRsi ? item.val : `${valNum >= 0 ? "+" : ""}${item.val}%`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Range Bar & Moving Average Track Visualizer */}
        <div style={{ margin: "6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: THEME.subText, fontWeight: "bold" }}>
            <span>52WL: ₹{fmt(stockData["52WL"] || details["52WL"])}</span>
            <span style={{ color: THEME.values, fontWeight: "900" }}>CMP: ₹{cmp}</span>
            <span>52WH: ₹{fmt(stockData["52WH"] || details["52WH"])}</span>
          </div>
          <div style={{ position: "relative", height: "5px", background: "#334155", borderRadius: "3px", margin: "4px 0" }}>
            <div style={{ position: "absolute", left: "60%", width: "10px", height: "10px", background: THEME.accentCyan, borderRadius: "50%", top: "-2.5px" }}></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "9px", color: THEME.subText }}>
              🔺200MA &nbsp; ▴50MA &nbsp; ▵25MA &nbsp; ▹10MA
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", borderRadius: "3px", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>SCR</button>
              <button style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", borderRadius: "3px", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>TVC</button>
              <button style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", borderRadius: "3px", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>YFC</button>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. EXTENDED PANEL (35% on Desktop, 100% on Mobile)                 */}
      {/* =================================================================== */}
      <div className="extended-sub-window">
        {/* ROW 1: PE (DPE) | DY | BVgr */}
        <div className="ext-row">
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>PE: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(pe)}</span>
            {dpe !== undefined && (
              <span style={{ color: getDiffColor(dpe), marginLeft: "3px" }}>
                ({parseFloat(dpe) >= 0 ? "+" : ""}{numFmt(dpe)}%)
              </span>
            )}
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>DY: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(dy)}%</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>BVgr: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(bvgr)}%</span>
          </div>
        </div>

        {/* ROW 2: PB (DPB) | PS | Payout */}
        <div className="ext-row">
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>PB: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(pb)}</span>
            {dpb !== undefined && (
              <span style={{ color: getDiffColor(dpb), marginLeft: "3px" }}>
                ({parseFloat(dpb) >= 0 ? "+" : ""}{numFmt(dpb)}%)
              </span>
            )}
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>PS: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(ps)}</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>Payout: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(payout)}%</span>
          </div>
        </div>

        {/* ROW 3: ROE | ROA | ROCE */}
        <div className="ext-row">
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>ROE: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(roe0)}</span>
            <span style={{ color: THEME.subText, marginLeft: "3px" }}>({numFmt(roe3y)})</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>ROA: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(roa0)}</span>
            <span style={{ color: THEME.subText, marginLeft: "3px" }}>({numFmt(roa3y)})</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>ROCE: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(roce0)}</span>
            <span style={{ color: THEME.subText, marginLeft: "3px" }}>({numFmt(roce3y)})</span>
          </div>
        </div>

        {/* ROW 4: MCAP | PCAP | DE */}
        <div className="ext-row">
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>MCAP: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{fmt(mcap)}</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>PCAP: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(pcap)}</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>DE: </span>
            <span style={{ color: THEME.values, marginLeft: "3px" }}>{numFmt(de)}</span>
          </div>
        </div>

        {/* ROW 5: SALES GROWTH (100% full panel width) */}
        <div className="ext-row" style={{ justifyContent: "flex-start", gap: "6px" }}>
          <span style={{ color: THEME.labels, fontWeight: "bold" }}>SALES GROWTH:</span>
          <span style={{ color: THEME.labels }}>(YOYQ -</span>
          <span style={{ color: getDiffColor(ysg), fontWeight: "bold" }}>{numFmt(ysg)}%</span>
          <span style={{ color: THEME.labels }}>) [TTM -</span>
          <span style={{ color: getDiffColor(sgTtm), fontWeight: "bold" }}>{numFmt(sgTtm)}%</span>
          <span style={{ color: THEME.labels }}>] [3Y -</span>
          <span style={{ color: getDiffColor(sg3y), fontWeight: "bold" }}>{numFmt(sg3y)}%</span>
          <span style={{ color: THEME.labels }}>]</span>
        </div>

        {/* ROW 6: PROFIT GROWTH (100% full panel width) */}
        <div className="ext-row" style={{ justifyContent: "flex-start", gap: "6px" }}>
          <span style={{ color: THEME.labels, fontWeight: "bold" }}>PROFIT GROWTH:</span>
          <span style={{ color: THEME.labels }}>(YOYQ -</span>
          <span style={{ color: getDiffColor(ypg), fontWeight: "bold" }}>{numFmt(ypg)}%</span>
          <span style={{ color: THEME.labels }}>) [TTM -</span>
          <span style={{ color: getDiffColor(pg1), fontWeight: "bold" }}>{numFmt(pg1)}%</span>
          <span style={{ color: THEME.labels }}>] [3Y -</span>
          <span style={{ color: getDiffColor(pg3), fontWeight: "bold" }}>{numFmt(pg3)}%</span>
          <span style={{ color: THEME.labels }}>]</span>
        </div>

        {/* ROW 7: QUANT SCORES */}
        <div className="ext-row">
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>T-SCORE: </span>
            <span style={{ color: THEME.values, fontWeight: "bold", marginLeft: "3px" }}>{numFmt(tScore)}</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>G-SCORE: </span>
            <span style={{ color: THEME.values, fontWeight: "bold", marginLeft: "3px" }}>{numFmt(gScore)}</span>
          </div>
          <div className="ext-cell-3col">
            <span style={{ color: THEME.labels }}>F-SCORE: </span>
            <span style={{ color: THEME.values, fontWeight: "bold", marginLeft: "3px" }}>{numFmt(fScore)}</span>
          </div>
        </div>

        {/* ROW 8: STACKED SHAREHOLDING (Label at top, Value below) */}
        <div className="ext-row" style={{ padding: "2px 0" }}>
          <div className="ext-cell-stacked">
            <span style={{ color: THEME.labels, fontWeight: "bold", fontSize: "10px" }}>PRMTR</span>
            <div style={{ fontSize: "11px", fontWeight: "bold" }}>
              <span style={{ color: THEME.values }}>{numFmt(prmtr)}% </span>
              <span style={{ color: getDiffColor(dprmtr), fontSize: "10px" }}>
                ({parseFloat(dprmtr) >= 0 ? "+" : ""}{numFmt(dprmtr)}%)
              </span>
            </div>
          </div>
          <div className="ext-cell-stacked">
            <span style={{ color: THEME.labels, fontWeight: "bold", fontSize: "10px" }}>FII</span>
            <div style={{ fontSize: "11px", fontWeight: "bold" }}>
              <span style={{ color: THEME.values }}>{numFmt(fii)}% </span>
              <span style={{ color: getDiffColor(dfii), fontSize: "10px" }}>
                ({parseFloat(dfii) >= 0 ? "+" : ""}{numFmt(dfii)}%)
              </span>
            </div>
          </div>
          <div className="ext-cell-stacked">
            <span style={{ color: THEME.labels, fontWeight: "bold", fontSize: "10px" }}>DII</span>
            <div style={{ fontSize: "11px", fontWeight: "bold" }}>
              <span style={{ color: THEME.values }}>{numFmt(dii)}% </span>
              <span style={{ color: getDiffColor(ddii), fontSize: "10px" }}>
                ({parseFloat(ddii) >= 0 ? "+" : ""}{numFmt(ddii)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}