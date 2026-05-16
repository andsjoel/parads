import { useState } from "react";
import { Link } from "react-router-dom";

import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "../firebase/firebase";
import { buildAuthEmail } from "../utils/authEmail";

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  function handlePasswordChange(event) {
    const value = event.target.value.slice(0, 8);

    setPassword(value);
    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isSubmitEnabled || isLoading) return;

    setErrorMessage("");

    try {
      setIsLoading(true);

      const cleanLogin = login.trim().toLowerCase();
      const authEmail = buildAuthEmail(cleanLogin);

      const credential = await signInWithEmailAndPassword(
        auth,
        authEmail,
        password,
      );

      console.log("Usuário logado:", credential.user);

      navigate("/feed", { replace: true });
    } catch (error) {
      console.error(error);

      switch (error.code) {
        case "auth/user-not-found":
          setErrorMessage("Usuário não encontrado.");
          break;

        case "auth/wrong-password":
          setErrorMessage("Senha incorreta.");
          break;

        case "auth/invalid-credential":
          setErrorMessage("Usuário ou senha inválidos.");
          break;

        case "auth/too-many-requests":
          setErrorMessage("Muitas tentativas. Tente novamente mais tarde.");
          break;

        default:
          setErrorMessage("Não foi possível entrar.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const isSubmitEnabled = login.trim().length >= 5 && password.trim().length === 8;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6">
      <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-[280px] w-[280px] rounded-full bg-app-primary/15 blur-3xl" />

      <div className="pointer-events-none absolute bottom-[-140px] right-[-100px] h-[260px] w-[260px] rounded-full bg-app-accent/10 blur-3xl" />

      <section className="flex flex-1 items-center justify-center pb-24">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-[340px] flex-col"
        >
          <div className="mb-3">
            <input
              value={login}
              onChange={(event) => {
                setLogin(event.target.value);
                setErrorMessage("");
              }}
              placeholder="Seu usuário"
              autoComplete="username"
              className="
                h-12
                w-full
                rounded-[1.4rem]
                border
                border-white/10
                bg-white/[0.06]
                px-4
                text-sm
                text-white
                shadow-[0_8px_40px_rgba(0,0,0,0.25)]
                outline-none
                backdrop-blur-2xl
                transition
                placeholder:text-app-muted
                focus:border-app-primary/30
                focus:bg-white/[0.08]
                focus:ring-4
                focus:ring-app-primary/10
              "
            />
          </div>

          <div className="mb-5">
            <div className="relative">
              <input
                value={password}
                onChange={handlePasswordChange}
                maxLength={8}
                autoComplete="current-password"
                className="absolute inset-0 z-10 h-full w-full opacity-0"
              />

              <div
                className="
                  flex
                  h-12
                  items-center
                  justify-center
                  gap-2.5
                  rounded-[1.4rem]
                  border
                  border-white/10
                  bg-white/[0.06]
                  px-5
                  shadow-[0_8px_40px_rgba(0,0,0,0.25)]
                  backdrop-blur-2xl
                  transition
                  focus-within:border-app-primary/30
                  focus-within:ring-4
                  focus-within:ring-app-primary/10
                "
              >
                {Array.from({ length: 8 }).map((_, index) => (
                  <span
                    key={index}
                    className={`
                      h-2.5
                      w-2.5
                      rounded-full
                      transition-all
                      duration-200
                      ${
                        password.length > index
                          ? "bg-app-primary shadow-[0_0_12px_rgba(255,183,3,0.65)]"
                          : "bg-white/10"
                      }
                    `}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isSubmitEnabled || isLoading}
            className={`
              h-12
              w-full
              rounded-full
              text-sm
              font-black
              transition
              active:scale-[0.98]

              ${
                isSubmitEnabled && !isLoading
                  ? `
                  bg-app-primary
                  text-[#1b1300]
                  shadow-[0_10px_30px_rgba(255,183,3,0.28)]
                  hover:brightness-110
                  `
                  : `
                  bg-white/[0.06]
                  text-app-muted
                  border
                  border-white/8
                  cursor-not-allowed
                  `
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
          {errorMessage && (
            <p
              className="
                mt-2
                text-center
                text-sm
                font-medium
                text-red-400
                animate-in
                fade-in
                duration-200
              "
            >
              {errorMessage}
            </p>
          )}
        </form>
      </section>

      <div className="fixed bottom-6 left-0 right-0 px-6">
        <Link
          to="/register"
          className="
            mx-auto
            flex
            h-12
            w-full
            max-w-[340px]
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-white/[0.04]
            text-sm
            font-semibold
            text-[#fffaf0]
            shadow-[0_8px_30px_rgba(0,0,0,0.2)]
            backdrop-blur-xl
            transition
            hover:bg-white/[0.06]
            active:scale-[0.98]
          "
        >
          Entrar para o time
        </Link>
      </div>
    </main>
  );
}
