import { coinPrice } from "./economy";

const profilePic = (id, name, theme, price, rarity = "common") => ({
  id,
  name,
  description: `Avatar ${name} para o perfil.`,
  category: "profile",
  theme,
  rarity,
  imageId: id,
  price: coinPrice(price),
});

export const profilePicsCatalog = [
  profilePic("pic-normal-1", "Normal 1", "normal", 1),
  profilePic("pic-normal-2", "Normal 2", "normal", 1),
  profilePic("pic-normal-3", "Normal 3", "normal", 1),
  profilePic("pic-normal-4", "Normal 4", "normal", 1),
  profilePic("pic-premium-1", "Premium 1", "premium", 999, "legendary"),
];
