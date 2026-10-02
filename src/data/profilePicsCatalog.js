import { catalogRarity } from "./economy";

const profilePic = (id, name, theme, rarity = "normal") => ({
  id,
  name,
  description: `Avatar ${name} para o perfil.`,
  category: "profile",
  theme,
  ...catalogRarity(rarity),
  imageId: id,
});

export const profilePicsCatalog = [
  profilePic("pic-normal-1", "Jogadora", "normal"),
  profilePic("pic-normal-2", "Jogador", "normal"),
  profilePic("pic-normal-3", "Jogador", "normal"),
  profilePic("pic-normal-4", "Jogadora", "normal"),
  profilePic("pic-normal-5", "Jogadora", "normal"),
  profilePic("pic-normal-6", "Jogador", "normal"),
  profilePic("pic-mascote-1", "Mascote", "mascote"),
  profilePic("pic-mascote-2", "Mascote", "mascote"),
  profilePic("pic-face-1", "de Boa", "face", "uncommon"),
  profilePic("pic-face-2", "Monstrinho", "face", "uncommon"),
  profilePic("pic-face-3", ":3", "face", "uncommon"),
  profilePic("pic-avatar-1", "Dan", "game", "uncommon"),
  profilePic("pic-avatar-2", "Fuchsia", "game", "uncommon"),
  profilePic("pic-nyang-1", "Ripper", "nyang", "rare"),
  profilePic("pic-nyang-2", "Nyang", "nyang", "rare"),
  profilePic("pic-anime-1", "Chibi Rosa", "chibi", "epic"),
  profilePic("pic-anime-2", "Cat Girl", "anime", "epic"),
  profilePic("pic-anime-3", "Sad Boy", "anime", "epic"),
  profilePic("pic-anime-4", "Lilith", "anime", "epic"),
  profilePic("pic-game-1", "Viego", "game", "legendary"),
  profilePic("pic-game-2", "Jinx", "game", "legendary"),
  profilePic("pic-game-3", "Yasuo", "game", "legendary"),
];
