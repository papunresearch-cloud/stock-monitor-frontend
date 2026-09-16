import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ref, get, set } from "firebase/database";
import { database } from "./firebase";

// ============================================================================
// 1. GLOBAL CONFIGURATION & THEME
// ============================================================================
export const APP_CONFIG = {
  theme: {
    ribbonBg: "#050b18",
    ribbonCardBg: "#0d182e",
    ribbonHeaderBg: "#132240",
    ribbonBorderColor: "#1e3a8a",
    ribbonTextColor: "#f8fafc",
    accentCyan: "#06b6d4",
    accentMagenta: "#ec4899",
    accentAmber: "#f59e0b",
    accentGreen: "#10b981",
    brownFont: "#8b4513",

    tableOuterBorder: "2px solid #0f172a",
    tableCellBorder: "1px solid #cbd5e1",
    rowEvenBg: "#f8fafc",
    rowOddBg: "#e0f2fe",
    rowSelectedBg: "#fef08a",
    fontColor: "#000000",
    fontWeight: "700",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

    sectorSeparator: "2px solid #b91c1c",
    industrySeparator: "2px solid #1d4ed8",
  },
  
  columns: [
    { key: "STOCK", label: "STOCK", type: "text", align: "left" },
    { key: "MCAP", label: "MCAP", type: "number", align: "right" },
    { key: "P-MCAP", label: "P-MCAP", type: "number", align: "right" },
    { key: "rsi", label: "RSI", type: "number", align: "right" },
    { key: "TSCORE", label: "TSCORE", type: "number", align: "right" },
    { key: "GSCORE", label: "GSCORE", type: "number", align: "right" },
    { key: "FSCORE", label: "FSCORE", type: "number", align: "right" },
    { key: "DPO%", label: "DPO%", type: "number", align: "right" },
    { key: "DY%", label: "DY%", type: "number", align: "right" },
    { key: "PB", label: "PB", type: "number", align: "right" },
    { key: "3PB", label: "3PB", type: "number", align: "right" },
    { key: "DPB%", label: "DPB%", type: "number", align: "right" },
    { key: "PE", label: "PE", type: "number", align: "right" },
    { key: "3PE", label: "3PE", type: "number", align: "right" },
    { key: "DPE%", label: "DPE%", type: "number", align: "right" },
    { key: "SECTOR", label: "SECTOR", type: "text", align: "left" },
    { key: "INDUSTRY", label: "INDUSTRY", type: "text", align: "left" },
  ],

  numericFilters: [
    { key: "P-MCAP", label: "P-MCAP", color: "#06b6d4" },
    { key: "TSCORE", label: "TSCORE", color: "#10b981" },
    { key: "FSCORE", label: "FSCORE", color: "#ec4899" },
    { key: "GSCORE", label: "GSCORE", color: "#f59e0b" },
    { key: "rsi", label: "RSI", color: "#3b82f6" },
    { key: "DY%", label: "DY%", color: "#8b5cf6" },
    { key: "PE", label: "PE", color: "#14b8a6" },
    { key: "PB", label: "PB", color: "#f43f5e" },
  ]
};

const sliderStyle = `
  .dual-range-thumb::-webkit-slider-thumb {
    pointer-events: auto !important;
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background-color: #ffffff !important;
    border: 2px solid #06b6d4 !important;
    cursor: pointer !important;
    box-shadow: 0 0 4px rgba(0,0,0,0.5) !important;
    -webkit-appearance: none !important;
  }
  .dual-range-thumb::-moz-range-thumb {
    pointer-events: auto !important;
    width: 16px !important;
    height: 16px !important;
    border-radius: 50% !important;
    background-color: #ffffff !important;
    border: 2px solid #06b6d4 !important;
    cursor: pointer !important;
    box-shadow: 0 0 4px rgba(0,0,0,0.5) !important;
  }
`;

