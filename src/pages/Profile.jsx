import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "../components/OrbitLoader";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileStats from "../components/profile/ProfileStats";
import { claimProfileMissionRewards } from "../services/profileMissionService";

export default function Profile() {
  const { userData: authUserData, sessionData, updateSessionData, loadingAuth } = useAuth();
  const [userData, setUserData] = useState(authUserData);
  const [isClaimingMissions, setIsClaimingMissions] = useState(false);

  useEffect(() => {
    setUserData(authUserData);
  }, [authUserData]);

  function handleUserUpdated(nextUser, changes = {}) {
    setUserData(nextUser);
    updateSessionData({ ...changes, user: nextUser });
  }

  async function handleClaimMissionRewards(category) {
    if (!userData?.id || !category || isClaimingMissions) return;

    try {
      setIsClaimingMissions(true);
      const result = await claimProfileMissionRewards(userData.id, category);
      const nextUser = {
        ...userData,
        progression: { ...userData.progression, coins: result.coins },
      };
      handleUserUpdated(nextUser, { stats: result.stats });
    } finally {
      setIsClaimingMissions(false);
    }
  }

  if (loadingAuth || !userData) {
    return (
      <main className="profile-page flex h-[100dvh] items-center justify-center overflow-hidden px-5 pb-20 pt-3">
        <OrbitLoader />
      </main>
    );
  }

  return (
    <main
      className="profile-page h-[100dvh] overflow-hidden pb-[76px] text-white"
      style={{ backgroundImage: `url(${generalBackground})` }}
    >
      <section className="mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden">
        <ProfileHeader
          user={userData}
          inventory={sessionData?.inventory}
          onUpdated={handleUserUpdated}
          compact
        />

        <ProfileStats
          stats={sessionData?.stats}
          missionsEnabled
          isClaiming={isClaimingMissions}
          onClaimRewards={handleClaimMissionRewards}
        />
      </section>
    </main>
  );
}
