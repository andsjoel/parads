const backgroundImages = import.meta.glob(
  "../assets/profile-backgrounds/**/*.{png,jpg,jpeg,webp,webm,mp4}",
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
    path.includes(`${targetId}.`),
  );

  if (entry) return entry[1];

  const fallback = Object.entries(files).find(([path]) =>
    path.includes(`${fallbackId}.`),
  );

  return fallback?.[1] || "";
}

export function isVideoAsset(src = "") {
  return /\.(webm|mp4)(?:$|[?#])/i.test(src);
}

function getStaticAssetById(files, id, fallbackId) {
  const targetId = id || fallbackId;
  const thumbnail = Object.entries(files).find(([path]) =>
    path.includes(`${targetId}-thumb.`),
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
    profile.selectedBackgroundId,
    "bg-default",
  );

  const profilePicUrl = getProfileAsset(
    profilePicImages,
    profile.selectedProfilePicId,
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
