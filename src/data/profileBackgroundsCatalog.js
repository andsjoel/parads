import { catalogRarity } from "./economy";

const background = (id, name, theme = "normal", rarity = "normal", imageId = id) => ({
  id,
  name,
  description: `Capa ${name} para o perfil.`,
  category: "profile",
  theme,
  ...catalogRarity(rarity),
  imageId,
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
  background("bg-pokemon-5", "Pokelim", "pokemon", "legendary", "bg-pokemon-5-legendary"),
  background("bg-pokemon-6", "Vibes", "pokemon", "epic", "bg-pokemon-6-epic"),
  background("bg-ghibli-1", "Ghibli", "ghibli", "uncommon"),
  background("bg-ghibli-2", "Ghibli", "ghibli", "uncommon"),
  background("bg-ghibli-3", "Ghibli", "ghibli", "uncommon"),
  background("bg-miranha-1", "Aranhaverso", "miranha", "legendary", "bg-miranha-1-legendary"),
  background("bg-miranha-2", "Miranha", "miranha", "epic", "bg-miranha-2-epic"),
  background("bg-naruto-1", "Narutin", "naruto", "legendary", "bg-naruto-1-legendary"),
  background("bg-pequeno-principe-1", "Pequeno Príncipe", "pequeno-principe", "uncommon"),
  background("bg-pequeno-principe-2", "O que você vê?", "pequeno-principe", "rare", "bg-pequeno-principe-2-rare"),
  background("bg-rick-morty-1", "Rick", "rick-morty", "epic", "bg-rick-morty-1-epic"),
  background("bg-rick-morty-2", "Rick e Morty", "rick-morty", "epic", "bg-rick-morty-2-epic"),
  background("bg-sailor-1", "Sailor Moon", "sailor-moon", "legendary", "bg-sailor-1-epic"),
  background("bg-sailor-2", "Sailor Moon", "sailor-moon", "epic", "bg-sailor-2-epic"),

  background("bg-video-multicato", "Gatoverso", "gatos", "exclusive"),
];
