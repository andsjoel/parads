/* eslint-disable react/prop-types */
export default function OrbitLoader({ size = 40, className = "" }) {
  return (
    <span
      className={`orbit-loader ${className}`}
      style={{ "--orbit-loader-size": `${size}px` }}
      role="status"
      aria-label="Carregando"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <span key={index} style={{ "--orbit-index": index }} />
      ))}
    </span>
  );
}
