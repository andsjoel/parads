/* eslint-disable react/prop-types */
export default function CourtTeamsFrame({ children, className = "" }) {
  return (
    <div className={`match-court-teams court-teams-frame grid grid-cols-2 ${className}`}>
      {children}
      <span className="court-teams-frame-divider" aria-hidden="true" />
    </div>
  );
}
