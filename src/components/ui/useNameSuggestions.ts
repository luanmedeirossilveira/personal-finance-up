"use client";

import { useEffect, useState } from "react";
import type { NameSuggestion, SuggestionSource } from "@/lib/name-suggestions-shared";

// Histórico de descrições do tipo de compra. Busca a cada abertura do formulário para já trazer
// o que foi lançado há pouco. Se falhar, o campo continua funcionando sem sugestões.
export function useNameSuggestions(source: SuggestionSource) {
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/name-suggestions?source=${source}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setSuggestions(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source]);

  return suggestions;
}
