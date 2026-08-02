"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renderiza o conteúdo (overlay + modal) diretamente no <body>, fora da árvore
// de componentes da página. Isso blinda os modais `position: fixed` contra
// qualquer ancestral que crie um containing block (transform, filter, contain,
// will-change, perspective) — a causa de modais aparecendo no topo/fim da página.
export default function ModalPortal({ children }: Readonly<{ children: React.ReactNode }>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
