import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

export default function QRScanner() {
  const navigate = useNavigate();
  const hasScannedRef = useRef(false);
  const scannerRef = useRef(null);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 12,
        qrbox: { width: 260, height: 260 },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        aspectRatio: 1
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;

        try {
          setStatus("success");
          if (navigator.vibrate) navigator.vibrate(120);

          await scanner.clear();

          let token = decodedText.trim();
          if (token.includes("/")) {
            token = token.split("/").filter(Boolean).pop();
          }

          setTimeout(() => navigate(`/qr/${token}`), 600);
        } catch (err) {
          console.error(err);
          setError("Could not process this QR code.");
          setStatus("error");
          hasScannedRef.current = false;
        }
      },
      () => {
        setStatus((current) => (current === "loading" ? "scanning" : current));
      }
    );

    return () => {
      try {
        scanner.clear().catch(() => {});
      } catch (e) {}
    };
  }, [navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <div style={styles.wrap}>
        <header style={styles.header}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>
            ←
          </button>

          <div style={styles.headerText}>
            <h1 style={styles.title}>Scan QR</h1>
            <p style={styles.subtitle}>
              Point your camera at a <span style={styles.green}>Travel Share</span> code
            </p>
          </div>

          <button type="button" style={styles.helpBtn}>?</button>
        </header>

        <div style={styles.notice}>
          <span style={styles.noticeIcon}>📷</span>
          <span>Camera access is required to scan QR codes</span>
        </div>

        <section style={styles.cameraCard}>
          <div id="qr-reader" style={styles.reader} />

          <div style={styles.overlay}>
            <div style={styles.scanBox}>
              <div style={{ ...styles.corner, ...styles.topLeft }} />
              <div style={{ ...styles.corner, ...styles.topRight }} />
              <div style={{ ...styles.corner, ...styles.bottomLeft }} />
              <div style={{ ...styles.corner, ...styles.bottomRight }} />

              {status !== "success" && <div style={styles.scanLine} />}
              {status === "success" && <div style={styles.successCircle}>✓</div>}
            </div>
          </div>
        </section>

        <section style={styles.statusCard}>
          <div style={styles.statusSpinner} />

          <div style={styles.statusCopy}>
            <h2 style={styles.statusTitle}>
              {status === "loading" && "Requesting camera"}
              {status === "scanning" && "Ready to scan"}
              {status === "success" && "QR detected"}
              {status === "error" && "Scan failed"}
            </h2>

            <p style={styles.statusText}>
              {status === "loading" && "Allow camera access when your browser asks."}
              {status === "scanning" && "Hold steady and keep the QR code inside the frame."}
              {status === "success" && "Opening your upload page..."}
              {status === "error" && (error || "Try again.")}
            </p>
          </div>

          <span style={styles.statusPill}>
            {status === "success" ? "Opening..." : "Scanning..."}
          </span>
        </section>

        <section style={styles.actionGrid}>
          <button type="button" style={styles.actionCard}>
            <span style={styles.actionIcon}>🖼️</span>
            <strong>Scan from Image</strong>
            <small>Use QR screenshot</small>
          </button>

          <button
            type="button"
            style={styles.actionCard}
            onClick={() => {
              const token = window.prompt("Enter QR token");
              if (token) navigate(`/qr/${token}`);
            }}
          >
            <span style={styles.actionIcon}>⌨️</span>
            <strong>Enter Code</strong>
            <small>Paste token manually</small>
          </button>
        </section>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => navigate("/qr/test-ci-token")}
            style={styles.demoButton}
          >
            <span style={styles.rowIcon}>▦</span>
            <span style={styles.rowText}>
              <strong>Test Demo QR</strong>
              <small>Development only</small>
            </span>
            <span style={styles.chevron}>›</span>
          </button>
        )}

        <button type="button" onClick={() => navigate("/")} style={styles.homeButton}>
          <span style={styles.rowIcon}>⌂</span>
          <span style={styles.rowText}>
            <strong>Back to Home</strong>
            <small>Return to home page</small>
          </span>
          <span style={styles.chevron}>›</span>
        </button>

        <div style={styles.tipCard}>
          <strong>💡 Tip</strong>
          <p>Good lighting and steady hands help QR codes scan faster.</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#04070d",
    color: "white",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "22px 16px",
    position: "relative",
    overflowX: "hidden"
  },

  glowOne: {
    position: "absolute",
    width: 380,
    height: 380,
    right: -140,
    top: -100,
    borderRadius: "50%",
    background: "rgba(0,255,153,0.16)",
    filter: "blur(90px)"
  },

  glowTwo: {
    position: "absolute",
    width: 300,
    height: 300,
    left: -160,
    bottom: -140,
    borderRadius: "50%",
    background: "rgba(59,130,246,0.13)",
    filter: "blur(90px)"
  },

  wrap: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    display: "grid",
    gap: 16
  },

  header: {
    display: "grid",
    gridTemplateColumns: "48px 1fr 42px",
    alignItems: "center",
    gap: 12
  },

  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    border: "1px solid #223047",
    background: "#111827",
    color: "white",
    fontSize: 24,
    cursor: "pointer"
  },

  headerText: {
    minWidth: 0
  },

  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 950,
    lineHeight: 1.1
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#a7b0c0",
    fontSize: 14
  },

  green: {
    color: "#00ff99",
    fontWeight: 900
  },

  helpBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "1px solid #223047",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer"
  },

  notice: {
    background: "rgba(17,24,39,0.92)",
    border: "1px solid #223047",
    borderRadius: 999,
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#cbd5e1",
    fontSize: 14
  },

  noticeIcon: {
    opacity: 0.9
  },

  cameraCard: {
    position: "relative",
    borderRadius: 28,
    overflow: "hidden",
    background: "#020617",
    border: "1px solid #334155",
    minHeight: 420,
    boxShadow: "0 28px 70px rgba(0,0,0,0.55)"
  },

  reader: {
    width: "100%",
    minHeight: 420
  },

  overlay: {
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at center, transparent 0 34%, rgba(0,0,0,0.48) 35% 100%)"
  },

  scanBox: {
    width: 270,
    height: 270,
    position: "relative"
  },

  corner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: "#4cffb4"
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTop: "5px solid",
    borderLeft: "5px solid",
    borderTopLeftRadius: 16
  },

  topRight: {
    top: 0,
    right: 0,
    borderTop: "5px solid",
    borderRight: "5px solid",
    borderTopRightRadius: 16
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottom: "5px solid",
    borderLeft: "5px solid",
    borderBottomLeftRadius: 16
  },

  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottom: "5px solid",
    borderRight: "5px solid",
    borderBottomRightRadius: 16
  },

  scanLine: {
    position: "absolute",
    top: "50%",
    left: 10,
    right: 10,
    height: 4,
    borderRadius: 999,
    background: "#00ff99",
    boxShadow: "0 0 24px #00ff99"
  },

  successCircle: {
    position: "absolute",
    inset: 0,
    margin: "auto",
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "#00ff99",
    color: "#03110b",
    display: "grid",
    placeItems: "center",
    fontSize: 56,
    fontWeight: 950
  },

  statusCard: {
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    gap: 14,
    alignItems: "center",
    background: "rgba(17,24,39,0.94)",
    border: "1px solid #223047",
    borderRadius: 22,
    padding: 16
  },

  statusSpinner: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "4px dashed #00ff99"
  },

  statusCopy: {
    minWidth: 0
  },

  statusTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900
  },

  statusText: {
    margin: "5px 0 0",
    color: "#a7b0c0",
    fontSize: 13,
    lineHeight: 1.35
  },

  statusPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "#00ff9920",
    color: "#00ff99",
    border: "1px solid #00ff9950",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap"
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12
  },

  actionCard: {
    border: "1px solid #223047",
    background: "rgba(17,24,39,0.92)",
    color: "white",
    borderRadius: 20,
    padding: 18,
    minHeight: 120,
    display: "grid",
    gap: 6,
    placeItems: "center",
    textAlign: "center",
    cursor: "pointer"
  },

  actionIcon: {
    fontSize: 28
  },

  demoButton: {
    border: "none",
    borderRadius: 20,
    padding: 18,
    background: "linear-gradient(135deg, #00ff99, #00cc7a)",
    color: "#03110b",
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    fontWeight: 900,
    cursor: "pointer"
  },

  homeButton: {
    border: "1px solid #223047",
    borderRadius: 20,
    padding: 18,
    background: "rgba(17,24,39,0.92)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer"
  },

  rowIcon: {
    fontSize: 22
  },

  rowText: {
    display: "grid",
    gap: 3
  },

  chevron: {
    fontSize: 26
  },

  tipCard: {
    border: "1px solid #223047",
    borderRadius: 20,
    padding: 16,
    background: "rgba(17,24,39,0.82)",
    color: "#a7b0c0"
  }
};