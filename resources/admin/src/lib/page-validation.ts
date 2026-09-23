import { z } from "zod"

export const pageFormSchema = z.object({
  title: z.string().trim().min(1, "Заглавието е задължително.").max(190, "Заглавието не може да бъде по-дълго от 190 символа."),
  slug: z.string().trim().min(1, "URL адресът не може да бъде празен.").max(190, "URL адресът не може да бъде по-дълъг от 190 символа."),
  content: z.string(),
  parent_id: z.number().int().positive().nullable(),
  status: z.enum(["draft", "published"], "Изберете валиден статус."),
})

export function slugifyPageTitle(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase("bg-BG")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}
