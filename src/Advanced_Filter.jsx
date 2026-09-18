import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ref, get, set } from "firebase/database";
import { database } from "./firebase";

// ============================================================================
// 1. GLOBAL CONFIGURATION & THEME SETTINGS
// ============================================================================
export const APP_CONFIG = {
  theme: {
    deepMaroon: "#58111A",        // Column Header Background & Header Accents
    headerTextColor: "#ffffff",    // Column Header Text Color
    rowYellow: "#fef9c3",          // Even rows (Pale Yellow)
    rowSky: "#e0f2fe",             // Odd rows (Light Sky)
    rowSelectedBg: "#fef08a",      // Selected row background highlight
    fontColor: "#000000",          // Table text color
    fontWeight: "700",             // Table font weight
    accentCyan: "#06b6d4",         // Primary buttons, active borders, counters
    accentMagenta: "#ec4899",      // Secondary action buttons & badges
    accentAmber: "#f59e0b",        // FILTER2 / List panel toggles & warnings
    accentGreen: "#10b981",        // Copy / Apply action buttons
    accentRed: "#ef4444",          // Reset button & alerts
    tableOuterBorder: "2px solid #1e3a8a", 
    tableCellBorder: "1px solid #1e3a8a",  
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  defaultColumns: [
    "Name", "CODE", "PCCAP", "mcap", "cmp", "PE", "3PE", "PB", "3PB", "PS", "F-score", "OPM", 
    "OCF%", "FCF%", "advdp", "DY", "G-score", "YSG", "YPG", "T-score", "RSI",
    "Dlutn", "BVgr", "FII", "DFII", "DII", "DDII", "PRH", "DPRH", "sector", "industry"
  ]
};

const sanitizeKey = (key) =>
  String(key || "").trim().replace(/[.#$\[\]\/]/g, "").toUpperCase();

const isRightAlignedCol = (colKey) => {
  const lower = colKey.toLowerCase();
  if (lower === "sector" || lower === "industry" || lower === "name" || lower === "nse" || lower === "code") return false;
  return true;
};

// ============================================================================
// 1.5. ISOLATED LONG-TEXT CELL
// ============================================================================
function LongTextCell({ displayVal, rightAligned, theme }) {
  const [tooltipPos, setTooltipPos] = useState(null);

  const handleShowTooltip = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const maxLeft = window.innerWidth - 240;
    const left = Math.min(rect.left, Math.max(10, maxLeft));
    setTooltipPos({ top: rect.bottom + 4, left: left });
  };

  const handleHideTooltip = () => setTooltipPos(null);

  return (
    <td style={{ padding: "6px 14px", border: theme.tableCellBorder, textAlign: rightAligned ? "right" : "left", whiteSpace: "nowrap", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", color: theme.fontColor, fontWeight: theme.fontWeight }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: rightAligned ? "flex-end" : "space-between", gap: "6px" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{displayVal}</span>
        {displayVal !== "-" && (
          <button type="button" onMouseDown={handleShowTooltip} onMouseUp={handleHideTooltip} onMouseLeave={handleHideTooltip} onTouchStart={handleShowTooltip} onTouchEnd={handleHideTooltip} title="Hold to view full text" style={{ background: "#334155", color: "#ffffff", border: "none", padding: "2px 5px", borderRadius: "3px", fontSize: "10px", cursor: "pointer", flexShrink: 0 }}>👁</button>
        )}
      </div>
      {tooltipPos && (
        <div style={{ position: "fixed", top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px`, backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #38bdf8", padding: "4px 8px", borderRadius: "4px", zIndex: 99999, fontSize: "12px", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          {displayVal}
        </div>
      )}
    </td>
  );
}

// ============================================================================
// 1.6. MEMOIZED ROW COMPONENT
// ============================================================================
const areRowsEqual = (prevProps, nextProps) => {
  return (
    prevProps.row.CODE === nextProps.row.CODE &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.index === nextProps.index &&
    prevProps.selectedColumns === nextProps.selectedColumns
  );
};

const MemoizedTableRow = React.memo(({ row, index, isSelected, selectedColumns, theme, toggleRowSelection }) => {
  const isEven = index % 2 === 0;
  const rowBg = isSelected ? theme.rowSelectedBg : isEven ? theme.rowYellow : theme.rowSky;
  const primaryKey = row.CODE || sanitizeKey(row.Name);

  return (
    <tr style={{ backgroundColor: rowBg }}>
      {/* Checkbox Cell */}
      <td style={{ padding: "6px 10px", border: theme.tableCellBorder, textAlign: "center", backgroundColor: rowBg, position: "sticky", left: 0, zIndex: 10 }}>
        <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(primaryKey)} style={{ cursor: "pointer" }} />
      </td>

      {/* Name Cell */}
      <td style={{ padding: "6px 14px", border: theme.tableCellBorder, textAlign: "left", whiteSpace: "nowrap", backgroundColor: rowBg, position: "sticky", left: "40px", zIndex: 10, fontWeight: "bold" }}>
        {row.Name}
      </td>

      {/* Other Columns */}
      {selectedColumns.filter((c) => c !== "Name").map((colKey) => {
        const val = row[colKey];
        const rightAligned = isRightAlignedCol(colKey);
        let displayVal = val !== undefined && val !== null ? val : "-";

        if (typeof displayVal === "number") {
          if (colKey.toLowerCase() === "mcap" || colKey.toLowerCase() === "cmp") {
            displayVal = displayVal.toLocaleString("en-IN", { maximumFractionDigits: 2 });
          } else {
            displayVal = Number(displayVal.toFixed(2));
          }
        }

        if (typeof displayVal === "string" && displayVal.length > 20) {
          return <LongTextCell key={colKey} displayVal={displayVal} rightAligned={rightAligned} theme={theme} />;
        }

        return (
          <td key={colKey} style={{ padding: "6px 14px", border: theme.tableCellBorder, textAlign: rightAligned ? "right" : "left", whiteSpace: "nowrap", color: theme.fontColor, fontWeight: theme.fontWeight }}>
            {displayVal}
          </td>
        );
      })}
    </tr>
  );
}, areRowsEqual);

// ============================================================================
// 2. MAIN ADVANCED FILTER COMPONENT
// ============================================================================
export default function AdvancedFilter() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableColumnsMeta, setAvailableColumnsMeta] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState(APP_CONFIG.defaultColumns);

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [columnListDraft, setColumnListDraft] = useState([]);
  const dragItemIndex = useRef(null);

  const [viewMode, setViewMode] = useState("all");
  const [selectedRows, setSelectedRows] = useState(new Set()); // Set of CODEs
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [manualQuery, setManualQuery] = useState("");
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [selectedManualCode, setSelectedManualCode] = useState("");
  const [manualAddedCodes, setManualAddedCodes] = useState([]);

  // Cloud State for Filter 1 and Filter 2 (Stores Arrays of CODEs)
  const [filter1List, setFilter1List] = useState([]);
  const [isFilter2PanelOpen, setIsFilter2PanelOpen] = useState(false);
  const [filter2List, setFilter2List] = useState([]);
  const [filter2Selected, setFilter2Selected] = useState(new Set());

  // VIRTUAL SCROLL STATE
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef(null);

  const theme = APP_CONFIG.theme;

  // 1. FETCH SCREENER & FILTER LISTS DIRECTLY FROM FIREBASE
  const fetchCloudData = useCallback(async () => {
    try {
      const screenerSnap = await get(ref(database, "SCREENER"));
      let cleanRecords = [];
      if (screenerSnap.exists()) {
        const val = screenerSnap.val();
        const records = Array.isArray(val) ? val : Object.values(val);
        cleanRecords = records.filter(Boolean).map(item => {
          const code = sanitizeKey(item.CODE || item.NSE || item.BSE || item.Name);
          return {
            ...item,
            CODE: code
          };
        });
        setData(cleanRecords);

        if (cleanRecords.length > 0) {
          const allKeys = Object.keys(cleanRecords[0]);
          setAvailableColumnsMeta(allKeys);
        }
      }

      // Fetch /filters/filter1 (Normalized to CODEs)
      const f1Snap = await get(ref(database, "filters/filter1"));
      if (f1Snap.exists()) {
        const f1Val = f1Snap.val();
        const arr = Array.isArray(f1Val) ? f1Val : Object.values(f1Val);
        setFilter1List(arr.map(sanitizeKey).filter(Boolean));
      } else {
        setFilter1List([]);
      }

      // Fetch /filters/filter2 (Normalized to CODEs)
      const f2Snap = await get(ref(database, "filters/filter2"));
      if (f2Snap.exists()) {
        const f2Val = f2Snap.val();
        const f2Arr = Array.isArray(f2Val) ? f2Val : Object.values(f2Val);
        setFilter2List(f2Arr.map(sanitizeKey).filter(Boolean));
      } else {
        setFilter2List([]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Firebase fetch failed in AdvancedFilter:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudData();
  }, [fetchCloudData]);

  // Lookup map indexed by CODE
  const codeToStockMap = useMemo(() => {
    const map = {};
    data.forEach(r => {
      if (r.CODE) map[r.CODE] = r;
      if (r.Name) map[sanitizeKey(r.Name)] = r;
    });
    return map;
  }, [data]);

  // MANUAL INPUT HANDLERS
  const handleManualInputChange = (e) => {
    const val = e.target.value;
    setManualQuery(val);
    setSelectedManualCode("");
    if (val.trim().length >= 2) {
      const q = val.trim().toLowerCase();
      const matches = data.filter((r) => 
        (r.Name && r.Name.toLowerCase().includes(q)) ||
        (r.CODE && r.CODE.toLowerCase().includes(q))
      );
      setManualSuggestions(matches.slice(0, 10));
    } else {
      setManualSuggestions([]);
    }
  };

  const handleSelectManualStock = (stockObj) => {
    setSelectedManualCode(stockObj.CODE);
    setManualQuery(`${stockObj.Name} (${stockObj.CODE})`);
    setManualSuggestions([]);
  };

  const handleApplyManualStock = () => {
    let targetCode = selectedManualCode;
    if (!targetCode && manualQuery.trim()) {
      const q = manualQuery.trim().toLowerCase();
      const match = data.find((r) => 
        (r.CODE && r.CODE.toLowerCase() === q) || 
        (r.Name && r.Name.toLowerCase() === q)
      );
      if (match) targetCode = match.CODE;
    }

    if (!targetCode) return alert("Please select a valid stock from suggestions!");

    if (!manualAddedCodes.includes(targetCode)) {
      setManualAddedCodes((prev) => [...prev, targetCode]);
    }
    setManualQuery("");
    setSelectedManualCode("");
    setManualSuggestions([]);
    setViewMode("manual");
  };

  // COLUMN CONFIGURATION MODAL HANDLERS
  const handleOpenColumnModal = () => {
    const activeCols = selectedColumns.filter((c) => c !== "Name");
    const activeSet = new Set(activeCols);
    const otherCols = availableColumnsMeta.filter((col) => col !== "Name" && !activeSet.has(col));

    const orderedDraft = [
      ...activeCols.map((c) => ({ field: c, selected: true })),
      ...otherCols.map((c) => ({ field: c, selected: false }))
    ];

    setColumnListDraft(orderedDraft);
    setIsColumnModalOpen(true);
  };

  const handleDraftToggleSelect = (field) => setColumnListDraft((prev) => prev.map((item) => (item.field === field ? { ...item, selected: !item.selected } : item)));
  const handleDraftSelectAll = () => setColumnListDraft((prev) => prev.map((item) => ({ ...item, selected: true })));
  const handleDraftDeselectAll = () => setColumnListDraft((prev) => prev.map((item) => ({ ...item, selected: false })));
  const handleDraftDefault = () => {
    const defaultSet = new Set(APP_CONFIG.defaultColumns.filter((c) => c !== "Name"));
    setColumnListDraft((prev) => prev.map((item) => ({ ...item, selected: defaultSet.has(item.field) })));
  };

  const handleDragStart = (e, index) => {
    dragItemIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = dragItemIndex.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setColumnListDraft((prev) => {
      const copy = [...prev];
      const [movedItem] = copy.splice(sourceIndex, 1);
      copy.splice(targetIndex, 0, movedItem);
      return copy;
    });
    dragItemIndex.current = null;
  };

  const handleApplyColumns = () => {
    const newlySelected = columnListDraft.filter((item) => item.selected).map((item) => item.field);
    const finalColumns = ["Name", ...newlySelected.filter((c) => c !== "Name")];
    setSelectedColumns(finalColumns);
    setIsColumnModalOpen(false);
  };

  // CLOUD FILTER 2 MUTATIONS (Direct Firebase Read/Write using CODE)
  const handleAddToFilter2 = async () => {
    const selectedCodes = Array.from(selectedRows);
    if (selectedCodes.length === 0) return alert("No stocks selected in the table to add!");

    try {
      const f2Ref = ref(database, "filters/filter2");
      const combined = Array.from(new Set([...filter2List, ...selectedCodes]));
      await set(f2Ref, combined);

      setFilter2List(combined);
      setSelectedRows(new Set());
      alert(`Added ${selectedCodes.length} stock CODE(s) to Firebase Filter2!`);
    } catch (e) {
      console.error("Firebase Filter2 save error:", e);
      alert("Failed to add to Firebase Filter2.");
    }
  };

  const handleDeleteFromFilter2 = async () => {
    const selectedCodes = Array.from(filter2Selected);
    if (selectedCodes.length === 0) return alert("No stocks selected in the FILTER2 panel to delete!");

    try {
      const f2Ref = ref(database, "filters/filter2");
      const remaining = filter2List.filter((code) => !selectedCodes.includes(code));

      if (remaining.length === 0) {
        await set(f2Ref, null);
      } else {
        await set(f2Ref, remaining);
      }

      setFilter2List(remaining);
      setFilter2Selected(new Set());
      alert("Deleted stocks from Firebase Filter2!");
    } catch (e) {
      console.error("Firebase Filter2 delete error:", e);
      alert("Failed to delete from Firebase Filter2.");
    }
  };

  const handleToggleFilter2Panel = async () => {
    if (!isFilter2PanelOpen) {
      try {
        const f2Snap = await get(ref(database, "filters/filter2"));
        if (f2Snap.exists()) {
          const val = f2Snap.val();
          const arr = Array.isArray(val) ? val : Object.values(val);
          setFilter2List(arr.map(sanitizeKey).filter(Boolean));
        } else {
          setFilter2List([]);
        }
      } catch (e) {}
      setFilter2Selected(new Set());
    }
    setIsFilter2PanelOpen((prev) => !prev);
  };

  const handleFilter2Apply = () => {
    setViewMode("filter2");
    setIsFilter2PanelOpen(false);
  };

  // DATA FILTERING & SORTING BY PRIMARY KEY CODE
  const displayedData = useMemo(() => {
    if (viewMode === "filter1") {
      const f1Set = new Set(filter1List);
      return data.filter((row) => f1Set.has(row.CODE) || f1Set.has(sanitizeKey(row.Name)));
    } else if (viewMode === "filter2") {
      const f2Set = new Set(filter2List);
      return data.filter((row) => f2Set.has(row.CODE) || f2Set.has(sanitizeKey(row.Name)));
    } else if (viewMode === "manual") {
      const manualSet = new Set(manualAddedCodes);
      return data.filter((row) => manualSet.has(row.CODE));
    }
    return data;
  }, [data, viewMode, filter1List, filter2List, manualAddedCodes]);

  const sortedData = useMemo(() => {
    let result = [...displayedData];
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
    return result;
  }, [displayedData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setScrollTop(0);
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
  };

  const toggleRowSelection = useCallback((rowCode) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowCode)) next.delete(rowCode);
      else next.add(rowCode);
      return next;
    });
  }, []);

  const handleReset = () => {
    setViewMode("all");
    setSelectedRows(new Set());
    setSortConfig({ key: null, direction: "asc" });
    setManualAddedCodes([]);
    setManualQuery("");
    setSelectedManualCode("");
    setManualSuggestions([]);
    setSelectedColumns(APP_CONFIG.defaultColumns);
    setScrollTop(0);
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
  };

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  // VIRTUAL SCROLL CALCULATIONS
  const ROW_HEIGHT = 36;
  const VISIBLE_ROWS = 25;
  const OVERSCAN = 10;

  const totalRows = sortedData.length;
  let startIndex = Math.floor(scrollTop / ROW_HEIGHT);
  startIndex = Math.max(0, startIndex - OVERSCAN);

  let endIndex = startIndex + VISIBLE_ROWS + (OVERSCAN * 2);
  endIndex = Math.min(totalRows, endIndex);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);

  const visibleData = sortedData.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div style={{ color: theme.accentCyan, backgroundColor: "#0b132b", minHeight: "100vh", padding: "40px", textAlign: "center", fontFamily: theme.fontFamily }}>
        <h2>⏳ Loading Advanced Screener from Firebase...</h2>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: theme.fontFamily, backgroundColor: "#0b132b", minHeight: "100vh", padding: "16px", boxSizing: "border-box" }}>
      
      {/* HEADER CONTROL PANEL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0f172a", padding: "14px 20px", borderRadius: "8px", border: `2px solid ${theme.deepMaroon}`, marginBottom: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900", color: theme.accentCyan, textTransform: "uppercase" }}>
            ⚡ Advanced Screener
          </h2>
          <div style={{ backgroundColor: "rgba(6, 182, 212, 0.15)", color: theme.accentCyan, border: `1px solid ${theme.accentCyan}`, padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "bold" }}>
            Selected: {selectedRows.size} / Displayed: {sortedData.length}
          </div>
          <div style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: theme.accentAmber, border: `1px solid ${theme.accentAmber}`, padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "bold" }}>
            Mode: {viewMode.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleOpenColumnModal} style={{ backgroundColor: theme.accentCyan, color: "#000000", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>⚙️ Select Column</button>
          <button onClick={() => setViewMode("filter1")} style={{ backgroundColor: theme.accentMagenta, color: "#ffffff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>📌 FILTER1 ({filter1List.length})</button>
          <button onClick={handleToggleFilter2Panel} style={{ backgroundColor: theme.accentAmber, color: "#000000", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>📂 FILTER2 List {isFilter2PanelOpen ? "▲" : "▼"} ({filter2List.length})</button>
          <button onClick={() => setViewMode("manual")} style={{ backgroundColor: "#8b5cf6", color: "#ffffff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>🔍 Manual View ({manualAddedCodes.length})</button>
          <button onClick={handleReset} style={{ backgroundColor: theme.accentRed, color: "#ffffff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>↺ RESET</button>
        </div>
      </div>

      {/* MANUAL STOCK SEARCH */}
      <div style={{ backgroundColor: "#0f172a", border: `2px solid ${theme.accentCyan}`, padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", position: "relative", flexWrap: "wrap" }}>
        <span style={{ color: theme.accentCyan, fontWeight: "bold", fontSize: "13px" }}>➕ Manual Stock Entry:</span>
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <input type="text" value={manualQuery} onChange={handleManualInputChange} placeholder="Search by Stock Name or Primary Key CODE..." style={{ width: "100%", padding: "8px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#ffffff", fontSize: "13px", boxSizing: "border-box" }} autoComplete="off" />
          {manualSuggestions.length > 0 && (
            <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0 0 6px 6px", listStyle: "none", margin: 0, padding: 0, zIndex: 100, maxHeight: "150px", overflowY: "auto" }}>
              {manualSuggestions.map((s) => (
                <li key={s.CODE} onClick={() => handleSelectManualStock(s)} style={{ padding: "8px 12px", cursor: "pointer", color: "#f8fafc", fontSize: "13px", borderBottom: "1px solid #334155" }} onMouseEnter={(e) => (e.target.style.backgroundColor = "#334155")} onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}>
                  <b>{s.Name}</b> <span style={{ color: theme.accentCyan, marginLeft: "8px" }}>({s.CODE})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={handleApplyManualStock} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>Apply Stock</button>
      </div>

      {/* FILTER2 PANEL */}
      {isFilter2PanelOpen && (
        <div style={{ backgroundColor: "#0f172a", border: `2px solid ${theme.accentAmber}`, padding: "16px", borderRadius: "8px", color: "#f8fafc", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #1e293b", paddingBottom: "8px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", color: theme.accentAmber, textTransform: "uppercase" }}>📂 FILTER2 Cloud Storage — {filter2List.length} Items (Keyed by CODE)</h3>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={handleAddToFilter2} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>➕ Add</button>
              <button type="button" onClick={handleDeleteFromFilter2} style={{ backgroundColor: theme.accentRed, color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>🗑️ Delete</button>
              <span style={{ color: "#334155" }}>|</span>
              <button type="button" onClick={() => setFilter2Selected(new Set(filter2List))} style={{ background: "none", border: "none", color: theme.accentGreen, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>All Select</button>
              <button type="button" onClick={() => setFilter2Selected(new Set())} style={{ background: "none", border: "none", color: theme.accentRed, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>All Deselect</button>
              <button type="button" onClick={handleFilter2Apply} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>✔ Apply</button>
            </div>
          </div>
          {filter2List.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "13px", padding: "10px 0" }}>No stocks in Firebase FILTER2. Select rows below and click <b>➕ Add</b>.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", maxHeight: "180px", overflowY: "auto", paddingRight: "4px" }}>
              {filter2List.map((code) => {
                const isChecked = filter2Selected.has(code);
                const displayName = codeToStockMap[code]?.Name || code;
                return (
                  <div key={code} onClick={() => {
                    const next = new Set(filter2Selected);
                    if (next.has(code)) next.delete(code); else next.add(code);
                    setFilter2Selected(next);
                  }} style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#1e293b", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", border: "1px solid #334155" }}>
                    <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ cursor: "pointer", accentColor: theme.accentAmber }} />
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${displayName} (${code})`}>
                      {displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* COLUMN SELECTION MODAL */}
      {isColumnModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ backgroundColor: "#0f172a", border: `2px solid ${theme.accentCyan}`, borderRadius: "10px", width: "500px", maxWidth: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", backgroundColor: theme.deepMaroon, borderBottom: `2px solid ${theme.accentCyan}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: "#ffffff", fontSize: "16px", fontWeight: "bold" }}>⚙️ Configure Columns & Drag to Reorder</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={handleDraftDefault} style={{ background: "none", border: "none", color: theme.accentCyan, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>Default</button>
                <button type="button" onClick={handleDraftSelectAll} style={{ background: "none", border: "none", color: theme.accentGreen, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>All Select</button>
                <button type="button" onClick={handleDraftDeselectAll} style={{ background: "none", border: "none", color: theme.accentRed, fontSize: "12px", fontWeight: "bold", cursor: "pointer", textDecoration: "underline" }}>Deselect All</button>
              </div>
            </div>
            <div style={{ padding: "10px 20px", backgroundColor: "#1e293b", fontSize: "12px", color: theme.accentCyan, borderBottom: "1px solid #334155" }}>🔒 Note: <b>"Name"</b> is permanently locked as the 1st column.</div>
            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
              {columnListDraft.map((item, idx) => (
                <div key={item.field} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", padding: "10px 14px", borderRadius: "6px", border: "1px solid #334155", cursor: "grab" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "#64748b", fontSize: "14px" }}>☰</span>
                    <input type="checkbox" checked={item.selected} onChange={() => handleDraftToggleSelect(item.field)} style={{ cursor: "pointer", accentColor: theme.accentCyan, width: "16px", height: "16px" }} />
                    <span style={{ color: "#f8fafc", fontWeight: "bold", fontSize: "13px" }}>{item.field}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px", backgroundColor: "#0b132b", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setIsColumnModalOpen(false)} style={{ backgroundColor: "#334155", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={handleApplyColumns} style={{ backgroundColor: theme.accentGreen, color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>✔ Apply & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* VIRTUALLY SCROLLED SPREADSHEET */}
      <div 
        ref={tableContainerRef}
        onScroll={handleScroll}
        style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)", border: theme.tableOuterBorder, borderRadius: "6px", backgroundColor: "#ffffff", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", position: "relative" }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "14px", fontWeight: theme.fontWeight, color: theme.fontColor }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 30, backgroundColor: theme.deepMaroon, color: theme.headerTextColor }}>
              <th style={{ padding: "10px", border: theme.tableCellBorder, textAlign: "center", width: "40px", backgroundColor: theme.deepMaroon, position: "sticky", left: 0, zIndex: 40 }}>
                <input
                  type="checkbox"
                  checked={sortedData.length > 0 && selectedRows.size === sortedData.length}
                  onChange={() => {
                    if (selectedRows.size === sortedData.length) setSelectedRows(new Set());
                    else setSelectedRows(new Set(sortedData.map((r) => r.CODE)));
                  }}
                  style={{ cursor: "pointer" }}
                />
              </th>
              <th onClick={() => handleSort("Name")} style={{ padding: "10px 14px", border: theme.tableCellBorder, textAlign: "left", cursor: "pointer", whiteSpace: "nowrap", backgroundColor: theme.deepMaroon, color: theme.headerTextColor, position: "sticky", left: "40px", zIndex: 40, textTransform: "uppercase" }}>
                NAME <span style={{ marginLeft: "6px", fontSize: "11px", color: theme.accentCyan }}>{sortConfig.key === "Name" ? (sortConfig.direction === "asc" ? " ▲ (A-Z)" : " ▼ (Z-A)") : " ⇅"}</span>
              </th>
              {selectedColumns.filter((col) => col !== "Name").map((colKey) => {
                const rightAligned = isRightAlignedCol(colKey);
                return (
                  <th key={colKey} onClick={() => handleSort(colKey)} style={{ padding: "10px 14px", border: theme.tableCellBorder, textAlign: rightAligned ? "right" : "left", cursor: "pointer", whiteSpace: "nowrap", backgroundColor: theme.deepMaroon, color: theme.headerTextColor, textTransform: "uppercase", userSelect: "none" }}>
                    {colKey} <span style={{ marginLeft: "6px", fontSize: "11px", color: theme.accentCyan }}>{sortConfig.key === colKey ? (sortConfig.direction === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={selectedColumns.length + 1} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  No stock records available for display in the current mode.
                </td>
              </tr>
            ) : (
              <>
                {topSpacerHeight > 0 && (
                  <tr style={{ height: `${topSpacerHeight}px` }}>
                    <td colSpan={selectedColumns.length + 1} style={{ padding: 0, border: "none" }}></td>
                  </tr>
                )}

                {visibleData.map((row, index) => {
                  const actualIndex = startIndex + index;
                  const isSelected = selectedRows.has(row.CODE);
                  return (
                    <MemoizedTableRow
                      key={row.CODE || row.Name}
                      row={row}
                      index={actualIndex}
                      isSelected={isSelected}
                      selectedColumns={selectedColumns}
                      theme={theme}
                      toggleRowSelection={toggleRowSelection}
                    />
                  );
                })}

                {bottomSpacerHeight > 0 && (
                  <tr style={{ height: `${bottomSpacerHeight}px` }}>
                    <td colSpan={selectedColumns.length + 1} style={{ padding: 0, border: "none" }}></td>
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