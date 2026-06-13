import { adminStyles } from "./adminStyles.js";

const s = adminStyles;

export function FormGroup({ children, wide }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      {children}
    </div>
  );
}

export function FormLabel({ children }) {
  return <label style={s.formLabel}>{children}</label>;
}

export function InputField({ label, name, value, onChange, placeholder, wide, autoFocus }) {
  return (
    <FormGroup wide={wide}>
      {label && <FormLabel>{label}</FormLabel>}
      <input
        style={s.formInput}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </FormGroup>
  );
}

export function TextareaField({ label, name, value, onChange, placeholder, wide = true }) {
  return (
    <FormGroup wide={wide}>
      {label && <FormLabel>{label}</FormLabel>}
      <textarea
        style={{ ...s.formInput, resize: "vertical", minHeight: "70px" }}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </FormGroup>
  );
}

export function SelectField({ label, name, value, onChange, options }) {
  return (
    <FormGroup>
      {label && <FormLabel>{label}</FormLabel>}
      <select style={s.formInput} name={name} value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </FormGroup>
  );
}
