import Card from "./Card";

export default function StatCard({ label, value, detail, icon = "•" }) {
  return (
    <Card>
      <div style={styles.top}>
        <span style={styles.icon}>{icon}</span>
        <span style={styles.label}>{label}</span>
      </div>

      <strong style={styles.value}>{value}</strong>

      {detail && <p style={styles.detail}>{detail}</p>}
    </Card>
  );
}

const styles = {
  top: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(96,165,250,0.15)"
  },
  label: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: 700
  },
  value: {
    display: "block",
    marginTop: 14,
    fontSize: 30,
    fontWeight: 950
  },
  detail: {
    margin: "6px 0 0",
    color: "#9ca3af",
    fontSize: 13
  }
};