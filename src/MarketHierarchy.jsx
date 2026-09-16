import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from './firebase';

// ============================================================================
// 1. CONFIGURATION & SETTINGS PARAMETERS
// ============================================================================

const METRIC_KEYS = [
  'mcap', 'PCCAP', 'RSI', 'T-score', 'G-score', 'F-score', 
  'PB', '3PB', 'DPB%', 'PE', '3PE', 'DPE%', 'DY', 'advdp', 'DE'
];

const COLUMNS = [
  { label: 'SEL', key: null, align: 'center' }, 
  { label: 'MARKET / SECTOR / INDUSTRY / STOCK', key: 'name', minWidth: '220px', align: 'left' },   
  { label: 'COUNT / CMP', key: 'count_cmp', minWidth: '140px', align: 'left' },                      
  { label: 'MCAP', key: 'mcap', align: 'right' },
  { label: 'P_MCAP', key: 'PCCAP', align: 'right' },
  { label: 'RSI', key: 'RSI', align: 'right' },
  { label: 'TSCORE', key: 'T-score', align: 'right' },
  { label: 'GSCORE', key: 'G-score', align: 'right' },
  { label: 'FSCORE', key: 'F-score', align: 'right' },
  { label: 'PB', key: 'PB', align: 'right' },
  { label: '3PB', key: '3PB', align: 'right' },
  { label: 'DPB%', key: 'DPB%', align: 'right' },
  { label: 'PE', key: 'PE', align: 'right' },
  { label: '3PE', key: '3PE', align: 'right' },
  { label: 'DPE%', key: 'DPE%', align: 'right' },
  { label: 'DY%', key: 'DY', align: 'right' },
  { label: 'DPO%', key: 'advdp', align: 'right' },
  { label: 'DE', key: 'DE', align: 'right' },
];

const THEME_CONFIG = {
  pageBgColor: '#000000',
  headerBgColor: '#111827',
  headerFontColor: '#E5E7EB',
  headerFontSize: '13px',
  marketBgColor: '#4A0810',
  marketFontColor: '#FFD1DC',
  sectorBgColor: '#063319',
  sectorFontColor: '#E6EE9C',
  industryBgColor: '#031833',
  industryFontColor: '#87CEEB',
  stockBgEven: '#D1D5DB',
  stockBgOdd: '#BFDBFE',
  stockFontColor: '#000000',
  tableFontSize: '14px',
  tableFontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  borderColor: '#000000',
  depthIndentPx: 18,
  accentCyan: '#06b6d4',
  accentAmber: '#f59e0b',
  accentGreen: '#10b981',
  accentRed: '#ef4444',
};

const calculateAverages = (stocks) => {
  const sums = {};
  const counts = {};

  METRIC_KEYS.forEach((key) => {
    sums[key] = 0;
    counts[key] = 0;
  });

  stocks.forEach((stock) => {
    METRIC_KEYS.forEach((key) => {
      const val = stock[key];
      if (typeof val === 'number' && !isNaN(val)) {
        sums[key] += val;
        counts[key] += 1;
      }
    });
  });

  const averages = {};
  METRIC_KEYS.forEach((key) => {
    averages[key] = counts[key] > 0 ? (sums[key] / counts[key]).toFixed(2) : 'N/A';
  });

  return averages;
};

