/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { Check, Edit3, Image, Sparkles, UserRound, X } from "lucide-react";

import { updateUserProfile } from "../../services/profileService";
import { unlockAchievement } from "../../services/achievementService";

import { profileBackgroundsCatalog } from "../../data/profileBackgroundsCatalog";
import { profilePicsCatalog } from "../../data/profilePicsCatalog";
import { profilePicBordersCatalog } from "../../data/profilePicBordersCatalog";
import {
  getAssetById,
  getCatalogAssetList,
  profileAssetFiles,
} from "../../utils/profileAssets";

const {
  backgroundImages,
  profilePicImages,
  profilePicBorderImages,
} = profileAssetFiles;

const statusIcons = ["✦", "⚡", "🔥", "🏐", "👑", "🌙", "💫", "🪽"];

function getThemeFromItem(item) {
  return item.theme || "default";
}

function getItemName(items, id) {
  return items.find((item) => item.id === id)?.name || id;
}

function onlyLettersAndNumbers(value) {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "");
}

export default function ProfileHeader({
  user,
  inventory,
  onUpdated,
  readOnly = false,
  onClose,
}) {
  const profile = user?.profile || {};

  const [isEditing, setIsEditing] = useState(false);
  const [pickerType, setPickerType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [draftProfile, setDraftProfile] = useState({
    displayName: profile.displayName || user?.fullName || "Jogador",
    statusMessage: profile.statusMessage || "",
    selectedBackgroundId: profile.selectedBackgroundId || "bg-default-1",
    selectedProfilePicId: profile.selectedProfilePicId || "pic-default-1",
    selectedProfilePicBorderId: profile.selectedProfilePicBorderId || null,
    selectedStatusIcon: profile.selectedStatusIcon || "✦",
  });

  const backgrounds = useMemo(
    () => getCatalogAssetList(backgroundImages, profileBackgroundsCatalog),
    [],
  );

  const profilePics = useMemo(
    () => getCatalogAssetList(profilePicImages, profilePicsCatalog),
    [],
  );

  const profilePicBorders = useMemo(
    () => getCatalogAssetList(profilePicBorderImages, profilePicBordersCatalog),
    [],
  );

  const selectedBackgroundId = isEditing
    ? draftProfile.selectedBackgroundId
    : profile.selectedBackgroundId;

  const selectedProfilePicId = isEditing
    ? draftProfile.selectedProfilePicId
    : profile.selectedProfilePicId;

  const selectedProfilePicBorderId = isEditing
    ? draftProfile.selectedProfilePicBorderId
    : profile.selectedProfilePicBorderId;

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

  const profilePicBorderUrl = selectedProfilePicBorderId
    ? getAssetById(
        profilePicBorderImages,
        selectedProfilePicBorderId,
        selectedProfilePicBorderId,
      )
    : "";

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
      selectedProfilePicBorderId: profile.selectedProfilePicBorderId || null,
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

      const previousStatus = profile.statusMessage?.trim() || "";
      const nextStatus = nextProfile.statusMessage?.trim() || "";

      if (!previousStatus && nextStatus) {
        await unlockAchievement(user.id, "first_status");
      }

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

    if (type === "profilePicBorder") {
      return inventory?.profilePicBorders?.includes(id);
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

    if (type === "profilePicBorder") {
      setDraftProfile((current) => ({
        ...current,
        selectedProfilePicBorderId: id,
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
        {!isEditing ? (
          <>
            <div className="relative h-40 overflow-hidden">
              <img
                src={backgroundUrl}
                alt=""
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-[#17231f]" />

              <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-white backdrop-blur-xl">
                Nv. {user?.progression?.level || 1}
              </div>

              {readOnly ? (
                onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white backdrop-blur-xl transition active:scale-95"
                  >
                    <X size={16} />
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-white backdrop-blur-xl transition active:scale-95"
                >
                  <Edit3 size={16} />
                </button>
              )}
            </div>

            <div className="relative px-4 pb-5">
              <div className="-mt-10 mb-4 flex items-end gap-3">
                <div className="relative h-[82px] w-[82px] shrink-0">
                  <img
                    src={profilePicUrl}
                    alt={displayName}
                    className="h-full w-full rounded-full object-cover"
                  />

                  {profilePicBorderUrl && (
                    <img
                      src={profilePicBorderUrl}
                      alt=""
                      className="
                        pointer-events-none absolute inset-0 z-10
                        h-full w-full object-contain
                        scale-[1.38]
                      "
                    />
                  )}
                </div>

                <div className="min-w-0 pb-2 pl-3">
                  <h2 className="truncate text-[1.35rem] font-black text-[#fffaf0] drop-shadow">
                    {displayName}
                  </h2>

                  <p className="mt-0.5 truncate text-sm font-semibold text-white/65">
                    @{user?.username || "player"}
                  </p>
                </div>
              </div>

              <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-[#fffaf0]">
                <span className="flex shrink-0 items-center justify-center text-[1.15rem] leading-none">
                  {selectedStatusIcon}
                </span>

                <span className="min-w-0 truncate">{statusMessage}</span>
              </p>
            </div>
          </>
        ) : (
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#fffaf0]">
                  Editar perfil
                </h2>
                <p className="mt-1 text-xs text-app-muted">
                  Personalize sua identidade de jogador
                </p>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
              >
                <X size={17} />
              </button>
            </div>

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
                value={getItemName(backgrounds, draftProfile.selectedBackgroundId)}
                onClick={() => setPickerType("background")}
              />

              <EditRow
                icon={UserRound}
                label="Foto"
                value={getItemName(profilePics, draftProfile.selectedProfilePicId)}
                onClick={() => setPickerType("profilePic")}
              />

              <EditRow
                icon={Sparkles}
                label="Borda"
                value={
                  draftProfile.selectedProfilePicBorderId
                    ? getItemName(profilePicBorders, draftProfile.selectedProfilePicBorderId)
                    : "Nenhuma"
                }
                onClick={() => setPickerType("profilePicBorder")}
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
                      displayName: onlyLettersAndNumbers(
                        event.target.value,
                      ).slice(0, 15),
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

              <EditRow
                icon={Sparkles}
                label="Ícone do status"
                value={draftProfile.selectedStatusIcon}
                onClick={() => setPickerType("statusIcon")}
              />

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
        )}
      </section>

      {pickerType && (
        <AssetPickerModal
          type={pickerType}
          backgrounds={backgrounds}
          profilePics={profilePics}
          profilePicBorders={profilePicBorders}
          selectedId={
            pickerType === "background"
              ? draftProfile.selectedBackgroundId
              : pickerType === "profilePic"
                ? draftProfile.selectedProfilePicId
                : pickerType === "profilePicBorder"
                  ? draftProfile.selectedProfilePicBorderId
                  : draftProfile.selectedStatusIcon
          }
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
  profilePicBorders,
  selectedId,
  isUnlocked,
  onClose,
  onSelect,
  onSelectStatusIcon,
}) {
  const isBackground = type === "background";
  const isProfilePic = type === "profilePic";
  const isProfilePicBorder = type === "profilePicBorder";
  const isStatusIcon = type === "statusIcon";

  const [selectedTheme, setSelectedTheme] = useState("all");
  const [showOnlyOwned, setShowOnlyOwned] = useState(true);

  const title = isBackground
    ? "Escolher background"
    : isProfilePic
      ? "Escolher foto"
      : isProfilePicBorder
        ? "Escolher borda"
        : "Escolher ícone";

  const items = useMemo(() => {
    if (isBackground) return backgrounds;
    if (isProfilePic) return profilePics;
    if (isProfilePicBorder) return profilePicBorders;

    return [];
  }, [
    backgrounds,
    isBackground,
    isProfilePic,
    isProfilePicBorder,
    profilePicBorders,
    profilePics,
  ]);

  const themes = useMemo(() => {
    const uniqueThemes = new Set(items.map((item) => getThemeFromItem(item)));

    return ["all", ...Array.from(uniqueThemes).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesTheme =
        selectedTheme === "all" || getThemeFromItem(item) === selectedTheme;

      const matchesOwned = !showOnlyOwned || isUnlocked(type, item.id);

      return matchesTheme && matchesOwned;
    });
  }, [items, selectedTheme, showOnlyOwned, isUnlocked, type]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
      <div className="max-h-[82vh] w-full max-w-[420px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#13201c]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>

            {!isStatusIcon && (
              <p className="mt-1 text-xs font-semibold text-app-muted">
                {filteredItems.length} opções disponíveis
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!isStatusIcon && (
          <div className="mb-4 flex flex-col gap-3">
            <select
              value={selectedTheme}
              onChange={(event) => setSelectedTheme(event.target.value)}
              className="h-11 rounded-full border border-white/10 bg-[#16231f] px-4 text-sm font-bold text-white outline-none focus:border-app-primary/40"
            >
              <option value="all">Todos os temas</option>

              {themes
                .filter((theme) => theme !== "all")
                .map((theme) => (
                  <option key={theme} value={theme}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={() => setShowOnlyOwned((current) => !current)}
              className="flex h-11 items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white active:scale-[0.98]"
            >
              <span>Mostrar somente os meus</span>

              <span
                className={`
                  flex h-6 w-11 items-center rounded-full p-1 transition
                  ${showOnlyOwned ? "bg-app-primary" : "bg-white/10"}
                `}
              >
                <span
                  className={`
                    h-4 w-4 rounded-full bg-white transition
                    ${showOnlyOwned ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </span>
            </button>
          </div>
        )}

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
          <div className="max-h-[48vh] overflow-y-auto pr-1">
            <div
              className={
                isBackground
                  ? "grid grid-cols-2 gap-3"
                  : "grid grid-cols-3 gap-3"
              }
            >
              {filteredItems.map((item) => {
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
                      ${selected ? "border-app-primary" : "border-white/10"}
                      ${!unlocked ? "opacity-35 grayscale" : ""}
                      h-24
                    `}
                  >
                    <img
                      src={item.src}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute bottom-0 left-0 right-0 bg-black/45 px-2 py-1 text-[10px] font-black text-white">
                      {item.name}
                    </div>

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

            {!filteredItems.length && (
              <p className="py-8 text-center text-sm font-semibold text-app-muted">
                Nenhuma opção encontrada nesse filtro.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
