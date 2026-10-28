import React, { useState, useRef } from "react";
import { parseWorkbook } from "./parseWorkbook";

export default function ManualModeModal({ isOpen, onClose, onDataLoaded }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [displayMode, setDisplayMode] = useState("normal"); // "normal" or "bank"
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedFile) {
      alert("Please select a valid .xlsx file first.");
      return;
    }

    setIsLoading(true);
    try {
      // Parse file purely in client-side memory
      const parsed = await parseWorkbook(selectedFile);
      onDataLoaded(parsed, displayMode, selectedFile.name.replace(/\.[^/.]+$/, ""));
      onClose();
    } catch (err) {
      console.error("Failed to parse financial workbook:", err);
      alert("Could not parse the workbook. Please ensure it matches the Screener Excel template structure.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
        zIndex: 99999,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "2px solid #06b6d4",
          boxShadow: "0 0 30px rgba(6, 182, 212, 0.3), 0 20px 40px rgba(0,0,0,0.8)",
          borderRadius: "14px",
          padding: "24px",
          width: "460px",
          maxWidth: "100%",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📂</span>
            <span style={{ color: "#38bdf8", fontWeight: "900", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase" }}>
              Manual Statement Visualizer
            </span>
          </div>
          <span
            style={{
              backgroundColor: "#1e293b",
              color: "#38bdf8",
              padding: "2px 8px",
              borderRadius: "4px",
              border: "1px solid #0284c7",
              fontSize: "11px",
              fontWeight: "900",
            }}
          >
            LOCAL SANDBOX
          </span>
        </div>

        {/* 1. File Picker */}
        <div style={{ backgroundColor: "#1e293b", padding: "14px", borderRadius: "8px", border: "1px solid #334155" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0", display: "block", marginBottom: "8px" }}>
            1. Select Screener Financial Workbook (.xlsx):
          </span>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
              }
            }}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                backgroundColor: "#f59e0b",
                color: "#000000",
                border: "none",
                padding: "8px 14px",
                borderRadius: "6px",
                fontWeight: "900",
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              📁 BROWSE .XLSX
            </button>
            <span
              style={{
                fontSize: "12px",
                color: selectedFile ? "#10b981" : "#94a3b8",
                fontWeight: "bold",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedFile ? `✓ ${selectedFile.name}` : "No file selected"}
            </span>
          </div>
        </div>

        {/* 2. Format Selection (Normal vs Bank) */}
        <div style={{ backgroundColor: "#1e293b", padding: "14px", borderRadius: "8px", border: "1px solid #334155" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0", display: "block", marginBottom: "8px" }}>
            2. Choose Display Format:
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setDisplayMode("normal")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontWeight: "900",
                fontSize: "12px",
                cursor: "pointer",
                backgroundColor: displayMode === "normal" ? "#06b6d4" : "#334155",
                color: displayMode === "normal" ? "#000000" : "#ffffff",
              }}
            >
              🏢 NORMAL MODE
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("bank")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontWeight: "900",
                fontSize: "12px",
                cursor: "pointer",
                backgroundColor: displayMode === "bank" ? "#f59e0b" : "#334155",
                color: displayMode === "bank" ? "#000000" : "#ffffff",
              }}
            >
              🏦 BANK MODE
            </button>
          </div>
        </div>

        {/* Modal Buttons: Cancel and Ok */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
          <button
            type="button"
            onClick={onClose}
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
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !selectedFile}
            style={{
              backgroundColor: isLoading || !selectedFile ? "#334155" : "#10b981",
              color: isLoading || !selectedFile ? "#94a3b8" : "#000000",
              border: "none",
              padding: "8px 20px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: isLoading || !selectedFile ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "PARSING..." : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}