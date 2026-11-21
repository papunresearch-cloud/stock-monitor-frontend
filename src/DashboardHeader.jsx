import React, { useState, useEffect } from 'react';

export default function DashboardHeader({ 
  onOpenSettings,
  onOpenHealth,

  // Master States from App.jsx
  isAutoMode, 
  isFrozen, 
  refreshRate, 
  isRefreshLocked, 
  isSyncLocked,
  isSyncPulsing,
  
  // Control Functions from App.jsx
  onAutoToggle, 
  onRateChange, 
  onRefresh, 
  onSync, 
  onFreezeToggle
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleScroll = () => {
      if (isManual && window.scrollY > 0) return; 
      if (window.scrollY > 60) {
        setIsCollapsed(true);
      } else if (window.scrollY < 10) {
        setIsCollapsed(false);
        setIsManual(false); 
      }
    };

    const handleResize = () => setIsMobile(window.innerWidth <= 768);

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isManual]);

  const toggleHeader = () => {
    setIsCollapsed(prev => !prev);
    setIsManual(true);
  };

  const ribbonStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(90deg, #11111a 0%, #1a1a2e 50%, #16213e 100%)',
    padding: isCollapsed ? '4px 20px' : (isMobile ? '10px 15px' : '12px 20px'),
    borderRadius: '6px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
    borderBottom: '2px solid #FFD700',
    color: 'white',
    fontFamily: 'sans-serif',
    marginBottom: '0px', 
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.3s ease', 
    position: 'relative'
  };

  const logoStyle = {
    fontSize: isCollapsed ? '12px' : (isMobile ? '18px' : '22px'), 
    fontWeight: '900',
    letterSpacing: '2px',
    margin: 0,
    background: '-webkit-linear-gradient(#FFD700, #FFA500)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0px 2px 4px rgba(0,0,0,0.3)',
    textTransform: 'uppercase',
    transition: 'all 0.3s ease'
  };

  const autoInputStyle = {
    background: 'rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 215, 0, 0.5)',
    color: '#FFD700',
    outline: 'none',
    padding: '4px 4px',
    fontSize: '12px',
    width: '38px',
    borderRadius: '4px',
    textAlign: 'center',
    marginLeft: '6px'
  };

  const getBtnStyle = (bgColor, textColor, shadowColor, isDisabled) => ({
    padding: '7px 14px',
    background: bgColor,
    color: textColor,
    border: '1px solid #111',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    boxShadow: `0 3px 0 ${shadowColor}`,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
  });

  // Dynamic visual states for Sync button
  const isSyncDisabled = isFrozen || isSyncLocked;
  let syncBgColor = '#008B8B';
  let syncShadowColor = '#004F4F';
  let syncLabel = 'Sync';

  if (isSyncPulsing) {
    syncBgColor = '#FF9800'; // Amber active pulse
    syncShadowColor = '#B26A00';
    syncLabel = 'Syncing...';
  } else if (isSyncDisabled) {
    syncBgColor = '#4A2000'; // Cooldown brown
    syncShadowColor = '#220E00';
    syncLabel = isFrozen ? 'Sync' : 'Locked';
  }

  return (
    <div style={ribbonStyle}>
      
      {/* 1. LOGO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: isCollapsed ? '12px' : (isMobile ? '18px' : '22px'), transition: 'all 0.3s ease' }}>⚡</span>
        <h1 style={logoStyle}>Nexus Terminal</h1>
      </div>

      {/* 2. DYNAMIC CONTROLS */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        opacity: isCollapsed ? 0 : 1, 
        maxHeight: isCollapsed ? '0px' : '200px', 
        overflow: 'hidden', 
        transition: 'all 0.3s ease'
      }}>
        
        {/* GOLDEN SETTINGS ICON */}
        <div 
          onClick={onOpenSettings}
          style={{
            fontSize: '26px',
            color: '#FFD700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            lineHeight: '1'
          }}
          title="Open Dashboard Settings"
        >
          ⚙ 
        </div>

        {/* HEALTH REPORT BUTTON */}
        <button 
          style={getBtnStyle('#1f242c', '#FFD700', '#000000', false)}
          onClick={onOpenHealth}
          title="View Backend, Database, and Sync Health"
        >
          ❤️ Health
        </button>

        {/* AUTO MODE */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            style={getBtnStyle(isAutoMode ? '#8B0000' : '#00008B', '#FFFFFF', '#000000', isFrozen)}
            onClick={onAutoToggle} 
            disabled={isFrozen}
          >
            {isAutoMode ? 'Auto - ON' : 'Auto - OFF'}
          </button>
          <input 
            type="number" 
            style={autoInputStyle} 
            value={refreshRate} 
            onChange={(e) => onRateChange(Number(e.target.value))} 
            min="1" 
            disabled={isFrozen} 
          />
          <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '5px', fontWeight: 'bold' }}>SEC</span>
        </div>

        {/* REFRESH */}
        <button 
          style={getBtnStyle((isAutoMode || isFrozen || isRefreshLocked) ? '#4B5363' : '#E60073', '#FFFFFF', '#000000', (isAutoMode || isFrozen || isRefreshLocked))} 
          onClick={onRefresh} 
          disabled={isAutoMode || isFrozen || isRefreshLocked}
          title="Click to manually refresh live data"
        >
          Refresh
        </button>
        
        {/* SYNC */}
        <button 
          style={getBtnStyle(syncBgColor, '#FFFFFF', syncShadowColor, isSyncDisabled)} 
          onClick={onSync} 
          disabled={isSyncDisabled}
          title={isSyncLocked ? "Sync locked for 15 minutes" : "Click to pulse daemon for full OHLC re-sync"}
        >
          {syncLabel}
        </button>
        
        {/* FREEZE */}
        <button 
          style={getBtnStyle(isFrozen ? '#8B0000' : '#FFFACD', isFrozen ? '#FFFFFF' : '#000000', '#000000', false)} 
          onClick={onFreezeToggle}
        >
          {isFrozen ? 'Unfreeze' : 'Freeze'}
        </button>
      </div>

      {/* 3. CENTERED MANUAL EXPANSION TOGGLE */}
      <div 
        onClick={toggleHeader}
        style={{
          position: 'absolute',
          bottom: '-16px', 
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1a1a2e',
          color: '#FFD700',
          border: '1px solid #FFD700',
          borderRadius: '0 0 8px 8px',
          padding: '2px 20px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 10
        }}
      >
        {isCollapsed ? '▼' : '▲'}
      </div>

    </div>
  );
}