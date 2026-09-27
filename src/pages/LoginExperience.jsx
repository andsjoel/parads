/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "../firebase/firebase";
import { buildAuthEmail } from "../utils/authEmail";
import { preloadUserSession } from "../services/sessionDataService";

const PASSWORD_LENGTH = 8;
const LOGIN_ANIMATION_MS = 5000;
const LOGIN_SUCCESS_MS = 1500;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function AnimatedUsername({ value, onChange, disabled, isSuccess }) {
  const inputRef = useRef(null);
  const exitIdRef = useRef(0);
  const [isFocused, setIsFocused] = useState(false);
  const [exitingCharacters, setExitingCharacters] = useState([]);

  function handleChange(event) {
    const nextValue = event.target.value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "")
      .toLowerCase()
      .slice(0, 24);

    if (nextValue.length < value.length) {
      const removed = value.slice(nextValue.length).split("").map((character) => ({
        character,
        id: exitIdRef.current++,
      }));

      setExitingCharacters((current) => [...current, ...removed]);
      window.setTimeout(() => {
        setExitingCharacters((current) =>
          current.filter((item) => !removed.some(({ id }) => id === item.id)),
        );
      }, 260);
    }

    onChange(nextValue);
  }

  return (
    <div
      className={`group absolute left-1/2 top-1/2 z-20 w-[min(86vw,430px)] -translate-x-1/2 -translate-y-1/2 cursor-text text-center transition-all duration-500 ${isSuccess ? "scale-90 opacity-0 blur-sm" : "opacity-100"}`}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        autoComplete="username"
        aria-label="Usuario"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />

      <div className="flex min-h-14 items-center justify-center overflow-visible">
        {!value && !isFocused ? (
          <span className="login-username-value text-[clamp(3.25rem,14vw,3.75rem)] font-normal text-white/42 transition-colors group-hover:text-white/58">
            usuario
          </span>
        ) : (
          <span className="login-username-value relative inline-flex items-center text-[clamp(3.25rem,14vw,3.75rem)] font-normal text-[#fffaf0]">
            {value.split("").map((character, index) => (
              <span
                key={`${index}-${character}`}
                className="login-character-enter inline-block"
              >
                {character}
              </span>
            ))}
            {exitingCharacters.map(({ character, id }) => (
              <span
                key={id}
                className="login-character-exit pointer-events-none absolute left-full"
              >
                {character}
              </span>
            ))}
            {isFocused && !disabled && <span className="login-caret ml-1 h-9 w-px bg-app-primary" />}
          </span>
        )}
      </div>
    </div>
  );
}

function PasswordDots({ value, onChange, disabled, isLoading, isReturning, isSuccess }) {
  const inputRef = useRef(null);

  return (
    <div
      className={`login-password-stage pointer-events-none absolute inset-0 transition-opacity duration-300 ${disabled && !isLoading ? "login-password-stage--locked" : ""} ${isSuccess ? "login-password-stage--success" : isReturning ? "login-password-stage--returning" : isLoading ? "login-password-stage--loading" : ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, PASSWORD_LENGTH))}
        maxLength={PASSWORD_LENGTH}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        autoComplete="current-password"
        aria-label="Senha de 8 caracteres"
        className="pointer-events-auto absolute left-0 top-[calc(50%+42px)] z-30 h-24 w-full cursor-text opacity-0"
      />

      <div className="login-password-track absolute inset-0" aria-hidden="true">
        {Array.from({ length: PASSWORD_LENGTH }).map((_, index) => {
          const angle = 450 - index * 45;
          const radians = (angle * Math.PI) / 180;

          return (
            <span
              key={index}
              className={`login-password-dot ${value.length > index ? "login-password-dot--active" : ""}`}
              style={{
                "--start-x": `${(index - 3.5) * 30}px`,
                "--dot-delay": `${index * 32}ms`,
                "--orbit-delay": `${(PASSWORD_LENGTH - 1 - index) * 95}ms`,
                "--return-delay": `${index * 45}ms`,
                "--depth-delay": `${index * 90}ms`,
                "--end-x": `${Math.sin(radians) * 108}px`,
                "--end-y": `${-Math.cos(radians) * 108}px`,
              }}
            />
          );
        })}
        <span className="login-success-core" />
      </div>
    </div>
  );
}

export default function LoginExperience() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const attemptRef = useRef(null);
  const navigate = useNavigate();
  const canSubmit = login.trim().length >= 5 && password.length === PASSWORD_LENGTH;

  useEffect(() => {
    if (!canSubmit || isLoading) return undefined;

    const signature = `${login}\u0000${password}`;
    if (attemptRef.current === signature) return undefined;

    const timer = window.setTimeout(async () => {
      attemptRef.current = signature;
      setErrorMessage("");
      setIsLoading(true);

      const authentication = signInWithEmailAndPassword(
          auth,
          buildAuthEmail(login.trim().toLowerCase()),
          password,
        )
          .then(async (credential) => {
            const session = await preloadUserSession(credential.user.uid);
            return session ? { ok: true } : { error: new Error("Usuario sem cadastro."), ok: false };
          })
          .catch((error) => ({ error, ok: false }));

      const [authResult] = await Promise.all([
        authentication,
        wait(LOGIN_ANIMATION_MS),
      ]);

      if (authResult.ok) {
        setIsSuccess(true);
        await wait(LOGIN_SUCCESS_MS);
        navigate("/feed", { replace: true });
        return;
      }

      console.error(authResult.error);
      setIsReturning(true);
      await wait(1200);
      setIsReturning(false);
      setIsLoading(false);
      setPassword("");
      setErrorMessage(
        authResult.error.code === "auth/too-many-requests"
          ? "Muitas tentativas. Aguarde um pouco."
          : "Usuario ou senha invalidos.",
      );
    }, 380);

    return () => window.clearTimeout(timer);
  }, [canSubmit, isLoading, login, navigate, password]);

  function handleLoginChange(value) {
    attemptRef.current = null;
    setLogin(value);
    if (value.trim().length < 5) setPassword("");
    setErrorMessage("");
  }

  function handlePasswordChange(value) {
    attemptRef.current = null;
    setPassword(value);
    setErrorMessage("");
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-7">
      <section className="flex flex-1 items-center justify-center">
        <div className="relative h-[320px] w-full max-w-[520px]">
          <AnimatedUsername value={login} onChange={handleLoginChange} disabled={isLoading} isSuccess={isSuccess} />
          <PasswordDots
            value={password}
            onChange={handlePasswordChange}
            disabled={isLoading || login.trim().length < 5}
            isLoading={isLoading}
            isReturning={isReturning}
            isSuccess={isSuccess}
          />

          <div className={`absolute left-0 right-0 top-[calc(50%+112px)] min-h-6 text-center transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}>
            {errorMessage && (
              <p className="login-error-enter text-sm font-normal text-red-300/80">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      <Link
        to="/register"
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-normal text-white/35 transition-colors hover:text-white/65 ${isLoading ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        Primeiro acesso
      </Link>

      {isSuccess && <span className="login-success-wave" aria-hidden="true" />}
    </main>
  );
}
