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

// NavLink style helper
const getLinkStyle = ({ isActive }) => ({
  backgroundColor: isActive ? "#06b6d4" : "#1e293b",
  color: isActive ? "#000000" : "#94a3b8",
  border: `1px solid ${isActive ? "#06b6d4" : "#334155"}`,
  padding: "7px 14px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "bold",
  fontSize: "12px",
  letterSpacing: "0.5px",
  transition: "all 0.2s ease-in-out",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px"
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
            </div>
          </header>

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

          {/* VIEW ROUTING */}
          <main style={{ padding: "10px" }}>
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