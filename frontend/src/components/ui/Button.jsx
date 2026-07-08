import { Link } from "react-router-dom";

export default function Button({
  children,
  to,
  onClick,
  type = "button",
  variant = "primary",
  full = false,
  disabled = false,
  className = ""
}) {
  const style = {
    ...styles.base,
    ...(variant === "primary" ? styles.primary : {}),
    ...(variant === "secondary" ? styles.secondary : {}),
    ...(variant === "ghost" ? styles.ghost : {}),
    ...(variant === "danger" ? styles.danger : {}),
    ...(full ? styles.full : {}),
    ...(disabled ? styles.disabled : {})
  };

  if (to) {
    return (
      <Link to={to} style={style} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style} className={className}>
      {children}
    </button>
  );
}

const styles = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    padding: "12px 16px",
    borderRadius: 8,
    fontWeight: 900,
    fontSize: 14,
    textDecoration: "none",
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 200ms ease"
  },
  primary: {
    background: "var(--accent, #7c3aed)",
    color: "var(--btn-primary-text, #ffffff)",
    boxShadow: "none"
  },
  secondary: {
    background: "var(--secondary, var(--accent-2, #60a5fa))",
    color: "var(--btn-secondary-text, var(--text))",
    boxShadow: "none"
  },
  ghost: {
    background: "var(--btn-ghost-bg)",
    border: "1px solid var(--btn-ghost-border)",
    color: "var(--btn-ghost-text)"
  },
  danger: {
    background: "#ef4444",
    color: "#ffffff",
    boxShadow: "none"
  },
  full: {
    width: "100%"
  },
  disabled: {
    opacity: 0.6,
    cursor: "not-allowed"
  }
};