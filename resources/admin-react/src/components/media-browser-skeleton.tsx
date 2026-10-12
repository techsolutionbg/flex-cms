const skeletonCount = 12

const masonryHeights = ["7.5rem", "10rem", "8.25rem", "11.5rem", "9rem", "8rem"]

export function MediaBrowserSkeleton({ layout }: { layout: "grid" | "masonry" }) {
  return (
    <div
      className={layout === "masonry" ? "media-masonry" : "media-grid"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="media-skeleton-status">Зареждане…</span>
      {Array.from({ length: skeletonCount }, (_, index) => (
        <article
          key={index}
          className={`media-card media-card-skeleton${layout === "masonry" ? " media-card-skeleton--masonry" : ""}`}
          aria-hidden="true"
        >
          <div
            className="media-card-skeleton-preview admin-skeleton-shimmer"
            style={
              layout === "masonry"
                ? { height: masonryHeights[index % masonryHeights.length] }
                : undefined
            }
          />
          <div className="media-card-skeleton-title admin-skeleton-shimmer" />
          {layout === "grid" && <div className="media-card-skeleton-footer admin-skeleton-shimmer" />}
        </article>
      ))}
    </div>
  )
}
