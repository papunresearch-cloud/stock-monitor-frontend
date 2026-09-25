import React, { useState, useEffect } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "./firebase";

export default function AlertSystemModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Alert State Stores
  const [masterDisable, setMasterDisable] = useState(false);
  const [stocksList, setStocksList] = useState([]);
  const [stockControls, setStockControls] = useState({});

  // Telegram Contact IDs State
  const [telegramList, setTelegramList] = useState([]);
  const [newTelegramId, setNewTelegramId] = useState("");
  const [editingTgId, setEditingTgId] = useState(null);
  const [editingTgText, setEditingTgText] = useState("");

  // Confirmation Audit Modal State (N - Y - N)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAnswers, setConfirmAnswers] = useState({ q1: "", q2: "", q3: "" });

  // --------------------------------------------------------------------------
  // 1. DATA INITIALIZATION
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const loadAlertConfiguration = async () => {
      setLoading(true);
      try {
        const wlSnap = await get(ref(database, "watchlist/watchlist"));
        let fetchedStocks = [];
        if (wlSnap.exists()) {
          const raw = wlSnap.val();
          fetchedStocks = (Array.isArray(raw) ? raw : Object.values(raw))
            .map((item) => (typeof item === "string" ? item.trim() : item?.CODE || item?.Name || ""))
            .filter(Boolean);
        }
        setStocksList(fetchedStocks);

        const alertsSnap = await get(ref(database, "alerts"));
        const alertsData = alertsSnap.exists() ? alertsSnap.val() : {};

        setMasterDisable(Boolean(alertsData.master_disable));

        const savedStockControls = alertsData.stock_controls || {};
        const mergedControls = {};
        fetchedStocks.forEach((stk) => {
          mergedControls[stk] = savedStockControls[stk]?.enabled !== undefined ? savedStockControls[stk].enabled : true;
        });
        setStockControls(mergedControls);

        // Read contacts under alerts/whatsapp (used for Telegram chat IDs)
        const rawContacts = alertsData.whatsapp || {};
        const parsedTg = Object.entries(rawContacts).map(([id, val]) => ({
          id,
          phone: typeof val === "string" ? val : val.phone,
          enabled: val.enabled !== undefined ? val.enabled : true,
        }));
        setTelegramList(parsedTg);
      } catch (err) {
        console.error("Alert config load error:", err);
        alert(`Failed to load alert configuration: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadAlertConfiguration();
  }, [isOpen]);

  // --------------------------------------------------------------------------
  // 2. HANDLERS: STOCKS
  // --------------------------------------------------------------------------
  const handleSetAllStocks = (enableStatus) => {
    const updated = {};
    stocksList.forEach((stk) => {
      updated[stk] = enableStatus;
    });
    setStockControls(updated);
  };

  const handleToggleStock = (stk) => {
    setStockControls((prev) => ({
      ...prev,
      [stk]: !prev[stk],
    }));
  };

  // --------------------------------------------------------------------------
  // 3. HANDLERS: TELEGRAM CONTACTS
  // --------------------------------------------------------------------------
  const handleAddTelegram = () => {
    const rawId = newTelegramId.trim();

    if (!rawId) {
      alert("❌ Please enter a Telegram Chat ID!");
      return;
    }

    if (!/^\d+$/.test(rawId)) {
      alert("❌ Invalid Telegram Chat ID! It must contain only numeric digits (e.g. 8852677941).");
      return;
    }

    const isDuplicate = telegramList.some((item) => item.phone === rawId);
    if (isDuplicate) {
      alert(`⚠️ Telegram Chat ID ${rawId} is already in the list!`);
      return;
    }

    const newEntry = {
      id: `tg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      phone: rawId,
      enabled: true,
    };
    setTelegramList((prev) => [...prev, newEntry]);
    setNewTelegramId("");
  };

  const handleDeleteTelegram = (id) => {
    setTelegramList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleTelegram = (id) => {
    setTelegramList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleSaveEditTelegram = (id) => {
    const rawId = editingTgText.trim();
    if (!rawId || !/^\d+$/.test(rawId)) {
      alert("❌ Invalid Telegram Chat ID! It must contain only numeric digits.");
      return;
    }
    setTelegramList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, phone: rawId } : item))
    );
    setEditingTgId(null);
    setEditingTgText("");
  };

  // --------------------------------------------------------------------------
  // 4. SAVE & PRE-COMMIT AUDIT (N - Y - N)
  // --------------------------------------------------------------------------
  const handleInitiateSave = () => {
    setConfirmAnswers({ q1: "", q2: "", q3: "" });
    setShowConfirmModal(true);
  };

  const handleFinalConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    try {
      const formattedStockControls = {};
      Object.entries(stockControls).forEach(([stk, isEnabled]) => {
        formattedStockControls[stk] = { enabled: Boolean(isEnabled) };
      });

      const formattedContacts = {};
      telegramList.forEach((item) => {
        formattedContacts[item.id] = { phone: item.phone, enabled: Boolean(item.enabled) };
      });

      const updates = {};
      updates["alerts/master_disable"] = Boolean(masterDisable);
      updates["alerts/stock_controls"] = formattedStockControls;
      updates["alerts/whatsapp"] = formattedContacts;
      updates["alerts/emails"] = null; // Cleanly purges deprecated emails node
      updates["alerts/last_settings_update"] = new Date().toISOString();

      await update(ref(database), updates);

      alert("✅ Alert settings successfully saved to Firebase!");
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: "16px",
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#070d18",
          border: "2px solid #0284c7",
          boxShadow: "0 0 45px rgba(2, 132, 199, 0.35), 0 25px 60px rgba(0,0,0,0.95)",
          borderRadius: "16px",
          width: "840px",
          maxWidth: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          color: "#f8fafc",
          overflow: "hidden",
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "16px 22px",
            background: "linear-gradient(135deg, #1e1b4b 0%, #0c1527 100%)",
            borderBottom: "2px solid #1e293b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "26px", filter: "drop-shadow(0 0 8px #38bdf8)" }}>✈️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#38bdf8", letterSpacing: "1px", textTransform: "uppercase" }}>
                STOCK MONITOR ALERT CONTROL CENTER
              </h2>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Auto-resets memory at midnight (00:00 IST) • 1 Alert per stock in 24 Hours
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#1e293b",
              border: "1px solid #475569",
              color: "#f87171",
              fontSize: "16px",
              fontWeight: "900",
              cursor: "pointer",
              borderRadius: "6px",
              padding: "4px 10px",
            }}
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div style={{ overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* SECTION 1: MASTER KILL SWITCH */}
          <div
            style={{
              background: masterDisable
                ? "linear-gradient(135deg, rgba(136, 19, 55, 0.35) 0%, rgba(15, 23, 42, 0.6) 100%)"
                : "linear-gradient(135deg, rgba(6, 78, 59, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)",
              border: `2px solid ${masterDisable ? "#f43f5e" : "#10b981"}`,
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              boxShadow: masterDisable ? "0 0 15px rgba(244, 63, 94, 0.2)" : "0 0 15px rgba(16, 185, 129, 0.2)",
            }}
          >
            <div>
              <div style={{ fontWeight: "900", fontSize: "14px", color: masterDisable ? "#fecdd3" : "#a7f3d0", letterSpacing: "0.5px" }}>
                MASTER DISPATCH SWITCH: {masterDisable ? "ALL ALERTS DISABLED ⛔" : "ALL ALERTS ARMED & ACTIVE 🟢"}
              </div>
              <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "3px" }}>
                Global circuit breaker. Overrides all stock triggers and Telegram alerts without altering settings.
              </div>
            </div>

            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "900", fontSize: "12px", color: "#10b981" }}>
                <input
                  type="radio"
                  name="master_switch"
                  checked={!masterDisable}
                  onChange={() => setMasterDisable(false)}
                  style={{ accentColor: "#10b981", transform: "scale(1.25)", cursor: "pointer" }}
                />
                ENABLE ALL
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "900", fontSize: "12px", color: "#f43f5e" }}>
                <input
                  type="radio"
                  name="master_switch"
                  checked={masterDisable}
                  onChange={() => setMasterDisable(true)}
                  style={{ accentColor: "#f43f5e", transform: "scale(1.25)", cursor: "pointer" }}
                />
                DISABLE ALL
              </label>
            </div>
          </div>

          {/* SECTION 2: WATCHLIST STOCK DISPATCH CONTROLS */}
          <div
            style={{
              background: "linear-gradient(180deg, #0e172a 0%, #070e1c 100%)",
              border: "1px solid #1d4ed8",
              borderRadius: "12px",
              padding: "16px 18px",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{ color: "#38bdf8", fontWeight: "900", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  WATCHLIST STOCKS ({stocksList.length} TOTAL from /watchlist/watchlist)
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "2px" }}>
                  Toggle individual stock triggers to silence specific symbols from notifying
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleSetAllStocks(true)}
                  style={{ backgroundColor: "#065f46", color: "#a7f3d0", border: "1px solid #10b981", padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "900", cursor: "pointer" }}
                >
                  ENABLE ALL
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllStocks(false)}
                  style={{ backgroundColor: "#881337", color: "#fecdd3", border: "1px solid #f43f5e", padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "900", cursor: "pointer" }}
                >
                  DISABLE ALL
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ color: "#38bdf8", fontSize: "12px", padding: "14px", textAlign: "center" }}>⏳ Loading Watchlist stocks...</div>
            ) : stocksList.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "12px", padding: "14px", textAlign: "center" }}>No stocks found under /watchlist/watchlist.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: "8px", maxHeight: "175px", overflowY: "auto", paddingRight: "4px" }}>
                {stocksList.map((stk) => {
                  const isEnabled = stockControls[stk] !== false;
                  return (
                    <div
                      key={stk}
                      onClick={() => handleToggleStock(stk)}
                      style={{
                        backgroundColor: isEnabled ? "#172554" : "#0f172a",
                        border: `1px solid ${isEnabled ? "#0284c7" : "#334155"}`,
                        padding: "7px 12px",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: "bold", color: isEnabled ? "#ffffff" : "#64748b" }}>
                        {stk}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "900",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          backgroundColor: isEnabled ? "#059669" : "#334155",
                          color: "#ffffff",
                        }}
                      >
                        {isEnabled ? "ACTIVE" : "MUTED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: TELEGRAM CONTACTS */}
          <div
            style={{
              background: "linear-gradient(180deg, #071727 0%, #030d17 100%)",
              border: "1px solid #0284c7",
              borderRadius: "12px",
              padding: "16px 18px",
              boxShadow: "0 0 20px rgba(2, 132, 199, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#38bdf8", fontWeight: "900", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  TELEGRAM CONTACTS ({telegramList.length})
                </span>
                <span style={{ fontSize: "11px", backgroundColor: "#0c2844", color: "#38bdf8", padding: "2px 8px", borderRadius: "10px", border: "1px solid #0369a1" }}>
                  Official Telegram Bot
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
              <input
                type="text"
                placeholder="Enter Telegram Chat ID (e.g. 8852677941)..."
                maxLength={20}
                value={newTelegramId}
                onChange={(e) => setNewTelegramId(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: "#07111e",
                  border: "1px solid #0369a1",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleAddTelegram}
                style={{
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: "6px",
                  fontWeight: "900",
                  fontSize: "12px",
                  cursor: "pointer",
                  boxShadow: "0 0 10px rgba(2, 132, 199, 0.4)",
                }}
              >
                ➕ ADD CONTACT
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "7px", maxHeight: "140px", overflowY: "auto", paddingRight: "4px" }}>
              {telegramList.length === 0 ? (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>No Telegram Chat IDs configured yet.</span>
              ) : (
                telegramList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: "#071220",
                      border: "1px solid #1e3a5f",
                      padding: "7px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {editingTgId === item.id ? (
                      <input
                        type="text"
                        value={editingTgText}
                        maxLength={20}
                        onChange={(e) => setEditingTgText(e.target.value)}
                        style={{ backgroundColor: "#0c1f36", color: "#38bdf8", border: "1px solid #0284c7", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", outline: "none", width: "200px" }}
                      />
                    ) : (
                      <span style={{ fontSize: "12px", color: item.enabled ? "#ffffff" : "#64748b", textDecoration: item.enabled ? "none" : "line-through" }}>
                        ✈️ Chat ID: <b style={{ color: item.enabled ? "#38bdf8" : "#64748b" }}>{item.phone}</b>
                      </span>
                    )}

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: item.enabled ? "#10b981" : "#f87171", cursor: "pointer", fontWeight: "bold" }}>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => handleToggleTelegram(item.id)}
                          style={{ accentColor: "#10b981", cursor: "pointer" }}
                        />
                        {item.enabled ? "ON" : "OFF"}
                      </label>

                      {editingTgId === item.id ? (
                        <button type="button" onClick={() => handleSaveEditTelegram(item.id)} style={{ backgroundColor: "#10b981", color: "#000", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>OK</button>
                      ) : (
                        <button type="button" onClick={() => { setEditingTgId(item.id); setEditingTgText(item.phone); }} style={{ backgroundColor: "#1e293b", color: "#f59e0b", border: "1px solid #334155", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>✏️</button>
                      )}

                      <button type="button" onClick={() => handleDeleteTelegram(item.id)} style={{ backgroundColor: "#1e293b", color: "#ef4444", border: "1px solid #334155", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "14px 22px",
            backgroundColor: "#050912",
            borderTop: "2px solid #1e293b",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: "#1e293b",
              color: "#cbd5e1",
              border: "1px solid #475569",
              padding: "9px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            DISCARD
          </button>

          <button
            type="button"
            onClick={handleInitiateSave}
            disabled={saving}
            style={{
              backgroundColor: "#0284c7",
              color: "#ffffff",
              border: "none",
              padding: "9px 26px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 0 15px rgba(2, 132, 199, 0.4)",
            }}
          >
            {saving ? "SAVING..." : "💾 SAVE ALERT CONFIGURATION"}
          </button>
        </div>
      </div>

      {/* 3-QUESTION AUDIT VERIFICATION MODAL (N - Y - N) */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              backgroundColor: "#0f172a",
              border: "2px solid #f59e0b",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              color: "#f8fafc",
              boxShadow: "0 10px 40px rgba(0,0,0,0.85)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #334155",
                paddingBottom: "10px",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: "900", color: "#f59e0b", textTransform: "uppercase" }}>
                ⚠️ PRE-COMMIT AUDIT VERIFICATION
              </span>
              <span
                style={{
                  fontSize: "11px",
                  backgroundColor: "#1e293b",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: "1px solid #f59e0b",
                  color: "#f59e0b",
                  fontWeight: "900",
                }}
              >
                SECURITY CHECK
              </span>
            </div>

            <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#cbd5e1" }}>
              Please answer the confirmation sequence before writing alert changes to Firebase.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", marginBottom: "22px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#1e293b",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                }}
              >
                <span>1. Don't you want to save?</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["Y", "N"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setConfirmAnswers({ ...confirmAnswers, q1: opt })}
                      style={{
                        width: "34px",
                        height: "28px",
                        fontWeight: "900",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: confirmAnswers.q1 === opt ? (opt === "N" ? "#10b981" : "#ef4444") : "#334155",
                        color: confirmAnswers.q1 === opt ? "#000" : "#fff",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#1e293b",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                }}
              >
                <span>2. Have you checked all the information?</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["Y", "N"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setConfirmAnswers({ ...confirmAnswers, q2: opt })}
                      style={{
                        width: "34px",
                        height: "28px",
                        fontWeight: "900",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: confirmAnswers.q2 === opt ? (opt === "Y" ? "#10b981" : "#ef4444") : "#334155",
                        color: confirmAnswers.q2 === opt ? "#000" : "#fff",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#1e293b",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                }}
              >
                <span>3. Data you want to save are incorrect?</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["Y", "N"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setConfirmAnswers({ ...confirmAnswers, q3: opt })}
                      style={{
                        width: "34px",
                        height: "28px",
                        fontWeight: "900",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: confirmAnswers.q3 === opt ? (opt === "N" ? "#10b981" : "#ef4444") : "#334155",
                        color: confirmAnswers.q3 === opt ? "#000" : "#fff",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid #334155", paddingTop: "14px" }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  backgroundColor: "#475569",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                CANCEL
              </button>

              {confirmAnswers.q1 === "N" && confirmAnswers.q2 === "Y" && confirmAnswers.q3 === "N" && (
                <button
                  type="button"
                  onClick={handleFinalConfirmSave}
                  style={{
                    backgroundColor: "#10b981",
                    color: "#000000",
                    border: "none",
                    padding: "8px 24px",
                    borderRadius: "6px",
                    fontWeight: "900",
                    fontSize: "12px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}