/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
} from "firebase/auth";
import { ArrowLeft } from "lucide-react";

import { auth } from "../firebase/firebase";
import {
  findFirstAccessInvite,
  validateFirstAccessCode,
} from "../services/firstAccessService";
import { buildAuthEmail } from "../utils/authEmail";
import { maskPhone, onlyNumbers } from "../utils/phone";
import {
  createUserBaseData,
  isUsernameAvailable,
} from "../services/userService";

function PinInput({ value, length, onChange, autoComplete }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        maxLength={length}
        inputMode="numeric"
        autoComplete={autoComplete}
        className="absolute inset-0 z-10 h-full w-full opacity-0"
      />
      <div className="flex h-12 items-center justify-center gap-2.5 rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-5 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl focus-within:border-app-primary/30 focus-within:ring-4 focus-within:ring-app-primary/10">
        {Array.from({ length }).map((_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${value.length > index ? "bg-app-primary shadow-[0_0_12px_rgba(255,183,3,0.65)]" : "bg-white/10"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function FirstAccess() {
  const [phone, setPhone] = useState("");
  const [invite, setInvite] = useState(null);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [temporaryCode, setTemporaryCode] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const phoneComplete = onlyNumbers(phone).length === 11;

  useEffect(() => {
    let isCurrent = true;

    if (!phoneComplete) {
      setInvite(null);
      setNameConfirmed(false);
      setErrorMessage("");
      setIsLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    async function findInvite() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const result = await findFirstAccessInvite(phone);

        if (isCurrent) setInvite(result);
      } catch (error) {
        console.error(error);
        if (isCurrent) {
          setInvite(null);
          setErrorMessage("Nao encontramos um primeiro acesso pendente para este celular.");
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    findInvite();

    return () => {
      isCurrent = false;
    };
  }, [phone, phoneComplete]);

  async function handleFinish(event) {
    event.preventDefault();
    if (
      temporaryCode.length !== 6 ||
      username.trim().length < 5 ||
      newPassword.length !== 8 ||
      newPassword !== confirmPassword ||
      isLoading
    ) return;

    try {
      setIsLoading(true);
      setErrorMessage("");
      const cleanUsername = username.trim().toLowerCase();
      const codeIsValid = await validateFirstAccessCode(invite, temporaryCode);

      if (!codeIsValid) {
        setErrorMessage("Codigo de primeiro acesso invalido.");
        return;
      }

      if (!(await isUsernameAvailable(cleanUsername))) {
        setErrorMessage("Esse usuario ja esta em uso.");
        return;
      }

      const authEmail = buildAuthEmail(cleanUsername);
      await signOut(auth);
      const credential = await createUserWithEmailAndPassword(
        auth,
        authEmail,
        newPassword,
      );

      try {
        await createUserBaseData({
          uid: credential.user.uid,
          preRegister: invite,
          username: cleanUsername,
          authEmail,
        });
      } catch (error) {
        await deleteUser(credential.user);
        throw error;
      }

      navigate("/feed", { replace: true });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error.code === "auth/email-already-in-use"
          ? "Esse usuario ja esta em uso."
          : "Nao foi possivel concluir seu primeiro acesso.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen px-6 text-white">
      <Link
        to="/login"
        aria-label="Voltar para entrar"
        className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"
      >
        <ArrowLeft size={18} />
      </Link>

      <section className="mx-auto flex min-h-screen w-full max-w-[340px] items-center">
        <div className="w-full">

        {!invite && (
          <div className="relative">
            <input
              value={phone}
              onChange={(event) => {
                setPhone(maskPhone(event.target.value));
                setErrorMessage("");
              }}
              placeholder="Seu celular"
              inputMode="numeric"
              autoComplete="tel"
              className="h-12 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 pr-12 text-sm outline-none placeholder:text-app-muted focus:border-app-primary/30 focus:ring-4 focus:ring-app-primary/10"
            />
            {isLoading && (
              <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-app-primary" />
            )}
          </div>
        )}

        {invite && !nameConfirmed && (
          <div className="mt-6">
            <p className="text-sm text-app-muted">Voce e</p>
            <p className="mt-1 text-xl font-black">{invite.fullName}?</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setInvite(null)} className="h-12 rounded-full border border-white/10 text-sm font-bold text-slate-300">Nao</button>
              <button type="button" onClick={() => setNameConfirmed(true)} className="h-12 rounded-full bg-app-primary text-sm font-black text-[#1b1300]">Sim, sou eu</button>
            </div>
          </div>
        )}

        {invite && nameConfirmed && (
          <form onSubmit={handleFinish} className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-300">Codigo de primeiro acesso</p>
              <PinInput value={temporaryCode} length={6} autoComplete="one-time-code" onChange={(event) => setTemporaryCode(onlyNumbers(event.target.value).slice(0, 6))} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-300">Escolha seu usuario</p>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\s/g, "").toLowerCase())}
                minLength={5}
                autoComplete="username"
                className="h-12 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 text-sm outline-none placeholder:text-app-muted focus:border-app-primary/30 focus:ring-4 focus:ring-app-primary/10"
                placeholder="Seu usuario"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-300">Nova senha de 8 numeros</p>
              <PinInput value={newPassword} length={8} autoComplete="new-password" onChange={(event) => setNewPassword(onlyNumbers(event.target.value).slice(0, 8))} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-300">Confirme a nova senha</p>
              <PinInput value={confirmPassword} length={8} autoComplete="new-password" onChange={(event) => setConfirmPassword(onlyNumbers(event.target.value).slice(0, 8))} />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && <p className="text-sm text-red-400">As senhas nao conferem.</p>}
            <button type="submit" disabled={temporaryCode.length !== 6 || username.trim().length < 5 || newPassword.length !== 8 || newPassword !== confirmPassword || isLoading} className="h-12 w-full rounded-full bg-app-primary text-sm font-black text-[#1b1300] disabled:opacity-50">
              {isLoading ? "Concluindo..." : "Definir senha e entrar"}
            </button>
          </form>
        )}
        {errorMessage && <p className="mt-4 text-center text-sm text-red-400">{errorMessage}</p>}
        </div>
      </section>
    </main>
  );
}
