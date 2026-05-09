interface Props {
  label?: string;
}

export function Spinner({ label = "Loading" }: Props) {
  return (
    <div className="spinner-only" role="status" aria-label={label}>
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
