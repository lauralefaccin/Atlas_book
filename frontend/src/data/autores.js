import { useState, useEffect } from "react";
import { api } from "../services/api";

const AUTORES_CHANGED_EVENT = "autores:changed";

export function useAutores() {
  const [autores, setAutores] = useState([]);

  async function fetchAutores() {
    try {
      const data = await api.getAutores();
      setAutores(data);
    } catch (err) {
      console.error("Erro ao carregar autores:", err.message);
      setAutores([]);
    }
  }

  useEffect(() => {
    fetchAutores();

    const handler = () => fetchAutores();
    window.addEventListener(AUTORES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AUTORES_CHANGED_EVENT, handler);
  }, []);

  return autores;
}

export function dispatchAutoresChanged() {
  window.dispatchEvent(new CustomEvent(AUTORES_CHANGED_EVENT));
}