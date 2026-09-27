/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
} from "firebase/auth";
import { ArrowLeft, Eye } from "lucide-react";

import { auth } from "../firebase/firebase";
import {
  findFirstAccessInvite,
  validateFirstAccessCode,
} from "../services/firstAccessService";
import {
  createUserBaseData,
  isUsernameAvailable,
} from "../services/userService";
import { buildAuthEmail } from "../utils/authEmail";
import { maskPhone, onlyNumbers } from "../utils/phone";

const PASSWORD_LENGTH = 8;

function normalizeUsername(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase()
    .slice(0, 10);
}

function AnimatedField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  inputMode = "text",
  autoComplete,
  maxLength,
  disabled = false,
  wave = false,
  compact = false,
  align = "center",
}) {
  const inputRef = useRef(null);
  const exitIdRef = useRef(0);
  const [focused, setFocused] = useState(false);
  const [exiting, setExiting] = useState([]);

  function handleChange(event) {
    const nextValue = onChange(event.target.value);

    if (nextValue.length < value.length) {
      const removed = value.slice(nextValue.length).split("").map((character) => ({
        character,
        id: exitIdRef.current++,
      }));
      setExiting((current) => [...current, ...removed]);
      window.setTimeout(() => {
        setExiting((current) => current.filter(
          (item) => !removed.some(({ id }) => id === item.id),
        ));
      }, 260);
    }

    return nextValue;
  }

  return (
    <div
      className={`relative flex cursor-text items-center transition-all duration-500 ${align === "left" ? "justify-start text-left" : "justify-center text-center"} ${compact ? "min-h-14" : "min-h-20"}`}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`absolute inset-0 z-10 h-full w-full cursor-text opacity-0 ${disabled ? "pointer-events-none" : ""}`}
      />

      {!value && !focused ? (
        <span className="login-username-value text-[clamp(2.7rem,12vw,3.75rem)] leading-none text-white/40 transition-opacity duration-500">
          {placeholder}
        </span>
      ) : (
        <span className="login-username-value relative inline-flex items-center text-[clamp(2.7rem,12vw,3.75rem)] leading-none text-[#fffaf0] transition-opacity duration-500">
          {value.split("").map((character, index) => (
            <span
              key={`${index}-${character}`}
              className={`login-character-enter inline-block ${wave ? "register-character-wave" : ""}`}
              style={wave ? { "--character-wave-delay": `${(value.length - index - 1) * 45}ms` } : undefined}
            >
              {character === " " ? "\u00a0" : character}
            </span>
          ))}
          {exiting.map(({ character, id }) => (
            <span key={id} className="login-character-exit pointer-events-none absolute left-full">
              {character}
            </span>
          ))}
          {focused && !disabled && <span className="login-caret ml-1 h-9 w-px bg-[#5bc0ff]" />}
        </span>
      )}
    </div>
  );
}

