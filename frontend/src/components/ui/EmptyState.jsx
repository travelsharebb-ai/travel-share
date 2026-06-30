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
    background: "rgba(17,24,39,0.92)",
    border: "1px solid #223047",
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
    background: "rgba(96,165,250,0.16)",
    fontSize: 30
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950
  },
  copy: {
    margin: 0,
    color: "#9ca3af",
    maxWidth: 480,
    lineHeight: 1.55
  }
};