import { useId } from "react";

export default function Input({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  textarea = false
}) {
  const generatedId = useId().replace(/:/g, "");
  const fieldId = id || `field-${generatedId}`;
  const fieldName = name || id || `field-${generatedId}`;

  return (
    <label htmlFor={fieldId} style={styles.wrap}>
      <span style={styles.label}>{label}</span>

      {textarea ? (
        <textarea
          id={fieldId}
          name={fieldName}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ ...styles.input, minHeight: 110, resize: "vertical" }}
        />
      ) : (
        <input
          id={fieldId}
          name={fieldName}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={styles.input}
        />
      )}
    </label>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 7
  },
  label: {
    color: "var(--text-muted)",
    fontWeight: 800,
    fontSize: 14
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box"
  }
};
