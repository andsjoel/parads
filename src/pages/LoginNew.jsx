/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight } from "lucide-react";

import loginBackground from "../assets/app-backgrounds/bg-login.png";
import { auth } from "../firebase/firebase";
import { preloadUserSession } from "../services/sessionDataService";
import { buildAuthEmail } from "../utils/authEmail";

const PASSWORD_LENGTH = 8;

function PasswordDots({ value, onChange, disabled, isValidating, hasError }) {
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const isComplete = value.length === PASSWORD_LENGTH;

  return (
    <div
      className={`login-password-field ${isFocused ? "login-password-field--focused" : ""} ${isComplete ? "login-password-field--complete" : ""} ${hasError ? "login-password-field--error" : ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        type="password"
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, PASSWORD_LENGTH))
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        maxLength={PASSWORD_LENGTH}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        autoComplete="current-password"
        aria-label="senha de 8 digitos"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />

      <div className="login-password-dots" aria-hidden="true">
        {Array.from({ length: PASSWORD_LENGTH }).map((_, index) => (
          <span
            key={index}
            className={`login-password-dot-new ${value.length > index ? "login-password-dot-new--filled" : ""}`}
            style={{
              "--wave-delay": `${(PASSWORD_LENGTH - 1 - index) * 55}ms`,
            }}
          />
        ))}
      </div>
      {isComplete && isValidating && <span className="sr-only">validando</span>}
    </div>
  );
}

function AnimatedUsername({ value, onChange, disabled }) {
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
      className={`login-username-line ${isFocused ? "login-username-line--focused" : ""}`}
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
        aria-label="usuario"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <span className={`login-username-text ${!value && !isFocused ? "login-username-placeholder" : ""}`}>
        {(value || (!isFocused ? "usuario" : "")).split("").map((character, index) => (
          <span key={`${index}-${character}`} className={value ? "login-character-enter inline-block" : ""}>
            {character}
          </span>
        ))}
        {exitingCharacters.map(({ character, id }) => (
          <span key={id} className="login-character-exit pointer-events-none absolute">
            {character}
          </span>
        ))}
        {isFocused && !disabled && <span className="login-username-caret" />}
      </span>
    </div>
  );
}

export default function LoginNew() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [hasPasswordError, setHasPasswordError] = useState(false);
  const [, setErrorMessage] = useState("");
  const validationIdRef = useRef(0);
  const navigate = useNavigate();

  const canSubmit = isValidated && password.length === PASSWORD_LENGTH;

  function resetValidation() {
    validationIdRef.current += 1;
    setIsValidated(false);
    setHasPasswordError(false);
    setErrorMessage("");
  }

  useEffect(() => {
    if (login.trim().length < 5 || password.length !== PASSWORD_LENGTH) return undefined;

    const validationId = ++validationIdRef.current;
    const timer = window.setTimeout(async () => {
      setIsValidating(true);
      setHasPasswordError(false);
      setErrorMessage("");

      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          buildAuthEmail(login.trim()),
          password,
        );
        const session = await preloadUserSession(credential.user.uid);

        if (!session) throw new Error("usuario sem cadastro");
        if (validationId !== validationIdRef.current) return;
        setIsValidated(true);
      } catch (error) {
        if (validationId !== validationIdRef.current) return;
        console.error(error);
        setHasPasswordError(true);
        setErrorMessage(
          error.code === "auth/too-many-requests"
            ? "muitas tentativas. aguarde um pouco."
            : "usuario ou senha invalidos.",
        );
        window.setTimeout(() => {
          if (validationId !== validationIdRef.current) return;
          setPassword("");
          setHasPasswordError(false);
        }, 620);
      } finally {
        if (validationId === validationIdRef.current) setIsValidating(false);
      }
    }, 720);

    return () => window.clearTimeout(timer);
  }, [login, password]);

  function handleSubmit(event) {
    event.preventDefault();
    if (canSubmit) navigate("/feed", { replace: true });
  }

  return (
    <main className="login-page" style={{ backgroundImage: `url(${loginBackground})` }}>
      <form className="login-box" onSubmit={handleSubmit}>
        <AnimatedUsername
          value={login}
          onChange={(value) => {
            resetValidation();
            setLogin(value);
            if (value.trim().length < 5) setPassword("");
          }}
          disabled={isValidating || isValidated}
        />

        <PasswordDots
          value={password}
          onChange={(value) => {
            resetValidation();
            setPassword(value);
          }}
          disabled={isValidating || isValidated || login.trim().length < 5}
          isValidating={isValidating}
          hasError={hasPasswordError}
        />

        <button type="submit" disabled={!canSubmit} className="login-submit">
          {isValidating ? "validando..." : "entrar"}
        </button>

      </form>

      <Link to="/register" className="login-first-access">
        <span>primeiro acesso</span>
        <ArrowRight size={18} strokeWidth={1.8} />
      </Link>
    </main>
  );
}
