export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips({ values, value, onChange, label, small }) {
  return (
    <div className={"chips" + (small ? " small" : "")}>
      {values.map((v) => (
        <button key={String(v)} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label ? label(v) : v}
        </button>
      ))}
    </div>
  );
}
