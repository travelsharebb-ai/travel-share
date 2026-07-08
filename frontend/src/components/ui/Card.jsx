export default function Card({ children, elevated = false, style }) {
  return (
    <section
      style={{
        ...styles.card,
        ...(elevated ? styles.elevated : {}),
        ...(style || {})
      }}
    >
      {children}
    </section>
  );
}

const styles = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 20,
    color: "var(--text)",
    backdropFilter: "blur(10px)"
  },
  elevated: {
    boxShadow: "0 22px 60px rgba(0, 0, 0, 0.36)"
  }
};