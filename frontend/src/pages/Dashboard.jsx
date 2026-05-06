import Stats from "../components/Stats";
import Table from "../components/Table";
import { useAuth } from "../context/AuthContext";
import { useAcervo } from "../data/acervo";

export default function Dashboard() {
  const { user } = useAuth();
  const acervo = useAcervo();
  const primeiroNome = user?.nome?.trim().split(" ")[0] || "";

  return (
    <div className="dashboard">
      <div className="header">
        <h1>
          Bem-vindo(a)
          {primeiroNome && (
            <> <span className="dashboard-highlight">{primeiroNome}</span></>
          )}
          !
        </h1>
      </div>

      <Stats />

      <Table />
    </div>
  );
}