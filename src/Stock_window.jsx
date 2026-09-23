import React, { useState, useEffect, useCallback } from 'react';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

const sanitizeKey = (key) =>
  String(key || '').trim().replace(/[.#$\[\]\/]/g, '').toUpperCase();

// ==========================================
// 1. 3D BUTTON COMPONENT (100% UNTOUCHED)
// ==========================================
const Button3D = ({ label, color, shadowColor, onClick, title, padding = '8px 16px' }) => {
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      title={title} 
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      onMouseLeave={() => setIsActive(false)}
      onClick={onClick}
      style={{
        padding: padding, 
        backgroundColor: color,
        color: '#ffffff',
        border: '1px solid #111',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '12px',
        cursor: 'pointer',
        width: '100%', 
        boxShadow: isActive ? `0 0px 0 ${shadowColor}` : `0 4px 0 ${shadowColor}`,
        transform: isActive ? 'translateY(4px)' : 'none',
        transition: 'all 0.1s ease',
        textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
        outline: 'none',
      }}
    >
      {label}
    </button>
  );
};

// ==========================================
// 2. VISUAL MAP PIN (100% UNTOUCHED LOGIC)
// ==========================================
const Marker = ({ value, color, circleSize, lineHeight, label, isTop = false, rawValue = null, scaleTo100 }) => {
  const positionPercent = scaleTo100(value);
  return (
    <div 
      title={`${label}: ₹${value}`}
      style={{
        position: 'absolute',
        [isTop ? 'bottom' : 'top']: '100%', 
        left: `${positionPercent}%`,
        display: 'flex',
        flexDirection: isTop ? 'column-reverse' : 'column',
        alignItems: 'center',
        transform: 'translateX(-50%)', 
        zIndex: isTop ? 10 : 5
      }}
    >
      {isTop ? (
        <div style={{ 
          width: 0, 
          height: 0, 
          borderLeft: `${circleSize}px solid transparent`, 
          borderRight: `${circleSize}px solid transparent`, 
          borderTop: `${circleSize * 1.5}px solid ${color}`,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))'
        }}></div>
      ) : (
        <>
          <div style={{ width: '2px', height: `${lineHeight}px`, backgroundColor: color, boxShadow: `0 0 3px ${color}` }}></div>
          <div style={{ width: `${circleSize}px`, height: `${circleSize}px`, backgroundColor: color, borderRadius: '50%', border: '1px solid #111', boxShadow: '0 2px 4px rgba(0,0,0,0.7)' }}></div>
        </>
      )}

      {rawValue !== null && (
        <div style={{ fontSize: '13px', color: '#FFFF00', marginBottom: isTop ? '4px' : '0', marginTop: isTop ? '0' : '4px', fontWeight: 'bold', textShadow: '1px 1px 2px #000', whiteSpace: 'nowrap' }}>
          ₹{rawValue}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. MAIN STOCK COMPONENT
// ==========================================
export default function Stock_window({ 
  code, name, ticker, nse,
  // Valuation
  pe, dpe, pb, dpb, ps, dy, bvgr, advdp,
  // Ratios
  roe0, roe3y, roa0, roa3y, roce0, roce3y,
  // Market Cap & Leverage
  mcap, pccap, de,
  // Growth
  ysg, sg_ttm, sg_3y, last_qtr,
  ypg, pg_1, pg_3,
  // Scores
  tScore, gScore, fScore,
  // Shareholding
  prh, dprh, fii, dfii, dii, ddii,
  // Meta
  review, group, remark, duration, sector, industry,
  isAutoMode, isFrozen, refreshRate, refreshTrigger, updateTrigger 
}) {
  const [fastData, setFastData] = useState({ CMP: 0, Tdy_chng: 0, Ydy_chng: 0 });
  const [slowData, setSlowData] = useState({
    "10MA": 0, "25MA": 0, "50MA": 0, "200MA": 0,
    "52WH": 0, "52WL": 0,
    "100H": 0, "100L": 0,
    "50H": 0, "50L": 0,
    "25H": 0, "25L": 0,
    "1W": 0, "1M": 0, "3M": 0, "1YR": 0, "3YR": 0, "RSI": 0
  });

  const [isRemarkOpen, setIsRemarkOpen] = useState(false);

  const openPopup = (url) => {
    if (url) {
      window.open(url, "_blank", "toolbar=no,menubar=no,scrollbars=yes,resizable=yes,top=100,left=200,width=1000,height=700");
    }
  };

  const primaryKey = (code || sanitizeKey(name) || sanitizeKey(ticker) || '').trim();
  const legacyTarget = (name || ticker || '').trim();

  const tvc_link = `https://in.tradingview.com/chart/?symbol=${nse || code || ticker}`;
  const yfc_link = `https://finance.yahoo.com/chart/${ticker || `${code}.NS`}#`;
  const scr_link = `https://www.screener.in/company/${code || nse}/consolidated/`; 

  const fetchStockData = useCallback(async () => {
    if (isFrozen || !primaryKey) return;

    try {
      // PARAM DATA: Strictly loaded from /param/<script> folder
      let paramRes = await fetch(`${FIREBASE_DB_URL}/param/${encodeURIComponent(primaryKey)}.json`);
      let data = paramRes.ok ? await paramRes.json() : null;

      if (!data && legacyTarget && legacyTarget !== primaryKey) {
        const fallbackRes = await fetch(`${FIREBASE_DB_URL}/param/${encodeURIComponent(legacyTarget)}.json`);
        if (fallbackRes.ok) data = await fallbackRes.json();
      }

      // LIVE OHLC DATA: Live candle endpoints
      let [liveRes0, liveRes1] = await Promise.all([
        fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(primaryKey)}/0.json`),
        fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(primaryKey)}/1.json`)
      ]);

      let c0 = liveRes0.ok ? await liveRes0.json() : null;
      let c1 = liveRes1.ok ? await liveRes1.json() : null;

      if (!c0 && !c1 && legacyTarget && legacyTarget !== primaryKey) {
        const [fb0, fb1] = await Promise.all([
          fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(legacyTarget)}/0.json`),
          fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(legacyTarget)}/1.json`)
        ]);
        if (fb0.ok) c0 = await fb0.json();
        if (fb1.ok) c1 = await fb1.json();
      }

      const currentCmp = Number(
        c0?.close ?? c0?.c ?? c1?.close ?? c1?.c ?? data?.CMP ?? data?.cmp ?? 0
      );

      setFastData({
        CMP: currentCmp,
        Tdy_chng: Number(data?.['2dy-%chng'] ?? data?.['Tdy-%chng'] ?? data?.tdyChange ?? 0),
        Ydy_chng: Number(data?.['Ydy-%chng'] ?? data?.ydyChange ?? 0)
      });

      setSlowData({
        "10MA": Number(data?.['10ma'] ?? data?.['10MA'] ?? 0),
        "25MA": Number(data?.['25ma'] ?? data?.['25MA'] ?? 0),
        "50MA": Number(data?.['50ma'] ?? data?.['50MA'] ?? 0),
        "200MA": Number(data?.['200ma'] ?? data?.['200MA'] ?? 0),
        // Range metrics strictly from /param folder
        "52WH": Number(data?.['52WH'] ?? data?.['52wh'] ?? 0),
        "52WL": Number(data?.['52WL'] ?? data?.['52wl'] ?? 0),
        "100H": Number(data?.['100H'] ?? data?.['100h'] ?? 0),
        "100L": Number(data?.['100L'] ?? data?.['100l'] ?? 0),
        "50H": Number(data?.['50H'] ?? data?.['50h'] ?? 0),
        "50L": Number(data?.['50L'] ?? data?.['50l'] ?? 0),
        "25H": Number(data?.['25H'] ?? data?.['25h'] ?? 0),
        "25L": Number(data?.['25L'] ?? data?.['25l'] ?? 0),
        "1W": Number(data?.['1wr'] ?? data?.['1W'] ?? 0),
        "1M": Number(data?.['1mr'] ?? data?.['1M'] ?? 0),
        "3M": Number(data?.['3mr'] ?? data?.['3M'] ?? 0),
        "1YR": Number(data?.['1yr'] ?? data?.['1YR'] ?? 0),
        "3YR": Number(data?.['3yr'] ?? data?.['3YR'] ?? 0),
        "RSI": Number(data?.RSI ?? data?.rsi ?? 0)
      });
    } catch (error) {
      console.error(`Error loading stock metrics for ${primaryKey}:`, error);
    }
  }, [primaryKey, legacyTarget, isFrozen]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  useEffect(() => {
    if (updateTrigger > 0 || refreshTrigger > 0) {
      fetchStockData();
    }
  }, [updateTrigger, refreshTrigger, fetchStockData]);

  useEffect(() => {
    let intervalId;
    if (isAutoMode && !isFrozen && refreshRate > 0) {
      intervalId = setInterval(fetchStockData, (refreshRate || 10) * 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoMode, isFrozen, refreshRate, fetchStockData]);

  const scaleTo100 = useCallback((value) => {
    const { "52WL": low52, "52WH": high52 } = slowData;
    if (!low52 || !high52 || high52 === low52 || !value) return 0;
    const rawPercentage = (((value - low52) / (high52 - low52)) * 100);
    return Math.max(0, Math.min(100, rawPercentage));
  }, [slowData]);

  // Scaled sub-range bar positions (100L/100H, 50L/50H, 25L/25H mapped to 52W range)
  const getSubRangeSpan = (low, high) => {
    if (!low || !high || !slowData["52WL"] || !slowData["52WH"]) return null;
    const left = scaleTo100(low);
    const right = scaleTo100(high);
    const width = Math.max(0, right - left);
    if (width === 0) return null;
    return {
      left: `${left}%`,
      width: `${width}%`
    };
  };

  const span100 = getSubRangeSpan(slowData["100L"], slowData["100H"]);
  const span50 = getSubRangeSpan(slowData["50L"], slowData["50H"]);
  const span25 = getSubRangeSpan(slowData["25L"], slowData["25H"]);

  const rangeValue = slowData["52WL"] 
    ? (((slowData["52WH"] - slowData["52WL"]) / slowData["52WL"]) * 100).toFixed(2) 
    : "0.00";

  // Legend size variable
  const Legend_Size = "9px";

  // ========================================================
  // 🎨 FRONT LOOK & COLOR PALETTE
  // ========================================================
  const COLOR_GREEN = "#00cc00"; 
  const COLOR_RED = "#e62e00";   
  const STATIC_TEXT_COLOR = "#B5C3FF"; 
  const VALUE_COLOR = "#FCC105";       
  const BORDER_COLOR = "#2a2f45";      

  const renderStars = () => {
    let starCount = 0;
    if (review && String(review).includes("STAR")) {
      starCount = parseInt(String(review).split(" ")[0]) || 0;
    }
    return (
      <span style={{ fontSize: '18px', letterSpacing: '2px' }}>
        {[1, 2, 3, 4, 5].map((num) => (
          <span key={num} style={{ color: num <= starCount ? '#FFD700' : '#A0AAB5' }}>★</span>
        ))}
      </span>
    );
  };

  const displayName = name ? name.split('(')[0].trim() : (code || '');

  const fmt = (v) => (v !== undefined && v !== null && v !== "" ? v : "xx.xx");
  const fmtPct = (v) => {
    if (v === undefined || v === null || v === "") return "xx.xx %";
    const num = parseFloat(v);
    return `${isNaN(num) ? v : num.toFixed(2)} %`;
  };
  const getDiffColor = (v) => {
    const num = parseFloat(v);
    if (isNaN(num)) return VALUE_COLOR;
    return num >= 0 ? COLOR_GREEN : COLOR_RED;
  };

  return (
    <div className="stock-window-wrapper" style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: '12px',
      width: '98%',
      margin: '0 auto 14px auto',
      position: 'relative',
      opacity: isFrozen ? 0.7 : 1,
      transition: 'opacity 0.3s ease',
      boxSizing: 'border-box'
    }}>
      
      {/* Responsive Stylesheet */}
      <style>{`
        @media (max-width: 1024px) {
          .stock-window-wrapper {
            flex-direction: column !important;
          }
          .stock-main-panel {
            width: 100% !important;
            flex: none !important;
          }
          .stock-extended-panel {
            width: 100% !important;
            flex: none !important;
          }
        }
      `}</style>

      {/* ======================================================== */}
      {/* LEFT: 65% MAIN TECHNICAL FACE-PLATE                      */}
      {/* ======================================================== */}
      <div className="stock-main-panel" style={{
        flex: '65',
        position: 'relative',
        padding: '15px',
        fontFamily: 'sans-serif',
        backgroundColor: '#000000',
        color: '#e0e0e0',
        border: '4px solid #C0C0C0',
        borderRadius: '8px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        
        {/* REVIEW/REMARK BADGE */}
        <div style={{ position: 'absolute', top: '4px', right: '10px', zIndex: 20, width: '130px' }}>
          <Button3D 
            label={renderStars()} 
            title={`GROUP: ${group || 'N/A'}\nDURATION: ${duration || 'N/A'}\nSECTOR: ${sector || 'N/A'}\nINDUSTRY: ${industry || 'N/A'}`} 
            color="#708090"        
            shadowColor="#4A5560"
            padding="4px 16px" 
            onClick={() => setIsRemarkOpen(true)} 
          />
        </div>

        {/* STOCK NAME, CODE & (LAST QTR) */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '15px', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#f7d026', fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {displayName}
          </h2>
          {code && (
            <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: 'bold', backgroundColor: '#0f172a', padding: '2px 8px', borderRadius: '4px', border: '1px solid #1e3a8a' }}>
              {code}
            </span>
          )}
          <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            (LAST QTR: {last_qtr || "JUNE, 2026"})
          </span>
        </div>

        {/* 8-COLUMN DATA TABLE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', backgroundColor: '#111111', border: '1px solid #444', borderRadius: '6px', marginBottom: '14px', textAlign: 'center', overflow: 'hidden' }}>
          {['Tdy-%chng', 'Ydy-%chng', '1W', '1M', '3M', '1YR', '3YR', 'RSI'].map((head, idx) => (
            <div key={`h-${idx}`} style={{ padding: '8px 2px', fontSize: '12px', fontWeight: '900', backgroundColor: '#1a1a1a', borderRight: idx < 7 ? '1px solid #444' : 'none', borderBottom: '1px solid #444', color: '#cccccc' }}>
              {head}
            </div>
          ))}
          
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: fastData.Tdy_chng >= 0 ? COLOR_GREEN : COLOR_RED }}>{fastData.Tdy_chng}%</div>
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: fastData.Ydy_chng >= 0 ? COLOR_GREEN : COLOR_RED }}>{fastData.Ydy_chng}%</div>
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: slowData["1W"] >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData["1W"]}%</div>
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: slowData["1M"] >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData["1M"]}%</div>
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: slowData["3M"] >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData["3M"]}%</div>
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: slowData["1YR"] >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData["1YR"]}%</div>
          <div style={{ padding: '10px 2px', borderRight: '1px solid #444', fontSize: '14px', fontWeight: 'bold', color: slowData["3YR"] >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData["3YR"]}%</div>
          <div style={{ padding: '10px 2px', fontSize: '14px', fontWeight: 'bold', color: slowData.RSI > 50 ? COLOR_GREEN : COLOR_RED }}>{slowData.RSI}</div>
        </div>

        {/* 3. LEGEND STRIP (Left-aligned, below data table, above scale visualizer) */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '14px', 
          fontSize: Legend_Size, 
          fontWeight: 'bold', 
          letterSpacing: '0.8px',
          marginBottom: '6px',
          paddingLeft: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#e2e8f0' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'linear-gradient(180deg, #22d3ee, #0891b2)', border: '1px solid #164e63', display: 'inline-block' }}></span>
            52WR
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#e2e8f0' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'linear-gradient(180deg, #fb7185, #e11d48)', border: '1px solid #881337', display: 'inline-block' }}></span>
            100DR
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#e2e8f0' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'linear-gradient(180deg, #818cf8, #4f46e5)', border: '1px solid #312e81', display: 'inline-block' }}></span>
            50DR
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#e2e8f0' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'linear-gradient(180deg, #fbbf24, #ea580c)', border: '1px solid #7c2d12', display: 'inline-block' }}></span>
            25DR
          </div>
        </div>

        {/* SCALE TRACK & QUICK BUTTONS */}
        <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
          <div style={{ width: '85%', display: 'flex', flexDirection: 'column', paddingRight: '15px', borderRight: '1px dashed #444' }}>
            <div style={{ position: 'relative', height: '140px', width: '100%' }}>
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '13px', color: '#cccccc' }}>52WL</div>
              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '13px', color: '#cccccc' }}>52WH</div>

              {/* 3D MULTI-LAYER RANGE BAR */}
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50px', 
                right: '50px', 
                height: '18px', 
                background: 'linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)', /* 52WR: Cyan Base */
                transform: 'translateY(-50%)', 
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.8), inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.6)',
                zIndex: 1
              }}>
                {/* 100DR Layer (Crimson Red) */}
                {span100 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: span100.left,
                    width: span100.width,
                    background: 'linear-gradient(180deg, #fb7185 0%, #e11d48 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.6)',
                    borderRight: '1px solid rgba(255,255,255,0.6)',
                    boxShadow: '0 0 6px rgba(225,29,72,0.6), inset 0 1px 2px rgba(255,255,255,0.4)',
                    zIndex: 2
                  }} />
                )}

                {/* 50DR Layer (Royal Indigo/Blue) */}
                {span50 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: span50.left,
                    width: span50.width,
                    background: 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.7)',
                    borderRight: '1px solid rgba(255,255,255,0.7)',
                    boxShadow: '0 0 7px rgba(79,70,229,0.7), inset 0 1px 2px rgba(255,255,255,0.45)',
                    zIndex: 3
                  }} />
                )}

                {/* 25DR Layer (Sunset Tangerine Orange) */}
                {span25 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: span25.left,
                    width: span25.width,
                    background: 'linear-gradient(180deg, #E3A602 0%, #A17603 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.9)',
                    borderRight: '1px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 0 8px rgba(234,88,12,0.8), inset 0 1px 2px rgba(255,255,255,0.5)',
                    zIndex: 4
                  }} />
                )}

                {/* CMP Marker */}
                <Marker value={fastData.CMP} scaleTo100={scaleTo100} color="#00E5FF" circleSize={12} lineHeight={14} label="CMP" isTop={true} rawValue={fastData.CMP} />
                
                {/* Moving Averages */}
                <Marker value={slowData["200MA"]} scaleTo100={scaleTo100} color="rgba(255, 68, 68, 0.95)" circleSize={14} lineHeight={40} label="200MA" />
                <Marker value={slowData["50MA"]}  scaleTo100={scaleTo100} color="rgba(255, 152, 0, 0.95)" circleSize={12} lineHeight={26} label="50MA" />
                <Marker value={slowData["25MA"]}  scaleTo100={scaleTo100} color="rgba(255, 235, 59, 0.95)" circleSize={10} lineHeight={16} label="25MA" />
                <Marker value={slowData["10MA"]}  scaleTo100={scaleTo100} color="rgba(0, 230, 118, 0.95)" circleSize={8} lineHeight={8} label="10MA" />
              </div>
            </div>

            <div style={{ marginTop: '5px', color: '#cccccc', fontWeight: '900', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '1px' }}>
              &lt; <span style={{ flex: 1, height: '1px', backgroundColor: '#555', margin: '0 15px' }}></span> 
              RANGE: {rangeValue}% 
              <span style={{ flex: 1, height: '1px', backgroundColor: '#555', margin: '0 15px' }}></span> &gt;
            </div>
          </div>

          <div style={{ width: '15%', paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <Button3D label="SCR" color="#0A5E01" shadowColor="#0E6B30" onClick={() => openPopup(scr_link)} />
            <Button3D label="TVC" color="#2962FF" shadowColor="#1565C0" onClick={() => openPopup(tvc_link)} />
            <Button3D label="YFC" color="#9C27B0" shadowColor="#6A1B9A" onClick={() => openPopup(yfc_link)} />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT: 35% EXTENDED PANEL (100% UNTOUCHED)                */}
      {/* ======================================================== */}
      <div className="stock-extended-panel" style={{
        flex: '35',
        position: 'relative',
        backgroundColor: '#000000',
        border: '4px solid #C0C0C0',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '4px 4px 10px rgba(0,0,0,0.6)',
        boxSizing: 'border-box'
      }}>
        <table style={{
          width: '100%',
          height: '100%',
          borderCollapse: 'collapse',
          fontSize: '11.5px',
          fontWeight: 'bold',
          tableLayout: 'fixed'
        }}>
          <tbody>
            {/* ROW 1: PE (value + delta on same line) | DY | BVgr */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td style={{ width: '42%', padding: '4px 2px', whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>PE : </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(pe)}</span>
                <span style={{ color: getDiffColor(dpe), marginLeft: '3px' }}>
                  ({fmtPct(dpe)})
                </span>
              </td>
              <td style={{ width: '29%', padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}`, whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>DY: </span>
                <span style={{ color: VALUE_COLOR }}>{fmtPct(dy)}</span>
              </td>
              <td style={{ width: '29%', padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}`, whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>BVgr(Y): </span>
                <span style={{ color: VALUE_COLOR }}>{fmtPct(bvgr)}</span>
              </td>
            </tr>

            {/* ROW 2: PB (value + delta on same line) | PS | Payout */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td style={{ padding: '4px 2px', whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>PB : </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(pb)}</span>
                <span style={{ color: getDiffColor(dpb), marginLeft: '3px' }}>
                  ({fmtPct(dpb)})
                </span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}`, whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>PS: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(ps)}</span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}`, whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>Payout: </span>
                <span style={{ color: VALUE_COLOR }}>{fmtPct(advdp)}</span>
              </td>
            </tr>

            {/* ROW 3: ROE | ROA | ROCE */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td style={{ padding: '4px 2px' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>ROE: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(roe0)}</span>
                <span style={{ fontSize: '10.5px', color: STATIC_TEXT_COLOR, marginLeft: '3px' }}>
                  (<span style={{ color: VALUE_COLOR }}>{fmt(roe3y)}</span>)
                </span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>ROA: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(roa0)}</span>
                <span style={{ fontSize: '10.5px', color: STATIC_TEXT_COLOR, marginLeft: '3px' }}>
                  (<span style={{ color: VALUE_COLOR }}>{fmt(roa3y)}</span>)
                </span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>ROCE: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(roce0)}</span>
                <span style={{ fontSize: '10.5px', color: STATIC_TEXT_COLOR, marginLeft: '3px' }}>
                  (<span style={{ color: VALUE_COLOR }}>{fmt(roce3y)}</span>)
                </span>
              </td>
            </tr>

            {/* ROW 4: MCAP | PCAP | DE */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td style={{ padding: '4px 2px' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>MCAP: </span>
                <span style={{ color: VALUE_COLOR, fontSize: '12px' }}>{fmt(mcap)}</span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>PCAP: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(pccap)}</span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>DE: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(de)}</span>
              </td>
            </tr>

            {/* ROW 5: SALES GROWTH (Full Width) */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td colSpan={3} style={{ padding: '5px 2px', whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>SG: </span>
                <span style={{ color: STATIC_TEXT_COLOR }}>(YOYQ – <span style={{ color: getDiffColor(ysg) }}>{fmtPct(ysg)}</span>) </span>
                <span style={{ color: STATIC_TEXT_COLOR }}>[TTM – <span style={{ color: getDiffColor(sg_ttm) }}>{fmtPct(sg_ttm)}</span>] </span>
                <span style={{ color: STATIC_TEXT_COLOR }}>[3Y – <span style={{ color: getDiffColor(sg_3y) }}>{fmtPct(sg_3y)}</span>]</span>
              </td>
            </tr>

            {/* ROW 6: PROFIT GROWTH (Full Width) */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td colSpan={3} style={{ padding: '5px 2px', whiteSpace: 'nowrap' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>PG: </span>
                <span style={{ color: STATIC_TEXT_COLOR }}>(YOYQ – <span style={{ color: getDiffColor(ypg) }}>{fmtPct(ypg)}</span>) </span>
                <span style={{ color: STATIC_TEXT_COLOR }}>[TTM – <span style={{ color: getDiffColor(pg_1) }}>{fmtPct(pg_1)}</span>] </span>
                <span style={{ color: STATIC_TEXT_COLOR }}>[3Y – <span style={{ color: getDiffColor(pg_3) }}>{fmtPct(pg_3)}</span>]</span>
              </td>
            </tr>

            {/* ROW 7: T-SCORE | G-SCORE | F-SCORE */}
            <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
              <td style={{ padding: '4px 2px' }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>T-SCORE: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(tScore)}</span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>G-SCORE: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(gScore)}</span>
              </td>
              <td style={{ padding: '4px 2px', borderLeft: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ color: STATIC_TEXT_COLOR }}>F-SCORE: </span>
                <span style={{ color: VALUE_COLOR }}>{fmt(fScore)}</span>
              </td>
            </tr>

            {/* ROW 8: STACKED SHAREHOLDING (Left-Aligned, Same Font Size) */}
            <tr>
              <td style={{ padding: '3px 4px', textAlign: 'left' }}>
                <div style={{ color: STATIC_TEXT_COLOR, fontSize: '10.5px', marginBottom: '2px' }}>PRMTR</div>
                <div style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: VALUE_COLOR }}>{fmtPct(prh)} </span>
                  <span style={{ color: getDiffColor(dprh) }}>({fmtPct(dprh)})</span>
                </div>
              </td>
              <td style={{ padding: '3px 4px', borderLeft: `1px solid ${BORDER_COLOR}`, textAlign: 'left' }}>
                <div style={{ color: STATIC_TEXT_COLOR, fontSize: '10.5px', marginBottom: '2px' }}>FII</div>
                <div style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: VALUE_COLOR }}>{fmtPct(fii)} </span>
                  <span style={{ color: getDiffColor(dfii) }}>({fmtPct(dfii)})</span>
                </div>
              </td>
              <td style={{ padding: '3px 4px', borderLeft: `1px solid ${BORDER_COLOR}`, textAlign: 'left' }}>
                <div style={{ color: STATIC_TEXT_COLOR, fontSize: '10.5px', marginBottom: '2px' }}>DII</div>
                <div style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: VALUE_COLOR }}>{fmtPct(dii)} </span>
                  <span style={{ color: getDiffColor(ddii) }}>({fmtPct(ddii)})</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* REMARK NOTEBOOK MODAL (100% UNTOUCHED) */}
      {isRemarkOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#121212', border: '2px solid #C0C0C0', borderRadius: '10px', padding: '25px', width: '450px', height: '350px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', position: 'relative', boxSizing: 'border-box' }}>
            <button onClick={() => setIsRemarkOpen(false)} style={{ position: 'absolute', top: '10px', right: '15px', background: 'transparent', border: 'none', color: '#ff5252', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            <h2 style={{ marginTop: 0, color: '#FFD700', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Remark: {displayName}</h2>
            <p style={{ color: '#ffffff', fontSize: '16px', lineHeight: '1.6' }}>{remark || "No remarks available for this stock."}</p>
          </div>
        </div>
      )}

    </div>
  );
}
