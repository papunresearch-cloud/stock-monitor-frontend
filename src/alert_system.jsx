import React, { useState, useEffect } from "react";
import { ref, get, set, update, remove } from "firebase/database";
import { database } from "./firebase";

export default function AlertSystemModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Alert State Stores
  const [masterDisable, setMasterDisable] = useState(false);
  const [stocksList, setStocksList] = useState([]);
  const [stockControls, setStockControls] = useState({}); // { [stock]: true/false }

  const [emailList, setEmailList] = useState([]); // [{ id, email, enabled }]
  const [newEmail, setNewEmail] = useState("");
  const [editingEmailId, setEditingEmailId] = useState(null);
  const [editingEmailText, setEditingEmailText] = useState("");

  const [whatsappList, setWhatsappList] = useState([]); // [{ id, phone, enabled }]
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [editingWaId, setEditingWaId] = useState(null);
  const [editingWaText, setEditingWaText] = useState("");

  const [banner, setBanner] = useState({ text: "", type: "info" });

  useEffect(() => {
    if (!isOpen) return;

    const loadAlertConfiguration = async () => {
      setLoading(true);
      try {
        // 1. Fetch current watchlist stocks
        const wlSnap = await get(ref(database, "watchlist/watchlist"));
        let fetchedStocks = [];
        if (wlSnap.exists()) {
          const raw = wlSnap.val();
          fetchedStocks = (Array.isArray(raw) ? raw : Object.values(raw))
            .map((item) => (typeof item === "string" ? item.trim() : item?.CODE || item?.Name || ""))
            .filter(Boolean);
        }
        setStocksList(fetchedStocks);

        // 2. Fetch /alerts root configuration
        const alertsSnap = await get(ref(database, "alerts"));
        const alertsData = alertsSnap.exists() ? alertsSnap.val() : {};

        // Master switch
        setMasterDisable(Boolean(alertsData.master_disable));

        // Stock controls
        const savedStockControls = alertsData.stock_controls || {};
        const mergedControls = {};
        fetchedStocks.forEach((stk) => {
          // Default to enabled (true) if undefined
          mergedControls[stk] = savedStockControls[stk]?.enabled !== undefined ? savedStockControls[stk].enabled : true;
        });
        setStockControls(mergedControls);

        // Emails list
        const rawEmails = alertsData.emails || {};
        const parsedEmails = Object.entries(rawEmails).map(([id, val]) => ({
          id,
          email: typeof val === "string" ? val : val.email,
          enabled: val.enabled !== undefined ? val.enabled : true,
        }));
        setEmailList(parsedEmails);

        // WhatsApp list
        const rawWa = alertsData.whatsapp || {};
        const parsedWa = Object.entries(rawWa).map(([id, val]) => ({
          id,
          phone: typeof val === "string" ? val : val.phone,
          enabled: val.enabled !== undefined ? val.enabled : true,
        }));
        setWhatsappList(parsedWa);
      } catch (err) {
        console.error("Alert config load error:", err);
        setBanner({ text: `Failed to load: ${err.message}`, type: "error" });
      } finally {
        setLoading(false);
      }
    };

    loadAlertConfiguration();
  }, [isOpen]);

  // Bulk actions for stocks
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

  // Email handlers
  const handleAddEmail = () => {
    const email = newEmail.trim();
    if (!email || !email.includes("@") || !email.includes(".")) {
      setBanner({ text: "Please enter a valid email address.", type: "error" });
      return;
    }
    const newEntry = {
      id: `em_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email,
      enabled: true,
    };
    setEmailList((prev) => [...prev, newEntry]);
    setNewEmail("");
    setBanner({ text: "", type: "info" });
  };

  const handleDeleteEmail = (id) => {
    setEmailList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleEmail = (id) => {
    setEmailList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleSaveEditEmail = (id) => {
    const text = editingEmailText.trim();
    if (!text || !text.includes("@")) {
      setBanner({ text: "Invalid email format.", type: "error" });
      return;
    }
    setEmailList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, email: text } : item))
    );
    setEditingEmailId(null);
    setEditingEmailText("");
  };

  // WhatsApp handlers
  const handleAddWhatsapp = () => {
    const phone = newWhatsapp.trim().replace(/\s+/g, "");
    if (!phone || phone.length < 10) {
      setBanner({ text: "Enter valid phone number with country code (e.g. +91XXXXXXXXXX)", type: "error" });
      return;
    }
    const newEntry = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      phone,
      enabled: true,
    };
    setWhatsappList((prev) => [...prev, newEntry]);
    setNewWhatsapp("");
    setBanner({ text: "", type: "info" });
  };

  const handleDeleteWhatsapp = (id) => {
    setWhatsappList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleWhatsapp = (id) => {
    setWhatsappList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleSaveEditWhatsapp = (id) => {
    const text = editingWaText.trim().replace(/\s+/g, "");
    if (!text || text.length < 10) {
      setBanner({ text: "Invalid WhatsApp phone format.", type: "error" });
      return;
    }
    setWhatsappList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, phone: text } : item))
    );
    setEditingWaId(null);
    setEditingWaText("");
  };

  // Save all changes directly to /alerts
  const handleSaveAllToFirebase = async () => {
    setSaving(true);
    try {
      const formattedStockControls = {};
      Object.entries(stockControls).forEach(([stk, isEnabled]) => {
        formattedStockControls[stk] = { enabled: Boolean(isEnabled) };
      });

      const formattedEmails = {};
      emailList.forEach((item) => {
        formattedEmails[item.id] = { email: item.email, enabled: Boolean(item.enabled) };
      });

      const formattedWhatsapp = {};
      whatsappList.forEach((item) => {
        formattedWhatsapp[item.id] = { phone: item.phone, enabled: Boolean(item.enabled) };
      });

      const updates = {};
      updates["alerts/master_disable"] = Boolean(masterDisable);
      updates["alerts/stock_controls"] = formattedStockControls;
      updates["alerts/emails"] = formattedEmails;
      updates["alerts/whatsapp"] = formattedWhatsapp;
      updates["alerts/last_settings_update"] = new Date().toISOString();

      await update(ref(database), updates);

      setBanner({ text: "Alert settings updated in Firebase! ✅", type: "success" });
      setTimeout(() => {
        setBanner({ text: "", type: "info" });
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Save error:", err);
      setBanner({ text: `Save error: ${err.message}`, type: "error" });
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
        backdropFilter: "blur(6px)",
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
          backgroundColor: "#0b1329",
          border: "2px solid #06b6d4",
          boxShadow: "0 0 35px rgba(6, 182, 212, 0.35), 0 20px 50px rgba(0,0,0,0.9)",
          borderRadius: "14px",
          width: "820px",
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
            padding: "16px 20px",
            background: "linear-gradient(90deg, #1e1b4b, #0f172a)",
            borderBottom: "2px solid #334155",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🔔</span>
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

        {/* NOTIFICATION BANNER */}
        {banner.text && (
          <div
            style={{
              padding: "10px 16px",
              backgroundColor: banner.type === "error" ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)",
              borderBottom: `1px solid ${banner.type === "error" ? "#ef4444" : "#10b981"}`,
              color: banner.type === "error" ? "#fca5a5" : "#6ee7b7",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {banner.text}
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* SECTION 1: MASTER KILL SWITCH */}
          <div
            style={{
              backgroundColor: masterDisable ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
              border: `2px solid ${masterDisable ? "#ef4444" : "#10b981"}`,
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <div style={{ fontWeight: "900", fontSize: "14px", color: masterDisable ? "#fca5a5" : "#6ee7b7" }}>
                MASTER ALERT SWITCH: {masterDisable ? "ALL ALERTS DISABLED ⛔" : "ALL ALERTS ACTIVE & ARMED 🟢"}
              </div>
              <div style={{ fontSize: "11px", color: "#cbd5e1" }}>
                Overrides all individual stock, email, and WhatsApp settings without erasing them.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "900", fontSize: "12px", color: "#10b981" }}>
                <input
                  type="radio"
                  name="master_switch"
                  checked={!masterDisable}
                  onChange={() => setMasterDisable(false)}
                  style={{ accentColor: "#10b981", transform: "scale(1.2)" }}
                />
                ENABLE ALL
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "900", fontSize: "12px", color: "#ef4444" }}>
                <input
                  type="radio"
                  name="master_switch"
                  checked={masterDisable}
                  onChange={() => setMasterDisable(true)}
                  style={{ accentColor: "#ef4444", transform: "scale(1.2)" }}
                />
                DISABLE ALL
              </label>
            </div>
          </div>

          {/* SECTION 2: WATCHLIST STOCK DISPATCH CONTROLS */}
          <div style={{ backgroundColor: "#111c38", border: "1px solid #1e3a8a", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{ color: "#38bdf8", fontWeight: "900", fontSize: "13px", textTransform: "uppercase" }}>
                  WATCHLIST STOCKS ({stocksList.length} TOTAL from /watchlist/watchlist)
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>
                  Toggle to silence specific stocks from generating Hi/Lo alerts
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleSetAllStocks(true)}
                  style={{ backgroundColor: "#065f46", color: "#a7f3d0", border: "1px solid #10b981", padding: "4px 10px", borderRadius: "5px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                >
                  ENABLE ALL
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllStocks(false)}
                  style={{ backgroundColor: "#7f1d1d", color: "#fecaca", border: "1px solid #ef4444", padding: "4px 10px", borderRadius: "5px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                >
                  DISABLE ALL
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ color: "#38bdf8", fontSize: "12px", padding: "10px", textAlign: "center" }}>⏳ Loading Watchlist stocks...</div>
            ) : stocksList.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "12px", padding: "10px", textAlign: "center" }}>No stocks found under /watchlist/watchlist.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", maxHeight: "160px", overflowY: "auto", paddingRight: "4px" }}>
                {stocksList.map((stk) => {
                  const isEnabled = stockControls[stk] !== false;
                  return (
                    <div
                      key={stk}
                      onClick={() => handleToggleStock(stk)}
                      style={{
                        backgroundColor: isEnabled ? "#1e293b" : "#1e1e24",
                        border: `1px solid ${isEnabled ? "#06b6d4" : "#475569"}`,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: "bold", color: isEnabled ? "#ffffff" : "#64748b" }}>
                        {stk}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "900",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: isEnabled ? "#059669" : "#475569",
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

          {/* SECTION 3: EMAIL RECIPIENTS */}
          <div style={{ backgroundColor: "#111c38", border: "1px solid #7c3aed", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ color: "#c084fc", fontWeight: "900", fontSize: "13px", textTransform: "uppercase" }}>
                EMAIL NOTIFICATION RECIPIENTS ({emailList.length})
              </span>
            </div>

            {/* Add Bar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                type="email"
                placeholder="Enter alert email (e.g. trader@gmail.com)..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleAddEmail}
                style={{ backgroundColor: "#a855f7", color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "900", fontSize: "12px", cursor: "pointer" }}
              >
                ➕ ADD EMAIL
              </button>
            </div>

            {/* Email List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
              {emailList.length === 0 ? (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>No email addresses added yet.</span>
              ) : (
                emailList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {editingEmailId === item.id ? (
                      <input
                        type="email"
                        value={editingEmailText}
                        onChange={(e) => setEditingEmailText(e.target.value)}
                        style={{ backgroundColor: "#1e293b", color: "#38bdf8", border: "1px solid #06b6d4", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", outline: "none", width: "240px" }}
                      />
                    ) : (
                      <span style={{ fontSize: "12px", color: item.enabled ? "#ffffff" : "#64748b", textDecoration: item.enabled ? "none" : "line-through" }}>
                        ✉️ {item.email}
                      </span>
                    )}

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: item.enabled ? "#10b981" : "#f87171", cursor: "pointer", fontWeight: "bold" }}>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => handleToggleEmail(item.id)}
                          style={{ accentColor: "#10b981" }}
                        />
                        {item.enabled ? "ON" : "OFF"}
                      </label>

                      {editingEmailId === item.id ? (
                        <button type="button" onClick={() => handleSaveEditEmail(item.id)} style={{ backgroundColor: "#10b981", color: "#000", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>OK</button>
                      ) : (
                        <button type="button" onClick={() => { setEditingEmailId(item.id); setEditingEmailText(item.email); }} style={{ backgroundColor: "#334155", color: "#f59e0b", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>✏️</button>
                      )}

                      <button type="button" onClick={() => handleDeleteEmail(item.id)} style={{ backgroundColor: "#334155", color: "#ef4444", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 4: WHATSAPP RECIPIENTS */}
          <div style={{ backgroundColor: "#111c38", border: "1px solid #10b981", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ color: "#34d399", fontWeight: "900", fontSize: "13px", textTransform: "uppercase" }}>
                WHATSAPP PHONE NUMBERS ({whatsappList.length})
              </span>
            </div>

            {/* Add Bar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="Enter WhatsApp number (e.g. +91XXXXXXXXXX)..."
                value={newWhatsapp}
                onChange={(e) => setNewWhatsapp(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleAddWhatsapp}
                style={{ backgroundColor: "#10b981", color: "#000000", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "900", fontSize: "12px", cursor: "pointer" }}
              >
                ➕ ADD WHATSAPP
              </button>
            </div>

            {/* WhatsApp List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
              {whatsappList.length === 0 ? (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>No WhatsApp numbers added yet.</span>
              ) : (
                whatsappList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {editingWaId === item.id ? (
                      <input
                        type="text"
                        value={editingWaText}
                        onChange={(e) => setEditingWaText(e.target.value)}
                        style={{ backgroundColor: "#1e293b", color: "#34d399", border: "1px solid #10b981", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", outline: "none", width: "240px" }}
                      />
                    ) : (
                      <span style={{ fontSize: "12px", color: item.enabled ? "#ffffff" : "#64748b", textDecoration: item.enabled ? "none" : "line-through" }}>
                        💬 {item.phone}
                      </span>
                    )}

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: item.enabled ? "#10b981" : "#f87171", cursor: "pointer", fontWeight: "bold" }}>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => handleToggleWhatsapp(item.id)}
                          style={{ accentColor: "#10b981" }}
                        />
                        {item.enabled ? "ON" : "OFF"}
                      </label>

                      {editingWaId === item.id ? (
                        <button type="button" onClick={() => handleSaveEditWhatsapp(item.id)} style={{ backgroundColor: "#10b981", color: "#000", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>OK</button>
                      ) : (
                        <button type="button" onClick={() => { setEditingWaId(item.id); setEditingWaText(item.phone); }} style={{ backgroundColor: "#334155", color: "#f59e0b", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>✏️</button>
                      )}

                      <button type="button" onClick={() => handleDeleteWhatsapp(item.id)} style={{ backgroundColor: "#334155", color: "#ef4444", border: "none", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>🗑️</button>
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
            padding: "14px 20px",
            backgroundColor: "#070c18",
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
            onClick={handleSaveAllToFirebase}
            disabled={saving}
            style={{
              backgroundColor: "#06b6d4",
              color: "#000000",
              border: "none",
              padding: "9px 26px",
              borderRadius: "6px",
              fontWeight: "900",
              fontSize: "12px",
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 0 15px rgba(6, 182, 212, 0.4)",
            }}
          >
            {saving ? "SAVING..." : "💾 SAVE ALERT CONFIGURATION"}
          </button>
        </div>
      </div>
    </div>
  );
}