const formatCell = (colKey, rawValue, theme) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { displayValue: "-", color: null };
  }

  if (typeof rawValue !== "number" || isNaN(rawValue)) {
    return { displayValue: String(rawValue), color: null };
  }

  const keyUpper = colKey.toUpperCase();
  const val = rawValue;
  const brown = theme.brownFont || "#8b4513";
  let displayValue = val.toFixed(2);
  let color = null;

  if (keyUpper === "MCAP") {
    if (val < -999) {
      displayValue = "-999";
      color = brown;
    } else if (val < 0) {
      displayValue = Math.round(val).toString();
      color = brown;
    } else {
      displayValue = Math.round(val).toString();
    }
  } else if (keyUpper === "P-MCAP" || keyUpper === "PCCAP" || keyUpper === "PMCAP") {
    if (val < -999) {
      displayValue = "-999.00";
      color = brown;
    } else if (val < 0) {
      displayValue = val.toFixed(2);
      color = brown;
    } else {
      displayValue = val.toFixed(2);
    }
  } else if (["RSI", "TSCORE", "FSCORE", "GSCORE", "DPO%"].includes(keyUpper)) {
    if (val < -999) {
      displayValue = "-999.00";
      color = brown;
    } else if (val > 999) {
      displayValue = "999.00";
      color = brown;
    } else if (val < 0 || val > 100) {
      displayValue = val.toFixed(2);
      color = brown;
    } else {
      displayValue = val.toFixed(2);
    }
  } else if (["PB", "3PB", "PE", "3PE"].includes(keyUpper)) {
    if (val < -999) {
      displayValue = "-999.00";
      color = brown;
    } else if (val > 999) {
      displayValue = "999.00";
      color = brown;
    } else if (val < 0) {
      displayValue = val.toFixed(2);
      color = brown;
    } else {
      displayValue = val.toFixed(2);
    }
  } else if (["DPB%", "DPE%", "DPB", "DPE"].includes(keyUpper)) {
    if (val < -999) {
      displayValue = "-999.00";
      color = brown;
    } else if (val > 999) {
      displayValue = "999.00";
      color = brown;
    } else {
      displayValue = val.toFixed(2);
    }
  }

  return { displayValue, color };
};

