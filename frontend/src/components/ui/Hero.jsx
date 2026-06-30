import Card from "./Card";

export default function Hero({ eyebrow, title, copy, actions, children }) {
  return (
    <Card elevated style={styles.hero}>
      <div style={styles.content}>
        {eyebrow && <p style={styles.eyebrow}>{eyebrow}</p>}
        <h1 style={styles.title}>{title}</h1>
        {copy && <p style={styles.copy}>{copy}</p>}
        {actions && <div style={styles.actions}>{actions}</div>}
      </div>

      {children && <div style={styles.visual}>{children}</div>}
    </Card>
  );
}

const styles = {
  hero: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 22,
    alignItems: "center",
    padding: "clamp(1rem, 3vw, 2rem)",
    background: "linear-gradient(rgba(2,6,14,0.92), rgba(2,6,14,0.92))",
    border: "1px solid rgba(148, 163, 184, 0.38)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(8px)"
  },
  content: {
    display: "grid",
    gap: 14
  },
  eyebrow: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    margin: 0
  },
  title: {
    margin: 0,
    fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
    lineHeight: 1.05,
    fontWeight: 950,
    fontFamily: "Georgia, 'Times New Roman', serif"
  },
  copy: {
    margin: 0,
    color: "#d1d5db",
    lineHeight: 1.65,
    maxWidth: 620,
    fontSize: 16
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap"
  },
  visual: {
    minHeight: 220,
    borderRadius: 12,
    background:
      "radial-gradient(circle at 30% 20%, rgba(96,165,250,0.28), transparent 36%), radial-gradient(circle at 80% 70%, rgba(124,58,237,0.28), transparent 34%), #05070d",
    border: "1px solid #223047"
  }
};