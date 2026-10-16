import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "../components/OrbitLoader";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileStats from "../components/profile/ProfileStats";
import { claimProfileMissionRewards } from "../services/profileMissionService";
import PromotionalMissions from "../components/profile/PromotionalMissions";
import { claimPromotionalMission } from "../services/promotionalMissionService";

export default function Profile() {
  const { userData: authUserData, sessionData, updateSessionData, loadingAuth } = useAuth();
  const [userData, setUserData] = useState(authUserData);
  const [isClaimingMissions, setIsClaimingMissions] = useState(false);
  const [selectedStat, setSelectedStat] = useState(null);
  const [isClaimingPromotion, setIsClaimingPromotion] = useState(false);

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

  async function handleClaimPromotion(missionId) {
    if (!userData?.id || isClaimingPromotion) return;
    try {
      setIsClaimingPromotion(true);
      const result = await claimPromotionalMission(userData.id, missionId);
      handleUserUpdated({ ...userData, progression: { ...userData.progression, coins: result.coins } }, { stats: result.stats });
    } finally {
      setIsClaimingPromotion(false);
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
      className="profile-page min-h-[100dvh] pb-[calc(90px+env(safe-area-inset-bottom))] text-white"
      style={{ backgroundImage: `url(${generalBackground})` }}
    >
      <section className="mx-auto flex w-full max-w-[520px] flex-col">
        <div className="shrink-0">
          <ProfileHeader
            user={userData}
            inventory={sessionData?.inventory}
            onUpdated={handleUserUpdated}
            compact
          />
        </div>

        <ProfileStats
          stats={sessionData?.stats}
          missionsEnabled
          isClaiming={isClaimingMissions}
          onClaimRewards={handleClaimMissionRewards}
          activeStat={selectedStat}
          onSelectStat={setSelectedStat}
        />
        <PromotionalMissions
          user={userData}
          inventory={sessionData?.inventory || {}}
          stats={sessionData?.stats || {}}
          collapsed={Boolean(selectedStat)}
          onExpand={() => setSelectedStat(null)}
          isClaiming={isClaimingPromotion}
          onClaim={handleClaimPromotion}
        />
      </section>
    </main>
  );
}
