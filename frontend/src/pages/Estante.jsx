import { useState, useEffect } from "react";
import { getGeneroColor, useGeneros } from "../data/generos";
import "./Livros.css"; // Reaproveitando os estilos
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import lixeiraIcon from "../imagens/icons/lixeira.png";
import estrelaIcon from "../imagens/icons/estrela.png";

const ALL_STATUS_FILTER = "Todos os Livros";
const STATUS_OPTIONS = ["Favoritos", "Lendo", "Pretendo Ler", "Finalizado", "Desistiu"];
const STATUS_FILTER_OPTIONS = [ALL_STATUS_FILTER, ...STATUS_OPTIONS];

export default function Estante() {
  const { user } = useAuth();
  const [livrosEstante, setLivrosEstante] = useState([]);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS_FILTER);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const generos = useGeneros();
  const { showPopup, showConfirmPopup } = usePopup();

  useEffect(() => {
    fetchEstante();
    const handler = () => fetchEstante();
    window.addEventListener("estante:changed", handler);
    return () => window.removeEventListener("estante:changed", handler);
  }, [user]);

  async function fetchEstante() {
    if (!user) {
      setLivrosEstante([]);
      return;
    }

    try {
      const estante = await api.getEstante();
      setLivrosEstante(estante);
    } catch (err) {
      console.error("Erro ao carregar estante:", err.message);
      setLivrosEstante([]);
    }
  }

  const getCorGenero = (generoNome) => {
    const generoCustomizado = generos.find(g => g.nome === generoNome);
    if (generoCustomizado?.cor) {
      return generoCustomizado.cor;
    }
    return getGeneroColor(generoNome);
  };

  const atualizarStatus = async (id, novoStatus) => {
    try {
      await api.atualizarStatusEstante(id, novoStatus);
      setLivrosEstante((current) =>
        current.map((livro) => (livro.id === id ? { ...livro, status: novoStatus } : livro))
      );
      setActiveMenuId(null);
      showPopup(`Livro movido para "${novoStatus}".`);
      window.dispatchEvent(new CustomEvent("estante:changed"));
    } catch (err) {
      console.error("Erro ao atualizar status da estante:", err.message);
      showPopup("Não foi possível alterar a subdivisão do livro.");
    }
  };

  const toggleFavorito = async (livro) => {
    const novaStatus = livro.status === "Favoritos" ? "Pretendo Ler" : "Favoritos";
    await atualizarStatus(livro.id, novaStatus);
  };

  const removerDaEstante = async (id) => {
    showConfirmPopup(
      "Tem certeza de que deseja remover este livro da estante? Esta ação não pode ser desfeita.",
      async () => {
        try {
          await api.removerEstante(id);
          setLivrosEstante((current) => current.filter((livro) => livro.id !== id));
          window.dispatchEvent(new CustomEvent("estante:changed"));
        } catch (err) {
          console.error("Erro ao remover da estante:", err.message);
          showPopup("Não foi possível remover o livro da estante.");
        }
      }
    );
  };

  const livrosFiltrados = livrosEstante.filter((livro) => {
    const status = livro.status || "Pretendo Ler";
    return statusFilter === ALL_STATUS_FILTER || status === statusFilter;
  });

  return (
    <section className="livros-page">
      <header className="livros-header">
        <div>
          <p className="livros-kicker">MINHA CONTA</p>
          <h1>Minha Estante</h1>
        </div>
      </header>

      <div className="livros-filters estante-filters">
        <label>
          Visualizar:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      {livrosFiltrados.length === 0 ? (
        <div className="livros-vazio">
          {livrosEstante.length === 0
            ? "Sua estante está vazia. Vá até a aba \"Livros\" e clique no ícone 🔖 para adicionar!"
            : "Nenhum livro encontrado nesta subdivisão."}
        </div>
      ) : (
        <div className="livros-grid">
          {livrosFiltrados.map((livro) => {
            const status = livro.status || "Pretendo Ler";
            const isFavorito = status === "Favoritos";

            return (
              <article
                key={livro.id}
                className="livro-card"
                style={{ "--livro-accent": getCorGenero(livro.genero) }}
              >
                <div className="livro-card-header">
                  <p className="livro-genero">{livro.genero}</p>
                  <div className="livro-card-actions">
                    <button
                      className={`btn-action-small btn-favorite ${isFavorito ? "active" : ""}`}
                      type="button"
                      onClick={() => toggleFavorito(livro)}
                      title={isFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <img src={estrelaIcon} alt="Favoritos" />
                    </button>
                    <button className="btn-delete" onClick={() => removerDaEstante(livro.id)}>
                      <img src={lixeiraIcon} alt="Remover da estante" />
                    </button>
                  </div>
                </div>
                <h3>{livro.titulo}</h3>
                <p className="livro-autor">{livro.autor}</p>

                <div className="livro-status-bar">
                  <span className={`livro-status-tag ${status.toLowerCase().replace(/\s+/g, "-")}`}>
                    {status}
                  </span>
                  <div className="status-menu-wrapper">
                    <button
                      className="btn-status-toggle"
                      type="button"
                      onClick={() => setActiveMenuId((current) => (current === livro.id ? null : livro.id))}
                    >
                      {activeMenuId === livro.id ? "Fechar" : "Mudar subdivisão"}
                    </button>
                    {activeMenuId === livro.id && (
                      <div className="status-menu">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={option === status ? "active" : ""}
                            onClick={() => atualizarStatus(livro.id, option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="livro-meta">
                  <button className="btn-ler" onClick={() => showPopup("Abrindo leitor...")}> 
                    Ler Livro
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}