import { catalogRarity } from "./economy";

const background = (id, name, theme = "normal", rarity = "normal") => ({
  id,
  name,
  description: `Capa ${name} para o perfil.`,
  category: "profile",
  theme,
  ...catalogRarity(rarity),
  imageId: id,
});

export const profileBackgroundsCatalog = [
  background("bg-normal-1", "Clássico"),
  background("bg-normal-2", "Clássico"),
  background("bg-normal-3", "Clássico"),
  background("bg-normal-4", "Clássico"),
  background("bg-normal-5", "Clássico"),
  background("bg-normal-6", "Clássico"),
  background("bg-normal-7", "Clássico"),
  background("bg-haikyu-1", "Time", "haikyu", "uncommon"),
  background("bg-haikyu-2", "Reis", "haikyu", "uncommon"),
  background("bg-haikyu-3", "Corvos", "haikyu", "uncommon"),
  background("bg-pokemon-1", "Pokebola", "pokemon", "uncommon"),
  background("bg-pokemon-2", "Pika", "pokemon", "uncommon"),
  background("bg-pokemon-3", "Forest", "pokemon", "uncommon"),
  background("bg-pokemon-4", "Mãe Eevee", "pokemon", "uncommon"),

  background("bg-video-multicato", "Gatoverso", "gatos", "exclusive"),
];
