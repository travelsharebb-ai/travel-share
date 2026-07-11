export default function PageHeader({ eyebrow, title, subtitle, actions, hero = false, className = "" }) {
  return (
    <section className={`${hero ? "hero-copy-panel" : ""} ${className}`} style={styles.wrap}>
      <div>
        {eyebrow && <p style={styles.eyebrow}>{eyebrow}</p>}
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>

      {actions && <div style={styles.actions}>{actions}</div>}
    </section>
  );
}

const styles = {
  wrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 18,
    flexWrap: "wrap"
  },
  eyebrow: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    background: "var(--eyebrow-bg, rgba(167,139,250,0.14))",
    color: "var(--eyebrow-text, var(--accent))",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    margin: "0 0 12px"
  },
  title: {
    margin: 0,
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)",
    lineHeight: 1.08,
    fontWeight: 950,
    fontFamily: "Georgia, 'Times New Roman', serif",
    textShadow: "none"
  },
  subtitle: {
    margin: "10px 0 0",
    color: "var(--text-muted)",
    fontSize: 16,
    maxWidth: 680,
    lineHeight: 1.55
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap"
  }
};