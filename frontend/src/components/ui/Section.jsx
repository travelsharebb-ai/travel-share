export default function Section({ title, subtitle, children, columns = 1 }) {
  return (
    <section style={styles.section}>
      {(title || subtitle) && (
        <div>
          {title && <h2 style={styles.title}>{title}</h2>}
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
      )}

      <div
        style={{
          ...styles.grid,
          gridTemplateColumns:
            columns === 3
              ? "repeat(auto-fit, minmax(240px, 1fr))"
              : columns === 2
                ? "repeat(auto-fit, minmax(280px, 1fr))"
                : "1fr"
        }}
      >
        {children}
      </div>
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: 16
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900
  },
  subtitle: {
    margin: "6px 0 0",
    color: "var(--text-muted)"
  },
  grid: {
    display: "grid",
    gap: 16
  }
};