import React, { useState, useEffect, useCallback } from 'react';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

const sanitizeKey = (key) =>
  String(key || '').trim().replace(/[.#$\[\]\/]/g, '').toUpperCase();

// ==========================================
// 1. 3D BUTTON COMPONENT
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
// 2. VISUAL MAP PIN (Scale Visualizer)
// ==========================================
const Marker = ({ value, color, circleSize, lineHeight, label, isTop = false, rawValue = null, scaleTo100 }) => {
  const positionPercent = scaleTo100(value);
  return (
    <div 
      title={`${label}: ₹${value}`}
      style={{
        position: 'absolute',
        [isTop ? 'bottom' : 'top']: '50%', 
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
          borderTop: `${circleSize * 1.5}px solid ${color}` 
        }}></div>
      ) : (
        <>
          <div style={{ width: '2px', height: `${lineHeight}px`, backgroundColor: color }}></div>
          <div style={{ width: `${circleSize}px`, height: `${circleSize}px`, backgroundColor: color, borderRadius: '50%', border: '1px solid #111' }}></div>
        </>
      )}

      {rawValue !== null && (
        <div style={{ fontSize: '13px', color: '#FFFF00', marginBottom: isTop ? '4px' : '0', marginTop: isTop ? '0' : '4px', fontWeight: '100' }}>
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
  pe, dpe, pb, dpb, ps, dy, tScore, fScore, gScore, review, group, remark, duration,
  sg_ttm, ysg, pg_1, ypg, sector, industry, pccap,
  ex_div_date, last_quarter_name, next_quarter_date,
  isAutoMode, isFrozen, refreshRate, refreshTrigger, updateTrigger 
}) {
  const [fastData, setFastData] = useState({ CMP: 0, Tdy_chng: 0, Ydy_chng: 0 });
  const [slowData, setSlowData] = useState({
    "10MA": 0, "25MA": 0, "50MA": 0, "200MA": 0,
    "52WH": 0, "52WL": 0, "1W": 0, "1M": 0, "3M": 0, "1YR": 0, "3YR": 0, "RSI": 0
  });

  const [isRemarkOpen, setIsRemarkOpen] = useState(false);

  const openPopup = (url) => {
    if (url) {
      window.open(url, "_blank", "toolbar=no,menubar=no,scrollbars=yes,resizable=yes,top=100,left=200,width=1000,height=700");
    }
  };

  // Primary lookup priority: Clean CODE -> sanitized name -> clean ticker
  const primaryKey = (code || sanitizeKey(name) || sanitizeKey(ticker) || '').trim();
  const legacyTarget = (name || ticker || '').trim();

  const tvc_link = `https://in.tradingview.com/chart/?symbol=${nse || code || ticker}`;
  const yfc_link = `https://finance.yahoo.com/chart/${ticker || `${code}.NS`}#`;
  const scr_link = `https://www.screener.in/company/${code || nse}/consolidated/`; 

  const fetchStockData = useCallback(async () => {
    if (isFrozen || !primaryKey) return;

    try {
      // 1. Fetch parameters with primary key (fallback to legacy raw name)
      let paramRes = await fetch(`${FIREBASE_DB_URL}/param/${encodeURIComponent(primaryKey)}.json`);
      let data = paramRes.ok ? await paramRes.json() : null;

      if (!data && legacyTarget && legacyTarget !== primaryKey) {
        const fallbackRes = await fetch(`${FIREBASE_DB_URL}/param/${encodeURIComponent(legacyTarget)}.json`);
        if (fallbackRes.ok) data = await fallbackRes.json();
      }

      // 2. Fetch live candles 0 & 1
      let [liveRes0, liveRes1] = await Promise.all([
        fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(primaryKey)}/0.json`),
        fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(primaryKey)}/1.json`)
      ]);

      let c0 = liveRes0.ok ? await liveRes0.json() : null;
      let c1 = liveRes1.ok ? await liveRes1.json() : null;

      // Fallback candle query using legacy target if primary returned null
      if (!c0 && !c1 && legacyTarget && legacyTarget !== primaryKey) {
        const [fb0, fb1] = await Promise.all([
          fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(legacyTarget)}/0.json`),
          fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(legacyTarget)}/1.json`)
        ]);
        if (fb0.ok) c0 = await fb0.json();
        if (fb1.ok) c1 = await fb1.json();
      }

      // 3. Resolve Current Price (Index 0 -> Index 1 -> CMP from param)
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
        "52WH": Number(data?.['52wh'] ?? data?.['52WH'] ?? 0),
        "52WL": Number(data?.['52wl'] ?? data?.['52WL'] ?? 0),
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
    if (!low52 || !high52 || high52 === low52) return 0;
    const rawPercentage = (((value - low52) / (high52 - low52)) * 100);
    return Math.max(0, Math.min(100, rawPercentage));
  }, [slowData]);

  const rangeValue = slowData["52WL"] 
    ? (((slowData["52WH"] - slowData["52WL"]) / slowData["52WL"]) * 100).toFixed(2) 
    : "0.00";

  const COLOR_GREEN = "#00cc00"; 
  const COLOR_RED = "#e62e00";   
  const DARK_GREEN = "#00cc00"; 
  const DARK_RED = "#e62e00";   
  const GRP_VALUATION = "#e6b800"; 
  const GRP_GROWTH = "#FF9800"; 
  const GRP_SCORES = "#005ce6";    

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

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '2%', width: '98%', margin: '0 auto', position: 'relative', opacity: isFrozen ? 0.7 : 1, transition: 'opacity 0.3s ease', boxSizing: 'border-box' }}>
      
      {/* ========================================== */}
      {/* LEFT: 70% MAIN TECHNICAL FACE-PLATE        */}
      {/* ========================================== */}
      <div style={{ flex: '7', position: 'relative', padding: '15px', fontFamily: 'sans-serif', backgroundColor: '#000000', color: '#e0e0e0', border: '4px solid #C0C0C0', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}>
        
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

        {/* STOCK NAME AND CODE */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '15px', gap: '10px' }}>
          <h2 style={{ margin: 0, color: '#f7d026', fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {displayName}
          </h2>
          {code && (
            <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: 'bold', backgroundColor: '#0f172a', padding: '2px 8px', borderRadius: '4px', border: '1px solid #1e3a8a' }}>
              {code}
            </span>
          )}
        </div>

        {/* 8-COLUMN DATA TABLE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', backgroundColor: '#111111', border: '1px solid #444', borderRadius: '6px', marginBottom: '25px', textAlign: 'center', overflow: 'hidden' }}>
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

        {/* SCALE TRACK & QUICK BUTTONS */}
        <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
          <div style={{ width: '85%', display: 'flex', flexDirection: 'column', paddingRight: '15px', borderRight: '1px dashed #444' }}>
            <div style={{ position: 'relative', height: '110px', width: '100%' }}>
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '12px', color: '#cccccc' }}>52WL</div>
              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '12px', color: '#cccccc' }}>52WH</div>

              <div style={{ position: 'absolute', top: '50%', left: '50px', right: '50px', height: '3px', backgroundColor: '#666', transform: 'translateY(-50%)', borderRadius: '2px' }}>
                <Marker value={fastData.CMP} scaleTo100={scaleTo100} color="rgba(33, 150, 243, 0.95)" circleSize={12} lineHeight={12} label="CMP" isTop={true} rawValue={fastData.CMP} />
                <Marker value={slowData["200MA"]} scaleTo100={scaleTo100} color="rgba(255, 68, 68, 0.85)" circleSize={14} lineHeight={40} label="200MA" />
                <Marker value={slowData["50MA"]}  scaleTo100={scaleTo100} color="rgba(255, 152, 0, 0.85)" circleSize={12} lineHeight={26} label="50MA" />
                <Marker value={slowData["25MA"]}  scaleTo100={scaleTo100} color="rgba(255, 235, 59, 0.85)" circleSize={10} lineHeight={16} label="25MA" />
                <Marker value={slowData["10MA"]}  scaleTo100={scaleTo100} color="rgba(0, 230, 118, 0.9)" circleSize={8} lineHeight={8} label="10MA" />
              </div>
            </div>
            <div style={{ color: '#cccccc', fontWeight: '900', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '1px' }}>
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

      {/* ========================================== */}
      {/* RIGHT: 30% EXTENSION PANEL                 */}
      {/* ========================================== */}
      <div style={{ flex: '3', position: 'relative', backgroundColor: '#000000', border: '4px solid #C0C0C0', borderRadius: '8px', padding: '15px', color: '#ffffff', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '4px 4px 10px rgba(0,0,0,0.6)', boxSizing: 'border-box' }}>
        
        {/* VALUATION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <div><span style={{color: GRP_VALUATION}}>PE:</span> <span style={{color: '#fff'}}>{pe ?? '-'}</span> (<span style={{color: Number(dpe) < 0 ? COLOR_RED : COLOR_GREEN}}>{dpe ?? '-'}%</span>)</div>
          <div><span style={{color: GRP_VALUATION}}>PB:</span> <span style={{color: '#fff'}}>{pb ?? '-'}</span> (<span style={{color: Number(dpb) < 0 ? COLOR_RED : COLOR_GREEN}}>{dpb ?? '-'}%</span>)</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <div><span style={{color: GRP_VALUATION}}>PS:</span> <span style={{color: '#fff'}}>{ps ?? '-'}</span></div>
          <div><span style={{color: GRP_VALUATION}}>D. Yield:</span> <span style={{color: '#fff'}}>{dy ?? '-'}%</span></div>
        </div>

        <hr style={{ borderColor: '#333', margin: '2px 0', width: '100%' }} />

        {/* GROWTH */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 'bold', fontSize: '13px' }}>
          <div>
            <span style={{color: GRP_GROWTH}}>SG: </span>
            <span style={{color: '#cccccc'}}>TTM-</span>
            <span style={{color: Number(sg_ttm) > 0 ? DARK_GREEN : DARK_RED}}>{sg_ttm || "N/A"}% </span>
            <span style={{color: '#cccccc'}}>(Q-</span>
            <span style={{color: Number(ysg) > 0 ? DARK_GREEN : DARK_RED}}>{ysg || "N/A"}%</span>
            <span style={{color: '#cccccc'}}>)</span>
          </div>
          <div>
            <span style={{color: GRP_GROWTH}}>PG: </span>
            <span style={{color: '#cccccc'}}>TTM-</span>
            <span style={{color: Number(pg_1) > 0 ? DARK_GREEN : DARK_RED}}>{pg_1 || "N/A"}% </span>
            <span style={{color: '#cccccc'}}>(Q-</span>
            <span style={{color: Number(ypg) > 0 ? DARK_GREEN : DARK_RED}}>{ypg || "N/A"}%</span>
            <span style={{color: '#cccccc'}}>)</span>
          </div>
        </div>

        <hr style={{ borderColor: '#333', margin: '2px 0', width: '100%' }} />
        
        {/* SCORES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <div><span style={{color: GRP_SCORES}}>T-Scr:</span> <span style={{color: '#fff'}}>{tScore ?? '-'}</span></div>
          <div><span style={{color: GRP_SCORES}}>F-Scr:</span> <span style={{color: '#fff'}}>{fScore ?? '-'}</span></div>
          <div><span style={{color: GRP_SCORES}}>G-Scr:</span> <span style={{color: '#fff'}}>{gScore ?? '-'}</span></div>
        </div>

        <hr style={{ borderColor: '#333', margin: '2px 0', width: '100%' }} />

        {/* CORPORATE DATES TIER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontFamily: 'sans-serif' }}>
          <div>
            <span style={{ color: '#b36b00', fontWeight: 'bold', textTransform: 'uppercase' }}>Ex-dividend: </span>
            <span style={{ color: '#a6a6a6', fontWeight: 'bold' }}>{ex_div_date || "N/A"}</span>
          </div>
          <div>
            <span style={{ color: '#b36b00', fontWeight: 'bold', textTransform: 'uppercase' }}>Latest Quarter: </span>
            <span style={{ color: '#a6a6a6', fontWeight: 'bold' }}>{last_quarter_name || "N/A"}</span>
          </div>
          <div>
            <span style={{ color: '#b36b00', fontWeight: 'bold', textTransform: 'uppercase' }}>Next Quarter Date: </span>
            <span style={{ color: '#a6a6a6', fontWeight: 'bold' }}>{next_quarter_date || "N/A"}</span>
          </div>
          
          <hr style={{ borderColor: '#333', margin: '2px 0', width: '100%' }} />
          
          <div style={{ fontFamily: 'monospace', fontSize: '13px', marginTop: '2px' }}>
            <span style={{ color: '#cc6600', fontWeight: 'bold', textTransform: 'uppercase' }}>Mkt Cap Rank: </span>
            <span style={{ color: '#80b3ff', fontWeight: 'bold' }}>{pccap ?? "N/A"}</span>
          </div>
        </div>

      </div>

      {/* REMARK NOTEBOOK MODAL */}
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