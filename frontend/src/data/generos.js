import { useState, useEffect } from "react";
import { api } from "../services/api";

const GENEROS_CHANGED_EVENT = "generos:changed";

// Mantido para uso nos livros e autores que precisam resolver cor por nome
export const GENERO_COR_MAP_FALLBACK = {
  "Clássico":          "#c7922d",
  "Romance":           "#2d5c4e",
  "Ficção Científica": "#486ca5",
  "Fantasia":          "#7a5a92",
  "Realismo":          "#2d5c4e",
  "Distopia":          "#486ca5",
  "Mistério":          "#5c3d2e",
  "Terror":            "#3b1a1a",
  "Aventura":          "#4a7c3f",
  "Realismo":          "#8c7b5a",
  "Poesia":            "#8c3a6b",
  "Biografia":         "#3a6b8c",
  "Filosofia":         "#5a6b3a",
  "Policial":          "#3a4a5a",
  "Histórico":         "#7a5a3a",
  "Infantojuvenil":    "#c85a2e",
};

export function getGeneroColor(generoNome) {
  return GENERO_COR_MAP_FALLBACK[generoNome] || "#c08928";
}

export function useGeneros() {
  const [generos, setGeneros] = useState([]);

  async function fetchGeneros() {
    try {
      const data = await api.getGeneros();
      setGeneros(data);
    } catch (err) {
      console.error("Erro ao carregar gêneros:", err.message);
      setGeneros([]);
    }
  }

  useEffect(() => {
    fetchGeneros();

    const handler = () => fetchGeneros();
    window.addEventListener(GENEROS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(GENEROS_CHANGED_EVENT, handler);
  }, []);

  return generos;
}

export function dispatchGenerosChanged() {
  window.dispatchEvent(new CustomEvent(GENEROS_CHANGED_EVENT));
}