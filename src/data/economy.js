export const COIN_CURRENCY = "coins";
export const INITIAL_COIN_BALANCE = 5;

export const ITEM_RARITIES = {
  normal: { label: "Normal", price: 1, color: "#aab4ae", order: 1 },
  uncommon: { label: "Incomum", price: 5, color: "#55d98b", order: 2 },
  rare: { label: "Raro", price: 10, color: "#4fa8ff", order: 3 },
  epic: { label: "Épico", price: 20, color: "#c56cff", order: 4 },
  legendary: { label: "Lendário", price: 35, color: "#ffb02e", order: 5 },
  superior: { label: "Superior", price: 50, color: "#ff7043", order: 6 },
  mythic: { label: "Mítico", price: 60, color: "#ff4f86", order: 7 },
  exclusive: { label: "Exclusivo", price: 100, color: "#fff2b2", order: 8 },
};

export function coinPrice(amount) {
  return {
    currency: COIN_CURRENCY,
    amount,
  };
}

export function catalogRarity(rarity = "normal") {
  const definition = ITEM_RARITIES[rarity] || ITEM_RARITIES.normal;
  return { rarity, price: coinPrice(definition.price) };
}

export function getItemRarity(rarity = "normal") {
  return ITEM_RARITIES[rarity] || ITEM_RARITIES.normal;
}

export function getPriceAmount(item, currency = COIN_CURRENCY) {
  if (item?.price?.currency !== currency) return null;
  return item.price.amount;
}
