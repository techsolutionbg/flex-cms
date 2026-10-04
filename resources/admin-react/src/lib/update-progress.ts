import type { PlatformUpdateJob } from "@/lib/admin-types"

const phases: Record<string, { step: number; label: string }> = {
  pending: { step: 0, label: "Изчакване на updater процеса" },
  running: { step: 1, label: "Подготовка на обновяването" },
  resolving: { step: 1, label: "Проверка на релийза и съвместимостта" },
  downloading: { step: 2, label: "Изтегляне на пакета" },
  verifying: { step: 3, label: "Проверка на подписа и файловете" },
  started: { step: 3, label: "Разархивиране на проверения пакет" },
  staged: { step: 4, label: "Създаване на резервно копие" },
  backed_up: { step: 4, label: "Подготовка на резервното копие и базата данни" },
  maintenance_enabled: { step: 5, label: "Инсталиране на новите файлове" },
  files_activated: { step: 5, label: "Файловете са инсталирани" },
  migrations_running: { step: 6, label: "Обновяване на базата данни" },
  health_checking: { step: 6, label: "Проверка на работоспособността" },
  completed: { step: 7, label: "Обновяването е завършено" },
  recovery_required: { step: 6, label: "Необходимо е възстановяване на платформата" },
  restoring_backup: { step: 6, label: "Неуспешна проверка: възстановяване на резервното копие" },
}

export function updateProgress(job: PlatformUpdateJob | null) {
  const phase = phases[job?.phase ?? job?.status ?? "pending"] ?? phases.running
  const total = job?.files_total ?? 0
  const done = job?.files_processed ?? 0
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0
  return { ...phase, value: Math.min(7, phase.step + fraction) }
}

export function updateMonitorError(job: PlatformUpdateJob, elapsed: number): string | null {
  const created = Date.parse(job.created_at ?? "")
  const age = Number.isFinite(created) ? Date.now() - created : elapsed
  if (job.status === "pending" && age >= 120_000) {
    return "Updater процесът не стартира задачата. Проверете дали работи и има достъп до storage/.env и опашката. Обновяването остава в опашката; не стартирайте втора инсталация."
  }
  if ((job.status === "pending" || job.status === "running") && elapsed >= 20 * 60_000) {
    return "Проследяването отне твърде дълго. Проверете updater логовете и състоянието на задачата. Тя може да продължава да се изпълнява."
  }
  return null
}