const CellTooltip = ({ text, theme, alignRight = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef(null);

  const showTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(true);
  };

  const startHideTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 500);
  };

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      onMouseEnter={showTooltip}
      onMouseLeave={startHideTimer}
    >
      <button
        type="button"
        style={{
          marginLeft: "4px",
          backgroundColor: "#0d182e",
          color: theme.accentCyan,
          border: `1px solid ${theme.accentCyan}`,
          borderRadius: "3px",
          cursor: "pointer",
          fontSize: "9px",
          padding: "0",
          width: "14px",
          height: "14px",
          minWidth: "14px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
        }}
      >
        i
      </button>

      {isVisible && (
        <div
          style={{
            position: "absolute",
            bottom: "125%",
            ...(alignRight ? { right: "0px", left: "auto" } : { left: "50%", transform: "translateX(-50%)" }),
            backgroundColor: "#0f172a",
            color: "#ffffff",
            border: `1px solid ${theme.accentCyan}`,
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "bold",
            whiteSpace: "normal",
            wordBreak: "break-word",
            minWidth: "140px",
            maxWidth: "240px",
            zIndex: 9999,
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

const DualRangeSlider = ({ min = 0, max = 100, valueMin, valueMax, onChange, color }) => {
  const clampedMin = Math.max(min, Math.min(max, valueMin));
  const clampedMax = Math.max(min, Math.min(max, valueMax));

  const minPercent = ((clampedMin - min) / (max - min)) * 100;
  const maxPercent = ((clampedMax - min) / (max - min)) * 100;

  return (
    <div style={{ position: "relative", width: "100%", height: "20px", display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", width: "100%", height: "6px", backgroundColor: "#334155", borderRadius: "3px" }} />
      <div
        style={{
          position: "absolute",
          left: `${minPercent}%`,
          width: `${Math.max(0, maxPercent - minPercent)}%`,
          height: "6px",
          backgroundColor: color || "#06b6d4",
          borderRadius: "3px",
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={clampedMin}
        onChange={(e) => {
          const val = Math.min(Number(e.target.value), valueMax);
          onChange(val, valueMax);
        }}
        className="dual-range-thumb"
        style={{
          position: "absolute",
          width: "100%",
          height: "6px",
          WebkitAppearance: "none",
          background: "transparent",
          pointerEvents: "none",
          zIndex: clampedMin > 90 ? 5 : 3,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={clampedMax}
        onChange={(e) => {
          const val = Math.max(Number(e.target.value), valueMin);
          onChange(valueMin, val);
        }}
        className="dual-range-thumb"
        style={{
          position: "absolute",
          width: "100%",
          height: "6px",
          WebkitAppearance: "none",
          background: "transparent",
          pointerEvents: "none",
          zIndex: 4,
        }}
      />
    </div>
  );
};

// ============================================================================
// 2. MAIN FILTER COMPONENT
// ============================================================================
export default function StockDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isRibbonExpanded, setIsRibbonExpanded] = useState(true);

  const [selectedSectors, setSelectedSectors] = useState(new Set());
  const [selectedIndustries, setSelectedIndustries] = useState(new Set());
  const [expandedSectors, setExpandedSectors] = useState(new Set());

  const [ranges, setRanges] = useState({});
  const [defaultRanges, setDefaultRanges] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedRows, setSelectedRows] = useState(new Set());

  // FILTER LIST STATES
  const [filter0List, setFilter0List] = useState([]);
  const [isFilter0View, setIsFilter0View] = useState(false);

  const [isListPanelOpen, setIsListPanelOpen] = useState(false);
  const [copiedList, setCopiedList] = useState([]); 
  const [copiedListSelected, setCopiedListSelected] = useState(new Set());
  const [isFilter1View, setIsFilter1View] = useState(false);

  // VIRTUAL SCROLLING
  const TABLE_ROW_HEIGHT = 37;
  const [scrollStartIndex, setScrollStartIndex] = useState(0); 
  const tableContainerRef = useRef(null);
  const masterCheckboxRef = useRef(null);

  // FETCH MASTER SCREENER RECORDS
  useEffect(() => {
    const screenerRef = ref(database, 'SCREENER');
    get(screenerRef)
      .then((snapshot) => {
        if (!snapshot.exists()) throw new Error("No records found under /SCREENER.");
        const rawVal = snapshot.val();
        const records = Array.isArray(rawVal) ? rawVal : Object.values(rawVal);

        const mappedData = records.filter(Boolean).map((row) => ({
          ...row,
          STOCK: row.Name || row.STOCK || "",
          MCAP: row.mcap,
          SECTOR: row.sector,
          INDUSTRY: row.industry,
          "P-MCAP": row.PCCAP,
          TSCORE: row["T-score"],
          FSCORE: row["F-score"],
          GSCORE: row["G-score"],
          "DPO%": row.advdp,
          "DY%": row.DY,
          rsi: row.RSI,
        }));

        setData(mappedData);

        const sectors = new Set(mappedData.map((r) => r.SECTOR).filter(Boolean));
        const industries = new Set(mappedData.map((r) => r.INDUSTRY).filter(Boolean));

        setSelectedSectors(sectors);
        setSelectedIndustries(industries);
        setExpandedSectors(new Set());

        const computedRanges = {};
        APP_CONFIG.numericFilters.forEach((f) => {
          const values = mappedData
            .map((r) => r[f.key])
            .filter((v) => typeof v === "number" && !isNaN(v));

          const minVal = values.length > 0 ? Math.floor(Math.min(0, ...values)) : 0;
          const maxVal = values.length > 0 ? Math.ceil(Math.max(100, ...values)) : 100;

          computedRanges[f.key] = { min: minVal, max: maxVal };
        });

        setRanges(computedRanges);
        setDefaultRanges(computedRanges);
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setLoading(false);
      });
  }, []);

  // FETCH FILTER0 & FILTER1 FROM FIREBASE
  const fetchCloudFilters = useCallback(async () => {
    try {
      const f0Snap = await get(ref(database, 'filters/filter0'));
      if (f0Snap.exists()) {
        const val = f0Snap.val();
        setFilter0List(Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean));
      } else {
        setFilter0List([]);
      }

      const f1Snap = await get(ref(database, 'filters/filter1'));
      if (f1Snap.exists()) {
        const val = f1Snap.val();
        setCopiedList(Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean));
      } else {
        setCopiedList([]);
      }
    } catch (e) {
      console.error("Error reading filters from Firebase:", e);
    }
  }, []);

  useEffect(() => {
    fetchCloudFilters();
  }, [fetchCloudFilters]);

  const sectorHierarchy = useMemo(() => {
    const map = {};
    data.forEach((row) => {
      if (row.SECTOR) {
        if (!map[row.SECTOR]) map[row.SECTOR] = new Set();
        if (row.INDUSTRY) map[row.SECTOR].add(row.INDUSTRY);
      }
    });
    return Object.keys(map).map((sec) => ({
      sector: sec,
      industries: Array.from(map[sec]),
    }));
  }, [data]);

  const totalSectorsCount = sectorHierarchy.length;
  const totalIndustriesCount = useMemo(() => {
    return sectorHierarchy.reduce((acc, curr) => acc + curr.industries.length, 0);
  }, [sectorHierarchy]);

  const isAllSelected = selectedSectors.size === totalSectorsCount && selectedIndustries.size === totalIndustriesCount;
  const isSomeSelected = (selectedSectors.size > 0 || selectedIndustries.size > 0) && !isAllSelected;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const selectAllHierarchy = useCallback(() => {
    setSelectedSectors(new Set(sectorHierarchy.map((s) => s.sector)));
    setSelectedIndustries(new Set(data.map((item) => item.INDUSTRY).filter(Boolean)));
  }, [sectorHierarchy, data]);

  const deselectAllHierarchy = useCallback(() => {
    setSelectedSectors(new Set());
    setSelectedIndustries(new Set());
  }, []);

  const toggleSelectAllHierarchy = useCallback(() => {
    if (isAllSelected) deselectAllHierarchy();
    else selectAllHierarchy();
  }, [isAllSelected, deselectAllHierarchy, selectAllHierarchy]);

  const toggleSector = useCallback((sector) => {
    const item = sectorHierarchy.find((s) => s.sector === sector);
    if (!item) return;

    const selectedCount = item.industries.filter((ind) => selectedIndustries.has(ind)).length;
    const allSelected = item.industries.length > 0 && selectedCount === item.industries.length;

    setSelectedIndustries((prevInds) => {
      const nextInds = new Set(prevInds);
      if (allSelected) item.industries.forEach((ind) => nextInds.delete(ind));
      else item.industries.forEach((ind) => nextInds.add(ind));
      return nextInds;
    });

    setSelectedSectors((prevSecs) => {
      const nextSecs = new Set(prevSecs);
      if (allSelected) nextSecs.delete(sector);
      else nextSecs.add(sector);
      return nextSecs;
    });
  }, [sectorHierarchy, selectedIndustries]);

  const toggleIndustry = useCallback((sector, industry) => {
    setSelectedIndustries((prevInds) => {
      const nextInds = new Set(prevInds);
      if (nextInds.has(industry)) nextInds.delete(industry);
      else nextInds.add(industry);
      return nextInds;
    });

    setSelectedSectors((prevSecs) => {
      const nextSecs = new Set(prevSecs);
      const item = sectorHierarchy.find((s) => s.sector === sector);
      if (!item) return prevSecs;

      const isRemoving = selectedIndustries.has(industry);
      const keepsOtherIndustries = isRemoving
        ? item.industries.some((ind) => ind !== industry && selectedIndustries.has(ind))
        : true;

      if (keepsOtherIndustries) nextSecs.add(sector);
      else nextSecs.delete(sector);
      return nextSecs;
    });
  }, [sectorHierarchy, selectedIndustries]);

  const toggleExpandSector = useCallback((sector) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  const resetFilters = () => {
    selectAllHierarchy();
    setExpandedSectors(new Set());
    setRanges(defaultRanges);
    setSelectedRows(new Set());
    setSortConfig({ key: null, direction: "asc" });
    setIsFilter0View(false);
    setIsFilter1View(false);
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    setScrollStartIndex(0);
  };

  const filteredAndSortedData = useMemo(() => {
    const savedF0Set = isFilter0View ? new Set(filter0List) : null;
    const savedF1Set = isFilter1View ? new Set(copiedList) : null;

    let result = data.filter((row) => {
      if (isFilter0View && savedF0Set && !savedF0Set.has(row.STOCK)) return false;
      if (isFilter1View && savedF1Set && !savedF1Set.has(row.STOCK)) return false;

      if (row.INDUSTRY) {
        if (!selectedIndustries.has(row.INDUSTRY)) return false;
      } else if (row.SECTOR) {
        if (!selectedSectors.has(row.SECTOR)) return false;
      }

      for (const filter of APP_CONFIG.numericFilters) {
        const val = row[filter.key];
        const range = ranges[filter.key];
        if (val !== undefined && range && typeof val === "number") {
          if (val < range.min || val > range.max) return false;
        }
      }
      return true;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key] ?? "";
        let valB = b[sortConfig.key] ?? "";

        if (typeof valA === "number" && typeof valB === "number") {
          return sortConfig.direction === "asc" ? valA - valB : valB - valA;
        }
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    setTimeout(() => setScrollStartIndex(0), 0);

    return result;
  }, [data, selectedSectors, selectedIndustries, ranges, sortConfig, isFilter0View, filter0List, isFilter1View, copiedList]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleRowSelection = (idx) => {
    setSelectedRows((prev) => {
      const updated = new Set(prev);
      if (updated.has(idx)) updated.delete(idx);
      else updated.add(idx);
      return updated;
    });
  };

  const toggleSelectAllRows = () => {
    if (selectedRows.size === filteredAndSortedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAndSortedData.map((_, idx) => idx)));
    }
  };

  // VIRTUAL SCROLLING
  const startIndex = scrollStartIndex;
  const visibleItemCount = 35;
  const endIndex = Math.min(filteredAndSortedData.length, startIndex + visibleItemCount);
  const visibleRows = filteredAndSortedData.slice(startIndex, endIndex);

  const topSpacerHeight = startIndex * TABLE_ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (filteredAndSortedData.length - endIndex) * TABLE_ROW_HEIGHT);

  const handleOptimizedScroll = (e) => {
    const scrollTop = e.currentTarget.scrollTop;
    const newStartIndex = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - 10);
    if (newStartIndex !== scrollStartIndex) {
      setScrollStartIndex(newStartIndex);
    }
  };

  // FILTER1 CLOUD ACTIONS
  const handleAddSelectedToFilter1 = async () => {
    const selectedStockNames = Array.from(selectedRows)
      .map((idx) => filteredAndSortedData[idx]?.STOCK)
      .filter(Boolean);

    if (selectedStockNames.length === 0) {
      alert("No rows selected in the table to add!");
      return;
    }

    try {
      const f1Ref = ref(database, 'filters/filter1');
      const updatedList = Array.from(new Set([...copiedList, ...selectedStockNames]));
      await set(f1Ref, updatedList);

      setCopiedList(updatedList);
      setSelectedRows(new Set());
      alert(`Successfully added ${selectedStockNames.length} stock(s) to Firebase Filter1!`);
    } catch (err) {
      console.error(err);
      alert("Cloud Error: Could not save stocks to Filter1.");
    }
  };

  const handleDeleteFromFilter1 = async () => {
    if (copiedListSelected.size === 0) {
      alert("No stocks selected in the panel to delete!");
      return;
    }

    try {
      const updatedList = copiedList.filter((stock) => !copiedListSelected.has(stock));
      const f1Ref = ref(database, 'filters/filter1');

      if (updatedList.length === 0) {
        await set(f1Ref, null);
      } else {
        await set(f1Ref, updatedList);
      }

      setCopiedList(updatedList);
      setCopiedListSelected(new Set());
      alert(`Successfully deleted items from Firebase Filter1!`);
    } catch (err) {
      console.error(err);
      alert("Cloud Error: Could not delete stocks from Filter1.");
    }
  };

  const handleToggleListPanel = async () => {
    if (!isListPanelOpen) {
      await fetchCloudFilters();
      setCopiedListSelected(new Set()); 
    }
    setIsListPanelOpen((prev) => !prev);
  };

  const theme = APP_CONFIG.theme;

  if (loading) {
    return (
      <div style={{ color: "#06b6d4", backgroundColor: "#0b132b", minHeight: "100vh", padding: "40px", textAlign: "center", fontFamily: theme.fontFamily }}>
        <h2>⏳ Loading screener dataset from Firebase...</h2>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ color: "#ef4444", backgroundColor: "#0b132b", minHeight: "100vh", padding: "40px", textAlign: "center", fontFamily: theme.fontFamily }}>
        <h2>⚠️ Could not load data</h2>
        <p style={{ color: "#f8fafc" }}>{errorMsg}</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: theme.fontFamily, backgroundColor: "#0b132b", minHeight: "100vh", padding: "16px" }}>
      <style>{sliderStyle}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.ribbonHeaderBg, padding: "12px 20px", borderRadius: "8px 8px 0 0", borderBottom: `2px solid ${theme.ribbonBorderColor}`, color: theme.ribbonTextColor, flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: theme.accentCyan }}>⚡ EXOTIC STOCK FILTER</h2>
          <span style={{ backgroundColor: "rgba(6, 182, 212, 0.15)", color: theme.accentCyan, border: `1px solid ${theme.accentCyan}`, padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "bold" }}>
            Matches: {filteredAndSortedData.length} / {data.length} Stocks
          </span>
          <span style={{ backgroundColor: "rgba(236, 72, 153, 0.15)", color: theme.accentMagenta, border: `1px solid ${theme.accentMagenta}`, padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "bold" }}>
            Selected: {selectedRows.size}
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* FILTER0 TOGGLE BUTTON */}
          <button
            onClick={() => {
              setIsFilter0View(!isFilter0View);
              setIsFilter1View(false);
            }}
            style={{
              backgroundColor: isFilter0View ? theme.accentGreen : "#1e293b",
              color: isFilter0View ? "#000000" : theme.accentGreen,
              border: `2px solid ${theme.accentGreen}`,
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            📌 Filter0 ({filter0List.length}) {isFilter0View ? "(ACTIVE)" : ""}
          </button>

          {/* FILTER1 TOGGLE BUTTON */}
          <button
            onClick={handleToggleListPanel}
            style={{
              backgroundColor: theme.accentAmber,
              color: "#000000",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
            }}
          >
            📂 Filter1 {isListPanelOpen ? "▲" : "▼"} {isFilter1View ? "(ACTIVE)" : ""}
          </button>
          
          <button onClick={resetFilters} style={{ backgroundColor: "#ef4444", color: "#ffffff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
            ↺ Reset Filters
          </button>
          
          <button onClick={() => setIsRibbonExpanded(!isRibbonExpanded)} style={{ backgroundColor: theme.accentCyan, color: "#000000", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "800", fontSize: "13px", cursor: "pointer" }}>
            {isRibbonExpanded ? "▲ Minimize Ribbon" : "▼ Expand Ribbon"}
          </button>
        </div>
      </div>

      {/* FILTER1 EXPANDABLE PANEL */}
      {isListPanelOpen && (
        <div style={{ backgroundColor: theme.ribbonBg, border: `2px solid ${theme.accentAmber}`, borderTop: "none", padding: "16px", color: theme.ribbonTextColor, marginBottom: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #1e293b", paddingBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", color: theme.accentAmber, textTransform: "uppercase" }}>
              📂 Filter1 Items (Firebase Cloud) — {copiedList.length}
            </h3>
            
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button type="button" onClick={() => setCopiedListSelected(new Set(copiedList))} style={{ background: "none", border: "none", color: theme.accentGreen, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>
                All Select
              </button>
              <span style={{ color: "#475569" }}>|</span>
              <button type="button" onClick={() => setCopiedListSelected(new Set())} style={{ background: "none", border: "none", color: theme.accentMagenta, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>
                All Deselect
              </button>

              <button type="button" onClick={handleAddSelectedToFilter1} style={{ backgroundColor: theme.accentCyan, color: "#000000", border: "none", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer", marginLeft: "10px" }}>
                ➕ Add
              </button>
              <button type="button" onClick={handleDeleteFromFilter1} style={{ backgroundColor: "#ef4444", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>
                🗑 Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFilter1View(true);
                  setIsFilter0View(false);
                  setIsListPanelOpen(false);
                }}
                style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}
              >
                ✔ Apply
              </button>
            </div>
          </div>

          {copiedList.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "13px", padding: "10px 0" }}>
              No stocks found in Filter1 on Firebase. Select stocks in the main table and click <b>➕ Add</b>.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
              {copiedList.map((stockName) => {
                const isChecked = copiedListSelected.has(stockName);
                return (
                  <div
                    key={stockName}
                    onClick={() => {
                      const next = new Set(copiedListSelected);
                      if (next.has(stockName)) next.delete(stockName);
                      else next.add(stockName);
                      setCopiedListSelected(next);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#0d182e", padding: "6px 10px", borderRadius: "4px", border: "1px solid #1e293b", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: "pointer", accentColor: theme.accentAmber }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "#f8fafc" }}>{stockName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FILTER RIBBON */}
      <div style={{ backgroundColor: theme.ribbonBg, padding: isRibbonExpanded ? "16px" : "10px 20px", border: `2px solid ${theme.ribbonBorderColor}`, borderTop: "none", color: theme.ribbonTextColor, transition: "all 0.3s ease-in-out", marginBottom: "16px", borderRadius: "0 0 8px 8px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        {!isRibbonExpanded ? (
          <div style={{ fontSize: "13px", color: "#94a3b8", display: "flex", gap: "24px" }}>
            <span>Sectors Selected: <b>{selectedSectors.size}</b></span>
            <span>Industries Selected: <b>{selectedIndustries.size}</b></span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "18px", width: "100%", alignItems: "stretch" }}>
            <div style={{ width: "440px", minWidth: "360px", flexShrink: 0, backgroundColor: theme.ribbonCardBg, padding: "12px 16px", borderRadius: "8px", border: "1px solid #1e293b", maxHeight: "340px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: "14px", color: theme.accentCyan, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🌳 Hierarchy
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    ref={masterCheckboxRef}
                    checked={isAllSelected}
                    onChange={toggleSelectAllHierarchy}
                    title="Toggle All"
                    style={{ cursor: "pointer", accentColor: theme.accentCyan, width: "16px", height: "16px" }}
                  />
                  <button type="button" onClick={selectAllHierarchy} style={{ background: "none", border: "none", color: isAllSelected ? theme.accentGreen : theme.accentCyan, fontSize: "12px", fontWeight: "bold", cursor: "pointer", padding: "2px 4px", borderRadius: "4px", textDecoration: "underline" }}>
                    Select All
                  </button>
                  <span style={{ color: "#475569", fontSize: "12px" }}>|</span>
                  <button type="button" onClick={deselectAllHierarchy} style={{ background: "none", border: "none", color: (selectedSectors.size === 0 && selectedIndustries.size === 0) ? "#64748b" : theme.accentMagenta, fontSize: "12px", fontWeight: "bold", cursor: "pointer", padding: "2px 4px", borderRadius: "4px", textDecoration: "underline" }}>
                    Deselect All
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
                {sectorHierarchy.map(({ sector, industries }) => {
                  const selectedIndCount = industries.filter((ind) => selectedIndustries.has(ind)).length;
                  const isAllIndsSelected = industries.length > 0 && selectedIndCount === industries.length;
                  const isSomeIndsSelected = selectedIndCount > 0 && selectedIndCount < industries.length;
                  const isExpanded = expandedSectors.has(sector);

                  return (
                    <div key={sector} style={{ marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span onClick={() => toggleExpandSector(sector)} style={{ cursor: "pointer", width: "14px", fontSize: "12px", userSelect: "none", color: theme.accentAmber }}>
                          {isExpanded ? "▼" : "►"}
                        </span>
                        <input
                          type="checkbox"
                          ref={(el) => { if (el) el.indeterminate = isSomeIndsSelected; }}
                          checked={isAllIndsSelected}
                          onChange={() => toggleSector(sector)}
                          style={{ cursor: "pointer", accentColor: theme.accentCyan, width: "15px", height: "15px" }}
                        />
                        <span onClick={() => toggleExpandSector(sector)} style={{ cursor: "pointer", fontWeight: "bold", fontSize: "14px", color: "#f1f5f9" }}>
                          {sector}
                        </span>
                        {isSomeIndsSelected && (
                          <span style={{ fontSize: "11px", color: theme.accentAmber, fontWeight: "normal" }}>
                            ({selectedIndCount}/{industries.length})
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                        <div style={{ marginLeft: "24px", marginTop: "4px" }}>
                          {industries.map((ind) => (
                            <div key={ind} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 0" }}>
                              <input type="checkbox" checked={selectedIndustries.has(ind)} onChange={() => toggleIndustry(sector, ind)} style={{ cursor: "pointer", accentColor: theme.accentMagenta, width: "14px", height: "14px" }} />
                              <span style={{ fontSize: "13px", color: "#cbd5e1" }}>{ind}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SLIDERS GRID */}
            <div style={{ flex: 1, backgroundColor: theme.ribbonCardBg, padding: "14px", borderRadius: "8px", border: "1px solid #1e293b", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: "12px 14px", maxHeight: "340px", boxSizing: "border-box" }}>
              {APP_CONFIG.numericFilters.map((f) => {
                const currentRange = ranges[f.key] || { min: 0, max: 100 };

                return (
                  <div key={f.key} style={{ backgroundColor: "#081021", padding: "10px 12px", borderRadius: "6px", borderLeft: `4px solid ${f.color}`, display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontWeight: "bold", fontSize: "13px", color: f.color }}>{f.label}</span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>0 - 100 Scale</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <input
                        type="number"
                        value={currentRange.min}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                          setRanges({ ...ranges, [f.key]: { ...currentRange, min: val } });
                        }}
                        style={{ width: "100%", backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #334155", borderRadius: "4px", padding: "4px 6px", fontSize: "12px", fontWeight: "bold" }}
                      />
                      <span style={{ color: "#64748b", fontSize: "11px" }}>to</span>
                      <input
                        type="number"
                        value={currentRange.max}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 100 : Number(e.target.value);
                          setRanges({ ...ranges, [f.key]: { ...currentRange, max: val } });
                        }}
                        style={{ width: "100%", backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #334155", borderRadius: "4px", padding: "4px 6px", fontSize: "12px", fontWeight: "bold" }}
                      />
                    </div>

                    <DualRangeSlider
                      min={0}
                      max={100}
                      valueMin={currentRange.min}
                      valueMax={currentRange.max}
                      color={f.color}
                      onChange={(newMin, newMax) => {
                        setRanges({ ...ranges, [f.key]: { min: newMin, max: newMax } });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TABLE DATA */}
      <div 
        ref={tableContainerRef}
        onScroll={handleOptimizedScroll}
        style={{ overflowY: "auto", maxHeight: "calc(100vh - 380px)", border: theme.tableOuterBorder, borderRadius: "6px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", backgroundColor: "#ffffff", position: "relative" }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: theme.fontSize, fontWeight: theme.fontWeight, color: theme.fontColor }}>
          <thead>
            <tr style={{ backgroundColor: "#0f172a", color: "#ffffff", position: "sticky", top: 0, zIndex: 20 }}>
              <th style={{ padding: "8px", border: theme.tableCellBorder, textAlign: "center", width: "36px", backgroundColor: "#0f172a" }}>
                <input type="checkbox" checked={filteredAndSortedData.length > 0 && selectedRows.size === filteredAndSortedData.length} onChange={toggleSelectAllRows} style={{ cursor: "pointer" }} />
              </th>
              {APP_CONFIG.columns.map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)} style={{ padding: "8px 10px", border: theme.tableCellBorder, textAlign: col.align, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", backgroundColor: "#0f172a" }}>
                  {col.label}
                  <span style={{ marginLeft: "4px", fontSize: "10px", color: theme.accentCyan }}>
                    {sortConfig.key === col.key ? (sortConfig.direction === "asc" ? " ▲" : " ▼") : " ⇅"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={APP_CONFIG.columns.length + 1} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No stocks match the selected criteria or active filter list.
                </td>
              </tr>
            ) : (
              <>
                {topSpacerHeight > 0 && (
                  <tr style={{ height: `${topSpacerHeight}px` }}>
                    <td colSpan={APP_CONFIG.columns.length + 1} style={{ padding: 0, border: "none" }} />
                  </tr>
                )}

                {visibleRows.map((row, relativeIdx) => {
                  const idx = startIndex + relativeIdx;
                  const prevRow = idx > 0 ? filteredAndSortedData[idx - 1] : null;

                  const isDiffSector = prevRow && prevRow.SECTOR !== row.SECTOR;
                  const isDiffIndustry = prevRow && !isDiffSector && prevRow.INDUSTRY !== row.INDUSTRY;

                  let borderTopStyle = theme.tableCellBorder;
                  if (isDiffSector) borderTopStyle = theme.sectorSeparator;
                  else if (isDiffIndustry) borderTopStyle = theme.industrySeparator;

                  const isRowSelected = selectedRows.has(idx);
                  const rowBg = isRowSelected ? theme.rowSelectedBg : idx % 2 === 0 ? theme.rowEvenBg : theme.rowOddBg;

                  return (
                    <tr key={idx} style={{ backgroundColor: rowBg, height: `${TABLE_ROW_HEIGHT}px`, transition: "background-color 0.15s ease" }}>
                      <td style={{ padding: "6px", textAlign: "center", border: theme.tableCellBorder, borderTop: borderTopStyle }}>
                        <input type="checkbox" checked={isRowSelected} onChange={() => toggleRowSelection(idx)} style={{ cursor: "pointer" }} />
                      </td>

                      {APP_CONFIG.columns.map((col) => {
                        const rawValue = row[col.key];
                        const { displayValue, color: fontColor } = formatCell(col.key, rawValue, theme);
                        const strVal = String(displayValue);
                        const isLongString = strVal.length > 16;

                        return (
                          <td
                            key={col.key}
                            style={{
                              padding: "6px 10px",
                              border: theme.tableCellBorder,
                              borderTop: borderTopStyle,
                              textAlign: col.align,
                              position: "relative",
                              maxWidth: "160px",
                              overflow: "visible",
                              color: fontColor || theme.fontColor,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: col.align === "right" ? "flex-end" : "flex-start" }}>
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  display: "inline-block",
                                  maxWidth: isLongString ? "120px" : "100%",
                                }}
                              >
                                {displayValue}
                              </span>

                              {isLongString && (
                                <CellTooltip
                                  text={strVal}
                                  theme={theme}
                                  alignRight={col.key === "INDUSTRY" || col.align === "right"}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {bottomSpacerHeight > 0 && (
                  <tr style={{ height: `${bottomSpacerHeight}px` }}>
                    <td colSpan={APP_CONFIG.columns.length + 1} style={{ padding: 0, border: "none" }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}