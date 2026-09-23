type BreadcrumbItem = {
  label: string
  href: string
}

export function breadcrumbsMarkup(
  currentLabelExpression: string,
  ancestors: BreadcrumbItem[] = [],
  isDashboardExpression = "false",
): string {
  const separator = `<span class="breadcrumbs-separator" aria-hidden="true">/</span>`
  const ancestorMarkup = ancestors
    .map((item) => `<a href="${item.href}">${item.label}</a>${separator}`)
    .join("")

  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol class="breadcrumbs-list"><li class="breadcrumbs-ancestors" x-show="!(${isDashboardExpression})"><a href="/admin">Табло</a>${separator}${ancestorMarkup}</li><li class="breadcrumbs-current" aria-current="page"><span x-text="${currentLabelExpression}"></span></li></ol></nav>`
}
