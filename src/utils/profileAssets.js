const backgroundImages = import.meta.glob(
  "../assets/profile-backgrounds/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    import: "default",
  },
);

const profilePicImages = import.meta.glob(
  "../assets/profile-pics/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    import: "default",
  },
);

const profilePicBorderImages = import.meta.glob(
  "../assets/profile-pic-borders/*.{png,jpg,jpeg,webp,svg}",
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

export function getCatalogAssetList(files, catalog) {
  return catalog.map((item) => ({
    ...item,
    src: getAssetById(files, item.imageId, item.imageId),
  }));
}

export function getProfileAssetUrls(profile = {}) {
  const backgroundUrl = getAssetById(
    backgroundImages,
    profile.selectedBackgroundId,
    "bg-default-1",
  );

  const profilePicUrl = getAssetById(
    profilePicImages,
    profile.selectedProfilePicId,
    "pic-default-1",
  );

  const profilePicBorderUrl = profile.selectedProfilePicBorderId
    ? getAssetById(
        profilePicBorderImages,
        profile.selectedProfilePicBorderId,
        profile.selectedProfilePicBorderId,
      )
    : "";

  return {
    backgroundUrl,
    profilePicUrl,
    profilePicBorderUrl,
  };
}

export const profileAssetFiles = {
  backgroundImages,
  profilePicImages,
  profilePicBorderImages,
};
