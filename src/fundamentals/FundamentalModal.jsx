import React from "react";
import CompanyDashboard from "./CompanyDashboard";
import BankDashboard from "./BankDashboard";
import { exportToPDF, exportToExcel } from "./exportReports";

export default function FundamentalModal({ isOpen, onClose, data, mode, stockName }) {
  if (!isOpen || !data) return null;

  const handleExportPDF = () => {
    try {
      exportToPDF(data, mode);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("Failed to export PDF.");
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(data);
    } catch (e) {
      console.error("Excel export failed:", e);
      alert("Failed to export Excel.");
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
        backgroundColor: "rgba(3, 7, 18, 0.92)",
        backdropFilter: "blur(6px)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Top Header Ribbon of the Statement Viewer */}
      <div
        style={{
          backgroundColor: "#0b0f19",
          borderBottom: "2px solid #1e293b",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>📊</span>
          <div>
            <h2
              style={{
                margin: 0,
                color: "#38bdf8",
                fontSize: "16px",
                fontWeight: "900",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              {stockName || "FINANCIAL STATEMENTS"}
            </h2>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold" }}>
              FORMAT: <span style={{ color: mode === "bank" ? "#f59e0b" : "#10b981" }}>
                {mode === "bank" ? "BANKING MODE" : "NORMAL CORPORATE MODE"}
              </span>
            </span>
          </div>
        </div>

        {/* Action Buttons: Excel Export, PDF Export, and Close */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handleExportExcel}
            style={{
              backgroundColor: "#10b981",
              color: "#000000",
              border: "none",
              padding: "7px 14px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            📥 EXCEL
          </button>

          <button
            onClick={handleExportPDF}
            style={{
              backgroundColor: "#f59e0b",
              color: "#000000",
              border: "none",
              padding: "7px 14px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            📄 PDF
          </button>

          <button
            onClick={onClose}
            style={{
              backgroundColor: "#334155",
              color: "#f87171",
              border: "1px solid #ef4444",
              padding: "7px 14px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: "pointer",
              marginLeft: "10px",
            }}
          >
            ✕ CLOSE
          </button>
        </div>
      </div>

      {/* Scrollable Statement Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", backgroundColor: "#020617" }}>
        {mode === "bank" ? (
          <BankDashboard data={data} />
        ) : (
          <CompanyDashboard data={data} />
        )}
      </div>
    </div>
  );
}