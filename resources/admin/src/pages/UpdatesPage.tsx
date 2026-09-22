import { HistoryDataTable } from "@/components/history-data-table"
import { Button } from "@/components/ui/button"
import type { AdminBootstrap } from "@/types"

export function UpdatesPage({ bootstrap }: { bootstrap: AdminBootstrap }) {
  const inspection = bootstrap.inspection

  return (
    <>
      <h1>Обновявания</h1>
      <p className="lead">
        Качете ZIP пакет за версията и стартирайте контролирано обновяване.
      </p>
      {bootstrap.notice && (
        <div className="notice success">{bootstrap.notice}</div>
      )}
      {bootstrap.error && <div className="notice error">{bootstrap.error}</div>}
      {inspection && (
        <div className="notice info">
          <strong>Пакетът е валиден.</strong>
          <br />
          Версия: {inspection.version ?? "-"} · Файлове:{" "}
          {inspection.files ?? "-"} · Миграции:{" "}
          {inspection.migrations ? "да" : "не"}
        </div>
      )}
      <section className="content-card">
        <h2>Качване на platform пакет</h2>
        <form
          method="post"
          action="/admin/updates/install"
          encType="multipart/form-data"
        >
          <input type="hidden" name="_token" value={bootstrap.csrfToken} />
          <input type="hidden" name="mode" value="install" />
          <label htmlFor="package">ZIP пакет на новата версия</label>
          <input
            id="package"
            type="file"
            name="package"
            accept="application/zip,.zip"
            required
          />
          <Button type="submit" className="mt-4">
            Актуализирай платформата
          </Button>
        </form>
        <p className="muted">
          Системата проверява checksum, цифровия подпис и съвместимостта,
          създава backup, изпълнява миграциите и прави health check.
        </p>
      </section>
      <section className="content-card">
        <h2>История</h2>
        <HistoryDataTable
          history={bootstrap.history ?? []}
          csrfToken={bootstrap.csrfToken}
        />
      </section>
    </>
  )
}
