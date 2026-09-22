export function DashboardPage() {
  return (
    <>
      <h1>Административен панел</h1>
      <p className="lead">
        Имате пълен достъп до системната администрация като супер администратор.
      </p>
      <section className="dashboard-grid" aria-label="Административни секции">
        <article className="content-card">
          <h2>Потребители</h2>
          <p>Управление на потребители, роли и статуси.</p>
          <a href="/api/users">Отвори API →</a>
        </article>
        <article className="content-card">
          <h2>Обновявания</h2>
          <p>Проверка, инсталация и връщане на подписани platform пакети.</p>
          <a href="/admin/updates">Отвори обновявания →</a>
        </article>
      </section>
    </>
  )
}
