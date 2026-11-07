// Anel de progresso — só onde há um limite real (orçamento, meta, contas pagas).
export default function ProgressRing({
  value,
  color,
  size = 88,
  stroke = 8,
  label,
}: Readonly<{
  /** 0..1 (pode passar de 1; o anel trava cheio, o rótulo mostra o real) */
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
}>) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(value, 1));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "rgb(var(--border))" }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ stroke: color, transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-numeric"
        style={{ color: "rgb(var(--text))" }}
      >
        {label ?? `${Math.round(value * 100)}%`}
      </span>
    </div>
  );
}
