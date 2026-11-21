import React, { useState, useEffect, useRef } from "react";
import { ref, get } from "firebase/database";
import { database } from "./firebase"; // Uses your configured firebase.js instance

export default function PinModalGuard({ children }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [targetPin, setTargetPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [trialsLeft, setTrialsLeft] = useState(3);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const inputRefs = useRef([]);

  // 1. Fetch PIN from Firebase path: /config/PIN
  useEffect(() => {
    const pinRef = ref(database, "config/PIN");
    get(pinRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          setTargetPin(String(val).trim());
        } else {
          setErrorMsg("PIN configuration not found in Firebase (/config/PIN).");
        }
      })
      .catch((err) => {
        setErrorMsg("Failed to connect to Firebase: " + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Auto-focus first input box once loaded
  useEffect(() => {
    if (!loading && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [loading]);

  // Dynamic Viewport: device-width while PIN modal is active so it opens 100% centered on mobile & desktop,
  // then switches to width=1100 when unlocked so STOCK-MONITOR opens exactly in its original 1100px layout.
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    if (!isUnlocked) {
      meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=5.0");
    } else {
      meta.setAttribute("content", "width=1100, initial-scale=1.0");
      window.scrollTo(0, 0);
    }
  }, [isUnlocked]);

  const enteredPin = digits.join("");
  const isPinComplete = enteredPin.length === 6;
  const isPinMatched = Boolean(targetPin && enteredPin === targetPin);

  // Handle digit input with auto-advance
  const handleDigitChange = (index, value) => {
    if (isLockedOut) return;

    // Only allow pure numeric digit (0-9)
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned && value !== "") return;

    const char = cleaned.slice(-1); // Take latest digit entered
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMsg("");

    // Auto-advance to next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace and Left/Right navigation
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle pasting 6 digits directly
  const handlePaste = (e) => {
    e.preventDefault();
    if (isLockedOut) return;
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  // OK Button: Unlocks and loads the page
  const handleConfirmUnlock = () => {
    if (isPinMatched) {
      setIsUnlocked(true);
    }
  };

  // Cancel Button or Failed 3 trials
  const handleCancel = () => {
    setDigits(["", "", "", "", "", ""]);
    setErrorMsg("Access Cancelled. Please refresh the page to try again.");
    setIsLockedOut(true);
  };

  // Automatically evaluate after 6 digits are typed if incorrect
  const verifyAttempt = () => {
    if (!isPinMatched) {
      const nextTrials = trialsLeft - 1;
      setTrialsLeft(nextTrials);
      setDigits(["", "", "", "", "", ""]);

      if (nextTrials <= 0) {
        setIsLockedOut(true);
        setErrorMsg("Access Denied: Exceeded 3 trials. Access cancelled.");
      } else {
        setErrorMsg(`Incorrect PIN. ${nextTrials} attempt${nextTrials > 1 ? "s" : ""} left.`);
        inputRefs.current[0]?.focus();
      }
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        backgroundColor: "rgba(3, 7, 18, 0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999999,
        padding: "16px",
        boxSizing: "border-box",
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#0d182e",
          border: "2px solid #06b6d4",
          borderRadius: "14px",
          padding: "26px 18px",
          width: "360px",
          maxWidth: "calc(100vw - 32px)",
          margin: "auto",
          boxSizing: "border-box",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(6, 182, 212, 0.25)",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔐</div>
        <h3
          style={{
            margin: "0 0 6px 0",
            color: "#06b6d4",
            fontSize: "17px",
            fontWeight: "800",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Security Verification
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 20px 0" }}>
          Enter the 6-digit numeric PIN to proceed
        </p>

        {loading ? (
          <div style={{ color: "#38bdf8", fontSize: "13px", padding: "20px 0" }}>
            Connecting to Firebase...
          </div>
        ) : (
          <>
            {/* 6 NUMERIC PIN BOXES */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "clamp(4px, 2vw, 8px)",
                marginBottom: "18px",
                width: "100%",
                boxSizing: "border-box",
              }}
              onPaste={handlePaste}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  disabled={isLockedOut}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  style={{
                    width: "clamp(34px, 11.5vw, 42px)",
                    height: "clamp(40px, 13vw, 48px)",
                    textAlign: "center",
                    fontSize: "clamp(18px, 5vw, 22px)",
                    fontWeight: "bold",
                    color: "#ffffff",
                    backgroundColor: "#081021",
                    border: digit ? "2px solid #06b6d4" : "1px solid #334155",
                    borderRadius: "8px",
                    outline: "none",
                    boxShadow: digit ? "0 0 10px rgba(6, 182, 212, 0.4)" : "none",
                    transition: "all 0.15s ease",
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </div>

            {/* ERROR OR STATUS MESSAGE */}
            {errorMsg && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "16px",
                  lineHeight: "1.4",
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              {isPinMatched && !isLockedOut ? (
                <button
                  type="button"
                  onClick={handleConfirmUnlock}
                  style={{
                    backgroundColor: "#10b981",
                    color: "#000000",
                    border: "none",
                    padding: "9px 26px",
                    borderRadius: "6px",
                    fontWeight: "900",
                    fontSize: "13px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    boxShadow: "0 0 14px rgba(16, 185, 129, 0.5)",
                  }}
                >
                  OK
                </button>
              ) : isPinComplete && !isLockedOut ? (
                <button
                  type="button"
                  onClick={verifyAttempt}
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#000000",
                    border: "none",
                    padding: "9px 24px",
                    borderRadius: "6px",
                    fontWeight: "900",
                    fontSize: "13px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Verify
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleCancel}
                disabled={isLockedOut}
                style={{
                  backgroundColor: "#1e293b",
                  color: "#f87171",
                  border: "1px solid #ef4444",
                  padding: "9px 24px",
                  borderRadius: "6px",
                  fontWeight: "900",
                  fontSize: "13px",
                  cursor: isLockedOut ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                  opacity: isLockedOut ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}