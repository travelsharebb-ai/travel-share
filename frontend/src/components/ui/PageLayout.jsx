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
    background: "linear-gradient(180deg, rgba(5, 7, 13, 0.28), rgba(11, 17, 29, 0.46))",
    color: "#ffffff",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "24px 16px",
    textShadow: "0 2px 18px rgba(0, 0, 0, 0.72)"
  },
  container: {
    width: "100%",
    margin: "0 auto",
    display: "grid",
    gap: 22
  }
};