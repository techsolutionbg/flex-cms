import { expect, test } from "@playwright/test"

test("login remains usable at responsive widths", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Добре дошли." })).toBeVisible()
  await expect(page.getByLabel("Имейл")).toBeVisible()
  await expect(page.getByRole("button", { name: /Вход/ })).toBeVisible()
})
