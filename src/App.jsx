import React from "react";
import PinModalGuard from "./PinModalGuard";
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

export default function App() {
  const [isScreenerSyncing, setIsScreenerSyncing] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Modal State for Screener Sync
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [updateChoice, setUpdateChoice] = useState(""); // "Y" or "N"
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

  // Valid when choice is "Y", a CSV file is picked, and date is within 5 days
  const isFormValid = updateChoice === "Y" && isDateValid(databaseDate) && selectedFile !== null;

  // Open modal handler
  const handleOpenSyncModal = () => {
    if (isScreenerSyncing) return;
    setUpdateChoice("");
    setSelectedFile(null);
    setDatabaseDate(getTodayISO());
    setIsSyncModalOpen(true);
  };

  const handleAbortSync = () => {
    setIsSyncModalOpen(false);
    setUpdateChoice("");
    setSelectedFile(null);
  };

  // Submit and Trigger Sync
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
          "sync_source": "BROWSE_FILE"
        });
      } catch (fbErr) {
        console.error("Firebase sync telemetry update error:", fbErr);
      }

      // 2. Upload file directly to backend
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("database_date", databaseDate);

      const response = await fetch(`${BACKEND_URL}/sync-screener-upload`, {
        method: "POST",
        mode: "cors",
        body: formData
      });

      if (response && response.ok) {
        alert(`🚀 Screener file uploaded successfully!\nDatabase date recorded: ${databaseDate}`);
      } else {
        alert(`⚠️ Backend responded with status: ${response ? response.status : "unknown"}`);
      }
    } catch (err) {
      console.error("Failed to trigger screener pipeline:", err);
      alert("❌ Could not connect to Render backend. Check Render server status.");
    } finally {
      setTimeout(() => {
        setIsScreenerSyncing(false);
        setSelectedFile(null);
      }, 120000); // 2-minute cooldown
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
          </div>
        </header>

        {/* ALERT SETTING CUSTOM POPUP */}
        <AlertSystemModal
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
        />

        {/* SCREENER SYNC MODAL */}
        {isSyncModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(3, 7, 18, 0.85)",
              backdropFilter: "blur(4px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#0f172a",
                border: "2px solid #06b6d4",
                boxShadow: "0 0 30px rgba(6, 182, 212, 0.3), 0 20px 40px rgba(0,0,0,0.8)",
                borderRadius: "14px",
                padding: "26px",
                width: "500px",
                maxWidth: "100%",
                color: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #1e293b",
                  paddingBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>⚡</span>
                  <span style={{ color: "#38bdf8", fontWeight: "900", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Screener Database Sync
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#f59e0b",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid #f59e0b",
                    fontSize: "11px",
                    fontWeight: "900",
                  }}
                >
                  AUDIT CHECK
                </span>
              </div>

              {/* Step 1: Confirmation */}
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "14px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid #334155",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#e2e8f0" }}>
                  1. Do you like to update screener database?
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["Y", "N"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setUpdateChoice(opt)}
                      style={{
                        width: "36px",
                        height: "32px",
                        fontWeight: "900",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: updateChoice === opt ? (opt === "Y" ? "#10b981" : "#ef4444") : "#334155",
                        color: updateChoice === opt ? "#000000" : "#ffffff",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Choose File Directly (Enhanced Font Size & File Status) */}
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "14px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  border: "1px solid #334155",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#e2e8f0" }}>
                  2. Choose Screener .csv file:
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    style={{
                      backgroundColor: "#CD5C5C",
                      color: "#000000",
                      border: "none",
                      padding: "8px 15px",
                      borderRadius: "6px",
                      fontWeight: "850",
                      fontSize: "12px",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      boxShadow: "0 0 12px rgba(245, 158, 11, 0.4)",
                      whiteSpace: "nowrap"
                    }}
                  >
                    📂 Browse .CSV
                  </button>
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: "#0f172a",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${selectedFile ? "#10b981" : "#334155"}`,
                      display: "flex",
                      alignItems: "center",
                      minWidth: 0
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: selectedFile ? "#10b981" : "#94a3b8",
                        fontWeight: "800",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {selectedFile ? `✓ ${selectedFile.name}` : "No file chosen"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Date Picker (High Visibility Date & Calendar Icon) */}
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "14px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  border: "1px solid #334155",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#e2e8f0" }}>
                    3. Date of Data of your new database:
                  </span>
                  <span style={{ fontSize: "11px", color: isDateValid(databaseDate) ? "#10b981" : "#f87171", fontWeight: "bold" }}>
                    {isDateValid(databaseDate) ? "✓ Valid (≤ 5 days)" : "✗ Must be ≤ 5 days old"}
                  </span>
                </div>

                <input
                  type="date"
                  value={databaseDate}
                  onChange={(e) => setDatabaseDate(e.target.value)}
                  style={{
                    backgroundColor: "#0f172a",
                    border: `2px solid ${isDateValid(databaseDate) ? "#06b6d4" : "#ef4444"}`,
                    color: "#38bdf8",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "15px",
                    fontWeight: "900",
                    outline: "none",
                    cursor: "pointer",
                    colorScheme: "dark", // Ensures native browser calendar button renders bright and clearly visible
                    boxShadow: isDateValid(databaseDate) ? "0 0 12px rgba(6, 182, 212, 0.25)" : "none",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  borderTop: "1px solid #1e293b",
                  paddingTop: "14px",
                }}
              >
                <button
                  type="button"
                  onClick={handleAbortSync}
                  style={{
                    backgroundColor: "#334155",
                    color: "#f87171",
                    border: "1px solid #ef4444",
                    padding: "9px 18px",
                    borderRadius: "6px",
                    fontWeight: "800",
                    fontSize: "12px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  CANCEL
                </button>

                {isFormValid && (
                  <button
                    type="button"
                    onClick={handleConfirmSync}
                    style={{
                      backgroundColor: "#10b981",
                      color: "#000000",
                      border: "none",
                      padding: "9px 24px",
                      borderRadius: "6px",
                      fontWeight: "900",
                      fontSize: "12px",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      boxShadow: "0 0 15px rgba(16, 185, 129, 0.5)",
                    }}
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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

export default function App() {
  return (
    <PinModalGuard>
      {/* Your complete app views and routes stay here */}
      {/* Nothing inside here will be rendered until the PIN is matched */}
    </PinModalGuard>
  );
}