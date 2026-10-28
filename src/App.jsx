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
import { exportToPdf, exportToXlsx } from "./fundamentals/exportReports";

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
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [updateChoice, setUpdateChoice] = useState(""); // "Y" or "N"
  const [syncSource, setSyncSource] = useState("DRIVE"); // "DRIVE", "BROWSE", or "AUTO"
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  // =========================================================================
  // FUNDAMENTAL ACTIONS & HANDLERS
  // =========================================================================
  const handleOpenDirectMode = (mode) => {
    if (!fundStockInput.trim()) {
      alert("⚠️ Please enter a stock name first in the field.");
      return;
    }

    setActiveFundMode(mode);

    if (activeFundData) {
      setIsFundViewerOpen(true);
    } else {
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
      const isBank = activeFundMode === "bank";
      exportToPdf(activeFundData, "dashboard-report-area", isBank);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("❌ Failed to generate PDF export.");
    }
  };

  const handleExportExcel = () => {
    if (!activeFundData) return;
    try {
      const isBank = activeFundMode === "bank";
      exportToXlsx(activeFundData, isBank);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("❌ Failed to generate Excel export.");
    }
  };

  // Trigger Sync Execution
  const handleConfirmSync = async () => {
    if (!isFormValid || isScreenerSyncing) return;

    setIsSyncModalOpen(false);
    setIsScreenerSyncing(true);

    try {
      try {
        await update(ref(database, "system_status/screener_sync"), {
          "Date of database data": databaseDate,
          "sync_triggered_at": new Date().toISOString(),
          "sync_source": syncSource,
        });
      } catch (fbErr) {
        console.error("Firebase sync telemetry update error:", fbErr);
      }

      let response;

      if (syncSource === "AUTO") {
        response = await fetch(`${BACKEND_URL}/auto-sync-screener`, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ database_date: databaseDate }),
        });
      } else if (syncSource === "BROWSE" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("database_date", databaseDate);

        response = await fetch(`${BACKEND_URL}/sync-screener-upload`, {
          method: "POST",
          mode: "cors",
          body: formData,
        });
      } else {
        response = await fetch(`${BACKEND_URL}/sync-screener`, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ database_date: databaseDate }),
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              
              {/* ========================================================================= */}
              {/* FUNDAMENTAL ANALYSIS CONTROLS (PLACED IMMEDIATELY LEFT OF ALERT) */}
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
                  <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "15px", fontWeight: "900", textTransform: "uppercase" }}>
                    📂 Manual Workbook Visualizer
                  </h3>
                  <span style={{ fontSize: "11px", color: "#10b981", backgroundColor: "#064e3b", padding: "2px 8px", borderRadius: "4px", fontWeight: "900" }}>
                    CLIENT SANDBOX
                  </span>
                </div>

                {/* 1. File Browser */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "#cbd5e1", fontWeight: "bold" }}>
                    1. Select .xlsx Workbook:
                  </label>
                  <input
                    ref={workbookFileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && setManualWorkbookFile(e.target.files[0])}
                  />
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => workbookFileInputRef.current?.click()}
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "#000000",
                        border: "none",
                        padding: "8px 14px",
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

                {/* 2. Format Selector */}
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

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFundManualModalOpen(false);
                      setManualWorkbookFile(null);
                    }}
                    style={{
                      backgroundColor: "#334155",
                      color: "#f87171",
                      border: "1px solid #ef4444",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: "800",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteManualWorkbook}
                    disabled={!manualWorkbookFile || isWorkbookParsing}
                    style={{
                      backgroundColor: manualWorkbookFile && !isWorkbookParsing ? "#10b981" : "#475569",
                      color: manualWorkbookFile && !isWorkbookParsing ? "#000000" : "#94a3b8",
                      border: "none",
                      padding: "8px 22px",
                      borderRadius: "6px",
                      fontWeight: "900",
                      fontSize: "12px",
                      cursor: manualWorkbookFile && !isWorkbookParsing ? "pointer" : "not-allowed",
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
              {/* Header Ribbon */}
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

              {/* Scrollable Statement Body */}
              <div id="dashboard-report-area" style={{ flex: 1, overflowY: "auto", padding: "16px", backgroundColor: "#020617" }}>
                {activeFundMode === "bank" ? <BankDashboard data={activeFundData} /> : <CompanyDashboard data={activeFundData} />}
              </div>
            </div>
          )}

          {/* SCREENER SYNC CONFIGURATION MODAL */}
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
                  maxWidth: "500px",
                  width: "90%",
                  boxShadow: "0 0 25px rgba(56, 189, 248, 0.3)",
                }}
              >
                <h3 style={{ margin: "0 0 16px 0", color: "#38bdf8", fontSize: "18px" }}>
                  🔄 Sync Screener Database
                </h3>

                {/* Step 1: Confirmation */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: "#cbd5e1" }}>
                    Do you want to update screener data? (Y/N)
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setUpdateChoice("Y")}
                      style={{
                        padding: "6px 16px",
                        borderRadius: "5px",
                        border: "1px solid #10b981",
                        backgroundColor: updateChoice === "Y" ? "#10b981" : "#1e293b",
                        color: updateChoice === "Y" ? "#000000" : "#ffffff",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Y (Yes)
                    </button>
                    <button
                      onClick={() => {
                        setUpdateChoice("N");
                        handleAbortSync();
                      }}
                      style={{
                        padding: "6px 16px",
                        borderRadius: "5px",
                        border: "1px solid #ef4444",
                        backgroundColor: updateChoice === "N" ? "#ef4444" : "#1e293b",
                        color: updateChoice === "N" ? "#000000" : "#ffffff",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      N (Abort)
                    </button>
                  </div>
                </div>

                {updateChoice === "Y" && (
                  <>
                    {/* Step 2: Date Selection */}
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: "#cbd5e1" }}>
                        Database Data Date (Max 5 days past, no future):
                      </label>
                      <input
                        type="date"
                        value={databaseDate}
                        max={getTodayISO()}
                        onChange={(e) => setDatabaseDate(e.target.value)}
                        style={{
                          backgroundColor: "#1e293b",
                          border: `1px solid ${isDateValid(databaseDate) ? "#10b981" : "#ef4444"}`,
                          color: "#ffffff",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      {!isDateValid(databaseDate) && (
                        <span style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px", display: "block" }}>
                          ⚠️ Date must be within the last 5 days.
                        </span>
                      )}
                    </div>

                    {/* Step 3: Source Selection */}
                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: "#cbd5e1" }}>
                        Data Source:
                      </label>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {[
                          { id: "DRIVE", label: "☁️ Google Drive" },
                          { id: "BROWSE", label: "📁 Browse File" },
                          { id: "AUTO", label: "⚡ Auto Screener" },
                        ].map((source) => (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => {
                              setSyncSource(source.id);
                              if (source.id !== "BROWSE") setSelectedFile(null);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "5px",
                              border: `1px solid ${syncSource === source.id ? "#38bdf8" : "#334155"}`,
                              backgroundColor: syncSource === source.id ? "#0284c7" : "#1e293b",
                              color: "#ffffff",
                              fontSize: "12px",
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                          >
                            {source.label}
                          </button>
                        ))}
                      </div>

                      {/* File Browse Picker */}
                      {syncSource === "BROWSE" && (
                        <div style={{ marginTop: "12px" }}>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            style={{ fontSize: "12px", color: "#94a3b8" }}
                          />
                          {selectedFile && (
                            <div style={{ fontSize: "11px", color: "#10b981", marginTop: "4px" }}>
                              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Modal Footer Controls */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button
                    onClick={handleAbortSync}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#334155",
                      border: "none",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSync}
                    disabled={!isFormValid}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      backgroundColor: isFormValid ? "#10b981" : "#475569",
                      border: "none",
                      color: isFormValid ? "#000000" : "#94a3b8",
                      fontWeight: "bold",
                      cursor: isFormValid ? "pointer" : "not-allowed",
                      fontSize: "12px",
                    }}
                  >
                    Confirm & Run
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