import { Smartphone } from "lucide-react";
import background from "../assets/app-backgrounds/bg-geral.png";

export default function DesktopBlocked() {
  return (
    <main className="desktop-blocked" style={{ backgroundImage: `url(${background})` }}>
      <section className="desktop-blocked-content">
        <Smartphone size={48} strokeWidth={1.5} className="mx-auto mb-6 text-[#ff7026]" aria-hidden="true" />
        <p className="mb-3 text-sm text-[#ff7026]">Parads</p>
        <h1 className="font-idv-title mb-5 text-4xl">Abra no celular.</h1>
        <p className="text-base leading-relaxed text-[#dfd5d6]">
          O Parads foi feito para dispositivos móveis e não está disponível no computador.
        </p>
        <p className="mt-4 text-sm text-[#a99b9e]">Acesse parads.com.br pelo navegador do seu celular.</p>
      </section>
    </main>
  );
}
