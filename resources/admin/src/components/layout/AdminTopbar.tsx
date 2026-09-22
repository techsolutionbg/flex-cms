export function AdminTopbar({ csrfToken }: { csrfToken: string }) {
  return (
    <header className="admin-topbar">
      <div className="topbar-spacer" aria-hidden="true" />
      <div className="topbar-actions">
        <form method="post" action="/logout">
          <input type="hidden" name="_token" value={csrfToken} />
          <button className="logout" type="submit">
            Изход
          </button>
        </form>
      </div>
    </header>
  )
}
