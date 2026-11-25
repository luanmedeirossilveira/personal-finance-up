// Chip de filtro (liga/desliga) — fatura do cartão e lista de contas do Mês.
export default function Chip({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active ? "border-accent-strong bg-accent-bg text-accent" : "border-line text-fg-soft"
      }`}
    >
      {children}
    </button>
  );
}
