// acervo.js — usado apenas pelo Dashboard (useAcervo) para exibir
// o "último livro adicionado" enquanto os livros reais vêm da API.
// O localStorage aqui é só um cache local legado; ele não é mais
// a fonte de verdade — essa responsabilidade passou para o backend.

import { useEffect, useState } from "react";

const STORAGE_KEY = "acervo_livros";
const ACERVO_CHANGED_EVENT = "acervo:changed";

export function saveAcervo(livros) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(livros));
  window.dispatchEvent(new CustomEvent(ACERVO_CHANGED_EVENT));
}

export function useAcervo() {
  const [livros, setLivros] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const salvo = window.localStorage.getItem(STORAGE_KEY);
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncAcervo = () => {
      try {
        const salvo = window.localStorage.getItem(STORAGE_KEY);
        setLivros(salvo ? JSON.parse(salvo) : []);
      } catch {
        setLivros([]);
      }
    };

    window.addEventListener(ACERVO_CHANGED_EVENT, syncAcervo);
    window.addEventListener("storage", syncAcervo);

    return () => {
      window.removeEventListener(ACERVO_CHANGED_EVENT, syncAcervo);
      window.removeEventListener("storage", syncAcervo);
    };
  }, []);

  return livros;
}