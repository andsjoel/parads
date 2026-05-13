import { useMemo, useState } from "react";
import { Check, Edit3, Image, Sparkles, UserRound, X } from "lucide-react";

import { updateUserProfile } from "../../services/profileService";

const backgroundImages = import.meta.glob(
  "../../assets/profile-backgrounds/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    import: "default",
  },
);

const profilePicImages = import.meta.glob(
  "../../assets/profile-pics/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    import: "default",
  },
);

const statusIcons = ["✦", "⚡", "🔥", "🏐", "👑", "🌙", "💫", "🪽"];

function getIdFromPath(path) {
  return path.split("/").pop().replace(/\.(png|jpg|jpeg|webp)$/i, "");
}

function getAssetList(files) {
  return Object.entries(files).map(([path, src]) => ({
    id: getIdFromPath(path),
    src,
  }));
}

function getAssetById(files, id, fallbackId) {
  const targetId = id || fallbackId;

  const entry = Object.entries(files).find(([path]) =>
    path.includes(`${targetId}.`),
  );

  if (entry) return entry[1];

  const fallback = Object.entries(files).find(([path]) =>
    path.includes(`${fallbackId}.`),
  );

  return fallback?.[1] || "";
}

function onlyLettersAndNumbers(value) {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "");
}

export default function ProfileHeader({ user, inventory, onUpdated }) {
  const profile = user?.profile || {};

  const [isEditing, setIsEditing] = useState(false);
  const [pickerType, setPickerType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [draftProfile, setDraftProfile] = useState({
    displayName: profile.displayName || user?.fullName || "Jogador",
    statusMessage: profile.statusMessage || "",
    selectedBackgroundId: profile.selectedBackgroundId || "bg-default-1",
    selectedProfilePicId: profile.selectedProfilePicId || "pic-default-1",
    selectedStatusIcon: profile.selectedStatusIcon || "✦",
  });

  const backgrounds = useMemo(() => getAssetList(backgroundImages), []);
  const profilePics = useMemo(() => getAssetList(profilePicImages), []);

  const selectedBackgroundId = isEditing
    ? draftProfile.selectedBackgroundId
    : profile.selectedBackgroundId;

  const selectedProfilePicId = isEditing
    ? draftProfile.selectedProfilePicId
    : profile.selectedProfilePicId;

  const selectedStatusIcon = isEditing
    ? draftProfile.selectedStatusIcon
    : profile.selectedStatusIcon || "✦";

  const backgroundUrl = getAssetById(
    backgroundImages,
    selectedBackgroundId,
    "bg-default-1",
  );

  const profilePicUrl = getAssetById(
    profilePicImages,
    selectedProfilePicId,
    "pic-default-1",
  );

  const displayName = isEditing
    ? draftProfile.displayName
    : profile.displayName || user?.fullName || "Jogador";

  const statusMessage = isEditing
    ? draftProfile.statusMessage
    : profile.statusMessage || "Pronto para entrar em quadra.";

  function startEditing() {
    setDraftProfile({
      displayName: profile.displayName || user?.fullName || "Jogador",
      statusMessage: profile.statusMessage || "",
      selectedBackgroundId: profile.selectedBackgroundId || "bg-default-1",
      selectedProfilePicId: profile.selectedProfilePicId || "pic-default-1",
      selectedStatusIcon: profile.selectedStatusIcon || "✦",
    });

    setIsEditing(true);
  }

  function cancelEditing() {
    setPickerType(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!user?.id) return;

    try {
      setIsSaving(true);

      const nextProfile = {
        ...profile,
        ...draftProfile,
        displayName: draftProfile.displayName.trim() || "Jogador",
        statusMessage: draftProfile.statusMessage.trim(),
      };

      await updateUserProfile(user.id, nextProfile);

      onUpdated?.({
        ...user,
        profile: nextProfile,
      });

      setIsEditing(false);
      setPickerType(null);
    } finally {
      setIsSaving(false);
    }
  }

  function isUnlocked(type, id) {
    if (type === "background") {
      return inventory?.backgrounds?.includes(id);
    }

    if (type === "profilePic") {
      return inventory?.profilePics?.includes(id);
    }

    return true;
  }

  function selectItem(type, id) {
    if (!isUnlocked(type, id)) return;

    if (type === "background") {
      setDraftProfile((current) => ({
        ...current,
        selectedBackgroundId: id,
      }));
    }

    if (type === "profilePic") {
      setDraftProfile((current) => ({
        ...current,
        selectedProfilePicId: id,
      }));
    }

    setPickerType(null);
  }

  return (
    <>
      <section
        className={`
          overflow-hidden rounded-[2rem] border border-white/10
          bg-[#17231f]/75 shadow-[0_18px_50px_rgba(0,0,0,0.28)]
          backdrop-blur-2xl transition-all duration-500
          ${isEditing ? "scale-[1.01]" : ""}
        `}
      >
        <div className="relative h-40 overflow-hidden">
          <img src={backgroundUrl} alt="" className="h-full w-full object-cover" />

          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-[#17231f]" />

          <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-white backdrop-blur-xl">
            Nv. {user?.progression?.level || 1}
          </div>

          <button
            type="button"
            onClick={isEditing ? cancelEditing : startEditing}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white backdrop-blur-xl transition active:scale-95"
          >
            {isEditing ? <X size={17} /> : <Edit3 size={16} />}
          </button>
        </div>

        <div className="relative px-4 pb-5">
          <div className="-mt-9 flex items-end gap-3">
            <div className="relative h-[82px] w-[82px] shrink-0 rounded-full border-4 border-[#17231f] bg-[#101716] p-1 shadow-[0_0_28px_rgba(255,183,3,0.22)]">
              <img
                src={profilePicUrl}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
              />

              <button
                type="button"
                disabled={!isEditing}
                onClick={() => setPickerType("statusIcon")}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-app-primary text-xs font-black text-[#1b1300] shadow-[0_0_16px_rgba(255,183,3,0.38)] disabled:pointer-events-none"
              >
                {selectedStatusIcon}
              </button>
            </div>

            <div className="min-w-0 pb-2">
              <h1 className="truncate text-xl font-black tracking-tight text-[#fffaf0]">
                {displayName}
              </h1>

              <p className="mt-0.5 truncate text-sm font-semibold text-app-muted">
                @{user?.username || "player"}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-[#fffaf0]">
            {statusMessage}
          </p>

          <div
            className={`
              grid transition-all duration-500
              ${isEditing ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}
            `}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-3">
                <EditRow
                  icon={Sparkles}
                  label="Nível"
                  value={`Nv. ${user?.progression?.level || 1}`}
                  disabled
                />

                <EditRow
                  icon={Image}
                  label="Background"
                  value={draftProfile.selectedBackgroundId}
                  onClick={() => setPickerType("background")}
                />

                <EditRow
                  icon={UserRound}
                  label="Foto"
                  value={draftProfile.selectedProfilePicId}
                  onClick={() => setPickerType("profilePic")}
                />

                <EditRow
                  icon={Sparkles}
                  label="Ícone"
                  value={draftProfile.selectedStatusIcon}
                  onClick={() => setPickerType("statusIcon")}
                />

                <div>
                  <label className="mb-1 block text-xs font-bold text-app-muted">
                    Nome de exibição
                  </label>
                  <input
                    value={draftProfile.displayName}
                    maxLength={15}
                    onChange={(event) =>
                      setDraftProfile((current) => ({
                        ...current,
                        displayName: onlyLettersAndNumbers(event.target.value).slice(0, 15),
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white outline-none focus:border-app-primary/40 focus:ring-4 focus:ring-app-primary/10"
                  />
                </div>

                <EditRow
                  icon={UserRound}
                  label="Usuário"
                  value={`@${user?.username || "player"}`}
                  disabled
                />

                <div>
                  <label className="mb-1 block text-xs font-bold text-app-muted">
                    Status
                  </label>
                  <input
                    value={draftProfile.statusMessage}
                    maxLength={25}
                    onChange={(event) =>
                      setDraftProfile((current) => ({
                        ...current,
                        statusMessage: event.target.value.slice(0, 25),
                      }))
                    }
                    placeholder="Pronto para jogar"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-app-muted focus:border-app-primary/40 focus:ring-4 focus:ring-app-primary/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="h-11 rounded-full border border-white/10 bg-white/[0.06] text-sm font-black text-white active:scale-[0.98]"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-11 rounded-full bg-app-primary text-sm font-black text-[#1b1300] shadow-[0_10px_30px_rgba(255,183,3,0.28)] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {pickerType && (
        <AssetPickerModal
          type={pickerType}
          backgrounds={backgrounds}
          profilePics={profilePics}
          selectedId={
            pickerType === "background"
              ? draftProfile.selectedBackgroundId
              : pickerType === "profilePic"
                ? draftProfile.selectedProfilePicId
                : draftProfile.selectedStatusIcon
          }
          inventory={inventory}
          isUnlocked={isUnlocked}
          onClose={() => setPickerType(null)}
          onSelect={selectItem}
          onSelectStatusIcon={(icon) => {
            setDraftProfile((current) => ({
              ...current,
              selectedStatusIcon: icon,
            }));
            setPickerType(null);
          }}
        />
      )}
    </>
  );
}

function EditRow({ icon: Icon, label, value, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        flex h-12 items-center justify-between rounded-2xl border border-white/10
        bg-white/[0.04] px-4 text-left transition active:scale-[0.98]
        ${disabled ? "opacity-60" : "hover:border-app-primary/30"}
      `}
    >
      <span className="flex items-center gap-3">
        <Icon size={17} className="text-app-primary" />
        <span className="text-xs font-bold text-app-muted">{label}</span>
      </span>

      <span className="max-w-[150px] truncate text-sm font-black text-white">
        {value}
      </span>
    </button>
  );
}

function AssetPickerModal({
  type,
  backgrounds,
  profilePics,
  selectedId,
  isUnlocked,
  onClose,
  onSelect,
  onSelectStatusIcon,
}) {
  const isBackground = type === "background";
  const isProfilePic = type === "profilePic";
  const isStatusIcon = type === "statusIcon";

  const title = isBackground
    ? "Escolher background"
    : isProfilePic
      ? "Escolher foto"
      : "Escolher ícone";

  const items = isBackground ? backgrounds : profilePics;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[1.8rem] border border-white/10 bg-[#13201c]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
          >
            <X size={18} />
          </button>
        </div>

        {isStatusIcon ? (
          <div className="grid grid-cols-4 gap-3">
            {statusIcons.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => onSelectStatusIcon(icon)}
                className={`
                  flex h-16 items-center justify-center rounded-2xl border text-2xl transition active:scale-95
                  ${
                    selectedId === icon
                      ? "border-app-primary bg-app-primary/15"
                      : "border-white/10 bg-white/[0.05]"
                  }
                `}
              >
                {icon}
              </button>
            ))}
          </div>
        ) : (
          <div className={isBackground ? "grid grid-cols-2 gap-3" : "grid grid-cols-3 gap-3"}>
            {items.map((item) => {
              const unlocked = isUnlocked(type, item.id);
              const selected = selectedId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onSelect(type, item.id)}
                  className={`
                    relative overflow-hidden rounded-2xl border transition active:scale-95
                    ${
                      selected
                        ? "border-app-primary"
                        : "border-white/10"
                    }
                    ${!unlocked ? "opacity-35 grayscale" : ""}
                    ${isBackground ? "h-24" : "h-24"}
                  `}
                >
                  <img
                    src={item.src}
                    alt={item.id}
                    className="h-full w-full object-cover"
                  />

                  {selected && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-app-primary text-[#1b1300]">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}

                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-black text-white">
                      Bloqueado
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}