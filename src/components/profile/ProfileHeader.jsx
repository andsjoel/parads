/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Edit3, GalleryVerticalEnd, Image, Sparkles, UserRound, X } from "lucide-react";

import { updateUserProfile } from "../../services/profileService";
import { purchaseProfileItem } from "../../services/profileStoreService";
import coinIcon from "../../assets/achievements/coin.png";

import { profileBackgroundsCatalog } from "../../data/profileBackgroundsCatalog";
import { profilePicsCatalog } from "../../data/profilePicsCatalog";
import { profilePicBordersCatalog } from "../../data/profilePicBordersCatalog";
import {
  DEFAULT_DISPLAY_CARD_ID,
  displayCardsCatalog,
} from "../../data/displayCardsCatalog";
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
  return item.theme || "normal";
}

function getItemName(items, id) {
  if (id === "bg-default" || id === "pic-default" || id === DEFAULT_DISPLAY_CARD_ID) return "Padrão";
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
  const [localInventory, setLocalInventory] = useState(inventory || {});

  const [draftProfile, setDraftProfile] = useState({
    displayName: profile.displayName || user?.fullName || "Jogador",
    statusMessage: profile.statusMessage || "",
    selectedBackgroundId: profile.selectedBackgroundId || "bg-default",
    selectedProfilePicId: profile.selectedProfilePicId || "pic-default",
    selectedProfilePicBorderId: profile.selectedProfilePicBorderId || null,
    selectedDisplayCardId: profile.selectedDisplayCardId || DEFAULT_DISPLAY_CARD_ID,
    selectedStatusIcon: profile.selectedStatusIcon || "✦",
  });

  useEffect(() => {
    setLocalInventory(inventory || {});
  }, [inventory]);

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
    "bg-default",
  );

  const profilePicUrl = getAssetById(
    profilePicImages,
    selectedProfilePicId,
    "pic-default",
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
      selectedBackgroundId: profile.selectedBackgroundId || "bg-default",
      selectedProfilePicId: profile.selectedProfilePicId || "pic-default",
      selectedProfilePicBorderId: profile.selectedProfilePicBorderId || null,
      selectedDisplayCardId: profile.selectedDisplayCardId || DEFAULT_DISPLAY_CARD_ID,
      selectedStatusIcon: profile.selectedStatusIcon || "✦",
    });

    setIsEditing(true);
  }

  useEffect(() => {
    if (!isEditing && !pickerType) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditing, pickerType]);

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
      return localInventory?.backgrounds?.includes(id);
    }

    if (type === "profilePic") {
      return localInventory?.profilePics?.includes(id);
    }

    if (type === "profilePicBorder") {
      return localInventory?.profilePicBorders?.includes(id);
    }

    if (type === "displayCard") {
      return id === DEFAULT_DISPLAY_CARD_ID || localInventory?.displayCards?.includes(id);
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

    if (type === "displayCard") {
      setDraftProfile((current) => ({
        ...current,
        selectedDisplayCardId: id,
      }));
    }

  }

  async function purchaseItem(type, id) {
    const result = await purchaseProfileItem({ uid: user.id, type, itemId: id });
    setLocalInventory(result.inventory);
    onUpdated?.({
      ...user,
      progression: { ...user.progression, coins: result.coins },
    }, { inventory: result.inventory });
    return result;
  }

  return (
    <>
      <section
        className={
          isEditing
            ? "fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-5 py-5 backdrop-blur-sm"
            : `profile-identity overflow-hidden transition-all duration-500 ${readOnly ? "rounded-[1.65rem] border border-white/10" : ""}`
        }
        aria-modal={isEditing ? "true" : undefined}
        role={isEditing ? "dialog" : undefined}
      >
        {!isEditing ? (
          <>
            <div className="relative h-56 overflow-hidden">
              <img
                src={backgroundUrl}
                alt=""
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-[#210019]/20 to-[#210019]" />

              <div className="profile-level-badge absolute left-5 top-5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-xl">
                <img src={coinIcon} alt="" className="h-5 w-5 object-contain" />
                <span>{user?.progression?.coins ?? 0}</span>
              </div>

              {readOnly ? (
                onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="profile-icon-action absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-black/30 text-white backdrop-blur-xl"
                  >
                    <X size={16} />
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="profile-icon-action absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-black/30 text-white backdrop-blur-xl"
                >
                  <Edit3 size={16} />
                </button>
              )}
            </div>

            <div className="relative px-6 pb-5">
              <div className="-mt-14 mb-3 flex items-end gap-4">
                <div className="profile-avatar relative h-[96px] w-[96px] shrink-0">
                  <img
                    src={profilePicUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />

                  {profilePicBorderUrl && (
                    <img
                      src={profilePicBorderUrl}
                      alt=""
                      className="
                        pointer-events-none absolute inset-0 z-10
                        h-full w-full object-contain
                        scale-[1.21]
                      "
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 pb-1">
                  <h2 className="font-idv-title break-words text-[clamp(2.35rem,10vw,3.75rem)] leading-[0.92] text-[#fffaf0] drop-shadow">
                    {displayName}
                  </h2>

                  <p className="mt-2 break-all text-sm font-normal text-[#ff8b58]/80">
                    @{user?.username || "player"}
                  </p>
                </div>
              </div>

              <p className="profile-status flex items-center gap-3 px-4 py-2 text-sm leading-relaxed text-white/58">
                <span className="flex shrink-0 items-center justify-center text-[1.15rem] leading-none">
                  {selectedStatusIcon}
                </span>

                <span className="min-w-0 truncate">{statusMessage}</span>
              </p>
            </div>
          </>
        ) : (
          <div className="profile-edit-modal flex max-h-[calc(100vh-2.5rem)] w-full max-w-[420px] flex-col overflow-hidden p-0">
            <div className="profile-edit-header flex shrink-0 items-center justify-between px-5 pb-4 pt-5">
              <div>
                <h2 className="font-idv-title text-2xl text-[#fffaf0]">
                  Editar perfil
                </h2>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                className="profile-modal-close flex h-9 w-9 items-center justify-center text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="profile-edit-content min-h-0 flex-1 overflow-y-auto px-5 py-1">
              <div className="flex flex-col gap-3 pb-3">
              <EditRow
                icon={coinIcon}
                label="Moedas"
                value={`${user?.progression?.coins ?? 0}c`}
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

              <EditRow
                icon={GalleryVerticalEnd}
                label="Carta"
                value={getItemName(displayCardsCatalog, draftProfile.selectedDisplayCardId)}
                onClick={() => setPickerType("displayCard")}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-white/40">
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
                  className="login-username-value h-14 w-full border-x-0 border-b border-t-0 border-white/15 bg-transparent px-1 text-4xl leading-none text-white outline-none focus:border-[#ff713f]/70"
                />
              </div>

              <EditRow
                icon={UserRound}
                label="Usuário"
                value={`@${user?.username || "player"}`}
                disabled
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-white/40">
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
                  className="h-11 w-full border-x-0 border-b border-t-0 border-white/15 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#ff713f]/70"
                />
              </div>

              <EditRow
                icon={Sparkles}
                label="Icon mode"
                value={draftProfile.selectedStatusIcon}
                onClick={() => setPickerType("statusIcon")}
              />
              </div>
            </div>

              <div className="profile-edit-footer grid shrink-0 grid-cols-2 gap-2 px-5 pb-5 pt-4">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="register-outline-action text-sm font-semibold"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="register-paper-action text-sm font-semibold disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
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
          displayCards={displayCardsCatalog}
          selectedId={
            pickerType === "background"
              ? draftProfile.selectedBackgroundId
              : pickerType === "profilePic"
                ? draftProfile.selectedProfilePicId
                : pickerType === "profilePicBorder"
                  ? draftProfile.selectedProfilePicBorderId
                  : pickerType === "displayCard"
                    ? draftProfile.selectedDisplayCardId
                    : draftProfile.selectedStatusIcon
          }
          isUnlocked={isUnlocked}
          onClose={() => setPickerType(null)}
          onSelect={selectItem}
          balance={user?.progression?.coins ?? 0}
          onPurchase={purchaseItem}
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
        flex h-12 items-center justify-between border-b border-white/10
        bg-transparent px-1 text-left transition active:scale-[0.98]
        ${disabled ? "opacity-50" : "hover:border-[#ff713f]/50"}
      `}
    >
      <span className="flex items-center gap-3">
        {typeof Icon === "string" ? (
          <img src={Icon} alt="" className="h-[18px] w-[18px] object-contain" />
        ) : (
          <Icon size={17} className="text-[#ff8b58]/85" />
        )}
        <span className="text-xs font-semibold text-white/40">{label}</span>
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
  displayCards,
  selectedId,
  isUnlocked,
  onClose,
  onSelect,
  balance,
  onPurchase,
  onSelectStatusIcon,
}) {
  const isBackground = type === "background";
  const isProfilePic = type === "profilePic";
  const isProfilePicBorder = type === "profilePicBorder";
  const isDisplayCard = type === "displayCard";
  const isStatusIcon = type === "statusIcon";

  const [selectedTheme, setSelectedTheme] = useState("all");
  const [showOnlyOwned, setShowOnlyOwned] = useState(true);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [purchaseTarget, setPurchaseTarget] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [confirmedItemId, setConfirmedItemId] = useState("");
  const themeMenuRef = useRef(null);

  useEffect(() => {
    if (!isThemeMenuOpen) return undefined;

    function closeThemeMenu(event) {
      if (!themeMenuRef.current?.contains(event.target)) {
        setIsThemeMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeThemeMenu);
    return () => document.removeEventListener("pointerdown", closeThemeMenu);
  }, [isThemeMenuOpen]);

  const title = isBackground
    ? "Escolher background"
    : isProfilePic
      ? "Escolher foto"
      : isProfilePicBorder
        ? "Escolher borda"
        : isDisplayCard
          ? "Escolher carta"
        : "Escolher ícone";

  const items = useMemo(() => {
    if (isBackground) return backgrounds;
    if (isProfilePic) return profilePics;
    if (isProfilePicBorder) return profilePicBorders;
    if (isDisplayCard) return displayCards;

    return [];
  }, [
    backgrounds,
    isBackground,
    isProfilePic,
    isProfilePicBorder,
    isDisplayCard,
    displayCards,
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
      <div className="profile-edit-modal max-h-[82vh] w-full max-w-[420px] overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-idv-title text-2xl text-white">{title}</h2>

            {!isStatusIcon && (
              <p className="mt-1 text-xs font-semibold text-white/35">
                {filteredItems.length} opções disponíveis
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="profile-modal-close flex h-10 w-10 items-center justify-center text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!isStatusIcon && (
          <div className="mb-4 flex flex-col gap-3">
            <div ref={themeMenuRef} className="profile-theme-select relative z-20">
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={isThemeMenuOpen}
                className={`profile-modal-select flex h-11 w-full items-center justify-between px-4 text-sm font-semibold text-white ${isThemeMenuOpen ? "profile-modal-select--open" : ""}`}
              >
                <span>{selectedTheme === "all" ? "Todos os temas" : selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)}</span>
                <ChevronDown size={17} className={`text-[#ff8b58] transition-transform duration-200 ${isThemeMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isThemeMenuOpen && (
                <div className="profile-theme-menu" role="listbox">
                  {themes.map((theme) => {
                    const isSelected = selectedTheme === theme;
                    const label = theme === "all"
                      ? "Todos os temas"
                      : theme.charAt(0).toUpperCase() + theme.slice(1);

                    return (
                      <button
                        key={theme}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedTheme(theme);
                          setIsThemeMenuOpen(false);
                        }}
                        className={`profile-theme-option ${isSelected ? "profile-theme-option--selected" : ""}`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check size={15} strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowOnlyOwned((current) => !current)}
              className="profile-modal-control flex h-11 items-center justify-between px-4 text-sm font-bold text-white active:scale-[0.98]"
            >
              <span>Inventário</span>

              <span
                className={`
                  flex h-6 w-11 items-center rounded-full p-1 transition
                  ${showOnlyOwned ? "bg-[#ff6235]" : "bg-white/10"}
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
                  profile-asset-option flex h-16 items-center justify-center border text-2xl transition active:scale-95
                  ${
                    selectedId === icon
                      ? "border-[#ff713f] bg-[#ff6235]/15"
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
                isBackground || isDisplayCard
                  ? "grid grid-cols-2 gap-3"
                  : "grid grid-cols-3 gap-3"
              }
            >
              {filteredItems.map((item) => {
                const selected = selectedId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPreviewItem(item);
                      setConfirmedItemId("");
                    }}
                    className={`
                      profile-asset-option relative h-24 overflow-hidden border transition active:scale-95
                      ${selected ? "border-[#ff713f]" : "border-white/10"}
                    `}
                  >
                    {isDisplayCard ? (
                      <div className={`display-card-preview ${item.previewClassName} h-full w-full`}>
                        {item.hasShine && <span className="display-card-preview-shine" />}
                      </div>
                    ) : (
                      <img
                        src={item.src}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    )}

                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                      <span className="truncate">{item.name}</span>
                      {item.price?.amount != null && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[#ffb071]">
                          <img src={coinIcon} alt="" className="h-3.5 w-3.5 object-contain" />
                          {item.price.amount}
                        </span>
                      )}
                    </div>

                    {selected && (
                      <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ff6235] text-[#210019]">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}

                  </button>
                );
              })}
            </div>

            {!filteredItems.length && (
              <p className="py-8 text-center text-sm font-semibold text-white/35">
                Nenhuma opção encontrada nesse filtro.
              </p>
            )}
          </div>
        )}

      </div>

        {previewItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-sm">
            <div className="profile-edit-modal max-h-[calc(100vh-3rem)] w-full max-w-[420px] overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-idv-title text-2xl text-white">{previewItem.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-white/45">{previewItem.description}</p>
                </div>
                <button type="button" onClick={() => setPreviewItem(null)} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center text-white" aria-label="Fechar visualização">
                  <X size={17} />
                </button>
              </div>

              <div className="profile-item-large-preview mb-4 h-64 overflow-hidden border border-white/10">
                {isDisplayCard ? (
                  <div className={`display-card-preview ${previewItem.previewClassName} h-full w-full`}>
                    {previewItem.hasShine && <span className="profile-sticker-shine absolute -inset-y-10 left-0 w-[78%]" />}
                  </div>
                ) : (
                  <img src={previewItem.src} alt={previewItem.name} className={`h-full w-full ${isBackground ? "object-cover" : "object-contain"}`} />
                )}
              </div>

              {isUnlocked(type, previewItem.id) ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelect(type, previewItem.id);
                    setConfirmedItemId(previewItem.id);
                    window.setTimeout(() => setPreviewItem(null), 700);
                  }}
                  className="register-paper-action flex h-12 w-full items-center justify-center gap-2 text-sm font-black"
                >
                  {confirmedItemId === previewItem.id ? <><Check size={17} strokeWidth={3} /> selecionado</> : selectedId === previewItem.id ? <><Check size={17} strokeWidth={3} /> em uso</> : "usar"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPurchaseError("");
                    setPurchaseTarget(previewItem);
                  }}
                  className="register-paper-action flex h-12 w-full items-center justify-center gap-2 text-sm font-black"
                >
                  comprar
                  <span className="inline-flex items-center gap-1">
                    <img src={coinIcon} alt="" className="h-4 w-4 object-contain" />
                    {previewItem.price?.amount ?? 0}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {purchaseTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-5 py-6 backdrop-blur-sm">
            <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
              <h3 className="font-idv-title text-2xl">Confirmar compra?</h3>
              <div className="my-5 grid grid-cols-2 gap-2">
                <div className="profile-modal-control p-3">
                  <p className="text-xs font-semibold text-white/40">Saldo atual</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xl font-black"><img src={coinIcon} alt="" className="h-5 w-5" />{balance}c</p>
                </div>
                <div className="profile-modal-control p-3">
                  <p className="text-xs font-semibold text-white/40">Preço</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xl font-black text-[#ff9a61]"><img src={coinIcon} alt="" className="h-5 w-5" />{purchaseTarget.price?.amount ?? 0}c</p>
                </div>
              </div>

              {purchaseError && <p className="mb-3 text-center text-sm font-bold text-red-300">{purchaseError}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={isPurchasing} onClick={() => setPurchaseTarget(null)} className="register-outline-action h-11 text-sm disabled:opacity-50">cancelar</button>
                <button
                  type="button"
                  disabled={isPurchasing}
                  onClick={async () => {
                    try {
                      setIsPurchasing(true);
                      setPurchaseError("");
                      await onPurchase(type, purchaseTarget.id);
                      setPurchaseTarget(null);
                    } catch (error) {
                      setPurchaseError(error?.message || "Não foi possível concluir a compra.");
                    } finally {
                      setIsPurchasing(false);
                    }
                  }}
                  className="register-paper-action h-11 text-sm disabled:opacity-50"
                >
                  {isPurchasing ? "comprando..." : "comprar"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
