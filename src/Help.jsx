import React, { useState, useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { ref, onValue } from "firebase/database";
import { database } from "./firebase";

// Helper: Calculate statistical distribution parameters
function calculateStats(arr) {
  const valid = arr.filter((v) => typeof v === "number" && !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return { count: 0, mean: 0, q1: 0, q2: 0, q3: 0, min: 0, max: 0 };

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

// Subcomponent: Dense Exotic Columnar Plot & Distribution Histogram
function MetricAnalyticalCard({
  title,
  metricKey,
  scoreKey = "F-score",
  data,
  themeColor,
  accentColor,
  metricDomain = [-25, 50],
}) {
  const containerRef = useRef(null);
  const [plotWidth, setPlotWidth] = useState(480);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 100) {
          setPlotWidth(entry.contentRect.width);
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
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
          p.score <= 100.0 &&
          p.score >= 0.0
      );
  }, [data, metricKey, scoreKey]);

  // Telemetry statistics
  const stats = useMemo(() => {
    const metricVals = points.map((p) => p.metric);
    return calculateStats(metricVals);
  }, [points]);

  // 1. Columnar plot points (sorted by metric value for dense columnar display)
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => a.metric - b.metric);
  }, [points]);

  // 2. Frequency distribution histogram
  const histogramBins = useMemo(() => {
    const binCount = 30;
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

  // SVG Dimension Constants
  const height = 190;
  const margin = { top: 14, right: 18, bottom: 28, left: 38 };
  const innerWidth = Math.max(120, plotWidth - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  // Scales
  const [minD, maxD] = metricDomain;
  const scaleX = (val) => margin.left + ((val - minD) / (maxD - minD)) * innerWidth;
  const scaleYScore = (val) => margin.top + innerHeight - (val / 100) * innerHeight;
  const scaleYHist = (count) =>
    margin.top + innerHeight - (count / histogramBins.maxCount) * innerHeight;

  // Generate 15-20% gap non-congested ticks
  const xTicks = useMemo(() => {
    const range = maxD - minD;
    const step = range <= 80 ? 15 : 25; // 15-20% step span
    const ticks = [];
    for (let t = Math.ceil(minD / step) * step; t <= maxD; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [minD, maxD]);

  const yTicks = [0, 20, 40, 60, 80, 100]; // 20% span to prevent congestion

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: "#09101d",
        border: `1px solid #1e293b`,
        borderTop: `3px solid ${themeColor}`,
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: themeColor, fontSize: "14px", fontWeight: "900", letterSpacing: "0.5px" }}>
          {title}
        </span>
        <span
          style={{
            backgroundColor: "#1e293b",
            color: accentColor,
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          {points.length} STOCKS
        </span>
      </div>

      {/* CHART 1: Dense Columnar Plot (Metric vs F-score) */}
      <div style={{ backgroundColor: "#040812", borderRadius: "8px", border: "1px solid #131e33", padding: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 4px 6px", fontSize: "11px", color: "#94a3b8", fontWeight: "700" }}>
          <span>📊 COLUMNAR PLOT: {metricKey} VS {scoreKey}</span>
          <span style={{ color: themeColor }}>Y: 0 - 100 SCALE</span>
        </div>
        <svg width="100%" height={height} viewBox={`0 0 ${plotWidth} ${height}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`grad-col-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.9" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((yVal) => (
            <g key={`y-grid-${yVal}`}>
              <line
                x1={margin.left}
                y1={scaleYScore(yVal)}
                x2={margin.left + innerWidth}
                y2={scaleYScore(yVal)}
                stroke="#172439"
                strokeDasharray="3 3"
              />
              <text
                x={margin.left - 6}
                y={scaleYScore(yVal) + 3}
                fill="#64748b"
                fontSize="9"
                fontWeight="bold"
                textAnchor="end"
              >
                {yVal}
              </text>
            </g>
          ))}

          {/* X-Axis Ticks */}
          {xTicks.map((xVal) => (
            <g key={`x-tick-${xVal}`}>
              <line
                x1={scaleX(xVal)}
                y1={margin.top + innerHeight}
                x2={scaleX(xVal)}
                y2={margin.top + innerHeight + 4}
                stroke="#334155"
              />
              <text
                x={scaleX(xVal)}
                y={margin.top + innerHeight + 15}
                fill="#64748b"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                {xVal}
              </text>
            </g>
          ))}

          {/* Dense Bars */}
          {sortedPoints.map((p, idx) => {
            const barX = scaleX(p.metric);
            const barY = scaleYScore(p.score);
            const barH = margin.top + innerHeight - barY;
            const barW = Math.max(1.5, Math.min(6, innerWidth / (points.length || 1)));

            return (
              <rect
                key={idx}
                x={barX - barW / 2}
                y={barY}
                width={barW}
                height={Math.max(1, barH)}
                fill={`url(#grad-col-${metricKey})`}
                opacity={0.8}
              >
                <title>{`${metricKey}: ${p.metric.toFixed(1)} | ${scoreKey}: ${p.score.toFixed(1)}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      {/* CHART 2: Dense Columnar Frequency Distribution Histogram */}
      <div style={{ backgroundColor: "#040812", borderRadius: "8px", border: "1px solid #131e33", padding: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 4px 6px", fontSize: "11px", color: "#94a3b8", fontWeight: "700" }}>
          <span>📈 DENSITY DISTRIBUTION: {metricKey}</span>
          <span style={{ color: accentColor }}>MAX FREQ: {histogramBins.maxCount}</span>
        </div>
        <svg width="100%" height={height - 30} viewBox={`0 0 ${plotWidth} ${height - 30}`} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`grad-hist-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
              <stop offset="100%" stopColor={themeColor} stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* X ticks */}
          {xTicks.map((xVal) => (
            <text
              key={`x-hist-tick-${xVal}`}
              x={scaleX(xVal)}
              y={margin.top + innerHeight - 30 + 15}
              fill="#64748b"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
            >
              {xVal}
            </text>
          ))}

          {/* Histogram Bins */}
          {histogramBins.bins.map((bin, i) => {
            const bx = scaleX(bin.x0);
            const bw = Math.max(2, scaleX(bin.x1) - bx - 1);
            const bh = ((bin.count / histogramBins.maxCount) * (innerHeight - 30));
            const by = margin.top + (innerHeight - 30) - bh;

            return (
              <rect
                key={i}
                x={bx}
                y={by}
                width={bw}
                height={Math.max(1, bh)}
                fill={`url(#grad-hist-${metricKey})`}
                rx={1}
              >
                <title>{`Range: [${bin.x0.toFixed(1)}, ${bin.x1.toFixed(1)}] | Count: ${bin.count}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      {/* STATISTICAL TELEMETRY CARD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "8px",
          backgroundColor: "#070c18",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #1e293b",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "bold" }}>MEAN</div>
          <div style={{ fontSize: "13px", color: "#ffffff", fontWeight: "900" }}>{stats.mean}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: "bold" }}>Q1 (25%)</div>
          <div style={{ fontSize: "13px", color: "#38bdf8", fontWeight: "900" }}>{stats.q1}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: themeColor, fontWeight: "bold" }}>Q2 (MEDIAN)</div>
          <div style={{ fontSize: "13px", color: themeColor, fontWeight: "900" }}>{stats.q2}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "#f59e0b", fontWeight: "bold" }}>Q3 (75%)</div>
          <div style={{ fontSize: "13px", color: "#f59e0b", fontWeight: "900" }}>{stats.q3}</div>
        </div>
      </div>
    </div>
  );
}

// Master Help Modal Component
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
        backgroundColor: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999, // Super high z-index to break free from headers
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          backgroundColor: "#070c18",
          border: "2px solid #06b6d4",
          boxShadow: "0 0 40px rgba(6, 182, 212, 0.4), 0 25px 60px rgba(0,0,0,0.9)",
          borderRadius: "14px",
          width: isMaximized ? "98vw" : "94vw",
          height: isMaximized ? "98vh" : "92vh",
          maxWidth: "1600px",
          display: "flex",
          flexDirection: "column",
          color: "#f8fafc",
          overflow: "hidden",
          transition: "all 0.2s ease-in-out",
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "2px solid #1e293b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#0b1329",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <span
              style={{
                color: "#ffcc00",
                fontSize: "15px",
                fontWeight: "900",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              QUANTUM TELEMETRY & METHODOLOGY INTELLIGENCE
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              style={{
                background: "#1e293b",
                border: "1px solid #475569",
                color: "#38bdf8",
                padding: "6px 12px",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {isMaximized ? "🗗 RESTORE" : "🗖 MAXIMIZE"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#dc2626",
                border: "none",
                color: "#ffffff",
                padding: "6px 12px",
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

        {/* Scrollable Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#38bdf8", fontWeight: "bold" }}>
              ⏳ Streaming live cross-sectional screener records...
            </div>
          ) : (
            <>
              {/* SECTION 1: 4 ANALYTICAL CHARTS GRID */}
              <div>
                <div style={{ color: "#38bdf8", fontSize: "14px", fontWeight: "900", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  📈 Cross-Sectional Score Distributions & Profitability / Growth Columns
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                    gap: "18px",
                  }}
                >
                  {/* Plot 1: roe-c vs F-score */}
                  <MetricAnalyticalCard
                    title="1. ROE-C VS F-SCORE"
                    metricKey="roe-c"
                    scoreKey="F-score"
                    data={data}
                    themeColor="#10b981"
                    accentColor="#06b6d4"
                    metricDomain={[-25, 50]}
                  />

                  {/* Plot 2: roa-c vs F-score */}
                  <MetricAnalyticalCard
                    title="2. ROA-C VS F-SCORE"
                    metricKey="roa-c"
                    scoreKey="F-score"
                    data={data}
                    themeColor="#3b82f6"
                    accentColor="#8b5cf6"
                    metricDomain={[-25, 50]}
                  />

                  {/* Plot 3: sgc vs F-score */}
                  <MetricAnalyticalCard
                    title="3. SGC VS F-SCORE"
                    metricKey="sgc"
                    scoreKey="F-score"
                    data={data}
                    themeColor="#f59e0b"
                    accentColor="#ef4444"
                    metricDomain={[-50, 100]}
                  />

                  {/* Plot 4: pgc vs F-score */}
                  <MetricAnalyticalCard
                    title="4. PGC VS F-SCORE"
                    metricKey="pgc"
                    scoreKey="F-score"
                    data={data}
                    themeColor="#ec4899"
                    accentColor="#f97316"
                    metricDomain={[-50, 100]}
                  />
                </div>
              </div>

              {/* SECTION 2: CONCISE METHODOLOGY SUMMARIES */}
              <div
                style={{
                  backgroundColor: "#09101d",
                  borderRadius: "10px",
                  border: "1px solid #1e293b",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                <div style={{ color: "#ffcc00", fontSize: "15px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase", borderBottom: "1px solid #1e293b", paddingBottom: "10px" }}>
                  📚 Calculation Methodology Summary
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
                  {/* F-Score Summary */}
                  <div style={{ backgroundColor: "#040812", padding: "14px", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
                    <h4 style={{ color: "#10b981", margin: "0 0 8px 0", fontSize: "14px" }}>
                      1. Fundamental Score (F-Score)
                    </h4>
                    <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", lineHeight: "1.6" }}>
                      • <b>Input Verification:</b> Checks multi-year Return on Equity (ROE) and Return on Assets (ROA) across current, 1-year, and 3-year periods.<br />
                      • <b>Boundary Clamping:</b> Raw ROE and ROA are bounded to <b>[-25, 50]</b> (`roe-c` and `roa-c`) to suppress extreme capital structure distortions.<br />
                      • <b>Logistic Weighting:</b> An S-curve weight (K) dynamically balances ROE against asset profitability (ROA).<br />
                      • <b>0–100 Scale:</b> Min-Max normalization assigns the final Fundamental score, with disqualified stocks set to 101.
                    </p>
                  </div>

                  {/* G-Score Summary */}
                  <div style={{ backgroundColor: "#040812", padding: "14px", borderRadius: "8px", borderLeft: "4px solid #f59e0b" }}>
                    <h4 style={{ color: "#f59e0b", margin: "0 0 8px 0", fontSize: "14px" }}>
                      2. Growth Score (G-Score)
                    </h4>
                    <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", lineHeight: "1.6" }}>
                      • <b>Sales & Profit Blends:</b> Merges TTM, latest quarter, and 3-year sales (`sg`) and 1-year/3-year profit growth (`pg`).<br />
                      • <b>Outlier Clamping:</b> Blended metrics are clamped strictly into <b>[-50, 100]</b> (`sgc` and `pgc`).<br />
                      • <b>Divergence Decay:</b> If sales and profit growth disagree heavily, profit weight drops toward 0.25 to prioritize reliable revenues.<br />
                      • <b>0–100 Scale:</b> Cross-sectional rescaling generates relative industry strength; missing metrics receive 101.
                    </p>
                  </div>

                  {/* T-Score Summary */}
                  <div style={{ backgroundColor: "#040812", padding: "14px", borderRadius: "8px", borderLeft: "4px solid #38bdf8" }}>
                    <h4 style={{ color: "#38bdf8", margin: "0 0 8px 0", fontSize: "14px" }}>
                      3. Technical Score (T-Score)
                    </h4>
                    <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", lineHeight: "1.6" }}>
                      • <b>DMA Engine (60%):</b> Measures price position relative to 50 DMA, 200 DMA, and 52-week extremes with volatility range dampening.<br />
                      • <b>Short-Term Returns (30%):</b> Weights 1-week, 1-month, and 3-month momentum against market-cap trimmed benchmarks.<br />
                      • <b>Long-Term Returns (10%):</b> Evaluates 6-month, 1-year, and 3-year performance vs broader market medians.<br />
                      • <b>Blended Composite:</b> Final combination creates a robust technical health metric.
                    </p>
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