import { fieldHintMarkup } from "@/components/field-hint"

export function collapsibleTextMarkup(text: string): string {
  return `<div class="collapsible-text page-description-hint">${fieldHintMarkup(text)}</div>`
}
