import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

// 1. Master Stock Monitor Engine (Your original App.jsx code moved here)
import StockMonitorView from "./StockMonitorView";

// 2. Stock Screener & Discovery Modules
import MarketHierarchy from "./MarketHierarchy";
import Filter from "./Filter";
import AdvancedFilter from "./Advanced_Filter";
import Watchlist from "./Watchlist";

export default function App() {
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

          {/* Navigation Funnel: Monitor + Screener Pipeline */}
          <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Live Terminal */}
            <NavLink to="/" style={getLinkStyle}>
              📡 Stock Monitor
            </NavLink>

            <div style={{ width: "1px", height: "20px", backgroundColor: "#334155", margin: "0 4px" }} />

            {/* Pipeline Order: Market Hierarchy -> Filter 1 -> Screener (Filter 2) -> Watchlist */}
            <NavLink to="/MarketHierarchy" style={getLinkStyle}>
              🌳 Market Hierarchy
            </NavLink>
            <NavLink to="/Filter" style={getLinkStyle}>
              🔍 Stock Filter
            </NavLink>
            <NavLink to="/Advanced_Filter" style={getLinkStyle}>
              ⚙️ Advanced Screener
            </NavLink>
            <NavLink to="/Watchlist" style={getLinkStyle}>
              📋 Watchlist
            </NavLink>
          </nav>
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