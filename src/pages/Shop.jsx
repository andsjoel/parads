/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronDown, GalleryVerticalEnd, Grid2X2, Image, Layers3, Store, UserRound, X } from "lucide-react";

import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import coinIcon from "../assets/achievements/coin.png";
import OrbitLoader from "../components/OrbitLoader";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileStats from "../components/profile/ProfileStats";
import { useAuth } from "../contexts/AuthContext";
import { profileBackgroundsCatalog } from "../data/profileBackgroundsCatalog";
import { profilePicsCatalog } from "../data/profilePicsCatalog";
import { profilePicBordersCatalog } from "../data/profilePicBordersCatalog";
import { displayCardsCatalog } from "../data/displayCardsCatalog";
import { purchaseProfileItem } from "../services/profileStoreService";
import { getCatalogAssetList, getProfileAssetUrls, profileAssetFiles } from "../utils/profileAssets";

const categories = [
  { id: "profilePic", label: "Pics", icon: UserRound, inventory: "profilePics", profile: "selectedProfilePicId" },
  { id: "profilePicBorder", label: "Bordas", icon: Layers3, inventory: "profilePicBorders", profile: "selectedProfilePicBorderId" },
  { id: "background", label: "Capas", icon: Image, inventory: "backgrounds", profile: "selectedBackgroundId" },
  { id: "displayCard", label: "Cartas", icon: GalleryVerticalEnd, inventory: "displayCards", profile: "selectedDisplayCardId" },
];

