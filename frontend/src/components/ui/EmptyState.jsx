import Button from "./Button";

export default function EmptyState({
  icon = "✨",
  title,
  copy,
  actionLabel,
  actionTo,
  onAction
}) {
  return (
    <div style={styles.wrap}>
      <div style={styles.icon}>{icon}</div>
      <h2 style={styles.title}>{title}</h2>
      {copy && <p style={styles.copy}>{copy}</p>}

      {actionLabel && (
        <Button to={actionTo} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 24,
    padding: 28,
    textAlign: "center",
    display: "grid",
    justifyItems: "center",
    gap: 12
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "var(--stat-icon-bg, rgba(167,139,250,0.12))",
    fontSize: 30
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950
  },
  copy: {
    margin: 0,
    color: "var(--text-muted)",
    maxWidth: 480,
    lineHeight: 1.55
  }
};