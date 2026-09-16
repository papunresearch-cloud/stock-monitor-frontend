import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";

// 1. The Stock Monitor (Your existing code, now inside StockMonitorView)
import StockMonitorView from "./StockMonitorView";

// 2. The Screener Suite components
import MarketHierarchy from "./MarketHierarchy";
import Filter from "./Filter";
import AdvancedFilter from "./Advanced_Filter";
import Watchlist from "./Watchlist";

export default function App() {
  return (
    <Router>
      <div style={{ backgroundColor: "#000000", minHeight: "100vh" }}>
        
        {/* TOP MASTER NAVIGATION BAR */}
        <header style={{ 
          backgroundColor: "#080c14", 
          borderBottom: "2px solid #1e293b", 
          padding: "10px 20px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          position: "sticky",
          top: 0,
          zIndex: 2000
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>⚡</span>
            <span style={{ color: "#ffcc00", fontWeight: "900", letterSpacing: "1px", fontSize: "14px", textTransform: "uppercase" }}>
              Quantum Terminal
            </span>
          </div>

          <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <NavLink to="/" style={navBtnStyle}>📡 Live Monitor</NavLink>
            <NavLink to="/MarketHierarchy" style={navBtnStyle}>🌳 Hierarchy</NavLink>
            <NavLink to="/Filter" style={navBtnStyle}>🔍 Stock Filter</NavLink>
            <NavLink to="/Advanced_Filter" style={navBtnStyle}>⚙️ Screener</NavLink>
            <NavLink to="/Watchlist" style={navBtnStyle}>📋 Watchlist</NavLink>
          </nav>
        </header>

        {/* ROUTES */}
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

const navBtnStyle = ({ isActive }) => ({
  backgroundColor: isActive ? "#06b6d4" : "#1e293b",
  color: isActive ? "#000000" : "#94a3b8",
  border: `1px solid ${isActive ? "#06b6d4" : "#334155"}`,
  padding: "6px 12px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "bold",
  fontSize: "12px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  transition: "all 0.15s ease-in-out"
});