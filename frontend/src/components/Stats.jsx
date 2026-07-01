import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAutores } from "../data/autores";
import { useGeneros } from "../data/generos";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import tituloIcon from "../imagens/icons/livro.png";
import estrelasIcon from "../imagens/icons/estrela.png";
import coracaoIcon from "../imagens/icons/coracao.png";
import estanteIcon from "../imagens/icons/estante (2).png";
import autoresIcon from "../imagens/icons/autores.png";

export default function Stats() {
  const [livros, setLivros] = useState([]);
  const generos = useGeneros();
  const autores = useAutores();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [estanteCount, setEstanteCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      if (!user) {
        setEstanteCount(0);
        return;
      }

      try {
        const estante = await api.getEstante();
        setEstanteCount(estante.length);
      } catch (err) {
        console.error("Erro ao carregar contagem da estante:", err.message);
        setEstanteCount(0);
      }
    }

    async function loadLivros() {
      if (!user) {
        setLivros([]);
        return;
      }

      try {
        const livrosApi = await api.getLivros();
        setLivros(livrosApi);
      } catch (err) {
        console.error("Erro ao carregar livros para estatísticas:", err.message);
        setLivros([]);
      }
    }

    loadCount();
    loadLivros();

    const updateEstanteCount = () => {
      loadCount();
    };

    window.addEventListener("estante:changed", updateEstanteCount);
    return () => {
      window.removeEventListener("estante:changed", updateEstanteCount);
    };
  }, [user]);

  const totalAutores = autores.length;

  const livrosOrdenados = useMemo(() => {
    return [...livros].sort(
      (a, b) =>
        new Date(b.criado_em || b.adicionado_em || b.id) -
        new Date(a.criado_em || a.adicionado_em || a.id)
    );
  }, [livros]);

  const ultimoLivro = livrosOrdenados[0];

  const truncateText = (text, maxLength) => {
    if (typeof text !== 'string') return text;
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const statsData = [
    {
      title: "Títulos",
      value: livros.length,
      iconUrl: tituloIcon,
      action: () => navigate("/livros"),
    },
    {
      title: "Gêneros",
      value: generos.length,
      iconUrl: coracaoIcon,
      action: () => navigate("/generos"),
    },
    {
      title: "Autores",
      value: totalAutores,
      iconUrl: autoresIcon,
      action: () => navigate("/autores"),
    },
    {
      title: "Minha Estante",
      value: estanteCount,
      iconUrl: estanteIcon,
      action: () => navigate("/estante"),
    },
    {
      title: "Último adicionado",
      value: ultimoLivro ? truncateText(ultimoLivro.titulo, 15) : "Nenhum livro",
      iconUrl: estrelasIcon,
      action: ultimoLivro ? () => navigate(`/livro/${ultimoLivro.id}`) : null,
    },
  ];

  return (
    <div className="stats">
      {statsData.map((item, index) => (
        <button
          key={index}
          type="button"
          className={`card stat-card${item.action ? " clickable" : " disabled"}`}
          onClick={item.action || undefined}
          disabled={!item.action}
          aria-label={`${item.title}${item.value ? `: ${item.value}` : ""}`}
        >
          
          <div className="icon">
            {item.iconUrl ? (
              <img src={item.iconUrl} alt={`${item.title} icon`} />
            ) : (
              item.icon
            )}
          </div>

          <h2 className="value">
            {item.value}
          </h2>

          <p className="label">
            {item.title}
          </p>

        </button>
      ))}
    </div>
  );
}