import { coinPrice } from "./economy";

const border = (id, name, theme, price, rarity = "rare") => ({
  id,
  name,
  description: `Moldura ${name} para o perfil.`,
  category: "profile",
  theme,
  rarity,
  imageId: id,
  price: coinPrice(price),
});

export const profilePicBordersCatalog = [
  border("border-normal-1", "Normal 1", "normal", 5, "common"),
  border("border-normal-2", "Normal 2", "normal", 5, "common"),
  border("border-normal-3", "Normal 3", "normal", 5, "common"),
  border("border-gamemaster-1", "Game Master 1", "game", 8),
  border("border-gamemaster-2", "Game Master 2", "game", 8),
  border("border-gamemaster-3", "Game Master 3", "game", 8),
  border("border-comic-1", "Comic", "comic", 15),
  border("border-magic-1", "Magic 1", "magic", 20, "special"),
  border("border-magic-2", "Magic 2", "magic", 20, "special"),
  border("border-mascot-1", "Mascot 1", "mascot", 20, "special"),
  border("border-mascot-2", "Mascot 2", "mascot", 20, "special"),
  border("border-fire-1", "Fire", "fire", 20, "special"),
];
