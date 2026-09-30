import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "../components/OrbitLoader";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileStats from "../components/profile/ProfileStats";

export default function Profile() {
  const { userData: authUserData, sessionData, updateSessionData, loadingAuth } = useAuth();
  const [userData, setUserData] = useState(authUserData);

  useEffect(() => {
    setUserData(authUserData);
  }, [authUserData]);

  function handleUserUpdated(nextUser, changes = {}) {
    setUserData(nextUser);
    updateSessionData({ ...changes, user: nextUser });
  }

  if (loadingAuth || !userData) {
    return (
      <main className="profile-page flex min-h-screen items-center justify-center px-5 pb-28 pt-6">
        <OrbitLoader />
      </main>
    );
  }

  return (
    <main
      className="profile-page min-h-screen pb-28 text-white"
      style={{ backgroundImage: `url(${generalBackground})` }}
    >
      <section className="mx-auto flex w-full max-w-[520px] flex-col">
        <ProfileHeader
          user={userData}
          inventory={sessionData?.inventory}
          onUpdated={handleUserUpdated}
        />

        <ProfileStats stats={sessionData?.stats} />
      </section>
    </main>
  );
}
