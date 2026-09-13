import React, { useState, useEffect, useMemo } from 'react';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

// 2026 Default NSE Exchange Holidays Fallback
const NSE_HOLIDAYS_2026 = {
  "2026-01-15": "Municipal Corporation Election",
  "2026-01-26": "Republic Day",
  "2026-03-03": "Holi",
  "2026-03-26": "Shri Ram Navami",
  "2026-03-31": "Shri Mahavir Jayanti",
  "2026-04-03": "Good Friday",
  "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2026-05-01": "Maharashtra Day",
  "2026-05-28": "Bakri Id",
  "2026-06-26": "Muharram",
  "2026-09-14": "Ganesh Chaturthi",
  "2026-10-02": "Mahatma Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-08": "Diwali Laxmi Pujan (Muhurat Trading)",
  "2026-11-10": "Diwali-Balipratipada",
  "2026-11-24": "Gurunanak Jayanti",
  "2026-12-25": "Christmas"
};

export default function HealthModal({ 
  isOpen, 
  onClose, 
  healthData, 
  firebasePing, 
  frontendStatus 
}) {
  const [currentIstTime, setCurrentIstTime] = useState('');
  const [calendarHolidays, setCalendarHolidays] = useState(NSE_HOLIDAYS_2026);
  const [stocksData, setStocksData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Live Clock Tracker: DD.MM.YY || HH:MM:SS (Asia/Kolkata)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(now);

      const d = parts.find(p => p.type === 'day')?.value || '00';
      const m = parts.find(p => p.type === 'month')?.value || '00';
      const y = parts.find(p => p.type === 'year')?.value || '00';
      const hh = parts.find(p => p.type === 'hour')?.value || '00';
      const mm = parts.find(p => p.type === 'minute')?.value || '00';
      const ss = parts.find(p => p.type === 'second')?.value || '00';

      setCurrentIstTime(`${d}.${m}.${y} || ${hh}:${mm}:${ss}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Detailed Data on Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchModalDetails = async () => {
      setLoadingDetails(true);
      try {
        const timestamp = Date.now();
        const [calRes, stocksRes] = await Promise.all([
          fetch(`${FIREBASE_DB_URL}/config/nse_calendar/holidays.json?_=${timestamp}`).catch(() => null),
          fetch(`${FIREBASE_DB_URL}/stocks.json?_=${timestamp}`).catch(() => null)
        ]);

        if (calRes && calRes.ok) {
          const calData = await calRes.json();
          if (calData && typeof calData === 'object') {
            if (isMounted) setCalendarHolidays(prev => ({ ...prev, ...calData }));
          }
        }

        if (stocksRes && stocksRes.ok) {
          const sData = await stocksRes.json();
          if (isMounted) setStocksData(sData);
        }
      } catch (err) {
        console.error("Error fetching telemetry details:", err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    fetchModalDetails();
    return () => { isMounted = false; };
  }, [isOpen]);

  // 3. Heartbeat Pulse & Lag Calculations
  const sys = healthData || {};
  const sync = sys.sync_data || {};

  let lagSeconds = null;
  let isBackendAlive = false;
  if (sys.heartbeat_epoch) {
    const nowEpoch = Date.now() / 1000;
    lagSeconds = Math.max(0, Math.round(nowEpoch - parseFloat(sys.heartbeat_epoch)));
    // Allows up to 6 minutes for a 5-minute heartbeat cycle
    isBackendAlive = lagSeconds <= 360;
  }

  // 4. Market Live, Today's Status & Next Day Evaluation
  const marketAnalysis = useMemo(() => {
    const now = new Date();
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const year = parseInt(istParts.find(p => p.type === 'year')?.value || '2026', 10);
    const month = parseInt(istParts.find(p => p.type === 'month')?.value || '1', 10);
    const day = parseInt(istParts.find(p => p.type === 'day')?.value || '1', 10);
    const hour = parseInt(istParts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(istParts.find(p => p.type === 'minute')?.value || '0', 10);

    const todayDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const todayDayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0: Sun, 6: Sat

    // Evaluate Today's Status
    const isWeekend = (todayDayOfWeek === 0 || todayDayOfWeek === 6);
    const isTodayHoliday = Boolean(calendarHolidays[todayDateStr]);
    
    let todayStatus = 'Trading day';
    let todayDetail = 'Regular Session (09:15 - 15:30)';

    if (isWeekend) {
      todayStatus = 'Holiday';
      todayDetail = `Weekend (${todayDayOfWeek === 6 ? 'Saturday' : 'Sunday'})`;
    } else if (isTodayHoliday) {
      todayStatus = 'Holiday';
      todayDetail = calendarHolidays[todayDateStr];
    }

    // Evaluate Live Market State
    const isMarketHours = (hour > 9 || (hour === 9 && minute >= 15)) && (hour < 15 || (hour === 15 && minute <= 30));
    let isLive = false;
    let liveReason = 'Outside Market Hours';

    if (isWeekend || isTodayHoliday) {
      liveReason = todayDetail;
    } else if (isMarketHours) {
      isLive = true;
      liveReason = 'Regular Trading Hours (09:15 - 15:30 IST)';
    }

    // Evaluate Next Day Status
    const nextDateObj = new Date(Date.UTC(year, month - 1, day + 1));
    const nextY = nextDateObj.getUTCFullYear();
    const nextM = String(nextDateObj.getUTCMonth() + 1).padStart(2, '0');
    const nextD = String(nextDateObj.getUTCDate()).padStart(2, '0');
    const nextDateStr = `${nextY}-${nextM}-${nextD}`;
    const nextDayOfWeek = nextDateObj.getUTCDay();

    let nextDayStatus = 'Trading day';
    let nextDayDetail = nextDateStr;

    if (nextDateStr === '2026-11-08') {
      nextDayStatus = 'Special Trading day';
      nextDayDetail = 'Diwali Laxmi Pujan (Muhurat Trading)';
    } else if (nextDayOfWeek === 0 || nextDayOfWeek === 6) {
      nextDayStatus = 'Holiday';
      nextDayDetail = `Weekend (${nextDayOfWeek === 6 ? 'Saturday' : 'Sunday'})`;
    } else if (calendarHolidays[nextDateStr]) {
      nextDayStatus = 'Holiday';
      nextDayDetail = calendarHolidays[nextDateStr];
    }

    return {
      isLive,
      liveReason,
      todayStatus,
      todayDetail,
      nextDayStatus,
      nextDayDetail
    };
  }, [calendarHolidays]);

  // 5. Parse Stocks & Indices Table with Time Stamp for Index-0 & Index-1
  const parsedLedger = useMemo(() => {
    if (!stocksData || typeof stocksData !== 'object') return [];

    const rows = [];
    for (const [symbol, candles] of Object.entries(stocksData)) {
      if (!candles || typeof candles !== 'object') continue;

      const keys = Object.keys(candles)
        .map(k => parseInt(k, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

      if (keys.length === 0) continue;

      // Index 0 formatting (Date and Time)
      const c0 = candles['0'] || candles[0];
      let index0Display = 'None / Cleared';
      if (c0 && c0.date) {
        index0Display = c0.time ? `${c0.date} || ${c0.time}` : c0.date;
      }

      // Index 1 formatting (Date and Time)
      const c1 = candles['1'] || candles[1];
      let index1Display = 'N/A';
      if (c1 && c1.date) {
        index1Display = c1.time ? `${c1.date} || ${c1.time}` : `${c1.date} || 15:30:00`;
      }

      // Oldest Historical Index Date
      const maxKey = keys[keys.length - 1];
      const lastIndexDate = candles[String(maxKey)]?.date || 'N/A';
      const totalBars = keys.length;

      rows.push({
        symbol,
        index0Display,
        index1Display,
        lastIndexDate,
        maxKey,
        totalBars
      });
    }

    rows.sort((a, b) => {
      if (a.symbol.startsWith('^') && !b.symbol.startsWith('^')) return -1;
      if (!a.symbol.startsWith('^') && b.symbol.startsWith('^')) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    return rows;
  }, [stocksData]);

  // Filtered rows for the continuity ledger
  const filteredLedger = useMemo(() => {
    if (!searchFilter.trim()) return parsedLedger;
    const term = searchFilter.toUpperCase().trim();
    return parsedLedger.filter(row => row.symbol.toUpperCase().includes(term));
  }, [parsedLedger, searchFilter]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '10px'
    }}>
      <div style={{
        backgroundColor: '#0a0d14',
        border: '2px solid #00BCD4',
        borderRadius: '12px',
        width: '98%',
        maxWidth: '1250px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 35px rgba(0, 188, 212, 0.35)',
        color: '#f0f0f0',
        overflow: 'hidden',
        fontFamily: 'Segoe UI, Roboto, sans-serif'
      }}>

        {/* ========================================================================= */}
        {/* HEADER & CLOCK */}
        {/* ========================================================================= */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #1a2332',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#00BCD4', fontSize: '18px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              DATABASE INTEGRITY & TELEMETRY
            </h2>
            <div style={{ color: '#00E676', fontSize: '13px', fontWeight: 'bold', marginTop: '3px', letterSpacing: '1px', fontFamily: 'monospace' }}>
              {currentIstTime || '00.00.00 || 00:00:00'} (IST)
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #ef4444',
              color: '#ef4444',
              borderRadius: '6px',
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            CLOSE [ESC]
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY */}
        {/* ========================================================================= */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* TOP SECTION: SYSTEM STATUS & HEARTBEAT PULSE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            
            {/* Backend State */}
            <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', border: '1px solid #1f2937' }}>
              <div style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase' }}>Render Backend Server</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', color: sys.backend_power === 'RUNNING' ? '#22c55e' : '#ef4444' }}>
                {sys.backend_power || 'OFFLINE'}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Container: <span style={{ color: isBackendAlive ? '#00E676' : '#f59e0b', fontWeight: 'bold' }}>{isBackendAlive ? 'ONLINE / AWAKE' : 'SLEEPING / INACTIVE'}</span>
              </div>
            </div>

            {/* Restored Heartbeat Pulse */}
            <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', border: '1px solid #1f2937' }}>
              <div style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase' }}>Last Heartbeat Pulse</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', color: '#00BCD4', fontFamily: 'monospace' }}>
                {sys.last_heartbeat || 'No record'}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Pulse Lag: <span style={{ color: isBackendAlive ? '#22c55e' : '#f97316', fontWeight: 'bold' }}>{lagSeconds !== null ? `${lagSeconds}s ago` : 'N/A'}</span>
              </div>
            </div>

            {/* Added: Last Sync Date & Time */}
            <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', border: '1px solid #1f2937' }}>
              <div style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase' }}>Last Sync Date & Time</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', color: '#facc15', fontFamily: 'monospace' }}>
                {sync.last_sync_time || 'Never'}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Sync Engine: <span style={{ color: sync.status === 'VERIFIED' ? '#22c55e' : '#38bdf8' }}>{sync.status || 'IDLE'}</span>
              </div>
            </div>

            {/* Firebase Pipe */}
            <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', border: '1px solid #1f2937' }}>
              <div style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase' }}>Firebase Realtime Pipe</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', color: firebasePing ? '#22c55e' : '#ef4444' }}>
                {firebasePing ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Frontend View: <span style={{ color: '#38bdf8' }}>{frontendStatus}</span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: MARKET SCHEDULE (TODAY, LIVE, NEXT DAY) */}
          {/* ========================================================================= */}
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '14px'
          }}>
            <div style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
              Exchange Schedule Telemetry
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              
              {/* Added: Today Status */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Today Status</div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  marginTop: '4px',
                  color: marketAnalysis.todayStatus === 'Trading day' ? '#38bdf8' : '#f59e0b'
                }}>
                  {marketAnalysis.todayStatus.toUpperCase()}
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>
                  {marketAnalysis.todayDetail}
                </div>
              </div>

              {/* Market Current Status */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Market Current Status</div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  marginTop: '4px',
                  color: marketAnalysis.isLive ? '#22c55e' : '#ef4444'
                }}>
                  {marketAnalysis.isLive ? '● LIVE' : '○ CLOSED'}
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>
                  {marketAnalysis.liveReason}
                </div>
              </div>

              {/* Next Day Status */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Next Day Status</div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  marginTop: '4px',
                  color: marketAnalysis.nextDayStatus === 'Trading day' ? '#38bdf8' : (marketAnalysis.nextDayStatus === 'Holiday' ? '#f59e0b' : '#a855f7')
                }}>
                  {marketAnalysis.nextDayStatus.toUpperCase()}
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>
                  {marketAnalysis.nextDayDetail}
                </div>
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: SCRIPT & INDEX CONTINUITY LEDGER */}
          {/* ========================================================================= */}
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px'
            }}>
              <div>
                <span style={{ color: '#00BCD4', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Script & Index Continuity Ledger
                </span>
                <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '10px' }}>
                  ({filteredLedger.length} registered entries)
                </span>
              </div>
              <input 
                type="text"
                placeholder="Search symbol (e.g., ^NSEI, TCS, RELIANCE)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '6px 12px',
                  fontSize: '12px',
                  minWidth: '260px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Scrollable Table */}
            <div style={{
              maxHeight: '340px',
              overflowY: 'auto',
              border: '1px solid #334155',
              borderRadius: '6px',
              backgroundColor: '#020617'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', fontFamily: 'monospace' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 10 }}>
                  <tr style={{ color: '#38bdf8', borderBottom: '2px solid #334155' }}>
                    <th style={{ padding: '8px 12px' }}>SYMBOL / INDEX</th>
                    <th style={{ padding: '8px 12px' }}>INDEX-0 (DATE || TIME)</th>
                    <th style={{ padding: '8px 12px' }}>INDEX-1 (DATE || TIME)</th>
                    <th style={{ padding: '8px 12px' }}>LAST INDEX DATE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>TOTAL BARS</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDetails ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        Loading real-time dataset ledger from Firebase...
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No records match the filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row) => {
                      const isIndex = row.symbol.startsWith('^');
                      const isFullDepth = row.totalBars >= 250;
                      return (
                        <tr 
                          key={row.symbol} 
                          style={{
                            borderBottom: '1px solid #1e293b',
                            backgroundColor: isIndex ? 'rgba(56, 189, 248, 0.05)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '7px 12px', fontWeight: 'bold', color: isIndex ? '#38bdf8' : '#e2e8f0' }}>
                            {row.symbol}
                          </td>
                          <td style={{ padding: '7px 12px', color: row.index0Display.includes('None') ? '#64748b' : '#22c55e' }}>
                            {row.index0Display}
                          </td>
                          <td style={{ padding: '7px 12px', color: '#facc15' }}>
                            {row.index1Display}
                          </td>
                          <td style={{ padding: '7px 12px', color: '#94a3b8' }}>
                            {row.lastIndexDate} (key {row.maxKey})
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'center', color: isFullDepth ? '#22c55e' : '#f97316', fontWeight: 'bold' }}>
                            {row.totalBars}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              backgroundColor: isFullDepth ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                              color: isFullDepth ? '#22c55e' : '#f97316'
                            }}>
                              {isFullDepth ? 'HEALTHY' : 'PARTIAL'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}