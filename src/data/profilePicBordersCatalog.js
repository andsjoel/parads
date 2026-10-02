import { catalogRarity } from "./economy";

const border = (id, name, theme, rarity) => ({
  id,
  name,
  description: `Moldura ${name} para o perfil.`,
  category: "profile",
  theme,
  ...catalogRarity(rarity),
  imageId: id,
});

export const profilePicBordersCatalog = [
  border("border-normal-1", "Clássico", "Clássico", "uncommon"),
  border("border-normal-2", "Clássico", "Clássico", "uncommon"),
  border("border-normal-3", "Clássico", "Clássico", "uncommon"),
  border("border-gamemaster-1", "Master Gold", "game", "rare"),
  border("border-gamemaster-2", "Master Sky", "game", "rare"),
  border("border-gamemaster-3", "Master Red", "game", "rare"),
  border("border-comic-1", "Comic", "comic", "epic"),
  border("border-comic-2", "Comic", "comic", "epic"),
  border("border-glitch-1", "Glitch", "outros", "epic"),
  border("border-magic-2", "Runas", "magic", "legendary"),
  border("border-mascot-1", "Gatuxo", "mascote", "legendary"),
  border("border-mascot-2", "Gatuxo", "mascote", "legendary"),
  border("border-fire-1", "On fire", "outros", "legendary"),
  border("border-fire-2", "On pixel", "outros", "legendary"),
  border("border-magic-1", "Gameboy", "outros", "superior"),
  border("border-gobble-1", "Gobble", "outros", "superior"),
];
