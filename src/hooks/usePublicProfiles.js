import { useEffect, useRef, useState } from "react";
import { getPublicProfileBundle, getPublicProfilePreviews } from "../services/publicProfileService";

export function usePublicProfilePreviews(userIds, { selfBundle, embedded = {} } = {}) {
  const localProfiles = embedded || {};
  const scope = selfBundle?.user?.id || "";
  const key = JSON.stringify([...new Set(userIds.filter((id) =>
    id && id !== scope && !localProfiles[id],
  ))].sort());
  const loaded = useRef({ scope, profiles: {} });
  const [result, setResult] = useState({ scope, profiles: {} });

  useEffect(() => {
    let current = true;
    if (loaded.current.scope !== scope) loaded.current = { scope, profiles: {} };
    const ids = JSON.parse(key);
    const missing = ids.filter((id) => !loaded.current.profiles[id]);
    if (!missing.length) return undefined;
    getPublicProfilePreviews(missing).then((profiles) => {
      if (!current) return;
      loaded.current.profiles = { ...loaded.current.profiles, ...profiles };
      setResult({ scope, profiles: loaded.current.profiles });
    }).catch((error) => console.warn("Falha ao carregar os perfis:", error));
    return () => { current = false; };
  }, [key, scope]);

  return {
    ...(result.scope === scope ? result.profiles : {}),
    ...localProfiles,
    ...(scope ? { [scope]: selfBundle } : {}),
  };
}

export function useSelectedPublicProfile(userId, localBundle) {
  const [result, setResult] = useState({ id: null, bundle: null, loading: false });
  useEffect(() => {
    if (!userId) {
      setResult({ id: null, bundle: null, loading: false });
      return undefined;
    }
    if (localBundle) return undefined;
    let current = true;
    setResult({ id: userId, bundle: null, loading: true });
    getPublicProfileBundle(userId, { force: true }).then((bundle) => {
      if (current) setResult({ id: userId, bundle, loading: false });
    }).catch((error) => {
      console.warn("Falha ao abrir a carta:", error);
      if (current) setResult({ id: userId, bundle: null, loading: false });
    });
    return () => { current = false; };
  }, [userId, localBundle]);
  if (localBundle) return { bundle: localBundle, loading: false };
  return result.id === userId ? result : { bundle: null, loading: Boolean(userId) };
}
