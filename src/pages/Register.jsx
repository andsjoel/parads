import { useEffect, useRef, useState } from "react";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { buildAuthEmail } from "../utils/authEmail";
import {
  createUserBaseData,
  isUsernameAvailable,
} from "../services/userService";

import { auth, db } from "../firebase/firebase";

function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

function onlyLetters(value) {
  return value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
}

function maskPhone(value) {
  const numbers = onlyNumbers(value).slice(0, 11);

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 3) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
  if (numbers.length <= 7) {
    return `${numbers.slice(0, 2)} ${numbers.slice(2, 3)} ${numbers.slice(3)}`;
  }

  return `${numbers.slice(0, 2)} ${numbers.slice(2, 3)} ${numbers.slice(
    3,
    7,
  )}-${numbers.slice(7)}`;
}

export default function Register() {
  const [phone, setPhone] = useState("");
  const [preRegister, setPreRegister] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [confirmedPerson, setConfirmedPerson] = useState(false);

  const [confirmationResult, setConfirmationResult] = useState(null);
  const [smsCode, setSmsCode] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const recaptchaRef = useRef(null);

  const phoneNumbers = onlyNumbers(phone);
  const isPhoneComplete = phoneNumbers.length === 11;

  const isUsernameValid = username.trim().length >= 5;
  const isPasswordValid = password.length === 8;
  const canCreateAccount =
    isUsernameValid && isPasswordValid && isPhoneVerified;

  const navigate = useNavigate();

  useEffect(() => {
    async function searchPreRegister() {
      if (!isPhoneComplete) {
        setPreRegister(null);
        setNotFound(false);
        setConfirmedPerson(false);
        setConfirmationResult(null);
        setSmsCode("");
        setIsPhoneVerified(false);
        return;
      }

      setIsSearching(true);
      setNotFound(false);
      setPreRegister(null);
      setConfirmedPerson(false);
      setConfirmationResult(null);
      setSmsCode("");
      setIsPhoneVerified(false);

      const phoneWithCountryCode = `55${phoneNumbers}`;
      const preRegisterRef = doc(
        db,
        "pre_registered_users",
        phoneWithCountryCode,
      );
      const preRegisterSnap = await getDoc(preRegisterRef);

      setIsSearching(false);

      if (!preRegisterSnap.exists()) {
        setNotFound(true);
        return;
      }

      const data = preRegisterSnap.data();

      if (!data.enabled || data.claimed) {
        setNotFound(true);
        return;
      }

      setPreRegister({
        id: preRegisterSnap.id,
        ...data,
      });
    }

    searchPreRegister();
  }, [isPhoneComplete, phoneNumbers]);

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function getSmsErrorMessage(error) {
    switch (error.code) {
      case "auth/invalid-phone-number":
        return "Número de telefone inválido.";

      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente mais tarde.";

      case "auth/quota-exceeded":
        return "Limite de SMS excedido. Tente novamente mais tarde.";

      case "auth/captcha-check-failed":
      case "auth/invalid-app-credential":
        return "Falha na verificação de segurança. Tente novamente.";

      default:
        return "Não foi possível enviar o SMS.";
    }
  }

  function getCodeErrorMessage(error) {
    switch (error.code) {
      case "auth/invalid-verification-code":
        return "Código incorreto. Confira o SMS e tente novamente.";

      case "auth/code-expired":
      case "auth/session-expired":
        return "Código expirado. Solicite um novo SMS.";

      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente mais tarde.";

      default:
        return "Não foi possível validar o código.";
    }
  }

  function getCreateAccountErrorMessage(error) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "Esse usuário já está em uso.";

      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Esse usuário já está em uso.";

      case "auth/weak-password":
        return "A senha precisa ter 8 caracteres.";

      case "auth/network-request-failed":
        return "Erro de conexão. Verifique sua internet.";

      case "permission-denied":
        return "Sem permissão para concluir o cadastro.";

      default:
        return "Não foi possível criar a conta.";
    }
  }

  function handlePhoneChange(event) {
    setPhone(maskPhone(event.target.value));
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value.slice(0, 8));
  }

  function handleUsernameChange(event) {
    setUsername(onlyLetters(event.target.value));
  }

  function handleNotMe() {
    clearRecaptcha();

    setPhone("");
    setPreRegister(null);
    setNotFound(false);
    setConfirmedPerson(false);
    setConfirmationResult(null);
    setSmsCode("");
    setIsPhoneVerified(false);
  }

  function handleBackToCode() {
    setIsPhoneVerified(false);
    setUsername("");
    setPassword("");
  }

  async function getRecaptchaVerifier() {
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }

    const container = document.getElementById("recaptcha-container");
    if (container) {
      container.innerHTML = "";
    }

    recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {
        console.log("reCAPTCHA resolvido");
      },
      "expired-callback": () => {
        console.log("reCAPTCHA expirado");
        recaptchaRef.current = null;
      },
    });

    await recaptchaRef.current.render();

    return recaptchaRef.current;
  }

  async function handleSendSms() {
    try {
      clearMessages();
      setIsSendingSms(true);

      const verifier = await getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(
        auth,
        `+${preRegister.phone}`,
        verifier,
      );

      setConfirmationResult(result);
      setSuccessMessage("Código enviado por SMS.");
    } catch (error) {
      console.error(error);
      clearRecaptcha();
      setErrorMessage(getSmsErrorMessage(error));
    } finally {
      setIsSendingSms(false);
    }
  }

  async function handleConfirmCode() {
    if (!confirmationResult || smsCode.length !== 6) return;

    try {
      clearMessages();
      setIsCheckingCode(true);

      await confirmationResult.confirm(smsCode);

      await signOut(auth);

      setIsPhoneVerified(true);
      setSuccessMessage("Telefone confirmado. Agora crie seu usuário.");
    } catch (error) {
      console.error(error);
      setErrorMessage(getCodeErrorMessage(error));
    } finally {
      setIsCheckingCode(false);
    }
  }

  async function createOrRecoverAuthCredential(authEmail, password) {
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        authEmail,
        password,
      );

      return {
        credential,
        isNewAuthUser: true,
      };
    } catch (error) {
      if (error.code !== "auth/email-already-in-use") {
        throw error;
      }

      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          authEmail,
          password,
        );
        const userSnap = await getDoc(doc(db, "users", credential.user.uid));

        if (userSnap.exists()) {
          await signOut(auth);
          throw error;
        }

        return {
          credential,
          isNewAuthUser: false,
        };
      } catch (recoverError) {
        console.error(recoverError);
        throw error;
      }
    }
  }

  async function handleCreateAccount() {
    if (!canCreateAccount || !preRegister) return;

    try {
      clearMessages();

      const cleanUsername = username.trim().toLowerCase();
      const authEmail = buildAuthEmail(cleanUsername);

      const available = await isUsernameAvailable(cleanUsername);

      if (!available) {
        setErrorMessage("Esse usuário já está em uso.");
        return;
      }

      await signOut(auth);

      const { credential, isNewAuthUser } = await createOrRecoverAuthCredential(
        authEmail,
        password,
      );

      try {
        await createUserBaseData({
          uid: credential.user.uid,
          preRegister,
          username: cleanUsername,
          authEmail,
        });
      } catch (error) {
        if (isNewAuthUser) {
          try {
            await deleteUser(credential.user);
          } catch (cleanupError) {
            console.error(cleanupError);
          }
        }

        throw error;
      }

      navigate("/feed");
    } catch (error) {
      console.error(error);
      setErrorMessage(getCreateAccountErrorMessage(error));
    }
  }

  function clearRecaptcha() {
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }

    const container = document.getElementById("recaptcha-container");
    if (container) {
      container.innerHTML = "";
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6">
      <div id="recaptcha-container" />

      <div className="absolute left-6 top-6 z-20">
        <Link
          to="/login"
          className="
            flex h-10 w-10 items-center justify-center
            rounded-full
            border border-white/10
            bg-[#17231f]/75
            text-stone-300
            shadow-[0_10px_30px_rgba(0,0,0,0.20)]
            backdrop-blur-2xl
            transition-all duration-300
            hover:border-app-primary/20
            hover:text-white
            active:scale-95
          "
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-[280px] w-[280px] rounded-full bg-app-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] right-[-100px] h-[260px] w-[260px] rounded-full bg-app-accent/10 blur-3xl" />

      <section className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-[340px] flex-col">
          <div className="mb-6 text-center">
            <p className="mt-2 text-sm leading-relaxed text-app-muted">
              Confirme seu número para criar sua conta.
            </p>
          </div>
          {!isPhoneVerified && (
            <input
              value={phone}
              onChange={handlePhoneChange}
              placeholder="61 9 9999-9999"
              inputMode="numeric"
              autoComplete="tel"
              className="h-12 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 text-center text-sm tracking-[0.08em] text-white shadow-[0_8px_40px_rgba(0,0,0,0.25)] outline-none backdrop-blur-2xl transition placeholder:text-app-muted focus:border-app-primary/30 focus:bg-white/[0.08] focus:ring-4 focus:ring-app-primary/10"
            />
          )}

          {isSearching && (
            <div className="mt-5 flex items-center justify-center gap-3 text-sm text-app-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-app-primary" />
            </div>
          )}

          {notFound && (
            <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.05] p-4 text-center text-sm text-[#fffaf0] backdrop-blur-xl">
              Número não encontrado no pré-cadastro.
            </div>
          )}

          {preRegister && !confirmedPerson && !isPhoneVerified && (
            <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 text-center shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition-all">
              <p className="text-sm text-app-muted">Esse número pertence à</p>

              <p className="mt-1 text-lg font-black text-white">
                {preRegister.fullName}
              </p>

              <p className="mt-1 text-sm text-app-muted">é você?</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmedPerson(true)}
                  className="h-11 rounded-full bg-app-primary text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(255,183,3,0.28)] transition active:scale-[0.98]"
                >
                  Sim
                </button>

                <button
                  type="button"
                  onClick={handleNotMe}
                  className="h-11 rounded-full border border-white/10 bg-white/[0.05] text-sm font-semibold text-[#fffaf0] transition active:scale-[0.98]"
                >
                  Não
                </button>
              </div>
            </div>
          )}

          {preRegister &&
            confirmedPerson &&
            !confirmationResult &&
            !isPhoneVerified && (
              <button
                type="button"
                onClick={handleSendSms}
                disabled={isSendingSms}
                className="mt-5 h-12 w-full rounded-full bg-app-primary text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(255,183,3,0.28)] transition active:scale-[0.98] disabled:opacity-50"
              >
                {isSendingSms ? "Enviando..." : "Receber código SMS"}
              </button>
            )}

          {confirmationResult && !isPhoneVerified && (
            <div className="mt-5 flex flex-col gap-3 transition-all">
              <input
                value={smsCode}
                onChange={(event) => {
                  clearMessages();
                  setSmsCode(onlyNumbers(event.target.value).slice(0, 6));
                }}
                placeholder="código SMS"
                inputMode="numeric"
                className="h-12 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 text-center text-sm tracking-[0.35em] text-white shadow-[0_8px_40px_rgba(0,0,0,0.25)] outline-none backdrop-blur-2xl transition placeholder:tracking-normal placeholder:text-app-muted focus:border-app-primary/30 focus:bg-white/[0.08] focus:ring-4 focus:ring-app-primary/10"
              />

              <button
                type="button"
                onClick={handleConfirmCode}
                disabled={smsCode.length !== 6 || isCheckingCode}
                className="h-12 w-full rounded-full bg-app-primary text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(255,183,3,0.28)] transition active:scale-[0.98] disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none"
              >
                {isCheckingCode ? "Validando..." : "Confirmar código"}
              </button>
            </div>
          )}

          {isPhoneVerified && (
            <div className="flex flex-col gap-3 transition-all">
              <input
                value={username}
                onChange={handleUsernameChange}
                placeholder="usuário"
                autoComplete="username"
                className="h-12 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 text-center text-sm text-white shadow-[0_8px_40px_rgba(0,0,0,0.25)] outline-none backdrop-blur-2xl transition placeholder:text-app-muted focus:border-app-primary/30 focus:bg-white/[0.08] focus:ring-4 focus:ring-app-primary/10"
              />

              <div className="relative">
                <input
                  value={password}
                  onChange={handlePasswordChange}
                  maxLength={8}
                  autoComplete="new-password"
                  className="absolute inset-0 z-10 h-full w-full opacity-0"
                />

                <div className="flex h-12 items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition focus-within:border-app-primary/30 focus-within:ring-4 focus-within:ring-app-primary/10">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span
                      key={index}
                      className={`
                        flex h-7 w-7 items-center justify-center rounded-full text-xs font-black uppercase transition-all duration-200
                        ${
                          password.length > index
                            ? "bg-app-primary text-slate-950 shadow-[0_0_12px_rgba(74,222,128,0.65)]"
                            : "bg-white/10 text-transparent"
                        }
                      `}
                    >
                      {password[index] || ""}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleBackToCode}
                  className="h-11 rounded-full border border-white/10 bg-white/[0.05] text-sm font-semibold text-[#fffaf0] transition active:scale-[0.98]"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleCreateAccount}
                  disabled={!canCreateAccount}
                  className="h-11 rounded-full bg-app-primary text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(255,183,3,0.28)] transition active:scale-[0.98] disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none"
                >
                  Cadastrar
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="mt-3 text-center text-sm font-medium text-red-400 animate-in fade-in duration-200">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="mt-3 text-center text-sm font-medium text-app-primary animate-in fade-in duration-200">
              {successMessage}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
