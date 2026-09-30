import { coinPrice } from "./economy";

const background = (id, name, price = 1, theme = "normal", rarity = "common") => ({
  id,
  name,
  description: `Capa ${name} para o perfil.`,
  category: "profile",
  theme,
  rarity,
  imageId: id,
  price: coinPrice(price),
});

export const profileBackgroundsCatalog = [
  background("bg-normal-1", "Normal 1"),
  background("bg-normal-2", "Normal 2"),
  background("bg-normal-3", "Normal 3"),
  background("bg-normal-4", "Normal 4"),
  background("bg-normal-5", "Normal 5"),
  background("bg-normal-6", "Normal 6"),
  background("bg-normal-7", "Normal 7"),
  background("bg-haikyu-1", "Haikyu 1", 3, "haikyu", "rare"),
  background("bg-haikyu-2", "Haikyu 2", 3, "haikyu", "rare"),
  background("bg-pokemon-1", "Pokémon 1", 3, "pokemon", "rare"),
  background("bg-pokemon-2", "Pokémon 2", 3, "pokemon", "rare"),
];
