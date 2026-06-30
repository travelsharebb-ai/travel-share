import { Link } from "react-router-dom";

export default function Button({
  children,
  to,
  onClick,
  type = "button",
  variant = "primary",
  full = false,
  disabled = false
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
      <Link to={to} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}>
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
    background: "#7c3aed",
    color: "#ffffff",
    boxShadow: "0 14px 30px rgba(124, 58, 237, 0.24)"
  },
  secondary: {
    background: "#60a5fa",
    color: "#0f172a",
    boxShadow: "0 14px 30px rgba(96, 165, 250, 0.24)"
  },
  ghost: {
    background: "#0b111d",
    border: "1px solid #1f2a3a",
    color: "#ffffff"
  },
  danger: {
    background: "#ef4444",
    color: "#ffffff",
    boxShadow: "0 14px 30px rgba(239, 68, 68, 0.24)"
  },
  full: {
    width: "100%"
  },
  disabled: {
    opacity: 0.6,
    cursor: "not-allowed"
  }
};