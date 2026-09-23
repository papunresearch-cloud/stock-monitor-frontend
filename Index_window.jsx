import React, { useState, useEffect, useCallback } from 'react';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

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
        [isTop ? 'bottom' : 'top']: '100%', 
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
          borderTop: `${circleSize * 1.5}px solid ${color}`,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))'
        }}></div>
      ) : (
        <>
          <div style={{ width: '2px', height: `${lineHeight}px`, backgroundColor: color, boxShadow: `0 0 4px ${color}` }}></div>
          <div style={{ width: `${circleSize}px`, height: `${circleSize}px`, backgroundColor: color, borderRadius: '50%', border: '1px solid #111', boxShadow: '0 2px 4px rgba(0,0,0,0.7)' }}></div>
        </>
      )}

      {rawValue !== null && (
        <div style={{ fontSize: '13px', color: '#ffffff', marginBottom: isTop ? '4px' : '0', marginTop: isTop ? '0' : '4px', fontWeight: 'bold', textShadow: '1px 1px 2px #000' }}>
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
    h100: 0, l100: 0,
    h50: 0, l50: 0,
    h25: 0, l25: 0,
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

  const safeTarget = (indexName || "").trim();

  const fetchIndexData = useCallback(async () => {
    if (isFrozen || !safeTarget) return;

    try {
      const [paramRes, liveRes0, liveRes1] = await Promise.all([
        fetch(`${FIREBASE_DB_URL}/param/${encodeURIComponent(safeTarget)}.json`),
        fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(safeTarget)}/0.json`),
        fetch(`${FIREBASE_DB_URL}/stocks/${encodeURIComponent(safeTarget)}/1.json`)
      ]);

      let data = paramRes.ok ? await paramRes.json() : null;
      const c0 = liveRes0.ok ? await liveRes0.json() : null;
      const c1 = liveRes1.ok ? await liveRes1.json() : null;

      if (!data) {
        const fallbackRes = await fetch(`${FIREBASE_DB_URL}/indices/${encodeURIComponent(safeTarget)}.json`);
        if (fallbackRes.ok) data = await fallbackRes.json();
      }

      const currentCmp = Number(c0?.close ?? c0?.c ?? c1?.close ?? c1?.c ?? 0);

      setFastData({
        cmp: currentCmp,
        tdyChange: Number(data?.['2dy-%chng'] ?? data?.['Tdy-%chng'] ?? data?.tdyChange ?? 0),
        ydyChange: Number(data?.['Ydy-%chng'] ?? data?.ydyChange ?? 0)
      });

      setSlowData({
        ma10: Number(data?.['10ma'] ?? data?.['10MA'] ?? data?.ma10 ?? 0),
        ma25: Number(data?.['25ma'] ?? data?.['25MA'] ?? data?.ma25 ?? 0),
        ma50: Number(data?.['50ma'] ?? data?.['50MA'] ?? data?.ma50 ?? 0),
        ma200: Number(data?.['200ma'] ?? data?.['200MA'] ?? data?.ma200 ?? 0),
        high52: Number(data?.['52wh'] ?? data?.['52WH'] ?? data?.high52 ?? 0),
        low52: Number(data?.['52wl'] ?? data?.['52WL'] ?? data?.low52 ?? 0),
        h100: Number(data?.['100H'] ?? data?.['100h'] ?? 0),
        l100: Number(data?.['100L'] ?? data?.['100l'] ?? 0),
        h50: Number(data?.['50H'] ?? data?.['50h'] ?? 0),
        l50: Number(data?.['50L'] ?? data?.['50l'] ?? 0),
        h25: Number(data?.['25H'] ?? data?.['25h'] ?? 0),
        l25: Number(data?.['25L'] ?? data?.['25l'] ?? 0),
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
      console.error(`Error loading index data for ${safeTarget}:`, error);
    }
  }, [safeTarget, ticker, isFrozen]);

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
    if (!low52 || !high52 || high52 === low52 || !value) return 0;
    const rawPercentage = (((value - low52) / (high52 - low52)) * 100);
    return Math.max(0, Math.min(100, rawPercentage));
  }, [slowData]);

  const getSubRangeSpan = (low, high) => {
    if (!low || !high) return null;
    const left = scaleTo100(low);
    const right = scaleTo100(high);
    return {
      left: `${left}%`,
      width: `${Math.max(0, right - left)}%`
    };
  };

  const span100 = getSubRangeSpan(slowData.l100, slowData.h100);
  const span50 = getSubRangeSpan(slowData.l50, slowData.h50);
  const span25 = getSubRangeSpan(slowData.l25, slowData.h25);

  const rangeValue = slowData.low52 
    ? (((slowData.high52 - slowData.low52) / slowData.low52) * 100).toFixed(2)
    : "0.00";

  // Configurable size variable
  const Legend_Size = "9px";

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
      <div style={{ overflowX: 'auto', marginBottom: '14px', borderRadius: '6px', border: '1px solid #444' }}>
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

      {/* 3. LEGEND STRIP (Left aligned, above the bar and below data box) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        fontSize: Legend_Size, 
        fontWeight: 'bold', 
        letterSpacing: '0.6px',
        marginBottom: '4px',
        paddingLeft: '2px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e0e0e0' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'linear-gradient(180deg, #22d3ee, #0891b2)', border: '1px solid #164e63', display: 'inline-block' }}></span>
          52WR
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e0e0e0' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'linear-gradient(180deg, #fb7185, #e11d48)', border: '1px solid #881337', display: 'inline-block' }}></span>
          100DR
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e0e0e0' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'linear-gradient(180deg, #818cf8, #4f46e5)', border: '1px solid #312e81', display: 'inline-block' }}></span>
          50DR
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e0e0e0' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'linear-gradient(180deg, #fbbf24, #ea580c)', border: '1px solid #7c2d12', display: 'inline-block' }}></span>
          25DR
        </div>
      </div>

      {/* 4. RULE SCALE & 3D BUTTONS */}
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '0' }}>
        
        {/* Left: 80% Scale Visualizer */}
        <div style={{ width: isMobile ? '100%' : '80%', display: 'flex', flexDirection: 'column', paddingRight: isMobile ? '0' : '15px', borderRight: isMobile ? 'none' : '1px dashed #444' }}>
          <div style={{ position: 'relative', height: '140px', width: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '15px', color: '#cccccc' }}>52WL</div>
            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '15px', color: '#cccccc' }}>52WH</div>

            {/* 3D MULTI-LAYER RANGE BAR CAPSULE */}
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '55px', 
              right: '55px', 
              height: '16px', 
              background: 'linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)', /* 52WR: Neon Cyan */
              transform: 'translateY(-50%)', 
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.35)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.8), inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.6)',
              zIndex: 1,
              overflow: 'visible'
            }}>
              
              {/* 100DR (Crimson Rose) */}
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

              {/* 50DR (Royal Blue/Violet) */}
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

              {/* 25DR (Sunset Tangerine) */}
              {span25 && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: span25.left,
                  width: span25.width,
                  background: 'linear-gradient(180deg, #fbbf24 0%, #ea580c 100%)',
                  borderLeft: '1px solid rgba(255,255,255,0.9)',
                  borderRight: '1px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 0 8px rgba(234,88,12,0.8), inset 0 1px 2px rgba(255,255,255,0.5)',
                  zIndex: 4
                }} />
              )}

              {/* CMP Marker */}
              <Marker value={fastData.cmp} scaleTo100={scaleTo100} color="#00E5FF" circleSize={12} lineHeight={14} label="CMP" isTop={true} rawValue={fastData.cmp} />
              
              {/* Moving Averages */}
              <Marker value={slowData.ma200} scaleTo100={scaleTo100} color="rgba(255, 68, 68, 0.95)" circleSize={16} lineHeight={45} label="200MA" />
              <Marker value={slowData.ma50} scaleTo100={scaleTo100} color="rgba(255, 152, 0, 0.95)" circleSize={14} lineHeight={30} label="50MA" />
              <Marker value={slowData.ma25} scaleTo100={scaleTo100} color="rgba(255, 235, 59, 0.95)" circleSize={12} lineHeight={18} label="25MA" />
              <Marker value={slowData.ma10} scaleTo100={scaleTo100} color="rgba(0, 230, 118, 0.95)" circleSize={10} lineHeight={8} label="10MA" />
            </div>
          </div>
          
          <div style={{ marginTop: '5px', color: '#cccccc', fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '1px' }}>
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