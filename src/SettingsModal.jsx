import React, { useState, useEffect } from 'react';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  allStocks = [], 
  savedFirebaseList = { stocks: [], displayOrder: '', groupBy: '' },
  onSave 
}) {
  
  // ==========================================
  // 1. STATES (Stock Watchlist Only)
  // ==========================================
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [displayOrder, setDisplayOrder] = useState('Alphabetical Dec. (A - Z)');
  const [groupBy, setGroupBy] = useState('No filter');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // ==========================================
  // 2. INITIALIZATION (Direct from Firebase Props)
  // ==========================================
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, savedFirebaseList]);

  const loadSettings = () => {
    if (savedFirebaseList?.stocks?.length > 0) {
      setSelectedStocks(savedFirebaseList.stocks || []);
      setDisplayOrder(savedFirebaseList.displayOrder || 'Alphabetical Dec. (A - Z)');
      setGroupBy(savedFirebaseList.groupBy || 'No filter');
    } else {
      const safeStocks = (allStocks || []).map(s => s?.ticker || s?.Name || s);
      setSelectedStocks(safeStocks.slice(0, 10)); 
      setDisplayOrder('Mkt Cap Rank inc.');
      setGroupBy('No filter');
    }
  };

  // ==========================================
  // 3. MASTER SAVE (Commit to Firebase)
  // ==========================================
  const handleSave = () => {
    const confirmSave = window.confirm("Save this list and layout as your permanent display in Firebase?\n\nClick 'OK' for YES.\nClick 'Cancel' for NO.");
    if (confirmSave && onSave) {
      onSave({ 
        stocks: selectedStocks, 
        displayOrder, 
        groupBy 
      });
      onClose();
    }
  };

  // ==========================================
  // 4. SELECTION CONTROLS
  // ==========================================
  const toggleSelection = (itemName) => {
    setSelectedStocks(prev => {
      const exists = prev.includes(itemName);
      return exists ? prev.filter(s => s !== itemName) : [...prev, itemName];
    });
  };

  const handleAllSelect = () => {
    setSelectedStocks([...(allStocks || []).map(s => s?.ticker || s?.Name || s)]);
  };

  const handleAllDeselect = () => {
    setSelectedStocks([]);
  };

  // ==========================================
  // 5. UI STYLES
  // ==========================================
  if (!isOpen) return null;

  const safeStocks = (allStocks || []).map(s => s?.ticker || s?.Name || s).sort();

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  const modalStyle = {
    width: isMobile ? '95%' : '900px',
    maxHeight: '90vh',
    background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.85), rgba(10, 10, 15, 0.95))',
    border: '1px solid rgba(255, 215, 0, 0.3)', 
    borderRadius: '12px', 
    padding: isMobile ? '15px' : '20px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.8)', 
    color: '#e0e0e0', 
    fontFamily: 'sans-serif',
    display: 'flex', 
    flexDirection: 'column', 
    gap: '20px', 
    overflowY: 'auto',
    boxSizing: 'border-box'
  };

  const sectionStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.4)', 
    border: '1px solid #333', 
    borderRadius: '8px', 
    padding: '15px'
  };

  const listContainerStyle = {
    maxHeight: isMobile ? '280px' : '220px', 
    overflowY: 'auto', 
    border: '1px solid #222',
    padding: '10px', 
    background: 'rgba(0,0,0,0.6)', 
    borderRadius: '6px',
    display: 'grid', 
    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
    gap: '10px', 
    marginBottom: '15px'
  };

  const btnStyle = (bg, color, extraStyle = {}) => ({
    padding: '6px 14px', background: bg, color: color,
    border: '1px solid #111', borderRadius: '4px', cursor: 'pointer',
    fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', 
    boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
    flex: isMobile ? '1 1 45%' : 'none',
    textAlign: 'center',
    ...extraStyle
  });

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
          <h2 style={{ margin: 0, color: '#FFD700', letterSpacing: '1px', fontSize: isMobile ? '16px' : '22px' }}>
            WATCHLIST SETTINGS
          </h2>
          <button onClick={onClose} style={btnStyle('#FF5252', '#fff', { fontSize: '14px', padding: '8px 16px' })}>
            ✕ Close
          </button>
        </div>

        {/* STOCKS SELECTION SECTION */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#E040FB', fontSize: '16px' }}>
              STOCKS (WATCHLIST)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '15px', width: isMobile ? '100%' : 'auto' }}>
              
              {/* GROUP BY DROPDOWN */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold', minWidth: '80px' }}>GROUP BY:</span>
                <select 
                  value={groupBy} 
                  onChange={(e) => setGroupBy(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.8)', color: '#00BCD4', border: '1px solid #444', padding: '6px 8px', borderRadius: '4px', outline: 'none', fontSize: '13px', width: isMobile ? '100%' : 'auto' }}
                >
                  <option value="No filter">No filter</option>
                  <option value="Group">Group</option>
                  <option value="Sector">Sector</option>
                  <option value="Industry">Industry</option>
                </select>
              </div>

              {/* DISPLAY ORDER DROPDOWN */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold', minWidth: '100px' }}>DISPLAY ORDER:</span>
                <select 
                  value={displayOrder} 
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.8)', color: '#FFD700', border: '1px solid #444', padding: '6px 8px', borderRadius: '4px', outline: 'none', fontSize: '13px', width: isMobile ? '100%' : 'auto' }}
                >
                  <option value="Mkt Cap Rank inc.">Mkt Cap Rank inc.</option>
                  <option value="Mkt Cap Rank dec.">Mkt Cap Rank dec.</option>
                  <option value="Alphabetical Dec. (A - Z)">Alphabetical Dec. (A - Z)</option>
                  <option value="F-score Inc.">F-score Inc.</option>
                  <option value="F-score dec.">F-score dec.</option>
                  <option value="G-score inc.">G-score inc.</option>
                  <option value="G-score dec.">G-score dec.</option>
                  <option value="T-score inc.">T-score inc.</option>
                  <option value="T-score dec.">T-score dec.</option>
                  <option value="RSI inc.">RSI inc.</option>
                  <option value="RSI dec.">RSI dec.</option>
                </select>
              </div>

            </div>
          </div>

          <div style={listContainerStyle}>
            {safeStocks.map(stockName => (
              <label key={stockName} style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="checkbox" 
                  checked={(selectedStocks || []).includes(stockName)} 
                  onChange={() => toggleSelection(stockName)} 
                />
                {stockName}
              </label>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleAllSelect} style={btnStyle('#2962FF', '#fff')}>All Select</button>
            <button onClick={handleAllDeselect} style={btnStyle('#4B5363', '#fff')}>All Deselect</button>
          </div>
        </div>

        {/* GLOBAL MASTER FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: '15px' }}>
          <button onClick={handleSave} style={btnStyle('#2E7D32', '#fff', { fontSize: '14px', padding: '10px 20px', width: isMobile ? '100%' : 'auto' })}>
            Save to Firebase
          </button>
        </div>

      </div>
    </div>
  );
}