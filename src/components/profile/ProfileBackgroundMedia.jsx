/* eslint-disable react/prop-types */
import { isVideoAsset } from "../../utils/profileAssets";

export default function ProfileBackgroundMedia({
  src,
  alt = "",
  animate = true,
  className = "",
}) {
  if (!src) return null;

  if (isVideoAsset(src)) {
    return (
      <video
        src={src}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : "true"}
        autoPlay={animate}
        muted
        loop
        playsInline
        preload={animate ? "auto" : "metadata"}
        className={className}
      />
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
