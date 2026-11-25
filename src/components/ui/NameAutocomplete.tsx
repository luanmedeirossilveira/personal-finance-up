"use client";

import { useId, useMemo, useState } from "react";
import { categoryLabel } from "@/lib/categories";
import { BRL } from "@/lib/month";
import { matchNameSuggestions, type NameSuggestion, type SuggestionSource } from "@/lib/name-suggestions-shared";
import { useNameSuggestions } from "./useNameSuggestions";

// Campo de descrição com sugestões do histórico (compras repetitivas). Escolher uma sugestão
// chama onPick, e o formulário decide o que mais preencher (categoria, valor).
export default function NameAutocomplete({
  source,
  value,
  onChange,
  onPick,
  enabled = true,
  className,
  placeholder,
  required,
}: Readonly<{
  source: SuggestionSource;
  value: string;
  onChange: (value: string) => void;
  onPick: (suggestion: NameSuggestion) => void;
  /** false = campo comum, sem sugestões (ex.: nome de fatura no BillForm). */
  enabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
}>) {
  const suggestions = useNameSuggestions(source);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  const matches = useMemo(() => matchNameSuggestions(suggestions, value), [suggestions, value]);
  const visible = enabled && open && matches.length > 0;

  function pick(s: NameSuggestion) {
    onPick(s);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!enabled || matches.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setOpen(true);
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (e.key === "Enter" && visible && active >= 0) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape" && visible) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const meta = (s: NameSuggestion) => {
    // Categorias do cartão alimentação (refeição, mercado…) são próprias: mostra como estão.
    const cat = s.category ? (source === "meal" ? s.category.charAt(0).toUpperCase() + s.category.slice(1) : categoryLabel(s.category)) : null;
    const amount = s.fixedAmount != null ? BRL(s.fixedAmount) : `últ. ${BRL(s.lastAmount)}`;
    return [cat, amount].filter(Boolean).join(" · ");
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role={enabled ? "combobox" : undefined}
        aria-expanded={enabled ? visible : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-autocomplete={enabled ? "list" : undefined}
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-[80] max-h-56 overflow-auto rounded-lg border border-line bg-surface-raised shadow-lg py-1"
        >
          {matches.map((s, i) => (
            <li
              key={s.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, não click: evita o blur do input fechar a lista antes da escolha.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-baseline justify-between gap-3 px-3 py-2 cursor-pointer ${i === active ? "bg-accent-bg" : ""}`}
            >
              <span className="text-sm text-fg truncate">{s.name}</span>
              <span className="text-[11px] text-fg-muted whitespace-nowrap">{meta(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
