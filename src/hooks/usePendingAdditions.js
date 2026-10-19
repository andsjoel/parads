import { useEffect, useRef, useState } from "react";

export function usePendingAdditions(scope) {
  const running = useRef(new Set());
  const mounted = useRef(false);
  const [pending, setPending] = useState([]);
  const [failures, setFailures] = useState([]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function dismiss(id) {
    setFailures((items) => items.filter((item) => item.scope !== scope || item.id !== id));
  }

  async function add(item, action) {
    const key = JSON.stringify([scope, item.id]);
    if (running.current.has(key)) return { ok: false };
    running.current.add(key);
    dismiss(item.id);
    setPending((items) => [...items, { ...item, scope }]);
    try {
      const value = await action();
      return { ok: true, value };
    } catch {
      if (mounted.current) {
        setFailures((items) => [...items, { ...item, scope }]);
      }
      return { ok: false };
    } finally {
      running.current.delete(key);
      if (mounted.current) {
        setPending((items) => items.filter((entry) => entry.scope !== scope || entry.id !== item.id));
      }
    }
  }

  return {
    pending: pending.filter((item) => item.scope === scope),
    failures: failures.filter((item) => item.scope === scope),
    add,
    dismiss,
  };
}
