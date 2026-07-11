import { useLanguage } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import PageLayout from "./ui/PageLayout.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import { ArrowLeft } from "lucide-react";

export default function QRScanner() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const hasScannedRef = useRef(false);
  const scannerRef = useRef(null);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const statusCopy = {
    loading: {
      title: t("hardcoded.cameraAccessIsRequiredToScanQrCodes"),
      body: t("hardcoded.cameraOrGallerySupported"),
      pill: t("common.loading")
    },
    scanning: {
      title: t("nav.scan"),
      body: t("hardcoded.goodLightingAndSteadyHandsHelpQrCodes"),
      pill: t("hardcoded.scan")
    },
    success: {
      title: t("hardcoded.openingQr"),
      body: t("hardcoded.pleaseWaitWhileWeLoadYourQrJourney"),
      pill: t("hardcoded.openingQr")
    },
    error: {
      title: t("hardcoded.cameraAccessIsRequiredToScanQrCodes"),
      body: error || t("hardcoded.goodLightingAndSteadyHandsHelpQrCodes"),
      pill: t("hardcoded.tip")
    }
  };
  const activeStatus = statusCopy[status] || statusCopy.scanning;

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
            try {
              const parsed = new URL(token);
              token = parsed.pathname.split("/").filter(Boolean).pop() || "";
            } catch (parseError) {
              token = token.split("/").filter(Boolean).pop() || "";
            }
          }
          if (!token || ["undefined", "null"].includes(token.toLowerCase())) {
            throw new Error("Missing QR token");
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
    <PageLayout>
      <PageHeader
        hero
        title={"Scan QR"}
        subtitle={"Point your camera at a Travel Share code"}
      />

      <div style={styles.container}>

        <div style={styles.content}>
          <div style={styles.backContainer}>
            <button className="btn-ghost topbar-icon-button" onClick={() => navigate(-1)} style={styles.backButton}>
              <ArrowLeft size={16} />
              <span style={styles.backLabel}>{t("common.back")}</span>
            </button>
          </div>

          <div style={styles.notice}>
            <span style={styles.noticeIcon}>📷</span>
            <span>{t("hardcoded.cameraAccessIsRequiredToScanQrCodes")}</span>
          </div>

          <section style={{ ...styles.cameraCard, zIndex: 2 }}>
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

          <section style={{ ...styles.statusCard, zIndex: 2 }}>
            <div style={styles.statusSpinner} />

            <div style={styles.statusCopy}>
              <h2 style={styles.statusTitle}>{activeStatus.title}</h2>

              <p style={styles.statusText}>{activeStatus.body}</p>
            </div>

            <span style={styles.statusPill}>{activeStatus.pill}</span>
          </section>

          <section style={{ ...styles.actionGrid, zIndex: 2 }}>
            <button type="button" style={styles.actionCard}>
              <span style={styles.actionIcon}>🖼️</span>
              <strong style={styles.actionLabel}>{t("hardcoded.scanFromImage")}</strong>
              <small style={styles.actionHint}>{t("hardcoded.useQrScreenshot")}</small>
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
              <strong style={styles.actionLabel}>{t("hardcoded.enterCode")}</strong>
              <small style={styles.actionHint}>{t("hardcoded.pasteTokenManually")}</small>
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
                <strong>{t("hardcoded.testDemoQr")}</strong>
                <small>{t("hardcoded.developmentOnly")}</small>
              </span>
              <span style={styles.chevron}>›</span>
            </button>
          )}

          <button type="button" onClick={() => navigate("/")} style={styles.homeButton}>
            <span style={styles.rowIcon}>⌂</span>
            <span style={styles.rowText}>
              <strong>{t("hardcoded.backToHome")}</strong>
              <small>{t("hardcoded.returnToHomePage")}</small>
            </span>
            <span style={styles.chevron}>›</span>
          </button>

          <div style={styles.tipCard}>
            <strong>{t("hardcoded.tip")}</strong>
            <p>{t("hardcoded.goodLightingAndSteadyHandsHelpQrCodes")}</p>
          </div>
        </div>
      </div>
    </PageLayout>
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

  container: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 16,
    overflow: "hidden"
  },
  content: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gap: 16
  },
  backContainer: {
    display: "flex",
    alignItems: "center"
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)"
  },
  backLabel: {
    display: "inline-block",
    fontWeight: 800
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
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
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
    color: "var(--text-muted)",
    fontSize: 14
  },

  green: {
    color: "var(--accent)",
    fontWeight: 900
  },

  helpBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontWeight: 900,
    cursor: "pointer"
  },

  notice: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "var(--text-muted)",
    fontSize: 14
  },

  noticeIcon: {
    opacity: 0.9
  },

  cameraCard: {
    position: "relative",
    borderRadius: 28,
    overflow: "hidden",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    minHeight: 420,
    boxShadow: "none"
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
    background: "transparent"
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
    borderColor: "var(--accent)"
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
    background: "var(--accent)",
    boxShadow: "none"
  },

  successCircle: {
    position: "absolute",
    inset: 0,
    margin: "auto",
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "var(--page-bg)",
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
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 22,
    padding: 16
  },

  statusSpinner: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "4px dashed var(--accent)"
  },

  statusCopy: {
    minWidth: 0
  },

  statusTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "var(--text)"
  },

  statusText: {
    margin: "5px 0 0",
    color: "var(--text-muted)",
    fontSize: 13,
    lineHeight: 1.35
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14
  },

  actionCard: {
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: 18,
    minHeight: 112,
    background: "var(--surface)",
    color: "var(--text)",
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gridTemplateRows: "auto auto",
    columnGap: 12,
    rowGap: 5,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer"
  },

  actionIcon: {
    gridRow: "1 / span 2",
    fontSize: 24,
    lineHeight: 1
  },

  actionLabel: {
    display: "block",
    minWidth: 0,
    fontSize: 15,
    lineHeight: 1.2,
    fontWeight: 900,
    color: "var(--text)"
  },

  actionHint: {
    display: "block",
    minWidth: 0,
    color: "var(--text-muted)",
    fontSize: 13,
    lineHeight: 1.3
  },

  statusPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "var(--accent-soft)",
    color: "var(--accent)",
    border: "1px solid var(--border)",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap"
  },

  demoButton: {
    border: "none",
    borderRadius: 20,
    padding: 18,
    background: "var(--accent)",
    color: "var(--page-bg)",
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    fontWeight: 900,
    cursor: "pointer"
  },

  homeButton: {
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: 18,
    background: "var(--surface)",
    color: "var(--text)",
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
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: 16,
    background: "var(--surface)",
    color: "var(--text-muted)"
  }
};