// ============================================================================
// 2. MAIN COMPONENT
// ============================================================================
export default function MarketHierarchyTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedStocks, setSelectedStocks] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // FILTER0 STATE (Cloud Sync)
  const [isFilter0PanelOpen, setIsFilter0PanelOpen] = useState(false);
  const [filter0List, setFilter0List] = useState([]);
  const [filter0Selected, setFilter0Selected] = useState(new Set());
  const [isFilter0Active, setIsFilter0Active] = useState(false);

  // FETCH MASTER SCREENER RECORDS
  useEffect(() => {
    const screenerRef = ref(database, 'SCREENER');
    get(screenerRef)
      .then((snapshot) => {
        if (!snapshot.exists()) throw new Error("No data found under /SCREENER in Firebase.");
        const val = snapshot.val();
        const records = Array.isArray(val) ? val : Object.values(val);
        setData(records.filter(Boolean));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // FETCH CLOUD FILTER0 LIST
  const fetchCloudFilter0 = useCallback(async () => {
    try {
      const f0Ref = ref(database, 'filters/filter0');
      const snap = await get(f0Ref);
      if (snap.exists()) {
        const val = snap.val();
        const list = Array.isArray(val) ? val : Object.values(val);
        const cleanList = list.filter(Boolean);
        setFilter0List(cleanList);
        return cleanList;
      } else {
        setFilter0List([]);
        return [];
      }
    } catch (e) {
      console.error("Error fetching Filter0:", e);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchCloudFilter0();
  }, [fetchCloudFilter0]);

  // Construct hierarchy tree
  const rawHierarchyTree = useMemo(() => {
    if (!data.length) return null;

    const filter0Set = isFilter0Active ? new Set(filter0List) : null;
    const workingData = filter0Set ? data.filter((row) => filter0Set.has(row.Name || row.STOCK)) : data;

    if (workingData.length === 0) return null;

    const sectorsMap = {};
    workingData.forEach((row) => {
      const sectorName = row.sector || 'Uncategorized Sector';
      const industryName = row.industry || 'Uncategorized Industry';

      if (!sectorsMap[sectorName]) sectorsMap[sectorName] = {};
      if (!sectorsMap[sectorName][industryName]) sectorsMap[sectorName][industryName] = [];
      sectorsMap[sectorName][industryName].push(row);
    });

    const sectorNodes = Object.entries(sectorsMap).map(([sectorName, industries]) => {
      const sectorStocks = [];
      const industryNodes = Object.entries(industries).map(([indName, stocks]) => {
        sectorStocks.push(...stocks);
        return {
          id: `ind_${sectorName}_${indName}`,
          name: indName,
          type: 'industry',
          count: stocks.length,
          averages: calculateAverages(stocks),
          children: stocks.map((s, idx) => ({
            id: s.Name || `stock_${s.NSE || idx}`,
            name: s.Name,
            type: 'stock',
            cmp: s.cmp,
            data: s,
          })),
        };
      });

      return {
        id: `sec_${sectorName}`,
        name: sectorName,
        type: 'sector',
        count: sectorStocks.length,
        averages: calculateAverages(sectorStocks),
        children: industryNodes,
      };
    });

    return {
      id: 'market_root',
      name: 'MARKET',
      type: 'market',
      count: workingData.length,
      averages: calculateAverages(workingData),
      children: sectorNodes,
    };
  }, [data, isFilter0Active, filter0List]);

  const handleSort = (key) => {
    if (!key) return;
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  };

  // Sort hierarchy tree recursively
  const sortedHierarchyTree = useMemo(() => {
    if (!rawHierarchyTree) return null;
    if (!sortConfig.key || !sortConfig.direction) return rawHierarchyTree;

    const { key, direction } = sortConfig;
    const isAsc = direction === 'asc';

    const getNodeValue = (node) => {
      const isStock = node.type === 'stock';
      if (key === 'name') return (node.name || '').toString().toLowerCase();
      if (key === 'count_cmp') return isStock ? node.cmp : node.count;
      
      const metrics = isStock ? node.data : node.averages;
      const val = metrics ? metrics[key] : null;
      if (val === null || val === undefined || val === 'N/A') {
        return isAsc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      }
      const num = parseFloat(val);
      return isNaN(num) ? val : num;
    };

    const sortChildren = (nodes) => {
      const sorted = [...nodes].sort((a, b) => {
        const valA = getNodeValue(a);
        const valB = getNodeValue(b);

        if (typeof valA === 'string' && typeof valB === 'string') {
          return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
      });

      return sorted.map((node) => {
        if (node.children && node.children.length > 0) {
          return { ...node, children: sortChildren(node.children) };
        }
        return node;
      });
    };

    return {
      ...rawHierarchyTree,
      children: sortChildren(rawHierarchyTree.children),
    };
  }, [rawHierarchyTree, sortConfig]);

  const toggleExpand = (nodeId) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const toggleStockSelect = (stockName) => {
    setSelectedStocks((prev) => ({ ...prev, [stockName]: !prev[stockName] }));
  };

  const handleReset = () => {
    setExpandedNodes({});
    setSelectedStocks({});
    setSortConfig({ key: null, direction: null });
    setIsFilter0Active(false);
  };

  // FILTER0 CLOUD ACTIONS
  const handleAddSelectedToFilter0 = async () => {
    const checkedStockNames = Object.keys(selectedStocks).filter((k) => selectedStocks[k]);
    if (checkedStockNames.length === 0) {
      alert("No stocks checked in the table to add!");
      return;
    }

    try {
      const f0Ref = ref(database, 'filters/filter0');
      const updatedList = Array.from(new Set([...filter0List, ...checkedStockNames]));
      await set(f0Ref, updatedList);

      setFilter0List(updatedList);
      setSelectedStocks({});
      alert(`Added ${checkedStockNames.length} stock(s) to Firebase Filter0!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update Firebase Filter0.");
    }
  };

  const handleDeleteFromFilter0 = async () => {
    if (filter0Selected.size === 0) {
      alert("No stocks selected in the Filter0 panel to delete!");
      return;
    }

    try {
      const updatedList = filter0List.filter((s) => !filter0Selected.has(s));
      const f0Ref = ref(database, 'filters/filter0');

      if (updatedList.length === 0) {
        await set(f0Ref, null);
      } else {
        await set(f0Ref, updatedList);
      }

      setFilter0List(updatedList);
      setFilter0Selected(new Set());
      alert("Deleted stocks from Firebase Filter0!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete from Firebase Filter0.");
    }
  };

  const handleToggleFilter0Panel = async () => {
    if (!isFilter0PanelOpen) {
      await fetchCloudFilter0();
      setFilter0Selected(new Set());
    }
    setIsFilter0PanelOpen((prev) => !prev);
  };

  const visibleRows = useMemo(() => {
    if (!sortedHierarchyTree) return [];

    const rows = [];
    const traverse = (node, depth = 0) => {
      rows.push({ node, depth });
      if (expandedNodes[node.id] && node.children) {
        node.children.forEach((child) => traverse(child, depth + 1));
      }
    };

    traverse(sortedHierarchyTree);
    return rows;
  }, [sortedHierarchyTree, expandedNodes]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedStocks).filter(Boolean).length;
  }, [selectedStocks]);

  if (loading) {
    return (
      <div style={{ backgroundColor: THEME_CONFIG.pageBgColor, color: '#06b6d4', padding: '40px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
        ⏳ Loading Hierarchy from Firebase...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: THEME_CONFIG.pageBgColor, color: '#ef4444', padding: '40px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
        ⚠️ Error: {error}
      </div>
    );
  }

  let stockRowCounter = 0;

  return (
    <div style={styles.pageContainer}>
      
      {/* TOP CONTROL BAR */}
      <div style={styles.controlBar}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleToggleFilter0Panel} style={styles.filter0Btn}>
            📂 Filter0 {isFilter0PanelOpen ? '▲' : '▼'} {isFilter0Active ? '(ACTIVE)' : ''}
          </button>
          <button onClick={handleReset} style={styles.resetButton}>
            🔄 Reset / Collapse All
          </button>
        </div>

        <div style={styles.selectInfo}>
          Selected Stocks: <span style={{ color: THEME_CONFIG.sectorFontColor }}>{selectedCount}</span>
        </div>
      </div>

      {/* FILTER0 EXPANDABLE OPERATING PANEL */}
      {isFilter0PanelOpen && (
        <div style={styles.panelContainer}>
          <div style={styles.panelHeader}>
            <h3 style={{ margin: 0, fontSize: '14px', color: THEME_CONFIG.accentAmber, textTransform: 'uppercase' }}>
              📂 Filter0 Items (Firebase Cloud) — {filter0List.length}
            </h3>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button type="button" onClick={() => setFilter0Selected(new Set(filter0List))} style={styles.linkActionGreen}>
                All Select
              </button>
              <span style={{ color: '#475569' }}>|</span>
              <button type="button" onClick={() => setFilter0Selected(new Set())} style={styles.linkActionRed}>
                All Deselect
              </button>

              <button type="button" onClick={handleAddSelectedToFilter0} style={styles.btnActionCyan}>
                ➕ Add ({selectedCount})
              </button>
              <button type="button" onClick={handleDeleteFromFilter0} style={styles.btnActionRed}>
                🗑 Delete
              </button>
              <button type="button" onClick={() => { setIsFilter0Active(true); setIsFilter0PanelOpen(false); }} style={styles.btnActionGreen}>
                ✔ Apply
              </button>
            </div>
          </div>

          {filter0List.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', padding: '10px 0' }}>
              No stocks in Firebase Filter0. Check stocks in the table rows and click <b>➕ Add</b>.
            </div>
          ) : (
            <div style={styles.stockGrid}>
              {filter0List.map((stockName) => {
                const isChecked = filter0Selected.has(stockName);
                return (
                  <div
                    key={stockName}
                    onClick={() => {
                      const next = new Set(filter0Selected);
                      if (next.has(stockName)) next.delete(stockName);
                      else next.add(stockName);
                      setFilter0Selected(next);
                    }}
                    style={styles.stockChip}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: 'pointer', accentColor: THEME_CONFIG.accentAmber }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>{stockName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SPREADSHEET TABLE */}
      <div style={styles.tableScrollContainer}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr style={styles.headerRow}>
              {COLUMNS.map((col) => {
                const isSorted = sortConfig.key === col.key && sortConfig.direction !== null;
                const align = col.align || 'right';
                const justify = align === 'left' ? 'flex-start' : (align === 'center' ? 'center' : 'flex-end');

                return (
                  <th
                    key={col.label}
                    onClick={() => col.key && handleSort(col.key)}
                    style={{
                      ...styles.th,
                      minWidth: col.minWidth || 'auto',
                      textAlign: align,
                      cursor: col.key ? 'pointer' : 'default',
                    }}
                    title={col.key ? 'Click to sort' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: justify, gap: '4px' }}>
                      <span>{col.label}</span>
                      {col.key && (
                        <span style={{ fontSize: '12px', opacity: isSorted ? 1 : 0.4 }}>
                          {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No stocks found matching the active Filter0 selection.
                </td>
              </tr>
            ) : (
              visibleRows.map(({ node, depth }) => {
                const isExpanded = !!expandedNodes[node.id];
                const isStock = node.type === 'stock';

                let rowBg = THEME_CONFIG.pageBgColor;
                let fontColor = THEME_CONFIG.stockFontColor;

                if (node.type === 'market') {
                  rowBg = THEME_CONFIG.marketBgColor;
                  fontColor = THEME_CONFIG.marketFontColor;
                } else if (node.type === 'sector') {
                  rowBg = THEME_CONFIG.sectorBgColor;
                  fontColor = THEME_CONFIG.sectorFontColor;
                } else if (node.type === 'industry') {
                  rowBg = THEME_CONFIG.industryBgColor;
                  fontColor = THEME_CONFIG.industryFontColor;
                } else {
                  const isEven = stockRowCounter % 2 === 0;
                  stockRowCounter++;
                  rowBg = isEven ? THEME_CONFIG.stockBgEven : THEME_CONFIG.stockBgOdd;
                  fontColor = THEME_CONFIG.stockFontColor;
                }

                const rowStyle = { backgroundColor: rowBg };
                const textStyle = { color: fontColor, fontWeight: 'bold' };
                const metrics = isStock ? node.data : node.averages;

                let countCmpDisplay = '';
                if (isStock) {
                  const cmpVal = metrics.cmp !== undefined && metrics.cmp !== null ? metrics.cmp : 'N/A';
                  countCmpDisplay = `CMP: ₹${cmpVal}`;
                } else {
                  countCmpDisplay = `COUNT: ${node.count}`;
                }

                return (
                  <tr key={node.id} style={rowStyle}>
                    <td style={styles.tdCenter}>
                      {isStock ? (
                        <input
                          type="checkbox"
                          checked={!!selectedStocks[node.name]}
                          onChange={() => toggleStockSelect(node.name)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#000000' }}
                        />
                      ) : (
                        <button onClick={() => toggleExpand(node.id)} style={styles.expandButton}>
                          {isExpanded ? '−' : '+'}
                        </button>
                      )}
                    </td>

                    <td style={{ ...styles.tdText, ...textStyle, textAlign: 'left', paddingLeft: `${depth * THEME_CONFIG.depthIndentPx + 10}px` }}>
                      {node.name}
                    </td>

                    <td style={{ ...styles.tdText, ...textStyle, textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {countCmpDisplay}
                    </td>

                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.mcap}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.PCCAP}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.RSI}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['T-score']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['G-score']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['F-score']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.PB}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['3PB']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['DPB%']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.PE}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['3PE']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics['DPE%']}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.DY}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.advdp}</td>
                    <td style={{ ...styles.tdNum, ...textStyle }}>{metrics.DE}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 3. STYLES
// ============================================================================
const styles = {
  pageContainer: {
    backgroundColor: THEME_CONFIG.pageBgColor,
    minHeight: '100vh',
    padding: '16px',
    boxSizing: 'border-box',
    fontFamily: THEME_CONFIG.tableFontFamily,
  },
  controlBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '4px 8px',
  },
  resetButton: {
    backgroundColor: '#1E293B',
    color: '#E5E7EB',
    border: '1px solid #4B5563',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  filter0Btn: {
    backgroundColor: THEME_CONFIG.accentAmber,
    color: '#000000',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
  },
  selectInfo: {
    color: '#E5E7EB',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  panelContainer: {
    backgroundColor: '#050b18',
    border: `2px solid ${THEME_CONFIG.accentAmber}`,
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '8px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  linkActionGreen: {
    background: 'none',
    border: 'none',
    color: THEME_CONFIG.accentGreen,
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  linkActionRed: {
    background: 'none',
    border: 'none',
    color: THEME_CONFIG.accentRed,
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  btnActionCyan: {
    backgroundColor: THEME_CONFIG.accentCyan,
    color: '#000000',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnActionRed: {
    backgroundColor: THEME_CONFIG.accentRed,
    color: '#ffffff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnActionGreen: {
    backgroundColor: THEME_CONFIG.accentGreen,
    color: '#000000',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
  },
  stockGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '8px',
    maxHeight: '180px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  stockChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#0d182e',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #1e293b',
    cursor: 'pointer',
  },
  tableScrollContainer: {
    maxHeight: '85vh',
    overflow: 'auto',
    border: `1px solid ${THEME_CONFIG.borderColor}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: THEME_CONFIG.tableFontSize,
    fontWeight: 'bold',
  },
  thead: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerRow: {
    borderBottom: `1px solid ${THEME_CONFIG.borderColor}`,
  },
  th: {
    padding: '10px 8px',
    color: THEME_CONFIG.headerFontColor,
    backgroundColor: THEME_CONFIG.headerBgColor,
    fontWeight: 'bold',
    fontSize: THEME_CONFIG.headerFontSize,
    border: `1px solid ${THEME_CONFIG.borderColor}`,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  tdText: {
    border: `1px solid ${THEME_CONFIG.borderColor}`,
    padding: '8px 10px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    maxWidth: '220px',
    minWidth: '170px',
    fontWeight: 'bold',
    fontSize: THEME_CONFIG.tableFontSize,
  },
  tdNum: {
    border: `1px solid ${THEME_CONFIG.borderColor}`,
    padding: '8px 8px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontWeight: 'bold',
    fontSize: THEME_CONFIG.tableFontSize,
  },
  tdCenter: {
    border: `1px solid ${THEME_CONFIG.borderColor}`,
    padding: '8px 4px',
    textAlign: 'center',
  },
  expandButton: {
    cursor: 'pointer',
    width: '24px',
    height: '24px',
    fontWeight: 'bold',
    fontSize: '16px',
    backgroundColor: '#FFFFFF',
    color: '#000000',
    border: `1px solid ${THEME_CONFIG.borderColor}`,
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};