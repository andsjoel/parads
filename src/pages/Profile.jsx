import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "../components/OrbitLoader";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileStats from "../components/profile/ProfileStats";

export default function Profile() {
  const { userData: authUserData, sessionData, loadingAuth } = useAuth();
  const [userData, setUserData] = useState(authUserData);

  useEffect(() => {
    setUserData(authUserData);
  }, [authUserData]);

  if (loadingAuth || !userData) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-28 pt-6">
        <OrbitLoader />
      </main>
    );
  }

  return (
    <main className="profile-page min-h-screen pb-28 text-white">
      <section className="mx-auto flex w-full max-w-[520px] flex-col">
        <ProfileHeader
          user={userData}
          inventory={sessionData?.inventory}
          onUpdated={setUserData}
        />

        <ProfileStats stats={sessionData?.stats} />
      </section>
    </main>
  );
}
