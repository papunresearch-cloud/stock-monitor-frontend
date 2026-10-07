import React, { useState, useEffect } from 'react';
import Index_window from './Index_window';
import DashboardHeader from './DashboardHeader'; 
import StockGrid from './StockGrid';
import SettingsModal from './SettingsModal';
import HealthModal from './HealthModal';

export default function StockMonitorView() {
  // ==========================================
  // 1. MASTER STATES (The Brain)
  // ==========================================
  // Problem 1 Fixed: Default state is now AUTO-ON (true)
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [refreshRate, setRefreshRate] = useState(10);

  const [isRefreshLocked, setIsRefreshLocked] = useState(false);
  const [isSyncLocked, setIsSyncLocked] = useState(false);
  const [isSyncPulsing, setIsSyncPulsing] = useState(false);

  // Sync Confirmation Modal State
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [firebaseConnected, setFirebaseConnected] = useState(true);

  // ==========================================
  // 2. SETTINGS & DISPLAY STATES
  // ==========================================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [allStocksPool, setAllStocksPool] = useState([]); 

  const allIndicesPool = [
    { name: 'NIFTY50', ticker: '^NSEI' },
    { name: 'NIFTY100', ticker: '^CNX100' },
    { name: 'NIFTY MIDCAP 150', ticker: 'NIFTYMIDCAP150.NS' },
    { name: 'NIFTY SMALLCAP 250', ticker: 'NIFTYSMLCAP250.NS' }
  ];

  const [savedFirebaseList, setSavedFirebaseList] = useState({
    indices: allIndicesPool,
    stocks: [],
    displayOrder: 'Alphabetical Dec. (A - Z)',
    groupBy: 'No filter'
  });

  const [displayConfig, setDisplayConfig] = useState({
    indices: allIndicesPool,
    stocks: [],
    displayOrder: 'Alphabetical Dec. (A - Z)',
    groupBy: 'No filter'
  });

  const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';
  const BACKEND_URL = 'https://nse-ohlc-system.onrender.com';

  // ==========================================
  // 3. INITIALIZATION & DATA BOOT
  // ==========================================
  useEffect(() => {
    const initializeTerminal = async () => {
      try {
        const poolRes = await fetch(`${FIREBASE_DB_URL}/watchlist.json`);
        const poolData = await poolRes.json();
        const rawWatchlist = poolData?.watchlist || poolData || [];
        const availableStocks = (Array.isArray(rawWatchlist) ? rawWatchlist : Object.values(rawWatchlist)).filter(Boolean);
        setAllStocksPool(availableStocks);

        const savedRes = await fetch(`${FIREBASE_DB_URL}/display_list.json`);
        const savedData = await savedRes.json();
        const rawFirebase = savedData || {};

        let parsedIndices = [];
        if (rawFirebase.indices) {
          const rawEntries = Array.isArray(rawFirebase.indices)
            ? rawFirebase.indices
            : Object.values(rawFirebase.indices);
          parsedIndices = rawEntries.filter(item => item !== null && item !== undefined);
        }

        const activeIndices = parsedIndices.length > 0 ? parsedIndices : allIndicesPool;

        let parsedStocks = [];
        if (rawFirebase.stocks) {
          const rawStockEntries = Array.isArray(rawFirebase.stocks)
            ? rawFirebase.stocks
            : Object.values(rawFirebase.stocks);
          parsedStocks = rawStockEntries.filter(item => item !== null && item !== undefined);
        } else {
          parsedStocks = availableStocks.slice(0, 10);
        }

        const firebaseBaseline = {
          indices: activeIndices,
          stocks: parsedStocks,
          displayOrder: rawFirebase.displayOrder || 'Alphabetical Dec. (A - Z)',
          groupBy: rawFirebase.groupBy || 'No filter'
        };

        setSavedFirebaseList(firebaseBaseline);
        setDisplayConfig(firebaseBaseline);

        if (!rawFirebase.indices || parsedIndices.length === 0 || parsedIndices.length !== activeIndices.length) {
          fetch(`${FIREBASE_DB_URL}/display_list/indices.json`, {
            method: 'PUT',
            body: JSON.stringify(activeIndices)
          }).catch(err => console.error("Index auto-heal error:", err));
        }
      } catch (error) {
        console.error("Boot Sequence Error:", error);
      }
    };

    initializeTerminal();
  }, []);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${FIREBASE_DB_URL}/system_status.json?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setHealthData(data);
          setFirebaseConnected(true);
        } else {
          setFirebaseConnected(false);
        }
      } catch (err) {
        setFirebaseConnected(false);
      }
    };

    fetchHealth();
    const healthInterval = setInterval(fetchHealth, 10000);
    return () => clearInterval(healthInterval);
  }, []);

  // ==========================================
  // 4. SETTINGS MODAL HANDLERS
  // ==========================================
  const handleApplySettings = (sessionData) => {
    setDisplayConfig(prev => ({
      ...prev,
      ...sessionData,
      indices: (sessionData.indices && sessionData.indices.length > 0) ? sessionData.indices.filter(Boolean) : prev.indices
    }));
  };

  const handleSaveSettings = async (sessionData) => {
    try {
      const cleanPayload = {
        ...sessionData,
        indices: (sessionData.indices && sessionData.indices.length > 0) 
          ? sessionData.indices.filter(Boolean) 
          : (displayConfig.indices.length > 0 ? displayConfig.indices.filter(Boolean) : allIndicesPool)
      };

      await fetch(`${FIREBASE_DB_URL}/display_list.json`, {
        method: 'PUT',
        body: JSON.stringify(cleanPayload)
      });

      setSavedFirebaseList(cleanPayload);
      setDisplayConfig(cleanPayload);
      alert("Settings permanently saved to Firebase.");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleDeleteSettings = async ({ type, indices, stocks }) => {
    try {
      const updatedList = { ...savedFirebaseList };
      
      if (type === 'indices' || type === 'index') {
        const remaining = (updatedList.indices || []).filter(Boolean).filter(i => {
          const checkName = i?.name || i;
          return !indices.some(del => (del?.name || del) === checkName);
        });
        updatedList.indices = remaining.length > 0 ? remaining : allIndicesPool;
      } else {
        updatedList.stocks = (updatedList.stocks || []).filter(Boolean).filter(s => !stocks.includes(s));
      }

      await fetch(`${FIREBASE_DB_URL}/display_list.json`, {
        method: 'PUT',
        body: JSON.stringify(updatedList)
      });

      setSavedFirebaseList(updatedList);
      setDisplayConfig(updatedList);
      alert(`Selected ${type} updated in permanent display list.`);
    } catch (error) {
      console.error("Failed to delete from list:", error);
    }
  };

  // ==========================================
  // 5. BUTTON ACTION HANDLERS & PULSES
  // ==========================================
  const handleSearch = (term) => console.log("Searching for:", term);
  const handleAutoToggle = () => { if (!isFrozen) setIsAutoMode(prev => !prev); };
  const handleRateChange = (newRate) => setRefreshRate(newRate);
  const handleFreezeToggle = () => setIsFrozen(prev => !prev);

  const handleRefresh = () => {
    if (isFrozen || isAutoMode || isRefreshLocked) return;
    setRefreshTrigger(prev => prev + 1);
    setIsRefreshLocked(true);
    setTimeout(() => setIsRefreshLocked(false), 5000);
  };

  const handleUpdate = () => {
    if (isFrozen) return;
    setUpdateTrigger(prev => prev + 1);
  };

  // Triggers the confirmation modal when Header "SYNC" button is clicked
  const handleSyncClick = () => {
    if (isSyncLocked || isFrozen) return;
    setShowSyncConfirm(true);
  };

  // Problem 2 Fixed: Executes OHLC Database Synchronization when confirmed "YES"
  const handleConfirmSync = async () => {
    setShowSyncConfirm(false);
    setIsSyncPulsing(true);

    // 60-second abort window to allow waking up sleeping Render instances
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      console.log("Triggering OHLC database sync to Render backend...");
      const response = await fetch(`${BACKEND_URL}/sync`, { 
        method: 'GET',
        mode: 'cors',
        signal: controller.signal 
      });
      console.log("Sync response status:", response.status);
    } catch (err) {
      console.error("Sync network trigger error:", err);
    } finally {
      clearTimeout(timeoutId);
      setIsSyncPulsing(false);
      setIsSyncLocked(true);
      setTimeout(() => setIsSyncLocked(false), 900000); // 15-minute lock
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        allIndices={allIndicesPool}
        allStocks={allStocksPool}
        savedFirebaseList={savedFirebaseList}
        onApply={handleApplySettings}
        onSave={handleSaveSettings}
        onDelete={handleDeleteSettings}
      />

      <HealthModal 
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        healthData={healthData}
        firebasePing={firebaseConnected}
        frontendStatus={isFrozen ? "FROZEN" : "ACTIVE"}
      />

      {/* SYNC CONFIRMATION POPUP MODAL */}
      {showSyncConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '2px solid #06b6d4',
              borderRadius: '12px',
              padding: '22px 28px',
              width: '360px',
              maxWidth: '92%',
              textAlign: 'center',
              boxShadow: '0 0 25px rgba(6, 182, 212, 0.35), 0 20px 40px rgba(0, 0, 0, 0.8)',
              color: '#f8fafc'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <h3
                style={{
                  color: '#38bdf8',
                  fontSize: '15px',
                  fontWeight: '900',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  margin: 0
                }}
              >
                CONFIRM OHLC SYNC
              </h3>
            </div>

            <p
              style={{
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                margin: '12px 0 22px 0',
                lineHeight: '1.4'
              }}
            >
              Do you want to initiate historical OHLC database synchronization?
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
              <button
                type="button"
                onClick={handleConfirmSync}
                style={{
                  backgroundColor: '#10b981',
                  color: '#000000',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '6px',
                  fontWeight: '900',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                }}
              >
                YES
              </button>

              <button
                type="button"
                onClick={() => setShowSyncConfirm(false)}
                style={{
                  backgroundColor: '#334155',
                  color: '#f87171',
                  border: '1px solid #ef4444',
                  padding: '8px 24px',
                  borderRadius: '6px',
                  fontWeight: '900',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD HEADER CONTAINER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 1000, backgroundColor: '#00004d', padding: '0 20px 10px 20px' }}>
        <DashboardHeader 
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHealth={() => setIsHealthOpen(true)}
          onSearch={handleSearch}
          isAutoMode={isAutoMode}
          isFrozen={isFrozen}
          refreshRate={refreshRate}
          isRefreshLocked={isRefreshLocked}
          isSyncLocked={isSyncLocked}
          isSyncPulsing={isSyncPulsing}
          onAutoToggle={handleAutoToggle}
          onRateChange={handleRateChange}
          onRefresh={handleRefresh}
          onUpdate={handleUpdate}
          onSync={handleSyncClick}
          onFreezeToggle={handleFreezeToggle}
        />
      </div>

      <div style={{ backgroundColor: '#00004d' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', padding: '10px 20px 40px 20px' }}>
          {(displayConfig.indices || [])
            .filter(Boolean)
            .map(indexObj => {
              const iName = indexObj?.name || (typeof indexObj === 'string' ? indexObj : '');
              if (!iName) return null;
              
              const iTicker = indexObj?.ticker || allIndicesPool.find(i => i.name === iName)?.ticker || iName;

              return (
                <Index_window 
                  key={iName} 
                  indexName={iName} 
                  ticker={iTicker}
                  isAutoMode={isAutoMode} 
                  isFrozen={isFrozen} 
                  refreshRate={refreshRate} 
                  refreshTrigger={refreshTrigger} 
                  updateTrigger={updateTrigger} 
                />
              );
            })}
        </div>
      </div>

      <div style={{ height: '2px', backgroundColor: '#29a3a3', zIndex: 10 }}></div>

      <div style={{ backgroundColor: '#001a00', flexGrow: 1, paddingBottom: '40px' }}>
        <h2 style={{ color: 'white', textAlign: 'center', marginTop: '20px', letterSpacing: '2px' }}>
          MY WATCHLIST
        </h2>
        
        <StockGrid 
          activeStocks={displayConfig.stocks}
          displayOrder={displayConfig.displayOrder}
          groupBy={displayConfig.groupBy}
          isAutoMode={isAutoMode} 
          isFrozen={isFrozen} 
          refreshRate={refreshRate} 
          refreshTrigger={refreshTrigger} 
          updateTrigger={updateTrigger} 
        />
      </div>
    </div>
  );
}