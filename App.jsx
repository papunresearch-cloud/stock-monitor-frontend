import React, { useState, useEffect } from 'react';
import Index_window from './Index_window';
import DashboardHeader from './DashboardHeader'; 
import StockGrid from './StockGrid';
import SettingsModal from './SettingsModal';

function App() {
  // ==========================================
  // 1. MASTER STATES (The Brain)
  // ==========================================
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [refreshRate, setRefreshRate] = useState(10);

  // Cooldown Lockouts & Pulse States
  const [isRefreshLocked, setIsRefreshLocked] = useState(false);
  const [isSyncLocked, setIsSyncLocked] = useState(false);
  const [isSyncPulsing, setIsSyncPulsing] = useState(false);

  // Network Fetch Triggers
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ==========================================
  // 2. SETTINGS & DISPLAY STATES
  // ==========================================
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [allStocksPool, setAllStocksPool] = useState([]); 
  const [savedFirebaseList, setSavedFirebaseList] = useState({ 
    indices: [], 
    stocks: [], 
    displayOrder: 'Alphabetical Dec. (A - Z)', 
    groupBy: 'No filter' 
  });
  
  const [displayConfig, setDisplayConfig] = useState({ 
    indices: [], 
    stocks: [], 
    displayOrder: 'Alphabetical Dec. (A - Z)',
    groupBy: 'No filter'
  });

  const allIndicesPool = [
    { name: 'NIFTY50', ticker: '^NSEI' },
    { name: 'NIFTY100', ticker: '^CNX100' },
    { name: 'NIFTY500', ticker: '^CRSLDX' },
    { name: 'NIFTY MIDCAP 150', ticker: 'NIFTYMIDCAP150.NS' },
    { name: 'NIFTY SMALLCAP 250', ticker: 'NIFTYSMLCAP250.NS' },
    { name: 'SENSEX', ticker: '^BSESN' }
  ];

  const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';
  const BACKEND_URL = 'https://nse-ohlc-system.onrender.com';

  // ==========================================
  // 3. INITIALIZATION (Boot Sequence)
  // ==========================================
  useEffect(() => {
    const initializeTerminal = async () => {
      try {
        const poolRes = await fetch(`${FIREBASE_DB_URL}/watchlist.json`);
        const poolData = await poolRes.json();
        const rawWatchlist = poolData?.watchlist || [];
        const availableStocks = Array.isArray(rawWatchlist) ? rawWatchlist : Object.values(rawWatchlist);
        setAllStocksPool(availableStocks);

        const savedRes = await fetch(`${FIREBASE_DB_URL}/display_list.json`);
        const savedData = await savedRes.json();
        const rawFirebase = savedData || {};
        const firebaseBaseline = {
          indices: Array.isArray(rawFirebase.indices) ? rawFirebase.indices : Object.values(rawFirebase.indices || {}),
          stocks: Array.isArray(rawFirebase.stocks) ? rawFirebase.stocks : Object.values(rawFirebase.stocks || {}),
          displayOrder: rawFirebase.displayOrder || 'Alphabetical Dec. (A - Z)',
          groupBy: rawFirebase.groupBy || 'No filter'
        };
        setSavedFirebaseList(firebaseBaseline);

        const localSession = JSON.parse(localStorage.getItem('temp_display_session'));
        if (localSession) {
          setDisplayConfig(localSession);
        } else if (firebaseBaseline.indices?.length > 0 || firebaseBaseline.stocks?.length > 0) {
          setDisplayConfig(firebaseBaseline);
        } else {
          setDisplayConfig({
            indices: [
              { name: 'NIFTY50', ticker: '^NSEI' },
              { name: 'NIFTY100', ticker: '^CNX100' },
              { name: 'NIFTY MIDCAP 150', ticker: 'NIFTYMIDCAP150.NS' },
              { name: 'NIFTY SMALLCAP 250', ticker: 'NIFTYSMLCAP250.NS' }
            ],
            stocks: availableStocks.slice(0, 10),
            displayOrder: 'Mkt Cap Rank inc.',
            groupBy: 'No filter'
          });
        }
      } catch (error) {
        console.error("Boot Sequence Error:", error);
      }
    };

    initializeTerminal();
  }, []);

  // ==========================================
  // 4. SETTINGS MODAL HANDLERS
  // ==========================================
  const handleApplySettings = (sessionData) => {
    setDisplayConfig(sessionData);
  };

  const handleSaveSettings = async (sessionData) => {
    try {
      await fetch(`${FIREBASE_DB_URL}/display_list.json`, {
        method: 'PUT',
        body: JSON.stringify(sessionData)
      });
      setSavedFirebaseList(sessionData);
      setDisplayConfig(sessionData);
      alert("Settings permanently saved to Firebase.");
    } catch (error) {
      console.error("Failed to save settings to Firebase:", error);
    }
  };

  // ==========================================
  // 5. BUTTON ACTION HANDLERS & PULSES
  // ==========================================
  const handleAutoToggle = () => {
    if (isFrozen) return;
    setIsAutoMode((prev) => !prev);
  };

  const handleRateChange = (newRate) => {
    setRefreshRate(newRate);
  };

  const handleFreezeToggle = () => {
    setIsFrozen((prev) => !prev);
  };

  const handleRefresh = () => {
    if (isFrozen || isAutoMode || isRefreshLocked) return;
    setRefreshTrigger((prev) => prev + 1);
    setIsRefreshLocked(true);
    setTimeout(() => {
      setIsRefreshLocked(false);
    }, 5000);
  };

  // SYNC: 10-second pulse emission + 15-minute lockout
  const handleSync = async () => {
    if (isFrozen || isSyncLocked) return;

    setIsSyncLocked(true);
    setIsSyncPulsing(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      await fetch(`${BACKEND_URL}/sync?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (err) {
      // Catch aborts and network errors cleanly
    } finally {
      clearTimeout(timeoutId);
      setTimeout(() => {
        setIsSyncPulsing(false);
      }, 10000);
    }

    setTimeout(() => {
      setIsSyncLocked(false);
    }, 900000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. GLOBAL STICKY HEADER */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: '#00004d', 
        padding: '0 20px 10px 20px'
      }}>
        <DashboardHeader 
          onOpenSettings={() => setIsSettingsOpen(true)}
          isAutoMode={isAutoMode}
          isFrozen={isFrozen}
          refreshRate={refreshRate}
          isRefreshLocked={isRefreshLocked}
          isSyncLocked={isSyncLocked}
          isSyncPulsing={isSyncPulsing}
          onAutoToggle={handleAutoToggle}
          onRateChange={handleRateChange}
          onRefresh={handleRefresh}
          onSync={handleSync}
          onFreezeToggle={handleFreezeToggle}
        />
      </div>

      {/* 2. SETTINGS MODAL */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        allIndices={allIndicesPool}
        allStocks={allStocksPool}
        savedFirebaseList={savedFirebaseList}
        onApply={handleApplySettings}
        onSave={handleSaveSettings}
      />

      {/* 3. UPPER PART: ENVY BLUE (Indices Display) */}
      <div style={{ backgroundColor: '#00004d' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', padding: '10px 20px 40px 20px' }}>
          {(displayConfig.indices || []).map(indexObj => {
            const iName = indexObj.name || indexObj; 
            const iTicker = indexObj.ticker || allIndicesPool.find(i => i.name === iName)?.ticker || iName;
            
            return (
              <Index_window 
                key={iName} 
                indexName={iName} 
                ticker={iTicker}
                isAutoMode={isAutoMode} 
                isFrozen={isFrozen} 
                refreshRate={refreshRate} 
                refreshTrigger={refreshTrigger} 
              />
            );
          })}
        </div>
      </div>

      {/* 4. TEAL SEPARATOR LINE */}
      <div style={{ height: '2px', backgroundColor: '#29a3a3', zIndex: 10 }}></div>

      {/* 5. LOWER PART: DEEP GREEN (Stock Watchlist Grid) */}
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
        />
      </div>

    </div>
  );
}

export default App;