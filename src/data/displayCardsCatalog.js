import { coinPrice } from "./economy";

export const DEFAULT_DISPLAY_CARD_ID = "display-card-orange";

export const defaultDisplayCard = {
  id: DEFAULT_DISPLAY_CARD_ID,
  name: "Carta Laranja",
  description: "Carta padrão de exibição do perfil.",
  cardClassName: "profile-sticker-card--orange",
  previewClassName: "display-card-preview--orange",
  hasShine: false,
};

export const displayCardsCatalog = [
  {
    id: "display-card-shiny",
    name: "Carta Brilhante",
    description: "Carta especial com acabamento translúcido e efeito de brilho.",
    category: "display-card",
    theme: "special",
    rarity: "rare",
    price: coinPrice(5),
    cardClassName: "profile-sticker-card--shiny",
    previewClassName: "display-card-preview--shiny",
    hasShine: true,
  },
];

export function getDisplayCard(id) {
  if (!id || id === DEFAULT_DISPLAY_CARD_ID) return defaultDisplayCard;
  return displayCardsCatalog.find((card) => card.id === id) || defaultDisplayCard;
}
