import React, { useState, useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { ref, onValue } from "firebase/database";
import { database } from "./firebase";

// ============================================================================
// 1. STATISTICAL UTILITY FUNCTIONS
// ============================================================================
function calculateStats(arr) {
  const valid = arr
    .filter((v) => typeof v === "number" && !isNaN(v) && isFinite(v))
    .sort((a, b) => a - b);

  if (valid.length === 0) {
    return { count: 0, mean: 0, q1: 0, q2: 0, q3: 0, min: 0, max: 0 };
  }

  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  const mean = sum / valid.length;

  const quantile = (q) => {
    const pos = (valid.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (valid[base + 1] !== undefined) {
      return valid[base] + rest * (valid[base + 1] - valid[base]);
    }
    return valid[base];
  };

  return {
    count: valid.length,
    mean: Number(mean.toFixed(2)),
    q1: Number(quantile(0.25).toFixed(2)),
    q2: Number(quantile(0.50).toFixed(2)),
    q3: Number(quantile(0.75).toFixed(2)),
    min: Number(valid[0].toFixed(2)),
    max: Number(valid[valid.length - 1].toFixed(2)),
  };
}

// ============================================================================
// 2. HORIZONTALLY STRETCHED ANALYTICAL CARD COMPONENT
// ============================================================================
function StretchedAnalyticalCard({
  title,
  metricKey,
  scoreKey,
  data,
  themeColor,
  accentColor,
  metricDomain = [-25, 50],
  metricLabel,
  scoreLabel,
}) {
  const containerRef = useRef(null);
  const [plotWidth, setPlotWidth] = useState(1100);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 100) {
          setPlotWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter valid data points
  const points = useMemo(() => {
    return data
      .map((d) => {
        const m = Number(d[metricKey]);
        const s = Number(d[scoreKey]);
        return { metric: m, score: s };
      })
      .filter(
        (p) =>
          !isNaN(p.metric) &&
          isFinite(p.metric) &&
          !isNaN(p.score) &&
          isFinite(p.score) &&
          p.score >= 0.0 &&
          p.score <= 100.0
      );
  }, [data, metricKey, scoreKey]);

  // Telemetry statistics calculated over the metric
  const stats = useMemo(() => {
    const metricVals = points.map((p) => p.metric);
    return calculateStats(metricVals);
  }, [points]);

  // Points sorted by score (X-axis) for orderly columnar rendering
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => a.score - b.score);
  }, [points]);

  // Frequency distribution histogram (Dense bins with tight spacing)
  const histogramBins = useMemo(() => {
    const binCount = 60; // Dense bucket count
    const [minDomain, maxDomain] = metricDomain;
    const step = (maxDomain - minDomain) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      x0: minDomain + i * step,
      x1: minDomain + (i + 1) * step,
      count: 0,
    }));

    points.forEach((p) => {
      const idx = Math.min(
        binCount - 1,
        Math.max(0, Math.floor((p.metric - minDomain) / step))
      );
      if (bins[idx]) bins[idx].count += 1;
    });

    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    return { bins, maxCount };
  }, [points, metricDomain]);

  // Dimensions & Margins
  const heightPlot = 260;
  const heightHist = 190;
  const margin = { top: 20, right: 35, bottom: 45, left: 60 };

  const innerWidth = Math.max(200, plotWidth - margin.left - margin.right);
  const innerHeightPlot = heightPlot - margin.top - margin.bottom;
  const innerHeightHist = heightHist - margin.top - margin.bottom;

  // Scales for Plot 1 (X = Score [0..100], Y = Metric [minD..maxD])
  const [minD, maxD] = metricDomain;
  const scaleXScore = (scoreVal) => margin.left + (scoreVal / 100.0) * innerWidth;
  const scaleYMetric = (metricVal) =>
    margin.top + innerHeightPlot - ((metricVal - minD) / (maxD - minD)) * innerHeightPlot;
  const baselineYMetric = scaleYMetric(0);

  // Scales for Plot 2 (Histogram: X = Metric [minD..maxD], Y = Count [0..maxCount])
  const scaleXMetric = (metricVal) =>
    margin.left + ((metricVal - minD) / (maxD - minD)) * innerWidth;
  const scaleYHist = (count) =>
    margin.top + innerHeightHist - (count / histogramBins.maxCount) * innerHeightHist;

  // X-axis Score ticks: 0, 5, 10, ..., 100
  const scoreTicks = useMemo(() => {
    const ticks = [];
    for (let t = 0; t <= 100; t += 5) {
      ticks.push(t);
    }
    return ticks;
  }, []);

  // Y-axis Metric ticks
  const yMetricTicks = useMemo(() => {
    const range = maxD - minD;
    const step = range <= 80 ? 15 : 25;
    const ticks = [];
    for (let v = Math.ceil(minD / step) * step; v <= maxD; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [minD, maxD]);

  // X-axis Metric ticks for histogram
  const xMetricTicks = useMemo(() => {
    const range = maxD - minD;
    const step = range <= 80 ? 10 : 20;
    const ticks = [];
    for (let v = Math.ceil(minD / step) * step; v <= maxD; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [minD, maxD]);

  // Y-axis Histogram frequency ticks (4 evenly spaced intervals)
  const yHistTicks = useMemo(() => {
    const max = histogramBins.maxCount;
    return [0, Math.round(max * 0.33), Math.round(max * 0.66), max];
  }, [histogramBins.maxCount]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        backgroundColor: "#070c18",
        border: "1px solid #1e293b",
        borderTop: `4px solid ${themeColor}`,
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
        boxSizing: "border-box",
      }}
    >
      {/* Title & Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>📊</span>
          <span style={{ color: themeColor, fontSize: "16px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase" }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ backgroundColor: "#1e293b", color: "#94a3b8", padding: "4px 10px", borderRadius: "5px", fontSize: "11px", fontWeight: "bold" }}>
            BOUNDS: [{minD}, {maxD}]
          </span>
          <span style={{ backgroundColor: "#1e293b", color: accentColor, padding: "4px 12px", borderRadius: "5px", fontSize: "12px", fontWeight: "900" }}>
            {points.length} ACTIVE STOCKS
          </span>
        </div>
      </div>

      {/* PLOT 1: X = Score (0..100) vs Y = Metric */}
      <div style={{ backgroundColor: "#030712", borderRadius: "8px", border: "1px solid #131e33", padding: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 6px 6px", fontSize: "11px", color: "#94a3b8", fontWeight: "800" }}>
          <span>📈 PLOT: {scoreKey}  VS {metricKey} </span>
          <span style={{ color: themeColor }}>DOMAIN: X ∈ [0, 100], Y ∈ [{minD}, {maxD}]</span>
        </div>
        <svg width="100%" height={heightPlot} viewBox={`0 0 ${plotWidth} ${heightPlot}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`grad-col-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yMetricTicks.map((yVal) => (
            <g key={`y-grid-${yVal}`}>
              <line
                x1={margin.left}
                y1={scaleYMetric(yVal)}
                x2={margin.left + innerWidth}
                y2={scaleYMetric(yVal)}
                stroke="#172439"
                strokeDasharray="4 4"
              />
              <text
                x={margin.left - 8}
                y={scaleYMetric(yVal) + 4}
                fill="#64748b"
                fontSize="10"
                fontWeight="bold"
                textAnchor="end"
              >
                {yVal}
              </text>
            </g>
          ))}

          {/* Zero reference line if within bounds */}
          {minD < 0 && maxD > 0 && (
            <line
              x1={margin.left}
              y1={baselineYMetric}
              x2={margin.left + innerWidth}
              y2={baselineYMetric}
              stroke="#334155"
              strokeWidth="1.2"
            />
          )}

          {/* X-Axis Ticks (Multiples of 10 labeled; 5s only marked) */}
          {scoreTicks.map((val) => {
            const isLabeled = val % 10 === 0;
            const tickX = scaleXScore(val);
            const tickY = margin.top + innerHeightPlot;
            return (
              <g key={`score-tick-${val}`}>
                <line
                  x1={tickX}
                  y1={tickY}
                  x2={tickX}
                  y2={tickY + (isLabeled ? 7 : 4)}
                  stroke={isLabeled ? "#64748b" : "#334155"}
                  strokeWidth={isLabeled ? "1.5" : "1"}
                />
                {isLabeled && (
                  <text
                    x={tickX}
                    y={tickY + 20}
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {val}
                  </text>
                )}
              </g>
            );
          })}

          {/* Dense Bars */}
          {sortedPoints.map((p, idx) => {
            const barX = scaleXScore(p.score);
            const barY = scaleYMetric(p.metric);
            const barH = Math.abs(baselineYMetric - barY);
            const topY = p.metric >= 0 ? barY : baselineYMetric;
            const barW = Math.max(2, (innerWidth / (points.length || 1)) * 0.95);

            return (
              <rect
                key={idx}
                x={barX - barW / 2}
                y={topY}
                width={barW}
                height={Math.max(1.5, barH)}
                fill={`url(#grad-col-${metricKey})`}
                opacity={0.88}
              >
                <title>{`${scoreKey}: ${p.score.toFixed(2)} | ${metricKey}: ${p.metric.toFixed(2)}`}</title>
              </rect>
            );
          })}

          {/* Axis Labels */}
          <text
            x={margin.left + innerWidth / 2}
            y={heightPlot - 4}
            fill="#38bdf8"
            fontSize="11"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="0.5px"
          >
            {scoreLabel}
          </text>
          <text
            transform={`rotate(-90)`}
            x={-(margin.top + innerHeightPlot / 2)}
            y={16}
            fill="#e2e8f0"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            {metricLabel}
          </text>
        </svg>
      </div>

      {/* PLOT 2: Dense Frequency Distribution Histogram */}
      <div style={{ backgroundColor: "#030712", borderRadius: "8px", border: "1px solid #131e33", padding: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 6px 6px", fontSize: "11px", color: "#94a3b8", fontWeight: "800" }}>
          <span>📊 HISTOGRAM: {metricKey}</span>
          <span style={{ color: accentColor }}>MAX FREQUENCY PER BUCKET: {histogramBins.maxCount}</span>
        </div>
        <svg width="100%" height={heightHist} viewBox={`0 0 ${plotWidth} ${heightHist}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`grad-hist-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={themeColor} stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Y-Axis Horizontal Gridlines & Count Numbers */}
          {yHistTicks.map((countVal) => (
            <g key={`y-hist-${countVal}`}>
              <line
                x1={margin.left}
                y1={scaleYHist(countVal)}
                x2={margin.left + innerWidth}
                y2={scaleYHist(countVal)}
                stroke="#172439"
                strokeDasharray="4 4"
              />
              <text
                x={margin.left - 8}
                y={scaleYHist(countVal) + 4}
                fill="#64748b"
                fontSize="10"
                fontWeight="bold"
                textAnchor="end"
              >
                {countVal}
              </text>
            </g>
          ))}

          {/* X-Axis Ticks (Metric Domain) */}
          {xMetricTicks.map((xVal) => (
            <g key={`x-hist-tick-${xVal}`}>
              <line
                x1={scaleXMetric(xVal)}
                y1={margin.top + innerHeightHist}
                x2={scaleXMetric(xVal)}
                y2={margin.top + innerHeightHist + 5}
                stroke="#334155"
              />
              <text
                x={scaleXMetric(xVal)}
                y={margin.top + innerHeightHist + 18}
                fill="#94a3b8"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {xVal}
              </text>
            </g>
          ))}

          {/* Histogram Bins (Zero-gap dense layout) */}
          {histogramBins.bins.map((bin, i) => {
            const bx = scaleXMetric(bin.x0);
            const bw = Math.max(1.8, scaleXMetric(bin.x1) - bx);
            const bh = (bin.count / histogramBins.maxCount) * innerHeightHist;
            const by = margin.top + innerHeightHist - bh;

            return (
              <rect
                key={i}
                x={bx}
                y={by}
                width={bw}
                height={Math.max(1, bh)}
                fill={`url(#grad-hist-${metricKey})`}
                opacity={0.92}
              >
                <title>{`Range: [${bin.x0.toFixed(1)}, ${bin.x1.toFixed(1)}] | Stock Count: ${bin.count}`}</title>
              </rect>
            );
          })}

          {/* Histogram Axis Labels */}
          <text
            x={margin.left + innerWidth / 2}
            y={heightHist - 4}
            fill="#38bdf8"
            fontSize="11"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="0.5px"
          >
            {metricLabel} (Grouped Intervals)
          </text>
          <text
            transform={`rotate(-90)`}
            x={-(margin.top + innerHeightHist / 2)}
            y={16}
            fill="#e2e8f0"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            Stock Count
          </text>
        </svg>
      </div>

      {/* STATISTICAL TELEMETRY CARD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          backgroundColor: "#030712",
          padding: "14px",
          borderRadius: "8px",
          border: "1px solid #1e293b",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold" }}>MEAN VALUE</div>
          <div style={{ fontSize: "16px", color: "#ffffff", fontWeight: "900", marginTop: "2px" }}>{stats.mean}</div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "bold" }}>FIRST QUARTILE (Q1 / 25%)</div>
          <div style={{ fontSize: "16px", color: "#38bdf8", fontWeight: "900", marginTop: "2px" }}>{stats.q1}</div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: themeColor, fontWeight: "bold" }}>SECOND QUARTILE (Q2 / MEDIAN)</div>
          <div style={{ fontSize: "16px", color: themeColor, fontWeight: "900", marginTop: "2px" }}>{stats.q2}</div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "bold" }}>THIRD QUARTILE (Q3 / 75%)</div>
          <div style={{ fontSize: "16px", color: "#f59e0b", fontWeight: "900", marginTop: "2px" }}>{stats.q3}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MASTER HELP COMPONENT
// ============================================================================
export default function Help({ isOpen, onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const screenerRef = ref(database, "SCREENER");
    const unsubscribe = onValue(screenerRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const rows = Object.keys(val).map((k) => ({
          CODE: k,
          ...val[k],
        }));
        setData(rows);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(2, 6, 23, 0.92)",
        backdropFilter: "blur(10px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          backgroundColor: "#070c18",
          border: "2px solid #06b6d4",
          boxShadow: "0 0 50px rgba(6, 182, 212, 0.4), 0 25px 60px rgba(0,0,0,0.95)",
          borderRadius: "14px",
          width: isMaximized ? "99vw" : "95vw",
          height: isMaximized ? "99vh" : "93vh",
          maxWidth: "1800px",
          display: "flex",
          flexDirection: "column",
          color: "#f8fafc",
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "2px solid #1e293b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#091224",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>⚡</span>
            <span
              style={{
                color: "#ffcc00",
                fontSize: "15px",
                fontWeight: "900",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
              }}
            >
              QUANTUM SYSTEM TELEMETRY & ALGORITHMIC CALCULATION GUIDE
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              style={{
                background: "#1e293b",
                border: "1px solid #475569",
                color: "#38bdf8",
                padding: "7px 14px",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {isMaximized ? "🗗 RESTORE SIZE" : "🗖 MAXIMIZE WINDOW"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#dc2626",
                border: "none",
                color: "#ffffff",
                padding: "7px 16px",
                borderRadius: "6px",
                fontWeight: "900",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              ✕ CLOSE
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "28px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px", color: "#38bdf8", fontWeight: "bold" }}>
              ⏳ Streaming live records from Firebase Realtime Database...
            </div>
          ) : (
            <>
              {/* SECTION 1: 4 VERTICALLY STACKED HORIZONTALLY STRETCHED CHARTS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
                <div style={{ borderBottom: "1px solid #1e293b", paddingBottom: "10px" }}>
                  <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "16px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase" }}>
                    📈 Cross-Sectional Score Distributions (Single-Column Panoramic View)
                  </h3>
                  <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "12px" }}>
                    Plots stretch across the full width to provide maximum resolution. Columns show exact distributions alongside quartile telemetry.
                  </p>
                </div>

                {/* 1. roe-c vs F-score */}
                <StretchedAnalyticalCard
                  title="ROE-C (Consolidated Return on Equity) vs Fundamental Score (F-Score)"
                  metricKey="roe-c"
                  scoreKey="F-score"
                  data={data}
                  themeColor="#10b981"
                  accentColor="#06b6d4"
                  metricDomain={[-25, 50]}
                  scoreLabel="F-Score"
                  metricLabel="ROE-C"
                />

                {/* 2. roa-c vs F-score */}
                <StretchedAnalyticalCard
                  title="ROA-C (Consolidated Return on Assets) vs Fundamental Score (F-Score)"
                  metricKey="roa-c"
                  scoreKey="F-score"
                  data={data}
                  themeColor="#3b82f6"
                  accentColor="#8b5cf6"
                  metricDomain={[-25, 50]}
                  scoreLabel="F-Score"
                  metricLabel="ROA-C"
                />

                {/* 3. sgc vs G-score */}
                <StretchedAnalyticalCard
                  title="Avg. Sales Growth (SGC) vs Growth Score (G-Score)"
                  metricKey="sgc"
                  scoreKey="G-score"
                  data={data}
                  themeColor="#f59e0b"
                  accentColor="#ef4444"
                  metricDomain={[-50, 100]}
                  scoreLabel="G-Score"
                  metricLabel="SGC (%)]"
                />

                {/* 4. pgc vs G-score */}
                <StretchedAnalyticalCard
                  title="Avg. Profit Growth (PGC) vs Growth Score (G-Score)"
                  metricKey="pgc"
                  scoreKey="G-score"
                  data={data}
                  themeColor="#ec4899"
                  accentColor="#f97316"
                  metricDomain={[-50, 100]}
                  scoreLabel="G-Score"
                  metricLabel="PGC (%)"
                />
              </div>

              {/* SECTION 2: DETAILED CALCULATION METHODOLOGY SUMMARY */}
              <div
                style={{
                  backgroundColor: "#09101d",
                  borderRadius: "12px",
                  border: "1px solid #1e293b",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                }}
              >
                <div style={{ borderBottom: "2px solid #1e293b", paddingBottom: "12px" }}>
                  <h2 style={{ color: "#ffcc00", fontSize: "17px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase", margin: 0 }}>
                    📚 Complete Calculation Methodology & Mathematical Formulations
                  </h2>
                  <p style={{ margin: "6px 0 0 0", color: "#94a3b8", fontSize: "13px" }}>
                    Exhaustive documentation explaining how raw market data transforms into cross-sectional scores (0–100 scale).
                  </p>
                </div>

                {/* METHODOLOGY 1: F-SCORE */}
                <div style={{ backgroundColor: "#040812", padding: "20px", borderRadius: "10px", borderLeft: "5px solid #10b981", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h3 style={{ color: "#10b981", margin: 0, fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    1. Fundamental Score (F-Score) — Calculation Logic
                  </h3>
                  <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.7" }}>
                    <p style={{ margin: "0 0 8px 0" }}>
                      The <b>F-score</b> measures the underlying capital quality and operational efficiency of the business. It blends Return on Equity (ROE) and Return on Assets (ROA) while applying non-linear dampening to guard against financial leverage traps:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>
                        <b>Mandatory Gatekeeper (Group 1):</b> A company must have valid data for the latest annual numbers: <code>roe-0</code> and <code>roa-0</code>. If either is missing, infinite, or outside of [-999, 999], the stock is disqualified and assigned a sentinel value of <b>101.0</b>.
                      </li>
                      <li>
                        <b>Temporal Cascading:</b>
                        <br />• <i>If only G1 is available:</i> <code>roe_raw = roe-0</code>, <code>roa_raw = roa-0</code>.
                        <br />• <i>If G1 + G2 (1-year prior) are available:</i> <code>60% * Year-0 + 40% * Year-1</code>.
                        <br />• <i>If G1 + G2 + G3 (3-year average) are all available:</i> <code>40% * Year-0 + 35% * Year-1 + 25% * 3Y-Avg</code>.
                      </li>
                      <li>
                        <b>Boundary Clamping ([-25, 50]):</b> <code>roe-c = max(-25, min(50, roe_raw))</code> and <code>roa-c = max(-25, min(50, roa_raw))</code>. This isolates companies from abnormal, non-recurring accounting windfalls or catastrophic write-downs.
                      </li>
                      <li>
                        <b>Non-Linear Leverage Sensitivity (Logistic Parameter K):</b> Highly leveraged companies can exhibit artificial spikes in ROE with weak ROA. The engine computes a logistic weighting factor:
                        <br />
                        <code style={{ color: "#38bdf8" }}>K = 1.0 / ( (1 + exp(-0.025 * (roa-c - 7.5))) ^ 25 )</code>
                        <br />
                        The final fundamental value becomes: <code>Fv = (roa-c + K * roe-c) / (1 + K)</code>. When ROA is strong, ROE is weighted normally; when ROA is weak or compromised, ROE weight collapses, protecting the score from debt-fueled optical performance.
                      </li>
                      <li>
                        <b>Cross-Sectional Min-Max Rescaling:</b> The fundamental value <code>Fv</code> is scaled linearly from <b>0.00 to 100.00</b> relative to the cross-sectional minimum and maximum observed across all active companies in the market.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* METHODOLOGY 2: G-SCORE */}
                <div style={{ backgroundColor: "#040812", padding: "20px", borderRadius: "10px", borderLeft: "5px solid #f59e0b", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h3 style={{ color: "#f59e0b", margin: 0, fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    2. Growth Score (G-Score) — Calculation Logic
                  </h3>
                  <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.7" }}>
                    <p style={{ margin: "0 0 8px 0" }}>
                      The <b>G-score</b> quantifies business expansion velocity. It merges sales expansion with net profit traction and utilizes dynamic divergence decay to ensure revenue growth confirms bottom-line expansion:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>
                        <b>Mandatory Gatekeeper:</b> Both TTM Sales Growth (<code>sg-ttm</code>) and 1-Year Profit Growth (<code>pg-1</code>) must be present and valid within [-100, 9999]. If either fails, the company is ineligible and assigned <b>101.0</b>.
                      </li>
                      <li>
                        <b>Multi-Horizon Blending:</b>
                        <br />• <i>Sales Growth (`sg`):</i> When quarterly (<code>sg-eq</code>), TTM, and 3-Year metrics exist, it weights short-term momentum and stability: <code>0.6 * (0.25 * sg-eq + 0.75 * sg-ttm) + 0.4 * sg-3y</code>.
                        <br />• <i>Profit Growth (`pg`):</i> Blends 1-Year (60%) with 3-Year (40%) profit trajectories: <code>0.6 * pg-1 + 0.4 * pg-3</code>.
                      </li>
                      <li>
                        <b>Clamping Outliers ([-50, 100]):</b> Blended sales and profit growth are capped strictly to <code>[-50, 100]</code> (`sgc` and `pgc`) to neutralize high base-effect distortions in small-cap turnarounds.
                      </li>
                      <li>
                        <b>Dynamic Divergence Sigmoid Decay:</b>
                        <br />• Computes discrepancy: <code>diff = |sgc - pgc|</code>.
                        <br />• Calculates sigmoid penalty: <code>kf = 100 / (1 + exp(ln(9) * (diff - 50) / 25))</code>.
                        <br />• Effective profit weight: <code>k = 0.25 + 0.0075 * kf</code>.
                        <br />• Raw growth metric: <code>fv = (sgc + k * pgc) / (1 + k)</code>.
                        <br />
                        <i>Significance:</i> When top-line sales growth and bottom-line profit growth expand together, profit gets near-equal weight ($k \approx 1.0$). When profit spikes without supporting sales growth, $k$ automatically drops down to $0.25$, prioritizing verifiable sales expansion.
                      </li>
                      <li>
                        <b>Market-Wide Rescaling:</b> Raw growth value <code>fv</code> is normalized across all eligible stocks to produce a final <b>0 to 100</b> rating (2 decimals).
                      </li>
                    </ul>
                  </div>
                </div>

                {/* METHODOLOGY 3: T-SCORE */}
                <div style={{ backgroundColor: "#040812", padding: "20px", borderRadius: "10px", borderLeft: "5px solid #38bdf8", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h3 style={{ color: "#38bdf8", margin: 0, fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    3. Technical Score (T-Score) — Calculation Logic
                  </h3>
                  <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.7" }}>
                    <p style={{ margin: "0 0 8px 0" }}>
                      The <b>T-score</b> evaluates multi-timeframe price momentum and structural trend strength. It combines price distance from key moving averages with benchmark-trimmed multi-horizon relative returns:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>
                        <b>Part 1: Distance-to-Moving-Averages (P-SCORE, Weight 60%):</b>
                        <br />• Measures relative position within 52-week channel: <code>x1 = (CMP - 52WL) / (52WH - 52WL)</code>, <code>x2 = 50MA position</code>, <code>x3 = 200MA position</code>.
                        <br />• Computes weighted price-structure centroid: <code>PSK = (w1*x1 + w2*x2 + w3*x3) / (w1 + w2 + w3)</code>.
                        <br />• Applies volatility range compression factor <code>F = 1 - 0.5 * exp(-4.5 * (52W Range %))</code> to prevent whip-saws in wide consolidation channels.
                        <br />• Centered metric <code>F1 = (PSK - 50) * F</code> is normalized across the market to generate <code>P-SCORE</code>.
                      </li>
                      <li>
                        <b>Part 2: Short-Term Return Alpha (ST-SCORE, Weight 30%):</b>
                        <br />• Uses 1-Week, 1-Month, and 3-Month returns converted to price equivalents.
                        <br />• Measures distance from the Top-1000 market-cap interquartile benchmark median (trimmed 45%–55% quantile).
                        <br />• Weights are biased toward immediate agility (7-day to 30-day levels weighted highest). Scaled from 0 to 100 using 5th and 95th percentiles.
                      </li>
                      <li>
                        <b>Part 3: Long-Term Return Alpha (OT-SCORE, Weight 10%):</b>
                        <br />• Uses 6-Month, 1-Year, and 3-Year returns against market-cap trimmed benchmarks.
                        <br />• Weights are biased toward structural multi-year persistence. Scaled from 0 to 100 via percentile normalization.
                      </li>
                      <li>
                        <b>Final Composite Formulation:</b>
                        <br />
                        <code style={{ color: "#38bdf8", fontWeight: "bold" }}>
                          T-score = 0.60 * P-SCORE + 0.30 * ST-SCORE + 0.10 * OT-SCORE
                        </code>
                        <br />
                        Stocks with invalid price channels or missing metrics default to 101.0.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}