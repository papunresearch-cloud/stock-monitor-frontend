import React, { useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { ref, update } from "firebase/database";
import { database } from "./firebase";

// View Components
import StockMonitorView from "./StockMonitorView";
import MarketHierarchy from "./MarketHierarchy";
import Filter from "./Filter";
import AdvancedFilter from "./Advanced_Filter";
import Watchlist from "./Watchlist";

// Alert System Modal Component
import AlertSystemModal from "./alert_system";

// Security PIN Guard (Restores startup PIN check)
import PinModalGuard from "./PinModalGuard";

export default function App() {
  const [isScreenerSyncing, setIsScreenerSyncing] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Modal State for Screener Sync
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [updateChoice, setUpdateChoice] = useState(""); // "Y" or "N"
  const [syncSource, setSyncSource] = useState("DRIVE"); // "DRIVE", "BROWSE", or "AUTO"
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Format local date YYYY-MM-DD
  const getTodayISO = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [databaseDate, setDatabaseDate] = useState(getTodayISO());

  // Backend Render Base URL
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://nse-ohlc-system.onrender.com";

  // Validate: Date must be today or less than 5 days older (and not future)
  const isDateValid = (dateStr) => {
    if (!dateStr) return false;
    const selected = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    fiveDaysAgo.setHours(0, 0, 0, 0);

    const checkDate = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    return checkDate >= fiveDaysAgo && checkDate <= today;
  };

  // Form validity check
  const isFormValid =
    updateChoice === "Y" &&
    isDateValid(databaseDate) &&
    (syncSource === "DRIVE" || syncSource === "AUTO" || (syncSource === "BROWSE" && selectedFile !== null));

  // Open modal handler
  const handleOpenSyncModal = () => {
    if (isScreenerSyncing) return;
    setUpdateChoice("");
    setSyncSource("DRIVE");
    setSelectedFile(null);
    setDatabaseDate(getTodayISO());
    setIsSyncModalOpen(true);
  };

  const handleAbortSync = () => {
    setIsSyncModalOpen(false);
    setUpdateChoice("");
    setSelectedFile(null);
  };

  // Trigger Sync Execution
  const handleConfirmSync = async () => {
    if (!isFormValid || isScreenerSyncing) return;

    setIsSyncModalOpen(false);
    setIsScreenerSyncing(true);

    try {
      // 1. Telemetry log in Firebase
      try {
        await update(ref(database, "system_status/screener_sync"), {
          "Date of database data": databaseDate,
          "sync_triggered_at": new Date().toISOString(),
          "sync_source": syncSource
        });
      } catch (fbErr) {
        console.error("Firebase sync telemetry update error:", fbErr);
      }

      let response;

      if (syncSource === "AUTO") {
        // Path A: Auto-Sync via Playwright directly on Screener.in
        response = await fetch(`${BACKEND_URL}/auto-sync-screener`, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ database_date: databaseDate })
        });
      } else if (syncSource === "BROWSE" && selectedFile) {
        // Path B: Local file multipart upload
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("database_date", databaseDate);

        response = await fetch(`${BACKEND_URL}/sync-screener-upload`, {
          method: "POST",
          mode: "cors",
          body: formData
        });
      } else {
        // Path C: Google Drive flow
        response = await fetch(`${BACKEND_URL}/sync-screener`, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ database_date: databaseDate })
        });
      }

      if (response && response.ok) {
        const modeLabel =
          syncSource === "AUTO"
            ? "Automated Screener.in Direct Download"
            : syncSource === "BROWSE"
            ? "Browsed Local File"
            : "Google Drive";

        alert(
          `🚀 Screener pipeline triggered successfully!\nMode: ${modeLabel}\nDatabase date recorded: ${databaseDate}`
        );
      } else {
        alert(`⚠️ Backend responded with status: ${response ? response.status : "unknown"}`);
      }
    } catch (err) {
      console.error("Failed to trigger screener pipeline:", err);
      alert("❌ Could not connect to Render backend. Check server status.");
    } finally {
      setTimeout(() => {
        setIsScreenerSyncing(false);
        setSelectedFile(null);
      }, 120000);
    }
  };

  return (
    <PinModalGuard>
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

            {/* Navigation Funnel */}
            <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <NavLink to="/" style={getLinkStyle}>📡 Stock Monitor</NavLink>
              <div style={{ width: "1px", height: "20px", backgroundColor: "#334155", margin: "0 4px" }} />
              <NavLink to="/MarketHierarchy" style={getLinkStyle}>🌳 Hierarchy</NavLink>
              <NavLink to="/Filter" style={getLinkStyle}>🔍 Filter 1</NavLink>
              <NavLink to="/Advanced_Filter" style={getLinkStyle}>⚙️ Filter 2</NavLink>
              <NavLink to="/Watchlist" style={getLinkStyle}>📋 Watchlist</NavLink>
            </nav>

            {/* TOP RIGHT ACTION BUTTONS */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => setIsAlertModalOpen(true)}
                style={{
                  backgroundColor: "#f59e0b",
                  color: "#000000",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  fontWeight: "900",
                  fontSize: "12px",
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  boxShadow: "0 0 12px rgba(245, 158, 11, 0.4)",
                  transition: "all 0.2s ease-in-out",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  textTransform: "uppercase",
                }}
              >
                🔔 ALERT SETTING
              </button>

              <button
                onClick={handleOpenSyncModal}
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
                {isScreenerSyncing ? "⏳ RUNNING ETL (2 MIN COOLDOWN)..." : "🔄 SYNC SCREENER"}
              </button>