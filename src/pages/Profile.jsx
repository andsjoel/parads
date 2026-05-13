import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../firebase/firebase";
import ProfileHeader from "../components/profile/ProfileHeader";

export default function Profile() {
  const [userData, setUserData] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const inventoryRef = doc(db, "user_inventory", user.uid);

    const [userSnap, inventorySnap] = await Promise.all([
      getDoc(userRef),
      getDoc(inventoryRef),
    ]);

    if (userSnap.exists()) {
      setUserData({
        id: userSnap.id,
        ...userSnap.data(),
      });
    }

    if (inventorySnap.exists()) {
      setInventory(inventorySnap.data());
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData(null);
        setInventory(null);
        setIsLoading(false);
        return;
      }

      await loadProfile(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-28 pt-6">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-app-primary shadow-[0_0_18px_rgba(255,183,3,0.35)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-28 pt-6 text-white">
      <section className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
        <ProfileHeader
          user={userData}
          inventory={inventory}
          onUpdated={setUserData}
        />

        <div className="rounded-[1.6rem] border border-white/10 bg-[#17231f]/70 p-4 backdrop-blur-2xl">
          <p className="text-sm font-black text-[#fffaf0]">Coleção</p>
          <p className="mt-1 text-xs text-app-muted">
            Fundos, fotos e efeitos desbloqueados aparecerão aqui.
          </p>
        </div>
      </section>
    </main>
  );
}