function SecretDots({
  value,
  onChange,
  length,
  disabled = false,
  inputRef,
  wave = false,
  mismatch = false,
  label,
  onActivate,
  compact = false,
  revealValue = false,
  hidingValue = false,
  withReveal = false,
  onReveal,
}) {
  return (
    <div className={`relative text-center transition-all duration-500 ${compact ? "py-2" : "py-5"}`} onClick={onActivate}>
      {label && <p className={`text-left text-sm font-normal text-white/38 ${compact ? "mb-2" : "mb-5"}`}>{label}</p>}
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(onlyNumbers(event.target.value).slice(0, length))}
        maxLength={length}
        inputMode="numeric"
        autoComplete="one-time-code"
        disabled={disabled}
        aria-label={label}
        className={`absolute inset-0 z-10 h-full w-full cursor-text opacity-0 ${disabled ? "pointer-events-none" : ""}`}
      />
      <div className={`flex justify-center gap-4 ${mismatch ? "register-password-mismatch" : ""}`}>
        {Array.from({ length }).map((_, index) => (
          <span
            key={index}
            className={`register-secret-dot ${value.length > index ? "register-secret-dot--active" : ""} ${wave ? "register-secret-dot--wave" : ""} ${revealValue ? "register-secret-dot--revealed" : ""} ${hidingValue ? "register-secret-dot--hiding" : ""}`}
            style={{
              "--fill-delay": `${index * 32}ms`,
              "--wave-delay": `${(length - index - 1) * 55}ms`,
            }}
          >
            {(revealValue || hidingValue) && value[index]}
          </span>
        ))}
        {withReveal && (
          <button type="button" onClick={onReveal} className="register-secret-reveal" aria-label="Exibir senha por cinco segundos">
            <Eye size={22} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

function CreatingAccount({ username }) {
  return (
    <div className="register-creating fixed inset-0 z-50 flex items-center justify-center">
      <div className="relative flex h-[230px] w-[230px] items-center justify-center">
        <div className="absolute inset-0 animate-spin [animation-duration:2.2s]">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full border border-[#5bc0ff] shadow-[0_0_15px_rgba(91,192,255,0.48)]"
              style={{ transform: `translate(-50%, -50%) rotate(${index * 45}deg) translateY(-96px)` }}
            />
          ))}
        </div>
        <span className="login-username-value max-w-[160px] truncate text-4xl text-[#fffaf0]">
          {username}
        </span>
      </div>
    </div>
  );
}

export default function FirstAccessExperience() {
  const [stage, setStage] = useState("phone");
  const [phone, setPhone] = useState("");
  const [invite, setInvite] = useState(null);
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [passwordWave, setPasswordWave] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [passwordConfirmed, setPasswordConfirmed] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordHiding, setPasswordHiding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneWave, setPhoneWave] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const codeCheckRef = useRef("");
  const confirmationRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (stage !== "phone" || onlyNumbers(phone).length !== 11) return undefined;

    let active = true;
    setPhoneWave(true);
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const result = await findFirstAccessInvite(phone);
        if (active) {
          setInvite(result);
          setStage("confirm-name");
          setPhoneWave(false);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setPhoneWave(false);
          setErrorMessage("Não encontramos seu convite.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 1400);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [phone, stage]);

  useEffect(() => {
    if (stage !== "code" || code.length !== 6 || codeCheckRef.current === code) return;
    codeCheckRef.current = code;

    validateFirstAccessCode(invite, code).then((valid) => {
      if (valid) {
        setErrorMessage("");
        window.setTimeout(() => setStage("username"), 300);
      } else {
        setErrorMessage("Esse código não confere.");
        window.setTimeout(() => {
          codeCheckRef.current = "";
          setCode("");
        }, 550);
      }
    });
  }, [code, invite, stage]);

  useEffect(() => {
    if (stage !== "password" || password.length !== PASSWORD_LENGTH || confirmEnabled) return;
    setPasswordWave(true);
    const timer = window.setTimeout(() => {
      setPasswordWave(false);
      setConfirmEnabled(true);
      confirmationRef.current?.focus();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [confirmEnabled, password, stage]);

  useEffect(() => {
    if (
      stage !== "password" ||
      !confirmEnabled ||
      confirmation.length !== PASSWORD_LENGTH ||
      loading ||
      passwordConfirmed
    ) return;

    if (confirmation !== password) {
      setMismatch(true);
      setErrorMessage("As senhas não conferem.");
      const timer = window.setTimeout(() => {
        setMismatch(false);
        setConfirmation("");
        confirmationRef.current?.focus();
      }, 850);
      return () => window.clearTimeout(timer);
    }

    setPasswordConfirmed(true);
    return undefined;
  }, [confirmEnabled, confirmation, loading, password, passwordConfirmed, stage]);

  useEffect(() => {
    if (!passwordVisible) return undefined;
    const hideTimer = window.setTimeout(() => {
      setPasswordVisible(false);
      setPasswordHiding(true);
    }, 4400);
    const finishTimer = window.setTimeout(() => setPasswordHiding(false), 5200);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(finishTimer);
    };
  }, [passwordVisible]);

  function revealPassword() {
    setPasswordHiding(false);
    setPasswordVisible(false);
    window.requestAnimationFrame(() => setPasswordVisible(true));
  }

  async function createAccount() {
    if (!passwordConfirmed || loading) return;
    let credential = null;
    try {
      setLoading(true);
      setErrorMessage("");
      const authEmail = buildAuthEmail(username);
      await signOut(auth);
      credential = await createUserWithEmailAndPassword(auth, authEmail, password);
      await createUserBaseData({ uid: credential.user.uid, preRegister: invite, username, authEmail });
      await new Promise((resolve) => window.setTimeout(resolve, 2200));
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error(error);
      if (credential?.user) await deleteUser(credential.user).catch(() => {});
      setLoading(false);
      setPasswordConfirmed(false);
      setConfirmation("");
      setErrorMessage("Não foi possível criar sua conta.");
    }
  }

  async function continueWithUsername() {
    if (username.length < 5 || username.length > 10 || loading) return;
    try {
      setLoading(true);
      setErrorMessage("");
      if (!(await isUsernameAvailable(username))) {
        setErrorMessage("Esse usuário já está em uso.");
        return;
      }
      setStage("password");
    } finally {
      setLoading(false);
    }
  }

  function handlePasswordChange(value) {
    if (confirmEnabled) {
      setConfirmEnabled(false);
      setConfirmation("");
    }
    setPassword(value);
    setPasswordConfirmed(false);
    setErrorMessage("");
  }

  function reopenPassword() {
    if (!confirmEnabled || loading) return;
    setConfirmEnabled(false);
    setPassword("");
    setConfirmation("");
    setErrorMessage("");
  }

  const stageOrder = {
    phone: 0,
    "confirm-name": 1,
    code: 2,
    username: 3,
    password: 4,
  };
  const currentStage = stageOrder[stage];

  return (
    <main className="relative min-h-screen overflow-x-hidden px-6 text-white">
      <Link to="/login" aria-label="Voltar" className="absolute left-6 top-6 z-40 text-white/40 transition-colors hover:text-white/70">
        <ArrowLeft size={23} strokeWidth={1.4} />
      </Link>

      <section className={`mx-auto flex min-h-screen w-full max-w-[520px] justify-center transition-all duration-700 ${currentStage > 0 ? "items-start pb-3 pt-16" : "items-center py-20"}`}>
        <div className="register-flow-stack w-full text-center">
          <div className={currentStage > 0 ? "register-flow-item-complete" : ""}>
            <AnimatedField
              value={phone}
              onChange={(value) => {
                const masked = maskPhone(value);
                setPhone(masked);
                setErrorMessage("");
                return masked;
              }}
              placeholder="61 9 9999-9999"
              ariaLabel="Celular"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={16}
              disabled={loading || currentStage > 0}
              wave={phoneWave}
              compact={currentStage > 0}
              align={currentStage > 0 ? "left" : "center"}
            />
          </div>

          {currentStage >= 1 && invite && (
            <div className={`register-stage-enter mt-1 ${currentStage > 1 ? "register-flow-item-complete" : ""}`}>
              <p className="text-left text-base font-normal text-white/38">Bem-vindo,</p>
              <p className="login-username-value mt-0 text-left text-[clamp(3.25rem,14vw,4.5rem)] leading-none text-[#fffaf0] transition-opacity duration-500">
                {invite.fullName}
              </p>
              {stage === "confirm-name" && (
                <div className="mt-8 flex items-center justify-between gap-5 text-sm">
                  <button type="button" onClick={() => { setInvite(null); setPhone(""); setStage("phone"); }} className="register-outline-action">
                    não sou eu
                  </button>
                  <button type="button" onClick={() => setStage("code")} className="register-paper-action justify-self-end">
                    sou eu
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === "code" && (
            <div className="register-stage-enter mt-5">
              <SecretDots
                value={code}
                onChange={(value) => { setCode(value); setErrorMessage(""); }}
                length={6}
                disabled={loading}
                label="código de primeiro acesso"
              />
            </div>
          )}

          {currentStage > 2 && (
            <p className="register-stage-enter mt-2 text-left text-sm font-semibold text-white/38">
              Seu código está correto.
            </p>
          )}

          {stage === "username" && (
            <div className="register-stage-enter mt-2">
              <p className="mb-1 text-left text-sm font-normal text-white/38">Agora crie seu</p>
              <AnimatedField
                value={username}
                onChange={(value) => {
                  const normalized = normalizeUsername(value);
                  setUsername(normalized);
                  setErrorMessage("");
                  return normalized;
                }}
                placeholder="usuario"
                ariaLabel="Novo usuario"
                autoComplete="username"
                maxLength={10}
                disabled={loading}
                align="center"
              />
              <p className="mt-1 text-right text-xs text-white/25">de 5 a 10 caracteres</p>
              <div className="mt-3 flex justify-end">
                <button type="button" disabled={username.length < 5 || loading} onClick={continueWithUsername} className="register-paper-action disabled:opacity-20">
                  continuar
                </button>
              </div>
            </div>
          )}

          {currentStage >= 4 && (
            <div className="register-stage-enter mt-2">
              <p className="text-left text-sm font-normal text-white/38">seu usuário é</p>
              <p className="login-username-value mt-0 text-left text-[clamp(2.7rem,12vw,3.75rem)] leading-none text-[#fffaf0] opacity-70">{username}</p>
            </div>
          )}

          {stage === "password" && (
            <div className="register-stage-enter mt-1">
              {!passwordConfirmed && <SecretDots
                value={password}
                onChange={handlePasswordChange}
                onActivate={reopenPassword}
                length={8}
                disabled={loading}
                wave={passwordWave}
                label="crie sua senha"
                compact
              />}
              <div className={`overflow-hidden transition-all duration-500 ${confirmEnabled && !passwordConfirmed ? "max-h-40 translate-y-0 opacity-100" : "max-h-0 -translate-y-4 opacity-0"}`}>
                <SecretDots inputRef={confirmationRef} value={confirmation} onChange={(value) => { setConfirmation(value); setErrorMessage(""); }} length={8} disabled={loading || !confirmEnabled} mismatch={mismatch} label="repita a senha" compact />
              </div>
              {passwordConfirmed && (
                <div className="register-stage-enter">
                  <SecretDots value={password} onChange={() => password} length={8} disabled label="sua senha é" revealValue={passwordVisible} hidingValue={passwordHiding} wave={passwordVisible || passwordHiding} withReveal onReveal={revealPassword} compact />
                </div>
              )}
            </div>
          )}

          <div className="mt-2 min-h-5">
            {loading && stage === "phone" && <span className="inline-block h-4 w-4 animate-spin rounded-full border border-white/20 border-t-[#5bc0ff]" />}
            {errorMessage && <p className="register-error-enter text-sm font-normal text-red-300/80">{errorMessage}</p>}
          </div>
        </div>
      </section>

      {passwordConfirmed && !loading && (
        <div className="fixed bottom-6 right-6 z-40">
          <button type="button" onClick={createAccount} className="register-paper-action">criar conta</button>
        </div>
      )}

      {loading && stage === "password" && <CreatingAccount username={username} />}
    </main>
  );
}
