import { profileBackgroundsCatalog } from "../data/profileBackgroundsCatalog";
import { profilePicsCatalog } from "../data/profilePicsCatalog";

const backgroundImages = import.meta.glob(
  "../assets/profile-backgrounds/**/*.{png,jpg,jpeg,webp,gif,webm,mp4}",
  {
    eager: true,
    import: "default",
  },
);

const profilePicImages = import.meta.glob(
  "../assets/profile-pics/**/*.{png,jpg,jpeg,webp,gif}",
  {
    eager: true,
    import: "default",
  },
);

const profilePicBorderImages = import.meta.glob(
  "../assets/profile-pic-borders/**/*.{png,jpg,jpeg,webp,gif,svg}",
  {
    eager: true,
    import: "default",
  },
);

export function getAssetById(files, id, fallbackId) {
  const targetId = id || fallbackId;

  const entry = Object.entries(files).find(([path]) =>
    path.endsWith(`/${targetId}`) || path.includes(`${targetId}.`),
  );

  if (entry) return entry[1];

  const fallback = Object.entries(files).find(([path]) =>
    path.endsWith(`/${fallbackId}`) || path.includes(`${fallbackId}.`),
  );

  return fallback?.[1] || "";
}

export function isVideoAsset(src = "") {
  return /\.(webm|mp4)(?:$|[?#])/i.test(src);
}

function getStaticAssetById(files, id, fallbackId) {
  const targetId = id || fallbackId;
  const thumbnailId = targetId.replace(/\.gif$/i, "");
  const thumbnail = Object.entries(files).find(([path]) =>
    path.includes(`${thumbnailId}-thumb.`),
  );

  return thumbnail?.[1] || getAssetById(files, targetId, fallbackId);
}

export function getCatalogAssetList(files, catalog) {
  return catalog.map((item) => ({
    ...item,
    src: getAssetById(files, item.imageId, item.imageId),
    mediaType: isVideoAsset(getAssetById(files, item.imageId, item.imageId))
      ? "video"
      : "image",
  }));
}

export function getProfileAssetUrls(profile = {}, options = {}) {
  const getProfileAsset = options.staticPreview
    ? getStaticAssetById
    : getAssetById;
  const backgroundUrl = getAssetById(
    backgroundImages,
    profileBackgroundsCatalog.find((item) => item.id === profile.selectedBackgroundId)?.imageId || profile.selectedBackgroundId,
    "bg-default",
  );

  const profilePicUrl = getProfileAsset(
    profilePicImages,
    profilePicsCatalog.find((item) => item.id === profile.selectedProfilePicId)?.imageId || profile.selectedProfilePicId,
    "pic-default",
  );

  const profilePicBorderUrl = profile.selectedProfilePicBorderId
    ? getProfileAsset(
        profilePicBorderImages,
        profile.selectedProfilePicBorderId,
        profile.selectedProfilePicBorderId,
      )
    : "";

  return {
    backgroundUrl,
    backgroundType: isVideoAsset(backgroundUrl) ? "video" : "image",
    profilePicUrl,
    profilePicBorderUrl,
  };
}

export const profileAssetFiles = {
  backgroundImages,
  profilePicImages,
  profilePicBorderImages,
};
