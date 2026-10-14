import { t } from "@/lib/admin-i18n"
export function MediaDetailSkeleton() {
  return (
    <div className="media-detail-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="media-skeleton-status">{t("Loading…")}</span>
      <div className="media-detail-skeleton-preview admin-skeleton-shimmer" aria-hidden="true" />
      <div className="media-detail-skeleton-section" aria-hidden="true">
        <div className="media-detail-skeleton-heading admin-skeleton-shimmer" />
        <div className="media-detail-skeleton-lines">
          <div className="admin-skeleton-shimmer" />
          <div className="admin-skeleton-shimmer" />
          <div className="admin-skeleton-shimmer" />
        </div>
      </div>
      <div className="media-detail-skeleton-section" aria-hidden="true">
        <div className="media-detail-skeleton-heading admin-skeleton-shimmer" />
        <div className="media-detail-skeleton-fields">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="media-detail-skeleton-field">
              <div className="admin-skeleton-shimmer media-detail-skeleton-label" />
              <div className="admin-skeleton-shimmer media-detail-skeleton-input" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
