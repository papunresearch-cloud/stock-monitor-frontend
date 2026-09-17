import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

// View Components
import StockMonitorView from "./StockMonitorView";
import MarketHierarchy from "./MarketHierarchy";
import Filter from "./Filter";
import AdvancedFilter from "./Advanced_Filter";
import Watchlist from "./Watchlist";

export default function App() {
  const [isScreenerSyncing, setIsScreenerSyncing] = useState(false);

  // Backend Render Base URL
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://nse-ohlc-system.onrender.com";

  // Trigger the 6-stage ETL Screener Pipeline
  const handleTriggerScreenerPipeline = async () => {
    if (isScreenerSyncing) return;

    const confirmRun = window.confirm(
      "Fetch new screener.csv from Google Drive, calculate scores, and overwrite Firebase /SCREENER?"
    );
    if (!confirmRun) return;

    setIsScreenerSyncing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/sync-screener`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        alert("🚀 Screener pipeline triggered on Render!\nIt runs in the background. Fresh data will appear shortly.");
      } else {
        alert(`⚠️ Backend responded with error status: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to trigger screener pipeline:", err);
      alert("❌ Could not connect to Render backend. Check Render server status.");
    } finally {
      // 15-second cooldown to prevent button spamming
      setTimeout(() => {
        setIsScreenerSyncing(false);
      }, 15000);
    }
  };

  return (
    <Router>
      <div style={{ backgroundColor: "#000000", minHeight: "100vh", color: "#ffffff", boxSizing: "border-box" }}>
        
        {/* TOP UNIFIED TERMINAL HEADER */}
        <header
          style={{
            backgroundColor: "#070c18",
            borderBottom: "2px solid #1e293b",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            position: "sticky",
            top: 0,
            zIndex: 3000,
          }}
        >
          {/* Platform Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>⚡</span>
            <span
              style={{
                color: "#ffcc00",
                fontWeight: "900",
                letterSpacing: "1px",
                fontSize: "14px",
                textTransform: "uppercase",
              }}
            >
              QUANTUM STOCK PLATFORM
            </span>
          </div>

          {/* Navigation Funnel: Monitor + Screener Suite */}
          <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <NavLink to="/" style={getLinkStyle}>📡 Stock Monitor</NavLink>

            <div style={{ width: "1px", height: "20px", backgroundColor: "#334155", margin: "0 4px" }} />

            <NavLink to="/MarketHierarchy" style={getLinkStyle}>🌳 Hierarchy</NavLink>
            <NavLink to="/Filter" style={getLinkStyle}>🔍 Filter 1</NavLink>
            <NavLink to="/Advanced_Filter" style={getLinkStyle}>⚙️ Filter 2</NavLink>
            <NavLink to="/Watchlist" style={getLinkStyle}>📋 Watchlist</NavLink>
          </nav>

          {/* CLOUD SCREENER SYNC BUTTON */}
          <div>
            <button
              onClick={handleTriggerScreenerPipeline}
              disabled={isScreenerSyncing}
              style={{
                backgroundColor: isScreenerSyncing ? "#334155" : "#10b981",
                color: isScreenerSyncing ? "#94a3b8" : "#000000",
                border: "none",
                padding: "7px 14px",
                borderRadius: "6px",
                fontWeight: "900",
                fontSize: "12px",
                letterSpacing: "0.5px",
                cursor: isScreenerSyncing ? "not-allowed" : "pointer",
                boxShadow: isScreenerSyncing ? "none" : "0 0 10px rgba(16, 185, 129, 0.4)",
                transition: "all 0.2s ease-in-out",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isScreenerSyncing ? "⏳ RUNNING ETL..." : "🔄 SYNC SCREENER (DRIVE ➔ FB)"}
            </button>
          </div>
        </header>

        {/* APPLICATION ROUTES */}
        <main>
          <Routes>
            <Route path="/" element={<StockMonitorView />} />
            <Route path="/MarketHierarchy" element={<MarketHierarchy />} />
            <Route path="/Filter" element={<Filter />} />
            <Route path="/Advanced_Filter" element={<AdvancedFilter />} />
            <Route path="/Watchlist" element={<Watchlist />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

const getLinkStyle = ({ isActive }) => ({
  backgroundColor: isActive ? "#06b6d4" : "#1e293b",
  color: isActive ? "#000000" : "#94a3b8",
  border: `1px solid ${isActive ? "#06b6d4" : "#334155"}`,
  padding: "6px 14px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "bold",
  fontSize: "12px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  transition: "all 0.15s ease-in-out",
  display: "inline-flex",
  alignItems: "center",
  boxShadow: isActive ? "0 0 10px rgba(6, 182, 212, 0.4)" : "none",
});