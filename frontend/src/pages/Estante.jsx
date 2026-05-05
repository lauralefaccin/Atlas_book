import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getGeneroColor, useGeneros } from "../data/generos";
import "./Livros.css"; // Reaproveitando os estilos
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import lixeiraIcon from "../imagens/icons/lixeira.png";
import estrelVazadaIcon from "../imagens/icons/estrela_vazada.png";
import estrelaCheiaIcon from "../imagens/icons/estrela (2).png";

const ALL_STATUS_FILTER = "Todos";
const STATUS_OPTIONS = ["Lendo", "Pretendo Ler", "Finalizado", "Desistiu"];

export default function Estante() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [livrosEstante, setLivrosEstante] = useState([]);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS_FILTER);
  const [showOnlyFavoritos, setShowOnlyFavoritos] = useState(false);
  
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
      showPopup(`Livro movido para "${novoStatus}".`);
      window.dispatchEvent(new CustomEvent("estante:changed"));
    } catch (err) {
      console.error("Erro ao atualizar status da estante:", err.message);
      showPopup("Não foi possível alterar a subdivisão do livro.");
    }
  };

  const toggleFavorito = async (livro) => {
    try {
      await api.toggleFavoritoEstante(livro.id);
      setLivrosEstante((current) =>
        current.map((l) => 
          l.id === livro.id ? { ...l, is_favorito: !l.is_favorito } : l
        )
      );
      const mensagem = livro.is_favorito ? "Removido dos favoritos." : "Adicionado aos favoritos.";
      showPopup(mensagem);
    } catch (err) {
      console.error("Erro ao atualizar favorito:", err.message);
      showPopup("Não foi possível atualizar o status de favorito.");
    }
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
    const passaFiltroStatus = statusFilter === ALL_STATUS_FILTER || status === statusFilter;
    const passaFiltrFavorito = !showOnlyFavoritos || livro.is_favorito === true;
    return passaFiltroStatus && passaFiltrFavorito;
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
        <div className="livros-status-filter estante-status-filter">
          <button
            type="button"
            className={`status-filter-btn ${statusFilter === ALL_STATUS_FILTER ? "active" : ""}`}
            onClick={() => setStatusFilter(ALL_STATUS_FILTER)}
          >
            Todos
          </button>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`status-filter-btn ${statusFilter === option ? "active" : ""}`}
              onClick={() => setStatusFilter(option)}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            className={`status-filter-btn ${showOnlyFavoritos ? "active" : ""}`}
            onClick={() => setShowOnlyFavoritos(!showOnlyFavoritos)}
            title="Mostrar apenas livros favoritos"
          >
             Favoritos
          </button>
        </div>
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
            const isFavorito = livro.is_favorito === true;

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
                      onClick={(e) => { e.stopPropagation(); toggleFavorito(livro); }}
                      title={isFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <img src={isFavorito ? estrelaCheiaIcon : estrelVazadaIcon} alt="Favoritos" />
                    </button>
                    <button className="btn-delete" onClick={(e) => { e.stopPropagation(); removerDaEstante(livro.id); }}>
                      <img src={lixeiraIcon} alt="Remover da estante" />
                    </button>
                  </div>
                </div>
                <div
                  className="livro-card-clickable"
                  onClick={(e) => { e.stopPropagation(); navigate(`/livro/${livro.id}`, { state: { fromEstante: true } }); }}
                  style={{ cursor: "pointer" }}
                >
                  <h3>{livro.titulo}</h3>
                  <p className="livro-autor">{livro.autor}</p>
                </div>

                <div className="livro-status-bar">
                  <span className={`livro-status-tag ${status.toLowerCase().replace(/\s+/g, "-")}`}>
                    {status}
                  </span>
                </div>

                <div className="livro-meta">
                  <button className="btn-ler" onClick={(e) => { e.stopPropagation(); navigate(`/livro/${livro.id}`, { state: { fromEstante: true } }); }}>
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