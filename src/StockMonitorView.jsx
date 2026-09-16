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
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [refreshRate, setRefreshRate] = useState(10);

  const [isRefreshLocked, setIsRefreshLocked] = useState(false);
  const [isSyncLocked, setIsSyncLocked] = useState(false);
  const [isSyncPulsing, setIsSyncPulsing] = useState(false);

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

  const handleSync = async () => {
    if (isSyncLocked || isFrozen) return;
    setIsSyncPulsing(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      await fetch(`${BACKEND_URL}/sync`, { 
        method: 'GET',
        mode: 'cors',
        signal: controller.signal 
      });
    } catch (err) {
      // Backend acknowledges or runs async
    } finally {
      clearTimeout(timeoutId);
      setIsSyncPulsing(false);
      setIsSyncLocked(true);
      setTimeout(() => setIsSyncLocked(false), 900000);
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
          onSync={handleSync}
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