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
    background: "rgba(3, 7, 15, 0.9)",
    border: "1px solid #1f2a3a",
    borderRadius: 8,
    padding: 20,
    color: "#ffffff",
    backdropFilter: "blur(10px)"
  },
  elevated: {
    boxShadow: "0 22px 60px rgba(0, 0, 0, 0.36)"
  }
};