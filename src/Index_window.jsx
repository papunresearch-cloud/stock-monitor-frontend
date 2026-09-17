import React, { useState, useEffect, useCallback } from 'react';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

// Key sanitizer matching backend firebase_manager.py
const sanitizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .trim()
    .replace(/[.#$/[\]]/g, '_');
};

// ==========================================
// 1. 3D BUTTON COMPONENT
// ==========================================
const Button3D = ({ label, color, shadowColor, onClick }) => {
  const [isActive, setIsActive] = useState(false);

  return (
    <button
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      onMouseLeave={() => setIsActive(false)}
      onClick={onClick}
      style={{
        padding: '10px 20px', 
        backgroundColor: color,
        color: '#ffffff',
        border: '1px solid #111',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '14px',
        cursor: 'pointer',
        width: '100%', 
        boxShadow: isActive ? `0 0px 0 ${shadowColor}` : `0 5px 0 ${shadowColor}`,
        transform: isActive ? 'translateY(5px)' : 'none',
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
        cursor: 'crosshair', 
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
        <div style={{ fontSize: '14px', color: '#ffffff', marginBottom: isTop ? '4px' : '0', marginTop: isTop ? '0' : '4px', fontWeight: 'bold' }}>
          ₹{rawValue}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. MAIN INDEX COMPONENT
// ==========================================
export default function Index_window({ 
  indexName = "NIFTY50",
  ticker = "^NSEI", 
  isAutoMode,
  isFrozen,
  refreshRate,
  refreshTrigger,
  updateTrigger 
}) {
  const [fastData, setFastData] = useState({ cmp: 0, tdyChange: 0, ydyChange: 0 });
  const [slowData, setSlowData] = useState({
    ma10: 0, ma25: 0, ma50: 0, ma200: 0, high52: 0, low52: 0,
    return1W: 0, return1M: 0, return3M: 0, return1Yr: 0, return3Yr: 0,
    rsi: 0, yfc_link: "#", tvc_link: "#" 
  });

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openPopup = (url) => {
    if (url && url !== "#") {
      window.open(url, "_blank", "toolbar=no,menubar=no,scrollbars=yes,resizable=yes,top=100,left=200,width=1000,height=700");
    }
  };

  const fetchIndexData = useCallback(async () => {
    if (isFrozen) return;

    // Build list of candidate keys to check in Firebase (Name, Ticker, Sanitized)
    const targets = [
      (indexName || "").trim(),
      sanitizeKey(indexName),
      (ticker || "").trim(),
      sanitizeKey(ticker)
    ].filter(Boolean);

    const timestamp = new Date().getTime();

    try {
      let data = null;
      let c0 = null;
      let c1 = null;

      // Probe candidate paths for parameter and candle data
      for (const target of targets) {
        if (!data) {
          const pRes = await fetch(`${FIREBASE_DB_URL}/param/${encodeURIComponent(target)}.json?_=${timestamp}`);
          if (pRes.ok) {
            const pVal = await pRes.json();
            if (pVal) data = pVal;
          }
        }
        if (!data) {
          const iRes = await fetch(`${FIREBASE_DB_URL}/indices/${encodeURIComponent(target)}.json?_=${timestamp}`);
          if (iRes.ok) {
            const iVal = await iRes.json();
            if (iVal) data = iVal;
          }
        }
        if (!c0) {
          const c0Res = await fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(target)}/0.json?_=${timestamp}`);
          if (c0Res.ok) {
            const c0Val = await c0Res.json();
            if (c0Val) c0 = c0Val;
          }
        }
        if (!c1) {
          const c1Res = await fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(target)}/1.json?_=${timestamp}`);
          if (c1Res.ok) {
            const c1Val = await c1Res.json();
            if (c1Val) c1 = c1Val;
          }
        }
        if (data && c0) break;
      }

      // Robust CMP resolution: Live candle (0) -> Param CMP -> Yesterday candle (1)
      const currentCmp = Number(c0?.close ?? c0?.c ?? data?.CMP ?? c1?.close ?? c1?.c ?? 0);

      setFastData({
        cmp: currentCmp,
        tdyChange: Number(data?.['2dy-%chng'] ?? data?.['%Chg (T)'] ?? data?.['Tdy-%chng'] ?? data?.tdyChange ?? 0),
        ydyChange: Number(data?.['Ydy-%chng'] ?? data?.ydyChange ?? 0)
      });

      setSlowData({
        ma10: Number(data?.['10ma'] ?? data?.['10MA'] ?? data?.ma10 ?? 0),
        ma25: Number(data?.['25ma'] ?? data?.['25MA'] ?? data?.ma25 ?? 0),
        ma50: Number(data?.['50ma'] ?? data?.['50MA'] ?? data?.ma50 ?? 0),
        ma200: Number(data?.['200ma'] ?? data?.['200MA'] ?? data?.ma200 ?? 0),
        high52: Number(data?.['52wh'] ?? data?.['52WH'] ?? data?.high52 ?? 0),
        low52: Number(data?.['52wl'] ?? data?.['52WL'] ?? data?.low52 ?? 0),
        return1W: Number(data?.['1wr'] ?? data?.['1W'] ?? data?.return1W ?? 0),
        return1M: Number(data?.['1mr'] ?? data?.['1M'] ?? data?.return1M ?? 0),
        return3M: Number(data?.['3mr'] ?? data?.['3M'] ?? data?.return3M ?? 0),
        return1Yr: Number(data?.['1yr'] ?? data?.['1YR'] ?? data?.return1Yr ?? 0),
        return3Yr: Number(data?.['3yr'] ?? data?.['3YR'] ?? data?.return3Yr ?? 0),
        rsi: Number(data?.RSI ?? data?.rsi ?? 0),
        yfc_link: `https://finance.yahoo.com/chart/${ticker}#`,
        tvc_link: `https://in.tradingview.com/chart/?symbol=${indexName === 'NIFTY50' ? 'NIFTY' : ticker}`
      });

    } catch (error) {
      console.error(`Error loading index data for ${indexName}:`, error);
    }
  }, [indexName, ticker, isFrozen]);

  useEffect(() => {
    fetchIndexData();
  }, [fetchIndexData]);

  useEffect(() => {
    if (updateTrigger > 0 || refreshTrigger > 0) {
      fetchIndexData();
    }
  }, [updateTrigger, refreshTrigger, fetchIndexData]);

  useEffect(() => {
    let intervalId;
    if (isAutoMode && !isFrozen) {
      intervalId = setInterval(fetchIndexData, (refreshRate || 10) * 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoMode, isFrozen, refreshRate, fetchIndexData]);

  const scaleTo100 = useCallback((value) => {
    const { low52, high52 } = slowData;
    if (!low52 || !high52 || high52 === low52) return 0;
    const rawPercentage = (((value - low52) / (high52 - low52)) * 100);
    return Math.max(0, Math.min(100, rawPercentage));
  }, [slowData]);

  const rangeValue = slowData.low52 
    ? (((slowData.high52 - slowData.low52) / slowData.low52) * 100).toFixed(2)
    : "0.00";

  const COLOR_GREEN = "#00E676";
  const COLOR_RED = "#FF5252";

  return (
    <div style={{ 
      padding: isMobile ? '10px' : '15px', 
      fontFamily: 'sans-serif', 
      width: isMobile ? '100%' : 'calc(50% - 12px)', 
      minWidth: isMobile ? 'auto' : '520px',
      maxWidth: '1000px',
      boxSizing: 'border-box', 
      margin: '0 auto',
      backgroundColor: '#000000',
      color: '#e0e0e0',
      border: '4px solid #C0C0C0',
      borderRadius: '8px',
      opacity: isFrozen ? 0.7 : 1,
      transition: 'opacity 0.3s ease'
    }}>
      
      {/* 1. HEADER TITLE */}
      <h2 style={{ textAlign: 'center', margin: '0 0 15px 0', color: '#d3d3d3', fontSize: '20px', letterSpacing: '1px' }}>
        {indexName}
      </h2>

      {/* 2. 8-COLUMN DATA TABLE */}
      <div style={{ overflowX: 'auto', marginBottom: '25px', borderRadius: '6px', border: '1px solid #444' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', backgroundColor: '#111111', textAlign: 'center', minWidth: isMobile ? '500px' : '100%' }}>
          {['Tdy-%chng', 'Ydy-%chng', '1W', '1M', '3M', '1YR', '3YR', 'RSI'].map((head, idx) => (
            <div key={`h-${idx}`} style={{ padding: '8px 4px', fontSize: '13px', fontWeight: '900', backgroundColor: '#1a1a1a', borderRight: idx < 7 ? '1px solid #444' : 'none', borderBottom: '1px solid #444', color: '#cccccc' }}>
              {head}
            </div>
          ))}
          
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: fastData.tdyChange >= 0 ? COLOR_GREEN : COLOR_RED }}>{fastData.tdyChange}%</div>
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: fastData.ydyChange >= 0 ? COLOR_GREEN : COLOR_RED }}>{fastData.ydyChange}%</div>
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: slowData.return1W >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData.return1W}%</div>
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: slowData.return1M >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData.return1M}%</div>
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: slowData.return3M >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData.return3M}%</div>
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: slowData.return1Yr >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData.return1Yr}%</div>
          <div style={{ padding: '12px 4px', borderRight: '1px solid #444', fontSize: '15px', fontWeight: 'bold', color: slowData.return3Yr >= 0 ? COLOR_GREEN : COLOR_RED }}>{slowData.return3Yr}%</div>
          <div style={{ padding: '12px 4px', fontSize: '15px', fontWeight: 'bold', color: slowData.rsi > 50 ? COLOR_GREEN : COLOR_RED }}>{slowData.rsi}</div>
        </div>
      </div>

      {/* 3. RULE SCALE & 3D BUTTONS */}
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '0' }}>
        
        {/* Left: 80% Scale Visualizer */}
        <div style={{ width: isMobile ? '100%' : '80%', display: 'flex', flexDirection: 'column', paddingRight: isMobile ? '0' : '15px', borderRight: isMobile ? 'none' : '1px dashed #444' }}>
          <div style={{ position: 'relative', height: '130px', width: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '16px', color: '#cccccc' }}>52WL</div>
            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '16px', color: '#cccccc' }}>52WH</div>

            <div style={{ position: 'absolute', top: '50%', left: '55px', right: '55px', height: '3px', backgroundColor: '#666', transform: 'translateY(-50%)', borderRadius: '2px' }}>
              <Marker value={fastData.cmp} scaleTo100={scaleTo100} color="rgba(33, 150, 243, 0.95)" circleSize={12} lineHeight={12} label="CMP" isTop={true} rawValue={fastData.cmp} />
              <Marker value={slowData.ma200} scaleTo100={scaleTo100} color="rgba(255, 68, 68, 0.85)" circleSize={16} lineHeight={45} label="200MA" />
              <Marker value={slowData.ma50} scaleTo100={scaleTo100} color="rgba(255, 152, 0, 0.85)" circleSize={14} lineHeight={30} label="50MA" />
              <Marker value={slowData.ma25} scaleTo100={scaleTo100} color="rgba(255, 235, 59, 0.85)" circleSize={12} lineHeight={18} label="25MA" />
              <Marker value={slowData.ma10} scaleTo100={scaleTo100} color="rgba(0, 230, 118, 0.9)" circleSize={10} lineHeight={8} label="10MA" />
            </div>
          </div>
          
          <div style={{ marginTop: '0px', color: '#cccccc', fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '1px' }}>
            &lt; <span style={{ flex: 1, height: '1px', backgroundColor: '#555', margin: '0 15px' }}></span> 
            RANGE: {rangeValue}% 
            <span style={{ flex: 1, height: '1px', backgroundColor: '#555', margin: '0 15px' }}></span> &gt;
          </div>
        </div>

        {/* Right: 20% Action Buttons */}
        <div style={{ width: isMobile ? '100%' : '20%', paddingLeft: isMobile ? '0' : '15px', minHeight: isMobile ? 'auto' : '140px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '20px', alignItems: 'center', justifyContent: 'center' }}>
          <Button3D label="TVC" color="#2962FF" shadowColor="#1565C0" onClick={() => openPopup(slowData.tvc_link)} />
          <Button3D label="YFC" color="#9C27B0" shadowColor="#6A1B9A" onClick={() => openPopup(slowData.yfc_link)} />
        </div>

      </div>

    </div>
  );
}