export default function Shop() {
  const { userData, sessionData, loadingAuth, updateSessionData } = useAuth();
  const [user, setUser] = useState(userData);
  const [inventory, setInventory] = useState(sessionData?.inventory || {});
  const [categoryId, setCategoryId] = useState("profilePic");
  const [theme, setTheme] = useState("all");
  const [viewMode, setViewMode] = useState("all");
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [purchaseTarget, setPurchaseTarget] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState(null);
  const themeMenuRef = useRef(null);

  useEffect(() => setUser(userData), [userData]);
  useEffect(() => setInventory(sessionData?.inventory || {}), [sessionData?.inventory]);
  useEffect(() => {
    if (!isThemeMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (!themeMenuRef.current?.contains(event.target)) setIsThemeMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [isThemeMenuOpen]);

  const catalogs = useMemo(() => ({
    profilePic: getCatalogAssetList(profileAssetFiles.profilePicImages, profilePicsCatalog),
    profilePicBorder: getCatalogAssetList(profileAssetFiles.profilePicBorderImages, profilePicBordersCatalog),
    background: getCatalogAssetList(profileAssetFiles.backgroundImages, profileBackgroundsCatalog),
    displayCard: displayCardsCatalog,
  }), []);

  const category = categories.find((item) => item.id === categoryId);
  const categoryItems = catalogs[categoryId] || [];
  const themes = ["all", ...new Set(categoryItems.map((item) => item.theme || "normal"))];
  const themedItems = theme === "all"
    ? categoryItems
    : categoryItems.filter((item) => (item.theme || "normal") === theme);
  const isOwned = (item) => inventory?.[category.inventory]?.includes(item.id);
  const items = viewMode === "all"
    ? themedItems
    : themedItems.filter((item) => !isOwned(item));

  async function buyItem() {
    if (!purchaseTarget || !user?.id) return;
    try {
      setIsPurchasing(true);
      setPurchaseError("");
      const result = await purchaseProfileItem({ uid: user.id, type: categoryId, itemId: purchaseTarget.id });
      const nextUser = { ...user, progression: { ...user.progression, coins: result.coins } };
      setInventory(result.inventory);
      setUser(nextUser);
      updateSessionData({ user: nextUser, inventory: result.inventory });
      setPurchaseSuccess(purchaseTarget);
      setPurchaseTarget(null);
    } catch (error) {
      setPurchaseError(error?.message || "Não foi possível concluir a compra.");
    } finally {
      setIsPurchasing(false);
    }
  }

  if (loadingAuth || !user) {
    return <main className="shop-page flex min-h-screen items-center justify-center"><OrbitLoader /></main>;
  }

  return (
    <main className="shop-page min-h-screen px-5 pb-28 pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className="mx-auto w-full max-w-[520px]">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-[#ff8b58]">Catálogo</p>
            <h1 className="font-idv-title text-4xl">Loja</h1>
          </div>
          <div className="shop-balance flex items-center gap-2 px-3 py-2">
            <img src={coinIcon} alt="" className="h-6 w-6 object-contain" />
            <span className="text-lg font-black">{user.progression?.coins ?? 0}c</span>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-4 gap-2" role="tablist">
          {categories.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { setCategoryId(id); setTheme("all"); setPreviewItem(null); }} className={`shop-category flex h-16 flex-col items-center justify-center gap-1 ${categoryId === id ? "shop-category--active" : ""}`}>
              <Icon size={18} />
              <span className="text-[11px] font-black">{label}</span>
            </button>
          ))}
        </div>

        <div className="mb-5 flex gap-2">
          <div ref={themeMenuRef} className="profile-theme-select relative z-20 min-w-0 flex-1">
            <button type="button" onClick={() => setIsThemeMenuOpen((current) => !current)} className={`profile-modal-select flex h-11 w-full items-center justify-between px-4 text-sm font-semibold text-white ${isThemeMenuOpen ? "profile-modal-select--open" : ""}`} aria-haspopup="listbox" aria-expanded={isThemeMenuOpen}>
              <span className="truncate">{theme === "all" ? "Todos os temas" : theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              <ChevronDown size={17} className={`shrink-0 text-[#ff8b58] transition-transform ${isThemeMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {isThemeMenuOpen && (
              <div className="profile-theme-menu" role="listbox">
                {themes.map((itemTheme) => {
                  const selected = theme === itemTheme;
                  return (
                    <button key={itemTheme} type="button" role="option" aria-selected={selected} onClick={() => { setTheme(itemTheme); setIsThemeMenuOpen(false); }} className={`profile-theme-option ${selected ? "profile-theme-option--selected" : ""}`}>
                      <span>{itemTheme === "all" ? "Todos os temas" : itemTheme.charAt(0).toUpperCase() + itemTheme.slice(1)}</span>
                      {selected && <Check size={15} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shop-view-toggle grid h-11 w-[92px] shrink-0 grid-cols-2 p-1" aria-label="Origem dos itens">
            <button type="button" onClick={() => setViewMode("all")} className={`flex items-center justify-center ${viewMode === "all" ? "shop-view-toggle__active" : ""}`} aria-label="Todos os itens" title="Todos">
              <Grid2X2 size={16} strokeWidth={2.4} />
            </button>
            <button type="button" onClick={() => setViewMode("store")} className={`flex items-center justify-center ${viewMode === "store" ? "shop-view-toggle__active" : ""}`} aria-label="Itens da loja" title="Loja">
              <Store size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => setPreviewItem(item)} className="shop-item text-left active:scale-[0.98]">
              <div className="relative h-36 overflow-hidden">
                {categoryId === "displayCard" ? (
                  <div className={`display-card-preview ${item.previewClassName} h-full w-full`}>{item.hasShine && <span className="display-card-preview-shine" />}</div>
                ) : (
                  <img src={item.src} alt={item.name} className={`h-full w-full ${categoryId === "background" ? "object-cover" : "object-contain"}`} />
                )}
                {isOwned(item) && <span className="shop-owned absolute right-2 top-2"><Check size={13} strokeWidth={3} /></span>}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-sm font-black">{item.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-black text-[#ffb071]"><img src={coinIcon} alt="" className="h-4 w-4" />{item.price?.amount ?? 0}</span>
              </div>
            </button>
          ))}
        </div>
        {!items.length && (
          <p className="py-10 text-center text-sm font-semibold text-white/35">
            {viewMode === "all" ? "Nenhum item disponível neste tema." : "Você já possui todos os itens deste tema."}
          </p>
        )}
      </section>

      {previewItem && (
        <ShopPreview
          item={previewItem}
          type={categoryId}
          user={user}
          stats={sessionData?.stats}
          owned={isOwned(previewItem)}
          onClose={() => setPreviewItem(null)}
          onBuy={() => { setPurchaseError(""); setPurchaseTarget(previewItem); }}
        />
      )}

      {purchaseTarget && (
        <PurchaseModal item={purchaseTarget} balance={user.progression?.coins ?? 0} error={purchaseError} loading={isPurchasing} onClose={() => setPurchaseTarget(null)} onConfirm={buyItem} />
      )}

      {purchaseSuccess && (
        <PurchaseSuccessModal item={purchaseSuccess} onClose={() => setPurchaseSuccess(null)} />
      )}
    </main>
  );
}

function ShopPreview({ item, type, user, stats, owned, onClose, onBuy }) {
  const simulatedUser = type === "displayCard"
    ? { ...user, profile: { ...user.profile, selectedDisplayCardId: item.id } }
    : user;
  const { backgroundUrl } = getProfileAssetUrls(simulatedUser.profile);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-5 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-[440px] flex-col">
        <div className="shop-preview-actions mb-2 h-[132px] shrink-0 px-4 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-words font-idv-title text-2xl leading-none">{item.name}</h2>
            <button type="button" onClick={onClose} className="profile-modal-close flex h-10 w-10 shrink-0 items-center justify-center" aria-label="Fechar"><X size={17} /></button>
          </div>

          <div className="mt-3 flex min-h-10 items-center justify-between gap-3">
            <p className="shop-item-description max-h-10 min-w-0 flex-1 overflow-y-auto pr-2 text-xs leading-relaxed text-white/45">{item.description}</p>
            <div className="shrink-0">
            {owned ? (
              <button type="button" disabled className="register-paper-action flex h-10 min-w-28 items-center justify-center gap-2 px-4 text-sm opacity-65">
                <Check size={16} /> já possui
              </button>
            ) : (
              <button type="button" onClick={onBuy} className="register-paper-action flex h-10 items-center gap-2 px-4 text-sm">comprar <img src={coinIcon} alt="" className="h-4 w-4" />{item.price?.amount ?? 0}</button>
            )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {type === "displayCard" ? (
            <article className={`profile-sticker-card profile-edit-modal ${item.cardClassName} relative overflow-hidden p-3`}>
              {item.hasShine && backgroundUrl && (
                <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.3]" />
              )}
              <div className={`absolute inset-0 ${item.hasShine ? "bg-gradient-to-b from-[#18050a]/35 via-[#18050a]/72 to-[#18050a]/96" : "bg-gradient-to-b from-[#8f2e10]/25 via-[#5b170c]/72 to-[#2c0908]/96"}`} />
              {item.hasShine && <div className="profile-sticker-shine pointer-events-none absolute -inset-y-10 left-0 w-[78%]" />}
              <div className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.035] p-2"><ProfileHeader user={simulatedUser} readOnly /></div>
              <div className="relative mt-3"><ProfileStats stats={stats} /></div>
            </article>
          ) : (
            <div className="profile-edit-modal p-4"><div className="profile-item-large-preview h-[55vh] overflow-hidden"><img src={item.src} alt={item.name} className={`h-full w-full ${type === "background" ? "object-cover" : "object-contain"}`} /></div></div>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseModal({ item, balance, error, loading, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-5 py-6 backdrop-blur-sm">
      <div className="profile-edit-modal w-full max-w-[420px] p-5">
        <h2 className="font-idv-title text-2xl">Confirmar compra?</h2>
        <p className="mt-1 text-sm text-white/45">{item.name}</p>
        <div className="my-5 grid grid-cols-2 gap-2">
          <div className="profile-modal-control p-3"><p className="text-xs text-white/40">Saldo atual</p><p className="mt-1 text-xl font-black">{balance}c</p></div>
          <div className="profile-modal-control p-3"><p className="text-xs text-white/40">Preço</p><p className="mt-1 text-xl font-black text-[#ff9a61]">{item.price?.amount ?? 0}c</p></div>
        </div>
        {error && <p className="mb-3 text-center text-sm font-bold text-red-300">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={loading} onClick={onClose} className="register-outline-action h-11 text-sm">cancelar</button>
          <button type="button" disabled={loading} onClick={onConfirm} className="register-paper-action h-11 text-sm disabled:opacity-50">{loading ? "comprando..." : "comprar"}</button>
        </div>
      </div>
    </div>
  );
}

function PurchaseSuccessModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-5 py-6 backdrop-blur-sm">
      <div className="profile-edit-modal relative w-full max-w-[380px] px-6 py-8 text-center text-white">
        <button type="button" onClick={onClose} className="profile-modal-close absolute right-4 top-4 flex h-9 w-9 items-center justify-center" aria-label="Fechar"><X size={17} /></button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#ff9a61]/35 bg-[#ff713f]/15 text-[#ff8b58] shadow-[0_0_24px_rgba(255,83,42,0.2)]">
          <CheckCircle2 size={28} strokeWidth={2.2} />
        </div>
        <h2 className="font-idv-title mt-4 text-3xl">Item comprado</h2>
        <p className="mt-1 text-sm font-black text-[#ff9a61]">{item.name}</p>
        <p className="mt-3 text-sm text-white/48">Personalize em seu perfil.</p>
      </div>
    </div>
  );
}
