/* eslint-disable react/prop-types */
import defaultProfilePic from "../../assets/profile-pics/pic-default.png";
import ProfileBackgroundMedia from "./ProfileBackgroundMedia";

export default function ProfileCoverPreview({ src, name, compact = false, animate = false }) {
  return (
    <div className={`profile-cover-preview ${compact ? "profile-cover-preview--compact" : ""}`}>
      <div className="profile-cover-preview__cover">
        <ProfileBackgroundMedia src={src} alt={name} animate={animate} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-[#210019]/20 to-[#210019]" />
      </div>
      <img src={defaultProfilePic} alt="" className="profile-cover-preview__avatar" />
      <div className="profile-cover-preview__identity">
        <span className="font-idv-title block truncate">Jogador</span>
        <span className="profile-cover-preview__username block truncate">@jogador</span>
      </div>
    </div>
  );
}
