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

// Security PIN Guard
import PinModalGuard from "./PinModalGuard";

// Visual Fundamental Financial Statement Components
import CompanyDashboard from "./fundamentals/CompanyDashboard";
import BankDashboard from "./fundamentals/BankDashboard";
import { parseWorkbook } from "./fundamentals/parseWorkbook";
import { exportToPDF, exportToExcel } from "./fundamentals/exportReports";

// NavLink style helper
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

export default function App() {
  const [isScreenerSyncing, setIsScreenerSyncing] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Modal State for Screener Sync
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false); // Popup 1: Mode & Date
  const [isManualModalOpen, setIsManualModalOpen] = useState(false); // Popup 2: File Picker (MAN mode)
  const [syncMode, setSyncMode] = useState("AUTO"); // Strictly "AUTO" or "MAN"
  const [selectedFile, setSelectedFile] = useState(null);
  const manualFileInputRef = useRef(null);

  // =========================================================================
  // VISUAL FUNDAMENTAL STATEMENT STATES
  // =========================================================================
  const [fundStockInput, setFundStockInput] = useState("");
  const [activeFundMode, setActiveFundMode] = useState("normal"); // "normal" or "bank"
  const [activeFundData, setActiveFundData] = useState(null);
  const [isFundViewerOpen, setIsFundViewerOpen] = useState(false);
  const [isFundManualModalOpen, setIsFundManualModalOpen] = useState(false);

  // Manual Mode Popup Internal States
  const [manualWorkbookFile, setManualWorkbookFile] = useState(null);
  const [manualFormatChoice, setManualFormatChoice] = useState("normal");
  const [isWorkbookParsing, setIsWorkbookParsing] = useState(false);
  const workbookFileInputRef = useRef(null);

  // Format local date YYYY-MM-DD
  const getTodayISO = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get date string 5 days ago in YYYY-MM-DD
  const getFiveDaysAgoISO = () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [databaseDate, setDatabaseDate] = useState(getTodayISO());

  // Backend Render Base URL
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://nse-ohlc-system.onrender.com";

  // Validate: Date must be today or within last 5 days
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

  // Open modal handler
  const handleOpenSyncModal = () => {
    if (isScreenerSyncing) return;
    setSyncMode("AUTO");
    setSelectedFile(null);
    setDatabaseDate(getTodayISO());
    setIsManualModalOpen(false);
    setIsSyncModalOpen(true);
  };

  const handleAbortSync = () => {
    setIsSyncModalOpen(false);
    setIsManualModalOpen(false);
    setSelectedFile(null);
  };

  // Step 1 OK Click: Either triggers AUTO or proceeds to Manual file popup
  const handleStep1Ok = () => {
    if (!isDateValid(databaseDate)) {
      alert("⚠️ Please select a valid DB Date (today or within the last 5 days).");
      return;
    }

    if (syncMode === "AUTO") {
      setIsSyncModalOpen(false);
      executeAutoSync();
    } else {
      // MAN mode selected -> Close Popup 1 and open Popup 2
      setIsSyncModalOpen(false);
      setSelectedFile(null);
      setIsManualModalOpen(true);
    }
  };

  // Execute AUTO mode directly
  const executeAutoSync = async () => {
    setIsScreenerSyncing(true);

    try {
      try {
        await update(ref(database, "system_status/screener_sync"), {
          "Date of database data": databaseDate,
          "sync_triggered_at": new Date().toISOString(),
          "sync_source": "AUTO_SYNC",
        });
      } catch (fbErr) {
        console.error("Firebase sync telemetry update error:", fbErr);
      }

      const response = await fetch(`${BACKEND_URL}/auto-sync-screener`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database_date: databaseDate }),
      });

      if (response && response.ok) {
        alert(
          `🚀 Screener Auto Sync initiated successfully!\nDB Date: ${databaseDate}\nBackground ETL pipeline is now executing.`
        );
      } else {
        alert(`⚠️ Backend responded with status: ${response ? response.status : "unknown"}`);
      }
    } catch (err) {
      console.error("Failed to trigger auto screener pipeline:", err);
      alert("❌ Could not connect to Render backend. Check server status.");
    } finally {
      setTimeout(() => {
        setIsScreenerSyncing(false);
      }, 120000);
    }
  };

  // Step 2 OK Click (MAN mode file upload execution)
  const handleManualUploadConfirm = async () => {
    if (!selectedFile) {
      alert("⚠️ Please select a .csv file from your local disk space.");
      return;
    }

    setIsManualModalOpen(false);
    setIsScreenerSyncing(true);

    try {
      try {
        await update(ref(database, "system_status/screener_sync"), {
          "Date of database data": databaseDate,
          "sync_triggered_at": new Date().toISOString(),
          "sync_source": "MANUAL_UPLOAD",
        });
      } catch (fbErr) {
        console.error("Firebase sync telemetry update error:", fbErr);
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("database_date", databaseDate);

      const response = await fetch(`${BACKEND_URL}/sync-screener-upload`, {
        method: "POST",
        mode: "cors",
        body: formData,
      });

      if (response && response.ok) {
        alert(
          `🚀 Manual Screener upload triggered successfully!\nFile: ${selectedFile.name}\nDB Date: ${databaseDate}`
        );
      } else {
        alert(`⚠️ Backend responded with status: ${response ? response.status : "unknown"}`);
      }
    } catch (err) {
      console.error("Failed to upload screener file:", err);
      alert("❌ Could not connect to Render backend. Check server status.");
    } finally {
      setTimeout(() => {
        setIsScreenerSyncing(false);
        setSelectedFile(null);
      }, 120000);
    }
  };

  // =========================================================================
  // FUNDAMENTAL ACTIONS & HANDLERS
  // =========================================================================
  const handleOpenDirectMode = (mode) => {
    if (!fundStockInput.trim()) {
      alert("⚠️ Please enter a stock symbol first in the field.");
      return;
    }

    setActiveFundMode(mode);

    // If a workbook has already been loaded for this session, open viewer immediately
    if (activeFundData) {
      setIsFundViewerOpen(true);
    } else {
      // Prompt user to select/load the workbook via Manual Mode dialog
      setManualFormatChoice(mode);
      setIsFundManualModalOpen(true);
    }
  };

  const handleOpenManualWorkbookDialog = () => {
    setManualWorkbookFile(null);
    setManualFormatChoice("normal");
    setIsFundManualModalOpen(true);
  };

  const handleExecuteManualWorkbook = async () => {
    if (!manualWorkbookFile) {
      alert("⚠️ Please select a valid .xlsx file first.");
      return;
    }

    setIsWorkbookParsing(true);
    try {
      // Pure in-browser client-side parsing: zero remote server/Playwright dependency
      const parsed = await parseWorkbook(manualWorkbookFile);
      setActiveFundData(parsed);
      setActiveFundMode(manualFormatChoice);
      if (!fundStockInput.trim()) {
        const inferredName = manualWorkbookFile.name.replace(/\.[^/.]+$/, "").toUpperCase();
        setFundStockInput(inferredName);
      }
      setIsFundManualModalOpen(false);
      setIsFundViewerOpen(true);
    } catch (err) {
      console.error("Failed to parse financial workbook:", err);
      alert("❌ Could not parse the .xlsx workbook. Ensure it is a valid Screener financial template.");
    } finally {
      setIsWorkbookParsing(false);
    }
  };

  const handleExportPDF = () => {
    if (!activeFundData) return;
    try {
      exportToPDF(activeFundData, activeFundMode);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("❌ Failed to generate PDF export.");
    }
  };

  const handleExportExcel = () => {
    if (!activeFundData) return;
    try {
      exportToExcel(activeFundData);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("❌ Failed to generate Excel export.");
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              
              {/* ========================================================================= */}
              {/* FUNDAMENTAL ANALYSIS CONTROLS (POSITIONED IMMEDIATELY LEFT OF ALERT) */}
              {/* ========================================================================= */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#0b1329",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                }}
              >
                {/* Stock Input Field */}
                <input
                  type="text"
                  placeholder="STOCK NAME..."
                  value={fundStockInput}
                  onChange={(e) => setFundStockInput(e.target.value.toUpperCase())}
                  style={{
                    backgroundColor: "#070c18",
                    border: "1px solid #334155",
                    color: "#38bdf8",
                    padding: "6px 10px",
                    borderRadius: "5px",
                    fontSize: "11px",
                    fontWeight: "900",
                    width: "105px",
                    outline: "none",
                    letterSpacing: "0.5px",
                  }}
                />

                {/* Bank Mode Button */}
                <button
                  type="button"
                  onClick={() => handleOpenDirectMode("bank")}
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#f59e0b",
                    border: "1px solid #f59e0b",
                    padding: "6px 10px",
                    borderRadius: "5px",
                    fontWeight: "900",
                    fontSize: "11px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    transition: "all 0.15s ease",
                  }}
                >
                  🏦 Bank Mode
                </button>

                {/* Normal Mode Button */}
                <button
                  type="button"
                  onClick={() => handleOpenDirectMode("normal")}
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#10b981",
                    border: "1px solid #10b981",
                    padding: "6px 10px",
                    borderRadius: "5px",
                    fontWeight: "900",
                    fontSize: "11px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    transition: "all 0.15s ease",
                  }}
                >
                  🏢 Normal Mode
                </button>

                {/* Manual Mode Button */}
                <button
                  type="button"
                  onClick={handleOpenManualWorkbookDialog}
                  style={{
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "5px",
                    fontWeight: "900",
                    fontSize: "11px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    boxShadow: "0 0 8px rgba(2, 132, 199, 0.4)",
                    transition: "all 0.15s ease",
                  }}
                >
                  📂 Manual Mode
                </button>
              </div>

              {/* ALERT SETTING BUTTON */}
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

              {/* SCREENER SYNC BUTTON */}
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
            </div>
          </header>

          {/* ========================================================================= */}
          {/* MANUAL WORKBOOK LOCAL PARSE POPUP DIALOG */}
          {/* ========================================================================= */}
          {isFundManualModalOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999,
              }}
            >
              <div
                style={{
                  backgroundColor: "#0f172a",
                  border: "2px solid #06b6d4",
                  borderRadius: "12px",
                  padding: "24px",
                  maxWidth: "460px",
                  width: "90%",
                  boxShadow: "0 0 30px rgba(6, 182, 212, 0.35)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #1e293b", paddingBottom: "10px" }}>
                  <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "16px", fontWeight: "900", textTransform: "uppercase" }}>
                    📂 Manual Workbook Visualizer
                  </h3>
                  <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "bold", backgroundColor: "#064e3b", padding: "2px 8px", borderRadius: "4px" }}>
                    CLIENT SANDBOX
                  </span>
                </div>

                {/* Step 1: File Browser Field */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "#cbd5e1", fontWeight: "bold" }}>
                    1. Select .xlsx Workbook:
                  </label>
                  <input
                    ref={workbookFileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    style={{ display: "none" }}
                    onChange={(e) => setManualWorkbookFile(e.target.files?.[0] || null)}
                  />
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => workbookFileInputRef.current?.click()}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "#f59e0b",
                        color: "#000000",
                        border: "none",
                        borderRadius: "5px",
                        fontWeight: "900",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      📁 Browse .xlsx
                    </button>
                    <span style={{ fontSize: "12px", color: manualWorkbookFile ? "#10b981" : "#94a3b8", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {manualWorkbookFile ? manualWorkbookFile.name : "No file selected"}
                    </span>
                  </div>
                </div>

                {/* Step 2: Format Choice (Bank vs Normal) */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "#cbd5e1", fontWeight: "bold" }}>
                    2. Select Display Format:
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setManualFormatChoice("normal")}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "6px",
                        border: `2px solid ${manualFormatChoice === "normal" ? "#10b981" : "#334155"}`,
                        backgroundColor: manualFormatChoice === "normal" ? "#064e3b" : "#1e293b",
                        color: manualFormatChoice === "normal" ? "#34d399" : "#ffffff",
                        fontWeight: "900",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🏢 Normal Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualFormatChoice("bank")}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "6px",
                        border: `2px solid ${manualFormatChoice === "bank" ? "#f59e0b" : "#334155"}`,
                        backgroundColor: manualFormatChoice === "bank" ? "#78350f" : "#1e293b",
                        color: manualFormatChoice === "bank" ? "#fbbf24" : "#ffffff",
                        fontWeight: "900",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🏦 Bank Mode
                    </button>
                  </div>
                </div>

                {/* Dialog Actions: OK and Cancel */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFundManualModalOpen(false);
                      setManualWorkbookFile(null);
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#334155",
                      border: "none",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteManualWorkbook}
                    disabled={!manualWorkbookFile || isWorkbookParsing}
                    style={{
                      padding: "8px 22px",
                      borderRadius: "6px",
                      backgroundColor: manualWorkbookFile && !isWorkbookParsing ? "#10b981" : "#475569",
                      border: "none",
                      color: manualWorkbookFile && !isWorkbookParsing ? "#000000" : "#94a3b8",
                      fontWeight: "900",
                      cursor: manualWorkbookFile && !isWorkbookParsing ? "pointer" : "not-allowed",
                      fontSize: "12px",
                      boxShadow: manualWorkbookFile ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
                    }}
                  >
                    {isWorkbookParsing ? "Parsing..." : "OK"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FULL SCREEN FUNDAMENTAL STATEMENT VIEWER MODAL */}
          {/* ========================================================================= */}
          {isFundViewerOpen && activeFundData && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(3, 7, 18, 0.94)",
                backdropFilter: "blur(6px)",
                display: "flex",
                flexDirection: "column",
                zIndex: 99999,
                boxSizing: "border-box",
              }}
            >
              {/* Header Ribbon with Mode, Stock, and Export Options */}
              <div
                style={{
                  backgroundColor: "#070c18",
                  borderBottom: "2px solid #1e293b",
                  padding: "10px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>📊</span>
                  <div>
                    <h2 style={{ margin: 0, color: "#38bdf8", fontSize: "16px", fontWeight: "900", letterSpacing: "1px" }}>
                      {fundStockInput || "FINANCIAL STATEMENT ANALYSIS"}
                    </h2>
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold" }}>
                      ACTIVE FORMAT:{" "}
                      <span style={{ color: activeFundMode === "bank" ? "#f59e0b" : "#10b981" }}>
                        {activeFundMode === "bank" ? "BANKING FINANCIALS" : "NORMAL CORPORATE"}
                      </span>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {/* Format Switcher Pills */}
                  <button
                    onClick={() => setActiveFundMode("normal")}
                    style={{
                      backgroundColor: activeFundMode === "normal" ? "#10b981" : "#1e293b",
                      color: activeFundMode === "normal" ? "#000000" : "#94a3b8",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "5px",
                      fontWeight: "bold",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    🏢 Normal Mode
                  </button>
                  <button
                    onClick={() => setActiveFundMode("bank")}
                    style={{
                      backgroundColor: activeFundMode === "bank" ? "#f59e0b" : "#1e293b",
                      color: activeFundMode === "bank" ? "#000000" : "#94a3b8",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "5px",
                      fontWeight: "bold",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    🏦 Bank Mode
                  </button>

                  <div style={{ width: "1px", height: "18px", backgroundColor: "#334155", margin: "0 4px" }} />

                  {/* Export Excel */}
                  <button
                    onClick={handleExportExcel}
                    style={{
                      backgroundColor: "#10b981",
                      color: "#000000",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "5px",
                      fontWeight: "900",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    📥 Export Excel
                  </button>

                  {/* Export PDF */}
                  <button
                    onClick={handleExportPDF}
                    style={{
                      backgroundColor: "#f59e0b",
                      color: "#000000",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "5px",
                      fontWeight: "900",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    📄 Export PDF
                  </button>

                  {/* Close Viewer */}
                  <button
                    onClick={() => setIsFundViewerOpen(false)}
                    style={{
                      backgroundColor: "#334155",
                      color: "#f87171",
                      border: "1px solid #ef4444",
                      padding: "6px 12px",
                      borderRadius: "5px",
                      fontWeight: "900",
                      fontSize: "11px",
                      cursor: "pointer",
                      marginLeft: "6px",
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Scrollable Statements Workspace */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", backgroundColor: "#020617" }}>
                {activeFundMode === "bank" ? (
                  <BankDashboard data={activeFundData} />
                ) : (
                  <CompanyDashboard data={activeFundData} />
                )}
              </div>
            </div>
          )}

          {/* POPUP 1: SCREENER SYNC CONFIGURATION (AUTO / MAN & DB DATE) */}
          {isSyncModalOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  backgroundColor: "#0f172a",
                  border: "2px solid #38bdf8",
                  borderRadius: "10px",
                  padding: "24px",
                  maxWidth: "440px",
                  width: "90%",
                  boxShadow: "0 0 25px rgba(56, 189, 248, 0.35)",
                }}
              >
                <h3 style={{ margin: "0 0 18px 0", color: "#38bdf8", fontSize: "17px", fontWeight: "900", letterSpacing: "0.5px" }}>
                  🔄 SYNC SCREENER
                </h3>

                {/* 1. Mode Selection: AUTO / MAN (Mutually Exclusive) */}
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#cbd5e1", fontWeight: "bold" }}>
                    Select Sync Mode:
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setSyncMode("AUTO")}
                      style={{
                        flex: 1,
                        padding: "9px 14px",
                        borderRadius: "6px",
                        border: `2px solid ${syncMode === "AUTO" ? "#10b981" : "#334155"}`,
                        backgroundColor: syncMode === "AUTO" ? "#10b981" : "#1e293b",
                        color: syncMode === "AUTO" ? "#000000" : "#ffffff",
                        fontWeight: "900",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.15s ease-in-out",
                        boxShadow: syncMode === "AUTO" ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
                      }}
                    >
                      ⚡ AUTO
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncMode("MAN")}
                      style={{
                        flex: 1,
                        padding: "9px 14px",
                        borderRadius: "6px",
                        border: `2px solid ${syncMode === "MAN" ? "#38bdf8" : "#334155"}`,
                        backgroundColor: syncMode === "MAN" ? "#0284c7" : "#1e293b",
                        color: syncMode === "MAN" ? "#ffffff" : "#ffffff",
                        fontWeight: "900",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.15s ease-in-out",
                        boxShadow: syncMode === "MAN" ? "0 0 10px rgba(56, 189, 248, 0.4)" : "none",
                      }}
                    >
                      📁 MAN
                    </button>
                  </div>
                </div>

                {/* 2. DB Date Picker with Tooltip and 5-Day Range Lock */}
                <div style={{ marginBottom: "20px" }}>
                  <div
                    title="DB date => latest date of updated data of www.screener.in."
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                      cursor: "help",
                    }}
                  >
                    <label style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: "bold", cursor: "help" }}>
                      DB Date:
                    </label>
                    <span
                      style={{
                        fontSize: "11px",
                        backgroundColor: "#334155",
                        color: "#38bdf8",
                        borderRadius: "50%",
                        width: "16px",
                        height: "16px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "900",
                      }}
                    >
                      ?
                    </span>
                  </div>

                  <input
                    type="date"
                    value={databaseDate}
                    min={getFiveDaysAgoISO()}
                    max={getTodayISO()}
                    title="DB date => latest date of updated data of www.screener.in"
                    onChange={(e) => setDatabaseDate(e.target.value)}
                    style={{
                      backgroundColor: "#1e293b",
                      border: `1px solid ${isDateValid(databaseDate) ? "#10b981" : "#ef4444"}`,
                      color: "#38bdf8",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      width: "100%",
                      boxSizing: "border-box",
                      fontSize: "13px",
                      fontWeight: "bold",
                      outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                  {!isDateValid(databaseDate) && (
                    <span style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px", display: "block" }}>
                      ⚠️ Date must be current date or within last 5 days.
                    </span>
                  )}
                </div>

                {/* Action Buttons: Cancel and Ok */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px" }}>
                  <button
                    type="button"
                    onClick={handleAbortSync}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      backgroundColor: "#334155",
                      border: "none",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStep1Ok}
                    disabled={!isDateValid(databaseDate)}
                    style={{
                      padding: "8px 22px",
                      borderRadius: "6px",
                      backgroundColor: isDateValid(databaseDate) ? "#10b981" : "#475569",
                      border: "none",
                      color: isDateValid(databaseDate) ? "#000000" : "#94a3b8",
                      fontWeight: "900",
                      cursor: isDateValid(databaseDate) ? "pointer" : "not-allowed",
                      fontSize: "12px",
                      boxShadow: isDateValid(databaseDate) ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* POPUP 2: MANUAL FILE SELECTION (BROWSE FROM LOCAL DISK) */}
          {isManualModalOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  backgroundColor: "#0f172a",
                  border: "2px solid #38bdf8",
                  borderRadius: "10px",
                  padding: "24px",
                  maxWidth: "460px",
                  width: "90%",
                  boxShadow: "0 0 25px rgba(56, 189, 248, 0.35)",
                }}
              >
                <h3 style={{ margin: "0 0 16px 0", color: "#38bdf8", fontSize: "17px", fontWeight: "900" }}>
                  📁 BROWSE SCREENER CSV FILE
                </h3>

                <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px", fontWeight: "bold" }}>
                  Selected DB Date: <span style={{ color: "#10b981" }}>{databaseDate}</span>
                </p>

                {/* Local Disk Browser Input */}
                <div style={{ marginBottom: "20px" }}>
                  <input
                    ref={manualFileInputRef}
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />

                  <button
                    type="button"
                    onClick={() => manualFileInputRef.current?.click()}
                    style={{
                      padding: "9px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      border: "1px solid #38bdf8",
                      fontWeight: "bold",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    📂 Browse .CSV File
                  </button>

                  {selectedFile ? (
                    <div style={{ marginTop: "12px", padding: "8px 12px", backgroundColor: "#1e293b", borderRadius: "6px", border: "1px solid #334155" }}>
                      <div style={{ fontSize: "13px", color: "#10b981", fontWeight: "900", wordBreak: "break-all" }}>
                        Selected: {selectedFile.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        Size: {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "10px", fontWeight: "bold" }}>
                      ⚠️ No file chosen yet.
                    </div>
                  )}
                </div>

                {/* Action Buttons: Cancel and Ok */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    onClick={handleAbortSync}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      backgroundColor: "#334155",
                      border: "none",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleManualUploadConfirm}
                    disabled={!selectedFile}
                    style={{
                      padding: "8px 22px",
                      borderRadius: "6px",
                      backgroundColor: selectedFile ? "#10b981" : "#475569",
                      border: "none",
                      color: selectedFile ? "#000000" : "#94a3b8",
                      fontWeight: "900",
                      cursor: selectedFile ? "pointer" : "not-allowed",
                      fontSize: "12px",
                      boxShadow: selectedFile ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* APPLICATION ROUTES: Zero outer padding allows full-width rendering on mobile */}
          <main style={{ padding: 0, margin: 0, width: "100%" }}>
            <Routes>
              <Route path="/" element={<StockMonitorView />} />
              <Route path="/MarketHierarchy" element={<MarketHierarchy />} />
              <Route path="/Filter" element={<Filter />} />
              <Route path="/Advanced_Filter" element={<AdvancedFilter />} />
              <Route path="/Watchlist" element={<Watchlist />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* ALERT SYSTEM POPUP MODAL */}
          <AlertSystemModal
            isOpen={isAlertModalOpen}
            onClose={() => setIsAlertModalOpen(false)}
          />
        </div>
      </Router>
    </PinModalGuard>
  );
}