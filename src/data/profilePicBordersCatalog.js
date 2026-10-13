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
  border("border-normal-1", "Clássico", "Clássico", "rare"),
  border("border-normal-2", "Clássico", "Clássico", "rare"),
  border("border-normal-3", "Clássico", "Clássico", "rare"),
  border("border-gamemaster-1", "Master Gold", "game", "epic"),
  border("border-gamemaster-2", "Master Sky", "game", "epic"),
  border("border-gamemaster-3", "Master Red", "game", "epic"),
  border("border-comic-1", "Comic", "comic", "legendary"),
  border("border-comic-2", "Comic", "comic", "legendary"),
  border("border-glitch-1", "Glitch", "outros", "legendary"),
  border("border-magic-2", "Runas", "magic", "superior"),
  border("border-mascot-1", "Gatuxo", "mascote", "superior"),
  border("border-mascot-2", "Gatuxo", "mascote", "superior"),
  border("border-fire-1", "On fire", "outros", "superior"),
  border("border-fire-2", "On pixel", "outros", "superior"),
  border("border-magic-1", "Gameboy", "outros", "mythic"),
  border("border-gobble-1", "Gobble", "outros", "mythic"),
];
