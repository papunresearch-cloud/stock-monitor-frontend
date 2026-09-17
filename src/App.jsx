import React, { useState, useEffect } from 'react';
import Index_window from './Index_window';
import DashboardHeader from './DashboardHeader';
import StockGrid from './StockGrid';
import SettingsModal from './SettingsModal';
import HealthModal from './HealthModal';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';
const BACKEND_URL = 'https://nse-ohlc-system.onrender.com';

const allIndicesPool = [
  { name: 'NIFTY50', ticker: '^NSEI' },
  { name: 'NIFTY100', ticker: '^CNX100' },
  { name: 'NIFTY MIDCAP 150', ticker: 'NIFTYMIDCAP150.NS' },
  { name: 'NIFTY SMALLCAP 250', ticker: 'NIFTYSMLCAP250.NS' }
];

export default function App() {
  // Master Terminal Controls
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [refreshRate, setRefreshRate] = useState(10);

  // Network Fetch Triggers
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Diagnostics & Modals
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [firebaseConnected, setFirebaseConnected] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Stock Pools & Configuration
  const [allStocksPool, setAllStocksPool] = useState([]);
  const [displayConfig, setDisplayConfig] = useState({
    indices: allIndicesPool,
    stocks: [],
    displayOrder: 'Alphabetical Dec. (A - Z)',
    groupBy: 'No filter'
  });

  useEffect(() => {
    const initializeTerminal = async () => {
      try {
        const timestamp = Date.now();
        const [poolRes, savedRes] = await Promise.all([
          fetch(`${FIREBASE_DB_URL}/watchlist.json?_=${timestamp}`),
          fetch(`${FIREBASE_DB_URL}/display_list.json?_=${timestamp}`)
        ]);

        const poolData = poolRes.ok ? await poolRes.json() : null;
        const savedData = savedRes.ok ? await savedRes.json() : null;

        // Populate stock pool from watchlist
        const rawWatchlist = poolData?.watchlist || [];
        const availableStocks = (Array.isArray(rawWatchlist) ? rawWatchlist : Object.values(rawWatchlist)).filter(Boolean);
        setAllStocksPool(availableStocks);

        // Populate display configurations
        const rawFirebase = savedData || {};
        let parsedIndices = [];
        if (rawFirebase.indices) {
          const rawEntries = Array.isArray(rawFirebase.indices)
            ? rawFirebase.indices
            : Object.values(rawFirebase.indices);
          parsedIndices = rawEntries.filter((item) => item !== null && item !== undefined);
        }

        let parsedStocks = [];
        if (rawFirebase.stocks) {
          parsedStocks = Array.isArray(rawFirebase.stocks)
            ? rawFirebase.stocks
            : Object.values(rawFirebase.stocks);
        }

        // Fallback to active watchlist pool if display_list/stocks is empty
        const activeStocks = parsedStocks.length > 0 ? parsedStocks : availableStocks;
        const activeIndices = parsedIndices.length > 0 ? parsedIndices : allIndicesPool;

        setDisplayConfig({
          indices: activeIndices,
          stocks: activeStocks,
          displayOrder: rawFirebase.displayOrder || 'Alphabetical Dec. (A - Z)',
          groupBy: rawFirebase.groupBy || 'No filter'
        });

        setFirebaseConnected(true);
      } catch (err) {
        console.error('Failed initializing terminal:', err);
        setFirebaseConnected(false);
      }
    };

    initializeTerminal();
  }, [updateTrigger]);

  const handleManualRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleManualSync = () => {
    setUpdateTrigger((prev) => prev + 1);
  };

  return (
    <div style={{ backgroundColor: '#000000', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#ffffff' }}>
      
      {/* 1. TOP MASTER HEADER */}
      <DashboardHeader
        isAutoMode={isAutoMode}
        setIsAutoMode={setIsAutoMode}
        isFrozen={isFrozen}
        setIsFrozen={setIsFrozen}
        refreshRate={refreshRate}
        setRefreshRate={setRefreshRate}
        onManualRefresh={handleManualRefresh}
        onManualSync={handleManualSync}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHealth={() => setIsHealthOpen(true)}
        firebaseConnected={firebaseConnected}
      />

      {/* 2. UPPER PART: FIXED INDICES */}
      <div style={{ backgroundColor: '#00004d', borderBottom: '2px solid #29a3a3' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', padding: '15px 20px 30px 20px' }}>
          {(displayConfig.indices || [])
            .filter(Boolean)
            .map((indexObj) => {
              const iName = indexObj?.name || (typeof indexObj === 'string' ? indexObj : '');
              if (!iName) return null;
              const iTicker = indexObj?.ticker || allIndicesPool.find((i) => i.name === iName)?.ticker || iName;

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

      {/* 3. LOWER PART: WATCHLIST STOCK GRID */}
      <div style={{ backgroundColor: '#001a00', flexGrow: 1, paddingBottom: '50px' }}>
        <h2 style={{ color: 'white', textAlign: 'center', margin: '25px 0 15px 0', letterSpacing: '2px', textTransform: 'uppercase' }}>
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

      {/* 4. SETTINGS MODAL */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          allStocksPool={allStocksPool}
          allIndicesPool={allIndicesPool}
          displayConfig={displayConfig}
          setDisplayConfig={setDisplayConfig}
          onSaveSuccess={() => setUpdateTrigger((prev) => prev + 1)}
        />
      )}

      {/* 5. HEALTH MODAL */}
      {isHealthOpen && (
        <HealthModal
          isOpen={isHealthOpen}
          onClose={() => setIsHealthOpen(false)}
          healthData={healthData}
          backendUrl={BACKEND_URL}
        />
      )}

    </div>
  );
}