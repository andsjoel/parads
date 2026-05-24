import { Link } from "react-router-dom";
import { UserPlus, Users, ShieldCheck, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const adminServices = [
  {
    title: "Convites",
    description: "Quem vai entrar pro time",
    icon: UserPlus,
    to: "/admin/pre-registers",
    disabled: false,
  },
  {
    title: "Atletas",
    description: "Lista da galera",
    icon: Users,
    to: "#",
    disabled: true,
  },
  {
    title: "Lista",
    description: "Criar e organizar a lista",
    icon: ShieldCheck,
    to: "/admin/volley-list",
    disabled: false,
  },
  {
    title: "Arena",
    description: "Configurações do app",
    icon: Settings,
    to: "#",
    disabled: true,
  },
];

export default function Admin() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <main className="min-h-screen px-5 pb-28 pt-6 text-white">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-[420px] items-center justify-center">
          <div className="w-full rounded-[2rem] border border-dashed border-white/10 bg-white/[0.04] p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-app-primary/15 text-app-primary">
              <ShieldCheck size={26} />
            </div>

            <p className="text-lg font-black text-[#fffaf0]">
              Ops, somente para administradores.
            </p>

            <p className="mt-2 text-sm leading-relaxed text-[#9aa89f]">
              Essa area e reservada para quem organiza a comunidade.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-28 pt-6 text-white">
      <section className="mx-auto w-full max-w-[420px]">

        <div className="grid grid-cols-2 gap-3">
          {adminServices.map((service) => {
            const Icon = service.icon;

            const card = (
              <div
                className={`
                  group
                  relative
                  flex
                  aspect-square
                  flex-col
                  justify-between
                  overflow-hidden
                  rounded-[1.8rem]
                  border
                  border-white/10
                  bg-[#17231f]/75
                  p-4
                  shadow-[0_14px_40px_rgba(0,0,0,0.24)]
                  backdrop-blur-2xl
                  transition-all
                  duration-300
                  active:scale-[0.98]

                  ${
                    service.disabled
                      ? "opacity-45"
                      : "hover:-translate-y-1 hover:border-app-primary/20"
                  }
                `}
              >
                {/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,183,3,0.10),transparent_42%)] opacity-80" /> */}
                <div
                  className="
                    relative z-10
                    flex h-12 w-12 items-center justify-center
                    rounded-2xl
                    bg-app-primary/15
                    text-app-primary
                    transition-all duration-300
                    group-hover:scale-105
                    group-hover:shadow-[0_0_26px_rgba(255,183,3,0.28)]
                  "
                >
                  <Icon size={22} />
                </div>

                <div>
                  <h2 className="relative z-10 text-[15px] font-black tracking-tight text-[#fffaf0]">
                    {service.title}
                  </h2>

                  <p className="relative z-10 mt-1 text-xs leading-relaxed text-[#9aa89f]">
                    {service.description}
                  </p>
                </div>
                <div
                  className="
                    absolute left-0 bottom-0 h-1 w-full
                    bg-gradient-to-r
                    from-app-primary/0
                    via-app-primary/70
                    to-app-primary/0
                    opacity-60
                  "
                />
              </div>
            );

            if (service.disabled) {
              return <div key={service.title}>{card}</div>;
            }

            return (
              <Link key={service.title} to={service.to}>
                {card}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
