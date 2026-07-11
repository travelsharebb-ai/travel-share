export default function PageLayout({ children, narrow = false }) {
  return (
    <main style={styles.page}>
      <div style={{ ...styles.container, maxWidth: narrow ? 760 : 1180 }}>
        {children}
      </div>
    </main>
  );
}

const styles = {
  page: {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    background: "transparent",
    color: "var(--text)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "24px 16px",
    textShadow: "none"
  },
  container: {
    width: "100%",
    margin: "0 auto",
    display: "grid",
    gap: 22
  }
};