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
    background: "rgba(17,24,39,0.92)",
    border: "1px solid #223047",
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
    border: "4px solid #223047",
    borderTopColor: "#60a5fa"
  },
  label: {
    color: "#9ca3af",
    margin: 0
  }
};