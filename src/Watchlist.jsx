import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ref, get, set, update, remove, onValue } from "firebase/database";
import { database } from "./firebase";

// ============================================================================
// 1. CONFIGURATION & FORMATTING HELPERS
// ============================================================================
export const APP_CONFIG = {
  theme: {
    deepMaroon: "#58111A",        
    headerTextColor: "#ffffff",    
    rowYellow: "#fef9c3",          
    rowSky: "#e0f2fe",             
    rowSelectedBg: "#fef08a",      
    fontColor: "#000000",          
    fontWeight: "700",             
    accentCyan: "#06b6d4",         
    accentMagenta: "#ec4899",      
    accentAmber: "#f59e0b",        
    accentGreen: "#10b981",        
    accentRed: "#ef4444",          
    tableOuterBorder: "2px solid #1e3a8a", 
    tableCellBorder: "1px solid #1e3a8a",  
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  columns: [
    "GROUP",
    "REVIEW", 
    "DURATION", 
    "REMARK", 
    "DATE",
    "TICKER"
  ],
  enrichmentMetrics: [
    "CODE", "DPB%", "DPE%", "DY", "F-score", "G-score", "PB", "PCCAP", 
    "PE", "PS", "T-score", "YPG", "YSG", "industry", "pg-1", "sector", "sg-ttm",
    "mcap", "roe-0", "roe-3y", "roa-0", "roa-3y", "roce-0", "roce-3y", 
    "sg-3y", "pg-3", "DE", "BVgr", "advdp", "FII", "DFII", "DII", 
    "DDII", "PRH", "DPRH", "Last Qtr"
  ]
};

const extractStockName = (item) => {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  if (typeof item === "object") return (item.CODE || item.Name || item.name || item.nseCode || String(item)).trim();
  return String(item).trim();
};

const formatDateToDDMMYYYY = (dateObj) => {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const parts = formatter.formatToParts(dateObj);
  const d = parts.find(p => p.type === 'day').value;
  const m = parts.find(p => p.type === 'month').value;
  const y = parts.find(p => p.type === 'year').value;
  return `${d}-${m}-${y}`;
};

const sanitizeKey = (key) =>
  String(key || "").trim().replace(/[.#$\[\]\/]/g, "_");

const extractScreenerFields = (screenerRecord) => {
  if (!screenerRecord || typeof screenerRecord !== "object") return {};
  const result = {};
  if (screenerRecord.Name) result.Name = screenerRecord.Name;

  APP_CONFIG.enrichmentMetrics.forEach((key) => {
    if (screenerRecord[key] !== undefined && screenerRecord[key] !== null) {
      result[key] = screenerRecord[key];
    }
  });
  return result;
};

// ============================================================================
// 2. MAIN COMPONENT
// ============================================================================
export default function StockWatchlist() {
  const theme = APP_CONFIG.theme;

  const [activeTab, setActiveTab] = useState("FILTER2"); 
  const [isModify, setIsModify] = useState(false);
  const [showModifyConfirm, setShowModifyConfirm] = useState(false);
  const [isWatchlistExpanded, setIsWatchlistExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const [mainData, setMainData] = useState([]);
  const [filter2RawNames, setFilter2RawNames] = useState([]);
  const [stockDatabase, setStockDatabase] = useState({});
  const [originalDb, setOriginalDb] = useState({});
  const [watchlistNames, setWatchlistNames] = useState([]);

  const [watchlistEditSelected, setWatchlistEditSelected] = useState(new Set());
  const [selectedStockNames, setSelectedStockNames] = useState(new Set());
  const [appliedFilter, setAppliedFilter] = useState(null);

  // Queue Modals
  const [addQueue, setAddQueue] = useState([]);
  const [currentAddIndex, setCurrentAddIndex] = useState(0);
  const [addAnswers, setAddAnswers] = useState({ q1: "", q2: "", q3: "", q4: "" });

  const [deleteQueue, setDeleteQueue] = useState([]);
  const [currentDeleteIndex, setCurrentDeleteIndex] = useState(0);
  const [deleteAnswers, setDeleteAnswers] = useState({ q1: "", q2: "", q3: "", dateInput: "" });

  const [updateQueue, setUpdateQueue] = useState([]);
  const [currentUpdateIndex, setCurrentUpdateIndex] = useState(0);
  const [updateAnswers, setUpdateAnswers] = useState({ q1: "", q2: "", q3: "" });

  // Dialog Modals
  const [notepadModal, setNotepadModal] = useState({ isOpen: false, stockName: "", text: "", error: "" });
  const [tickerModal, setTickerModal] = useState({ isOpen: false, stockName: "", text: "", defaultTicker: "", isManualMode: false });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [bannerMsg, setBannerMsg] = useState({ text: "", type: "info" });

  const todayFormattedDate = formatDateToDDMMYYYY(new Date());

  // Real-Time Sync & Initializer
  useEffect(() => {
    setLoading(true);

    const loadInitialData = async () => {
      try {
        const f2Snap = await get(ref(database, 'filters/filter2'));
        if (f2Snap.exists()) {
          const f2Val = f2Snap.val();
          const f2Arr = Array.isArray(f2Val) ? f2Val : Object.values(f2Val);
          setFilter2RawNames(f2Arr.map(extractStockName).filter(Boolean));
        } else {
          setFilter2RawNames([]);
        }

        const wlSnap = await get(ref(database, 'watchlist'));
        if (wlSnap.exists()) {
          const wlData = wlSnap.val() || {};
          const wlArr = Array.isArray(wlData.watchlist) ? wlData.watchlist.map(extractStockName).filter(Boolean) : [];
          const details = wlData.detailedDb || {};
          
          setWatchlistNames(wlArr);
          setWatchlistEditSelected(new Set(wlArr));
          setStockDatabase(details);
          setOriginalDb(JSON.parse(JSON.stringify(details)));
        } else {
          setWatchlistNames([]);
          setWatchlistEditSelected(new Set());
          setStockDatabase({});
          setOriginalDb({});
        }
      } catch (err) {
        console.error("Firebase Initialization Error:", err);
        setBannerMsg({ text: `Sync Error: ${err.message}`, type: "error" });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    // Listen to /SCREENER: mirror metric updates directly into detailedDb
    const screenerRef = ref(database, 'SCREENER');
    const unsubscribeScreener = onValue(screenerRef, async (snapshot) => {
      if (!snapshot.exists()) return;

      const val = snapshot.val();
      const screenerArr = (Array.isArray(val) ? val : Object.values(val)).filter(Boolean);
      setMainData(screenerArr);

      const lookup = {};
      screenerArr.forEach((item) => {
        if (item.CODE) lookup[sanitizeKey(item.CODE)] = item;
        if (item.Name) lookup[sanitizeKey(item.Name)] = item;
      });

      try {
        const wlSnap = await get(ref(database, 'watchlist'));
        if (!wlSnap.exists()) return;

        const wlData = wlSnap.val() || {};
        const activeWatchlist = Array.isArray(wlData.watchlist) ? wlData.watchlist : [];
        const currentDetailedDb = wlData.detailedDb || {};
        const dbUpdates = {};
        let needsSync = false;

        activeWatchlist.forEach((stk) => {
          const safeKey = sanitizeKey(stk);
          const screenerRecord = lookup[safeKey] || {};
          if (Object.keys(screenerRecord).length === 0) return;

          const newScreenerMetrics = extractScreenerFields(screenerRecord);
          const existingStock = currentDetailedDb[safeKey] || {};

          const hasDiff = Object.entries(newScreenerMetrics).some(
            ([k, v]) => existingStock[k] !== v
          );

          if (hasDiff) {
            needsSync = true;
            dbUpdates[`watchlist/detailedDb/${safeKey}`] = {
              ...existingStock,
              ...newScreenerMetrics,
              GROUP: existingStock.GROUP || "GROUP-0",
              REVIEW: existingStock.REVIEW || "NR",
              DURATION: existingStock.DURATION || "NR",
              REMARK: existingStock.REMARK || "",
              DATE: existingStock.DATE || formatDateToDDMMYYYY(new Date()),
              TICKER: existingStock.TICKER || (screenerRecord.NSE ? `${screenerRecord.NSE}.NS` : stk),
              CODE: existingStock.CODE || screenerRecord.CODE || safeKey
            };
          }
        });

        if (needsSync && Object.keys(dbUpdates).length > 0) {
          await update(ref(database), dbUpdates);
          setStockDatabase((prev) => {
            const nextDb = { ...prev };
            Object.entries(dbUpdates).forEach(([path, updatedObj]) => {
              const k = path.replace("watchlist/detailedDb/", "");
              nextDb[k] = updatedObj;
            });
            return nextDb;
          });
        }
      } catch (err) {
        console.error("Live SCREENER sync error:", err);
      }
    });

    return () => unsubscribeScreener();
  }, []);

  const mainDataMap = useMemo(() => {
    const map = {};
    if (Array.isArray(mainData)) {
      mainData.forEach((item) => {
        if (item.CODE) map[item.CODE.trim()] = item;
        if (item.Name) map[item.Name.trim()] = item;
        if (item.CODE) map[sanitizeKey(item.CODE)] = item;
      });
    }
    return map;
  }, [mainData]);

  const findMainRecord = useCallback((stockIdentifier) => {
    if (!stockIdentifier) return {};
    const cleanStr = String(stockIdentifier).trim();
    const safeStr = sanitizeKey(cleanStr);
    return mainDataMap[cleanStr] || mainDataMap[safeStr] || {};
  }, [mainDataMap]);

  const handleFieldChange = (stockName, fieldKey, value) => {
    const validName = extractStockName(stockName);
    setStockDatabase((prev) => ({
      ...prev,
      [validName]: {
        ...prev[validName],
        [fieldKey]: value
      }
    }));
  };

  const displayedStockNames = useMemo(() => {
    let list = activeTab === "FILTER2" ? filter2RawNames : watchlistNames;
    if (activeTab === "WATCHLIST" && appliedFilter) {
      list = list.filter((name) => appliedFilter.has(name));
    }
    return list.map(extractStockName).filter(Boolean);
  }, [activeTab, filter2RawNames, watchlistNames, appliedFilter]);

  const selectableDisplayedStocks = useMemo(() => {
    if (activeTab === "FILTER2") {
      return displayedStockNames.filter((name) => !watchlistNames.includes(name));
    }
    return displayedStockNames;
  }, [displayedStockNames, activeTab, watchlistNames]);

  const handleToggleSelectStock = (stockName) => {
    setSelectedStockNames((prev) => {
      const next = new Set(prev);
      if (next.has(stockName)) next.delete(stockName);
      else next.add(stockName);
      return next;
    });
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) setSelectedStockNames(new Set(selectableDisplayedStocks));
    else setSelectedStockNames(new Set());
  };

  // Cloud Event Dispatcher to instruct master.py
  const dispatchStockEvent = async (action, stockName, ticker = "") => {
    try {
      const cmdRef = ref(database, "system_commands/stock_event");
      await set(cmdRef, {
        action: action,
        stock: stockName,
        ticker: ticker,
        timestamp: Date.now()
      });
      console.log(`[EVENT] Dispatched ${action} for ${stockName} (${ticker})`);
    } catch (err) {
      console.error("[EVENT] Failed to dispatch stock event:", err);
    }
  };

  // ============================================================================
  // 1. ADD HANDLER
  // ============================================================================
  const startAddProcess = () => {
    const list = Array.from(selectedStockNames);
    if (list.length === 0) return;
    setAddQueue(list);
    setCurrentAddIndex(0);
    setAddAnswers({ q1: "", q2: "", q3: "", q4: "" });
  };

  const handleOkAddStock = async () => {
    const stockToAdd = addQueue[currentAddIndex];
    const safeStockKey = sanitizeKey(stockToAdd);
    const today = formatDateToDDMMYYYY(new Date());

    let mainRecord = findMainRecord(stockToAdd);
    if (!mainRecord || Object.keys(mainRecord).length === 0) {
      try {
        const snap = await get(ref(database, `SCREENER/${safeStockKey}`));
        if (snap.exists()) mainRecord = snap.val() || {};
      } catch (err) {
        console.warn("Direct screener fallback error:", err);
      }
    }

    const screenerMetrics = extractScreenerFields(mainRecord);
    const ticker = stockDatabase[stockToAdd]?.TICKER || (mainRecord.NSE ? `${mainRecord.NSE}.NS` : stockToAdd);

    const completeStockRecord = {
      ...screenerMetrics,
      CODE: mainRecord.CODE || safeStockKey,
      Name: mainRecord.Name || stockToAdd,
      GROUP: stockDatabase[stockToAdd]?.GROUP || "GROUP-0",
      REVIEW: stockDatabase[stockToAdd]?.REVIEW || "NR",
      DURATION: stockDatabase[stockToAdd]?.DURATION || "NR",
      REMARK: stockDatabase[stockToAdd]?.REMARK || "",
      DATE: today,
      TICKER: ticker
    };

    const nextWatchlist = Array.from(new Set([...watchlistNames, stockToAdd]));

    setWatchlistNames(nextWatchlist);
    setStockDatabase((prev) => ({ ...prev, [stockToAdd]: completeStockRecord }));
    setOriginalDb((prev) => ({ ...prev, [stockToAdd]: JSON.parse(JSON.stringify(completeStockRecord)) }));
    setWatchlistEditSelected(new Set(nextWatchlist));

    setSelectedStockNames((prev) => {
      const next = new Set(prev);
      next.delete(stockToAdd);
      return next;
    });

    try {
      const updates = {};
      updates['watchlist/watchlist'] = nextWatchlist;
      updates[`watchlist/detailedDb/${safeStockKey}`] = completeStockRecord;
      updates[`stocklist/${safeStockKey}`] = ticker;

      await update(ref(database), updates);
      await dispatchStockEvent("ADD", stockToAdd, ticker);

      setBannerMsg({ text: `Successfully enrolled ${stockToAdd}! ✅`, type: "success" });
      setTimeout(() => setBannerMsg({ text: "", type: "info" }), 3500);
    } catch (err) {
      console.error("Firebase Add Sync Error:", err);
      setBannerMsg({ text: `Add Error: ${err.message}`, type: "error" });
    }

    if (currentAddIndex + 1 < addQueue.length) {
      setCurrentAddIndex((prev) => prev + 1);
      setAddAnswers({ q1: "", q2: "", q3: "", q4: "" });
    } else {
      setAddQueue([]);
    }
  };

  const handleCancelAddStock = () => {
    if (currentAddIndex + 1 < addQueue.length) {
      setCurrentAddIndex((prev) => prev + 1);
      setAddAnswers({ q1: "", q2: "", q3: "", q4: "" });
    } else {
      setAddQueue([]);
    }
  };

  const handleAbortAdd = () => {
    setAddQueue([]);
    setCurrentAddIndex(0);
  };

  // ============================================================================
  // 2. DELETE HANDLER
  // ============================================================================
  const startDeleteProcess = () => {
    const list = Array.from(watchlistEditSelected);
    if (list.length === 0) return;
    setDeleteQueue(list);
    setCurrentDeleteIndex(0);
    setDeleteAnswers({ q1: "", q2: "", q3: "", dateInput: "" });
  };

  const handleOkDeleteStock = async () => {
    const stockToDelete = deleteQueue[currentDeleteIndex];
    const safeStockKey = sanitizeKey(stockToDelete);

    const nextWatchlist = watchlistNames.filter((name) => name !== stockToDelete);
    setWatchlistNames(nextWatchlist);
    setStockDatabase((prev) => {
      const copy = { ...prev };
      delete copy[stockToDelete];
      return copy;
    });
    setOriginalDb((prev) => {
      const copy = { ...prev };
      delete copy[stockToDelete];
      return copy;
    });
    setWatchlistEditSelected((prev) => {
      const next = new Set(prev);
      next.delete(stockToDelete);
      return next;
    });

    try {
      await set(ref(database, 'watchlist/watchlist'), nextWatchlist);
      await remove(ref(database, `stocklist/${safeStockKey}`));
      await remove(ref(database, `watchlist/detailedDb/${safeStockKey}`));
      await remove(ref(database, `stocks/${safeStockKey}`));
      await remove(ref(database, `param/${safeStockKey}`));

      await dispatchStockEvent("DELETE", stockToDelete);

      setBannerMsg({ text: `Purged ${stockToDelete} cleanly. 🗑️`, type: "success" });
      setTimeout(() => setBannerMsg({ text: "", type: "info" }), 3500);
    } catch (err) {
      console.error("Purge error:", err);
      setBannerMsg({ text: `Purge Error: ${err.message}`, type: "error" });
    }

    if (currentDeleteIndex + 1 < deleteQueue.length) {
      setCurrentDeleteIndex((prev) => prev + 1);
      setDeleteAnswers({ q1: "", q2: "", q3: "", dateInput: "" });
    } else {
      setDeleteQueue([]);
    }
  };

  const handleCancelDeleteStock = () => {
    if (currentDeleteIndex + 1 < deleteQueue.length) {
      setCurrentDeleteIndex((prev) => prev + 1);
      setDeleteAnswers({ q1: "", q2: "", q3: "", dateInput: "" });
    } else {
      setDeleteQueue([]);
    }
  };

  const handleAbortDelete = () => {
    setDeleteQueue([]);
    setCurrentDeleteIndex(0);
  };

  // ============================================================================
  // 3. UPDATE HANDLER
  // ============================================================================
  const startUpdateProcess = () => {
    if (watchlistNames.length === 0) return;
    setUpdateQueue([...watchlistNames]);
    setCurrentUpdateIndex(0);
    setUpdateAnswers({ q1: "", q2: "", q3: "" });
  };

  const handleOkUpdateStock = async () => {
    const stockToUpdate = updateQueue[currentUpdateIndex];
    const safeStockKey = sanitizeKey(stockToUpdate);
    const today = formatDateToDDMMYYYY(new Date());

    const curr = stockDatabase[stockToUpdate] || {};
    const orig = originalDb[stockToUpdate] || {};

    const coreChanged =
      curr.GROUP !== orig.GROUP ||
      curr.DURATION !== orig.DURATION ||
      curr.REVIEW !== orig.REVIEW ||
      curr.REMARK !== orig.REMARK ||
      curr.TICKER !== orig.TICKER;

    const updatedDate = coreChanged ? today : (curr.DATE || today);

    const updatedMetadata = {
      ...curr,
      GROUP: curr.GROUP || "GROUP-0",
      REVIEW: curr.REVIEW || "NR",
      DURATION: curr.DURATION || "NR",
      REMARK: curr.REMARK || "",
      DATE: updatedDate,
      TICKER: curr.TICKER || stockToUpdate
    };

    setStockDatabase((prev) => ({ ...prev, [stockToUpdate]: updatedMetadata }));
    setOriginalDb((prev) => ({ ...prev, [stockToUpdate]: JSON.parse(JSON.stringify(updatedMetadata)) }));

    try {
      await update(ref(database, `watchlist/detailedDb/${safeStockKey}`), updatedMetadata);

      if (updatedMetadata.TICKER) {
        await set(ref(database, `stocklist/${safeStockKey}`), updatedMetadata.TICKER);
      }
    } catch (err) {
      console.error("Update error:", err);
    }

    if (currentUpdateIndex + 1 < updateQueue.length) {
      setCurrentUpdateIndex((prev) => prev + 1);
      setUpdateAnswers({ q1: "", q2: "", q3: "" });
    } else {
      setUpdateQueue([]);
    }
  };

  const handleCancelUpdateStock = () => {
    if (currentUpdateIndex + 1 < updateQueue.length) {
      setCurrentUpdateIndex((prev) => prev + 1);
      setUpdateAnswers({ q1: "", q2: "", q3: "" });
    } else {
      setUpdateQueue([]);
    }
  };

  const handleAbortUpdate = () => {
    setUpdateQueue([]);
    setCurrentUpdateIndex(0);
  };

  const handleApply = () => {
    setActiveTab("WATCHLIST");
    setAppliedFilter(new Set(watchlistEditSelected));
  };

  const handleSaveNotepad = () => {
    handleFieldChange(notepadModal.stockName, "REMARK", notepadModal.text);
    setNotepadModal({ isOpen: false, stockName: "", text: "", error: "" });
  };

  const openExternalLink = (type, stockName) => {
    const validName = extractStockName(stockName);
    const mainRecord = findMainRecord(validName);
    const nse = mainRecord.NSE;
    const bse = mainRecord.BSE;
    const fallbackCode = mainRecord.CODE || validName; 

    let url = "";
    if (type === "SCR") url = `https://www.screener.in/company/${nse || bse || fallbackCode}/consolidated/`;
    else if (type === "TV") url = `https://in.tradingview.com/chart/?symbol=${nse || fallbackCode}`;
    else if (type === "GF") url = nse ? `https://www.google.com/finance/beta/quote/${nse}:NSE` : `https://www.google.com/finance/`;
    else if (type === "YF") url = nse ? `https://finance.yahoo.com/quote/${nse}.NS/` : `https://finance.yahoo.com/lookup/?s=${encodeURIComponent(fallbackCode)}`;

    if (!url) return;
    const width = 1000, height = 700;
    const left = (window.innerWidth - width) / 2 + window.screenX;
    const top = (window.innerHeight - height) / 2 + window.screenY;
    window.open(url, "_blank", `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
  };

  const isAllDisplayedSelected = selectableDisplayedStocks.length > 0 && selectableDisplayedStocks.every((name) => selectedStockNames.has(name));

  if (loading) {
    return (
      <div style={{ color: theme.accentCyan, backgroundColor: "#0b132b", minHeight: "100vh", padding: "40px", textAlign: "center", fontFamily: theme.fontFamily }}>
        <h2>⏳ Loading Watchlist from Firebase...</h2>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: theme.fontFamily, backgroundColor: "#0b132b", minHeight: "100vh", padding: "16px", boxSizing: "border-box" }}>
      
      {/* CONTROL PANEL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0f172a", padding: "10px 16px", borderRadius: "8px", border: `2px solid ${theme.deepMaroon}`, marginBottom: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", flexWrap: "wrap", gap: "10px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => { setActiveTab("FILTER2"); setSelectedStockNames(new Set()); setAppliedFilter(null); }}
            style={{
              backgroundColor: activeTab === "FILTER2" ? theme.accentAmber : "#1e293b",
              color: activeTab === "FILTER2" ? "#000000" : theme.accentAmber,
              border: `2px solid ${theme.accentAmber}`,
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: "pointer",
              textTransform: "uppercase"
            }}
          >
            FILTER2 ({filter2RawNames.length})
          </button>

          <div style={{ display: "flex", alignItems: "center", background: "#1e293b", borderRadius: "6px", border: `2px solid ${theme.accentCyan}`, overflow: "hidden" }}>
            <button
              onClick={() => { setActiveTab("WATCHLIST"); setSelectedStockNames(new Set()); setAppliedFilter(null); }}
              style={{
                backgroundColor: activeTab === "WATCHLIST" ? theme.accentCyan : "transparent",
                color: activeTab === "WATCHLIST" ? "#000000" : theme.accentCyan,
                border: "none",
                padding: "8px 14px",
                fontWeight: "900",
                fontSize: "12px",
                cursor: "pointer",
                textTransform: "uppercase"
              }}
            >
              WATCHLIST ({watchlistNames.length})
            </button>
            <button
              onClick={() => setIsWatchlistExpanded((prev) => !prev)}
              title="Expand Panel"
              style={{
                backgroundColor: "#334155",
                color: theme.accentCyan,
                border: "none",
                padding: "8px 12px",
                fontWeight: "900",
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              {isWatchlistExpanded ? "▼" : "+"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowModifyConfirm(true)}
            style={{
              backgroundColor: isModify ? theme.accentRed : "#7c3aed",
              color: "#ffffff",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: "pointer",
              textTransform: "uppercase"
            }}
          >
            MODIFY: {isModify ? "YES" : "NO"}
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            style={{
              backgroundColor: theme.accentAmber,
              color: "#000000",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: "pointer",
              textTransform: "uppercase"
            }}
          >
            HELP
          </button>
        </div>
      </div>

      {bannerMsg.text && (
        <div style={{ marginBottom: "12px", padding: "10px 14px", backgroundColor: bannerMsg.type === "error" ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)", border: `2px solid ${bannerMsg.type === "error" ? theme.accentRed : theme.accentGreen}`, color: bannerMsg.type === "error" ? "#fca5a5" : "#6ee7b7", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{bannerMsg.text}</span>
          <button onClick={() => setBannerMsg({ text: "", type: "info" })} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>✕</button>
        </div>
      )}

      {/* EXPANSION PANEL */}
      {isWatchlistExpanded && (
        <div style={{ marginBottom: "16px", padding: "16px", backgroundColor: "#0f172a", border: `2px solid ${theme.accentCyan}`, borderRadius: "8px" }}>
          <div style={{ color: theme.accentCyan, fontWeight: "900", textTransform: "uppercase", fontSize: "12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>WATCHLIST CHECKBOXES ({watchlistNames.length} TOTAL):</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setWatchlistEditSelected(new Set(watchlistNames))} style={{ backgroundColor: "#1e293b", color: theme.accentCyan, border: `1px solid ${theme.accentCyan}`, padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>SELECT ALL</button>
              <button onClick={() => setWatchlistEditSelected(new Set())} style={{ backgroundColor: "#1e293b", color: theme.accentRed, border: `1px solid ${theme.accentRed}`, padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>DESELECT ALL</button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            {watchlistNames.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>No stocks in Watchlist. Select from Filter2 and Add.</p>
            ) : (
              watchlistNames.map((stockName) => {
                const isChecked = watchlistEditSelected.has(stockName);
                return (
                  <label key={stockName} style={{ display: "flex", alignItems: "center", gap: "6px", background: isChecked ? "#1e293b" : "#334155", padding: "6px 12px", borderRadius: "6px", border: `1px solid ${isChecked ? theme.accentCyan : "#475569"}`, color: "#ffffff", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const next = new Set(watchlistEditSelected);
                        if (e.target.checked) next.add(stockName);
                        else next.delete(stockName);
                        setWatchlistEditSelected(next);
                      }}
                      style={{ accentColor: theme.accentCyan }}
                    />
                    {stockName}
                  </label>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #334155", paddingTop: "12px" }}>
            <button 
              onClick={startAddProcess} 
              disabled={selectedStockNames.size === 0} 
              style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "900", fontSize: "12px", cursor: selectedStockNames.size === 0 ? "not-allowed" : "pointer", opacity: selectedStockNames.size === 0 ? 0.5 : 1 }}
            >
              ➕ ADD TO WATCHLIST ({selectedStockNames.size})
            </button>
            
            <button 
              onClick={startDeleteProcess} 
              disabled={watchlistEditSelected.size === 0} 
              style={{ backgroundColor: theme.accentRed, color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "900", fontSize: "12px", cursor: watchlistEditSelected.size === 0 ? "not-allowed" : "pointer", opacity: watchlistEditSelected.size === 0 ? 0.5 : 1 }}
            >
              🗑️ DELETE CHECKED ({watchlistEditSelected.size})
            </button>
            
            <div style={{ width: "2px", height: "24px", backgroundColor: "#334155", margin: "0 5px" }} />
            
            <button onClick={handleApply} disabled={watchlistEditSelected.size === 0} style={{ backgroundColor: theme.accentAmber, color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "900", fontSize: "12px", cursor: watchlistEditSelected.size === 0 ? "not-allowed" : "pointer", opacity: watchlistEditSelected.size === 0 ? 0.5 : 1 }}>
              ✔️ APPLY ({watchlistEditSelected.size})
            </button>

            <button 
              onClick={startUpdateProcess} 
              disabled={watchlistNames.length === 0}
              style={{ 
                backgroundColor: theme.accentCyan, 
                color: "#000000", 
                border: "none", 
                padding: "8px 16px", 
                borderRadius: "6px", 
                fontWeight: "900", 
                fontSize: "12px", 
                marginLeft: "auto", 
                cursor: watchlistNames.length === 0 ? "not-allowed" : "pointer", 
                opacity: watchlistNames.length === 0 ? 0.5 : 1
              }}
            >
              💾 UPDATE DATABASE
            </button>
          </div>
        </div>
      )}

      {/* SPREADSHEET TABLE */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 240px)", border: isModify ? "2px solid #ef4444" : theme.tableOuterBorder, borderRadius: "8px", backgroundColor: "#ffffff", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px", fontWeight: theme.fontWeight, color: theme.fontColor }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 30, backgroundColor: theme.deepMaroon, color: theme.headerTextColor }}>
              <th style={{ padding: "12px 8px", border: theme.tableCellBorder, textAlign: "center", width: "50px", backgroundColor: theme.deepMaroon, position: "sticky", left: 0, zIndex: 40, textTransform: "uppercase" }}>
                <input type="checkbox" checked={isAllDisplayedSelected} onChange={handleToggleSelectAll} style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: theme.accentAmber }} />
              </th>
              <th style={{ padding: "12px 16px", border: theme.tableCellBorder, textAlign: "left", backgroundColor: theme.deepMaroon, position: "sticky", left: "50px", zIndex: 40, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                STOCK NAME
              </th>
              {APP_CONFIG.columns.map((colKey) => (
                <th key={colKey} style={{ padding: "12px 14px", border: theme.tableCellBorder, textAlign: "center", backgroundColor: theme.deepMaroon, color: theme.headerTextColor, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {colKey}
                </th>
              ))}
              <th style={{ padding: "12px 14px", border: theme.tableCellBorder, textAlign: "center", backgroundColor: theme.deepMaroon, color: theme.headerTextColor, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                LINK BUTTONS
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedStockNames.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#64748b", fontWeight: "bold" }}>
                  No stocks found in {activeTab}.
                </td>
              </tr>
            ) : (
              displayedStockNames.map((stockName, index) => {
                const stockData = stockDatabase[stockName] || {};
                const isEven = index % 2 === 0;
                const rowBg = isEven ? theme.rowYellow : theme.rowSky;
                const isSelected = selectedStockNames.has(stockName);
                const isEditable = isModify || activeTab === "WATCHLIST";
                const isAlreadyInWatchlist = activeTab === "FILTER2" && watchlistNames.includes(stockName);

                return (
                  <tr key={stockName} style={{ backgroundColor: isSelected ? theme.rowSelectedBg : rowBg }}>
                    <td style={{ padding: "8px", border: theme.tableCellBorder, textAlign: "center", backgroundColor: isSelected ? theme.rowSelectedBg : rowBg, position: "sticky", left: 0, zIndex: 10 }}>
                      <input 
                        type="checkbox" 
                        checked={isAlreadyInWatchlist ? false : isSelected} 
                        disabled={isAlreadyInWatchlist}
                        onChange={() => handleToggleSelectStock(stockName)} 
                        style={{ width: "18px", height: "18px", cursor: isAlreadyInWatchlist ? "not-allowed" : "pointer", accentColor: theme.accentAmber, opacity: isAlreadyInWatchlist ? 0.75 : 1 }} 
                        title={isAlreadyInWatchlist ? "Already in Watchlist" : "Select to Add"}
                      />
                    </td>

                    <td style={{ padding: "8px 16px", border: theme.tableCellBorder, textAlign: "left", backgroundColor: isSelected ? theme.rowSelectedBg : rowBg, position: "sticky", left: "50px", zIndex: 10, fontWeight: "900", whiteSpace: "nowrap", color: "#000000" }}>
                      {stockName}
                      {isAlreadyInWatchlist && (
                        <span 
                          style={{ marginLeft: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: theme.accentRed, color: "#ffffff", fontSize: "10px", fontWeight: "900", verticalAlign: "middle" }} 
                          title="Already in Watchlist"
                        >
                          W
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center" }}>
                      <input
                        type="text"
                        maxLength={20}
                        disabled={!isEditable}
                        value={stockData["GROUP"] ?? "GROUP-0"}
                        onChange={(e) => handleFieldChange(stockName, "GROUP", e.target.value)}
                        style={{ width: "100%", padding: "6px", backgroundColor: isEditable ? "#0f172a" : "#cbd5e1", color: isEditable ? theme.accentAmber : "#000000", fontWeight: "900", borderRadius: "4px", border: "1px solid #334155", cursor: isEditable ? "text" : "not-allowed", textAlign: "center", fontSize: "12px", boxSizing: "border-box" }}
                      />
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center" }}>
                      <select
                        disabled={!isEditable}
                        value={stockData["REVIEW"] || "NR"}
                        onChange={(e) => handleFieldChange(stockName, "REVIEW", e.target.value)}
                        style={{ width: "100%", padding: "6px", backgroundColor: isEditable ? "#0f172a" : "#cbd5e1", color: isEditable ? theme.accentMagenta : "#000000", fontWeight: "900", borderRadius: "4px", border: "1px solid #334155", cursor: isEditable ? "pointer" : "not-allowed", textAlign: "center" }}
                      >
                        {["NR", "1 STAR", "2 STAR", "3 STAR", "4 STAR", "5 STAR"].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center" }}>
                      <select
                        disabled={!isEditable}
                        value={stockData["DURATION"] || "NR"}
                        onChange={(e) => handleFieldChange(stockName, "DURATION", e.target.value)}
                        style={{ width: "100%", padding: "6px", backgroundColor: isEditable ? "#0f172a" : "#cbd5e1", color: isEditable ? theme.accentCyan : "#000000", fontWeight: "900", borderRadius: "4px", border: "1px solid #334155", cursor: isEditable ? "pointer" : "not-allowed", textAlign: "center" }}
                      >
                        {["V. Long (3-10 Years)", "Long (1-3 Years)", "Medium (6-12 Month)", "Short (3-6 Month)", "V. Short (0-3 Month)", "NR"].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEditable) return;
                          setNotepadModal({ isOpen: true, stockName: stockName, text: stockData["REMARK"] || "", error: "" });
                        }}
                        style={{ backgroundColor: stockData["REMARK"] ? theme.accentGreen : theme.accentAmber, color: "#000000", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: "900", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                      >
                        ✏️ {stockData["REMARK"] ? "EDIT" : "ADD"}
                      </button>
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center", color: "#16a34a", fontWeight: "900", whiteSpace: "nowrap" }}>
                      {stockData["DATE"] || ""}
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEditable) return;
                          const mainRecord = findMainRecord(stockName);
                          const defaultTicker = mainRecord.NSE ? `${mainRecord.NSE}.NS` : stockName;
                          setTickerModal({ isOpen: true, stockName: stockName, text: stockData["TICKER"] || defaultTicker, defaultTicker: defaultTicker, isManualMode: false });
                        }}
                        style={{ 
                          backgroundColor: isEditable ? "#0f172a" : "#cbd5e1", 
                          color: isEditable ? theme.accentAmber : "#000000", 
                          border: `1px solid ${isEditable ? "#334155" : "#cbd5e1"}`, 
                          padding: "6px", 
                          borderRadius: "4px", 
                          fontWeight: "900", 
                          cursor: isEditable ? "pointer" : "not-allowed", 
                          fontSize: "12px", 
                          width: "120px",
                          boxSizing: "border-box",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                         {stockData["TICKER"] || "SET TICKER"}
                      </button>
                    </td>

                    <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
                        <button type="button" onClick={() => openExternalLink("SCR", stockName)} style={{ backgroundColor: "#2563eb", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}>SCR</button>
                        <button type="button" onClick={() => openExternalLink("TV", stockName)} style={{ backgroundColor: "#ea580c", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}>TV</button>
                        <button type="button" onClick={() => openExternalLink("GF", stockName)} style={{ backgroundColor: "#16a34a", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}>GF</button>
                        <button type="button" onClick={() => openExternalLink("YF", stockName)} style={{ backgroundColor: "#9333ea", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}>YF</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 1. ADD MODAL */}
      {addQueue.length > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `2px solid ${theme.accentGreen}`, borderRadius: "12px", padding: "24px", width: "480px", color: "#f8fafc", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#94a3b8" }}>
                ADDING ITEM {currentAddIndex + 1} OF {addQueue.length}
              </span>
              <span style={{ fontSize: "11px", backgroundColor: "#1e293b", padding: "3px 8px", borderRadius: "4px", border: `1px solid ${theme.accentGreen}`, color: theme.accentGreen, fontWeight: "900" }}>
                SECURITY CHECK
              </span>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h1 style={{ color: theme.accentGreen, fontSize: "28px", fontWeight: "900", margin: "0 0 6px 0", letterSpacing: "1px" }}>
                {addQueue[currentAddIndex]}
              </h1>
              <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>Verify the mandatory checklist before adding to Firebase.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", marginBottom: "24px" }}>
              {[
                { key: "q1", text: "A. Are you sure you want to add this stock?" },
                { key: "q2", text: "B. Do you add this stock without any purpose?" },
                { key: "q3", text: "C. Have you completed your research on this stock?" },
                { key: "q4", text: "D. Have you filled-up all the manual entries?" }
              ].map(({ key, text }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "8px 12px", borderRadius: "6px" }}>
                  <span>{text}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["Y", "N"].map((opt) => (
                      <button key={opt} onClick={() => setAddAnswers({ ...addAnswers, [key]: opt })} style={{ width: "32px", height: "28px", fontWeight: "bold", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: addAnswers[key] === opt ? theme.accentGreen : "#334155", color: addAnswers[key] === opt ? "#000" : "#fff" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #334155", paddingTop: "14px" }}>
              <button onClick={handleAbortAdd} style={{ backgroundColor: "#334155", color: "#f87171", border: "1px solid #ef4444", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                ABORT
              </button>
              <button onClick={handleCancelAddStock} style={{ backgroundColor: "#475569", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                CANCEL
              </button>

              {addAnswers.q1 === "Y" && addAnswers.q2 === "N" && addAnswers.q3 === "Y" && addAnswers.q4 === "Y" && (
                <button onClick={handleOkAddStock} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "8px 24px", borderRadius: "6px", fontWeight: "900", cursor: "pointer" }}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. DELETE MODAL */}
      {deleteQueue.length > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `2px solid ${theme.accentRed}`, borderRadius: "12px", padding: "24px", width: "480px", color: "#f8fafc", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#94a3b8" }}>
                DELETING ITEM {currentDeleteIndex + 1} OF {deleteQueue.length}
              </span>
              <span style={{ fontSize: "11px", backgroundColor: "#1e293b", padding: "3px 8px", borderRadius: "4px", border: `1px solid ${theme.accentRed}`, color: theme.accentRed, fontWeight: "900" }}>
                DELETION AUDIT
              </span>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h1 style={{ color: theme.accentRed, fontSize: "28px", fontWeight: "900", margin: "0 0 6px 0", letterSpacing: "1px" }}>
                {deleteQueue[currentDeleteIndex]}
              </h1>
              <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>Permanent removal from Watchlist, Stocklist, OHLC & Param History.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", marginBottom: "24px" }}>
              {[
                { key: "q1", text: "A. Are you sure you want to delete this stock?" },
                { key: "q2", text: "B. By mistake are you not deleting this stock?" },
                { key: "q3", text: "C. Do you know deleting this stock will erase history?" }
              ].map(({ key, text }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "8px 12px", borderRadius: "6px" }}>
                  <span>{text}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["Y", "N"].map((opt) => (
                      <button key={opt} onClick={() => setDeleteAnswers({ ...deleteAnswers, [key]: opt })} style={{ width: "32px", height: "28px", fontWeight: "bold", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: deleteAnswers[key] === opt ? theme.accentRed : "#334155", color: "#fff" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "8px 12px", borderRadius: "6px" }}>
                <span>D. Enter Today's Date:</span>
                <input
                  type="text"
                  placeholder={todayFormattedDate}
                  value={deleteAnswers.dateInput}
                  onChange={(e) => setDeleteAnswers({ ...deleteAnswers, dateInput: e.target.value.trim() })}
                  style={{ width: "110px", padding: "5px 8px", backgroundColor: "#0f172a", border: "1px solid #475569", color: "#ffffff", borderRadius: "4px", textAlign: "center", fontWeight: "bold", fontSize: "12px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #334155", paddingTop: "14px" }}>
              <button onClick={handleAbortDelete} style={{ backgroundColor: "#334155", color: "#f87171", border: "1px solid #ef4444", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                ABORT
              </button>
              <button onClick={handleCancelDeleteStock} style={{ backgroundColor: "#475569", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                CANCEL
              </button>

              {deleteAnswers.q1 === "Y" && deleteAnswers.q2 === "N" && deleteAnswers.q3 === "Y" && deleteAnswers.dateInput === todayFormattedDate && (
                <button onClick={handleOkDeleteStock} style={{ backgroundColor: theme.accentRed, color: "#ffffff", border: "none", padding: "8px 24px", borderRadius: "6px", fontWeight: "900", cursor: "pointer" }}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. UPDATE MODAL */}
      {updateQueue.length > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `2px solid ${theme.accentCyan}`, borderRadius: "12px", padding: "24px", width: "480px", color: "#f8fafc", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#94a3b8" }}>
                UPDATING ITEM {currentUpdateIndex + 1} OF {updateQueue.length}
              </span>
              <span style={{ fontSize: "11px", backgroundColor: "#1e293b", padding: "3px 8px", borderRadius: "4px", border: `1px solid ${theme.accentCyan}`, color: theme.accentCyan, fontWeight: "900" }}>
                DATABASE SYNC
              </span>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <h1 style={{ color: theme.accentCyan, fontSize: "28px", fontWeight: "900", margin: "0 0 6px 0", letterSpacing: "1px" }}>
                {updateQueue[currentUpdateIndex]}
              </h1>
              <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>Verify updates before syncing changes to Firebase.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", marginBottom: "24px" }}>
              {[
                { key: "q1", text: "A. Are you sure you want to update this stock?" },
                { key: "q2", text: "B. Do you update this stock without any purpose?" },
                { key: "q3", text: "C. Do you update this stock without any research?" }
              ].map(({ key, text }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "8px 12px", borderRadius: "6px" }}>
                  <span>{text}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["Y", "N"].map((opt) => (
                      <button key={opt} onClick={() => setUpdateAnswers({ ...updateAnswers, [key]: opt })} style={{ width: "32px", height: "28px", fontWeight: "bold", borderRadius: "4px", border: "none", cursor: "pointer", backgroundColor: updateAnswers[key] === opt ? theme.accentCyan : "#334155", color: updateAnswers[key] === opt ? "#000" : "#fff" }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #334155", paddingTop: "14px" }}>
              <button onClick={handleAbortUpdate} style={{ backgroundColor: "#334155", color: "#f87171", border: "1px solid #ef4444", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                ABORT
              </button>
              <button onClick={handleCancelUpdateStock} style={{ backgroundColor: "#475569", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                CANCEL
              </button>

              {updateAnswers.q1 === "Y" && updateAnswers.q2 === "N" && updateAnswers.q3 === "N" && (
                <button onClick={handleOkUpdateStock} style={{ backgroundColor: theme.accentCyan, color: "#000000", border: "none", padding: "8px 24px", borderRadius: "6px", fontWeight: "900", cursor: "pointer" }}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TICKER MODAL */}
      {tickerModal.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `3px solid ${theme.accentCyan}`, borderRadius: "12px", padding: "24px", width: "400px", maxWidth: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.7)", textAlign: "center" }}>
            <h3 style={{ color: theme.accentCyan, fontSize: "18px", fontWeight: "900", marginBottom: "16px", textTransform: "uppercase" }}>TICKER CONFIGURATION</h3>
            <p style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "bold", marginBottom: "20px" }}>Select ticker mode for <span style={{ color: theme.accentAmber }}>{tickerModal.stockName}</span></p>

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={() => {
                  handleFieldChange(tickerModal.stockName, "TICKER", tickerModal.defaultTicker);
                  setTickerModal({ isOpen: false, stockName: "", text: "", defaultTicker: "", isManualMode: false });
                }}
                style={{ backgroundColor: "#334155", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "900", cursor: "pointer" }}
              >
                USE DEFAULT
              </button>
              <button
                onClick={() => setTickerModal((prev) => ({ ...prev, isManualMode: true }))}
                style={{ backgroundColor: theme.accentAmber, color: "#000000", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "900", cursor: "pointer" }}
              >
                MANUAL
              </button>
            </div>

            {tickerModal.isManualMode && (
              <div style={{ marginTop: "16px", borderTop: "1px solid #334155", paddingTop: "16px" }}>
                <input
                  type="text"
                  value={tickerModal.text}
                  onChange={(e) => setTickerModal((prev) => ({ ...prev, text: e.target.value.toUpperCase() }))}
                  placeholder="Enter manual YF ticker..."
                  style={{ width: "100%", padding: "10px", backgroundColor: "#1e293b", color: theme.accentAmber, fontWeight: "900", borderRadius: "6px", border: "1px solid #334155", textAlign: "center", fontSize: "14px", boxSizing: "border-box", outline: "none", marginBottom: "16px" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                   <button onClick={() => setTickerModal({ isOpen: false, stockName: "", text: "", defaultTicker: "", isManualMode: false })} style={{ backgroundColor: "#334155", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>CANCEL</button>
                   <button onClick={() => {
                      handleFieldChange(tickerModal.stockName, "TICKER", tickerModal.text);
                      setTickerModal({ isOpen: false, stockName: "", text: "", defaultTicker: "", isManualMode: false });
                   }} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>SAVE TICKER</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODIFY TOGGLE CONFIRM */}
      {showModifyConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `3px solid ${theme.accentAmber}`, borderRadius: "12px", padding: "30px", width: "420px", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.7)" }}>
            <h3 style={{ color: theme.accentAmber, fontSize: "20px", fontWeight: "900", marginBottom: "16px", textTransform: "uppercase" }}>MODIFY SECURITY MODE</h3>
            <p style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "bold", marginBottom: "24px" }}>Do you want to unlock column data for manual modification?</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
              <button onClick={() => { setIsModify(true); setShowModifyConfirm(false); }} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "900", fontSize: "14px", cursor: "pointer", textTransform: "uppercase" }}>YES</button>
              <button onClick={() => { setIsModify(false); setShowModifyConfirm(false); }} style={{ backgroundColor: theme.accentRed, color: "#ffffff", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "900", fontSize: "14px", cursor: "pointer", textTransform: "uppercase" }}>NO</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTEPAD MODAL */}
      {notepadModal.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `3px solid ${theme.accentCyan}`, borderRadius: "12px", padding: "24px", width: "600px", maxWidth: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.7)" }}>
            <h3 style={{ color: theme.accentCyan, fontSize: "18px", fontWeight: "900", marginBottom: "8px", textTransform: "uppercase" }}>NOTEPAD: REMARK FOR {notepadModal.stockName}</h3>
            <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px", fontWeight: "bold" }}>Enter detailed evaluation notes. Maximum 1000 words allowed.</p>
            
            <textarea
              rows="10"
              value={notepadModal.text}
              onChange={(e) => {
                const val = e.target.value;
                const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
                if (wordCount <= 1000) {
                  setNotepadModal({ ...notepadModal, text: val, error: "" });
                } else {
                  setNotepadModal({ ...notepadModal, error: "ERROR: Word limit exceeded! Maximum allowed is 1000 words." });
                }
              }}
              placeholder="Type detailed review here..."
              style={{ width: "100%", backgroundColor: "#1e293b", border: "2px solid #334155", borderRadius: "6px", color: "#ffffff", padding: "12px", fontSize: "14px", fontWeight: "bold", boxSizing: "border-box", outline: "none" }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "12px", fontWeight: "bold" }}>
              <span style={{ color: notepadModal.text.trim().split(/\s+/).filter(Boolean).length >= 1000 ? theme.accentRed : "#94a3b8" }}>
                {notepadModal.text.trim().split(/\s+/).filter(Boolean).length} / 1000 words
              </span>
              {notepadModal.error && <span style={{ color: theme.accentRed }}>{notepadModal.error}</span>}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setNotepadModal({ isOpen: false, stockName: "", text: "", error: "" })} style={{ backgroundColor: "#334155", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "900", cursor: "pointer", textTransform: "uppercase" }}>CANCEL</button>
              <button onClick={handleSaveNotepad} style={{ backgroundColor: theme.accentAmber, color: "#000000", border: "none", padding: "8px 20px", borderRadius: "6px", fontWeight: "900", cursor: "pointer", textTransform: "uppercase" }}>SAVE REMARK</button>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL */}
      {showHelpModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `3px solid ${theme.accentAmber}`, borderRadius: "12px", padding: "30px", width: "600px", maxWidth: "100%", color: "#f8fafc", boxShadow: "0 10px 40px rgba(0,0,0,0.7)" }}>
            <h3 style={{ color: theme.accentAmber, fontSize: "20px", fontWeight: "900", marginBottom: "16px", textTransform: "uppercase" }}>HELP & COLUMN FILL UP GUIDE</h3>
            <div style={{ fontSize: "13px", fontWeight: "bold", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              <p>🔹 <b>GROUP:</b> Manual portfolio grouping. Default is <b>GROUP-0</b>.</p>
              <p>🔹 <b>REVIEW:</b> Manual star rating from <b>NR to 5 STAR</b>.</p>
              <p>🔹 <b>DURATION:</b> Manual time horizon selection.</p>
              <p>🔹 <b>REMARK:</b> Detailed notes (up to 1000 words max).</p>
              <p>🔹 <b>DATE:</b> Read-only; auto-records update date in DD-MM-YYYY format.</p>
              <p>🔹 <b>TICKER:</b> Yahoo Finance tracking ticker (e.g. MAHABANK.NS).</p>
              <hr style={{ borderColor: "#334155", margin: "10px 0" }} />
              <p style={{ color: theme.accentCyan }}>🟢 Screener metrics and extra financial parameters are kept in real-time sync with Firebase.</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <button onClick={() => setShowHelpModal(false)} style={{ backgroundColor: theme.accentAmber, color: "#000000", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "900", cursor: "pointer", textTransform: "uppercase" }}>GOT IT</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}