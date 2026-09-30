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
  profilePic("pic-normal-5", "Normal 5", "normal", 1),
  profilePic("pic-normal-6", "Normal 6", "normal", 1),
  profilePic("pic-mascote-1", "Mascote 1", "mascote", 2),
  profilePic("pic-mascote-2", "Mascote 2", "mascote", 2),
  profilePic("pic-face-1", "Face 1", "face", 5),
  profilePic("pic-face-2", "Face 2", "face", 5),
  profilePic("pic-face-3", "Face 3", "face", 5),
  profilePic("pic-anime-1", "Anime 1", "anime", 10, "rare"),
  profilePic("pic-anime-2", "Anime 2", "anime", 10, "rare"),
  profilePic("pic-anime-3", "Anime 3", "anime", 10, "rare"),
];
