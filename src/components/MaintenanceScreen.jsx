import background from "../assets/app-backgrounds/bg-manutencao.png";

export default function MaintenanceScreen() {
  return (
    <main className="maintenance-screen" style={{ backgroundImage: `url(${background})` }}>
      <h1 className="sr-only">Parads em manutenção</h1>
      <p className="sr-only">Estamos ajustando a rede por aqui. Daqui a pouco o jogo continua.</p>
    </main>
  );
}
