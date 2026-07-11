export default function LoadingState({ label = "Loading..." }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.spinner} />
      <p style={styles.label}>{label}</p>
    </div>
  );
}

const styles = {
  wrap: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 22,
    padding: 24,
    display: "grid",
    justifyItems: "center",
    gap: 12
  },
  spinner: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "4px solid var(--border)",
    borderTopColor: "var(--accent, #60a5fa)"
  },
  label: {
    color: "var(--text-muted)",
    margin: 0
  }
};