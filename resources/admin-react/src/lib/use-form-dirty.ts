import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

function snapshot(form: HTMLFormElement): string {
  const controls = Array.from(form.elements).flatMap((element): unknown[][] => {
    if (
      !(element instanceof HTMLElement) ||
      element instanceof HTMLButtonElement ||
      element.hasAttribute("data-dirty-ignore")
    )
      return []
    if (element instanceof HTMLInputElement) {
      if (["submit", "button", "reset"].includes(element.type)) return []
      if (element.type === "checkbox" || element.type === "radio")
        return [[element.name, element.type, element.value, element.checked]]
      if (element.type === "file")
        return [[element.name, element.type, Array.from(element.files ?? []).map((file) => file.name)]]
      return [[element.name, element.type, element.value]]
    }
    if (element instanceof HTMLTextAreaElement) return [[element.name, "textarea", element.value]]
    if (element instanceof HTMLSelectElement)
      return [[element.name, "select", Array.from(element.selectedOptions).map((option) => option.value)]]
    return []
  })
  const editorValues = Array.from(
    form.querySelectorAll<HTMLElement>('[contenteditable="true"], [role="textbox"]'),
  ).map((editor) => [
    editor.getAttribute("aria-label") ?? editor.className,
    editor.innerHTML,
  ])
  return JSON.stringify(
    [controls, editorValues],
  )
}

/** Tracks whether a form's current controls differ from the last loaded or saved values. */
export function useFormDirty(
  formRef: RefObject<HTMLFormElement | null>,
  ready = true,
): { isDirty: boolean; markClean: () => void; refresh: () => void } {
  const [isDirty, setIsDirty] = useState(false)
  const baseline = useRef<string | null>(null)

  const refresh = useCallback(() => {
    const form = formRef.current
    if (!form) return
    requestAnimationFrame(() => {
      if (baseline.current !== null) setIsDirty(snapshot(form) !== baseline.current)
    })
  }, [baseline, formRef])

  const markClean = useCallback(() => {
    const form = formRef.current
    if (!form) return
    requestAnimationFrame(() => {
      baseline.current = snapshot(form)
      setIsDirty(false)
    })
  }, [baseline, formRef])

  useEffect(() => {
    const form = formRef.current
    if (!form || !ready) return
    baseline.current = snapshot(form)
    setIsDirty(false)
  }, [baseline, formRef, ready])

  useEffect(() => {
    const form = formRef.current
    if (!form) return
    let frame = 0
    const update = (event: Event) => {
      // Expanding or collapsing a section changes only the editor layout, not form data.
      if (event.target instanceof Element && event.target.closest(".collapsible-section-header")) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => refresh())
    }
    form.addEventListener("input", update)
    form.addEventListener("change", update)
    form.addEventListener("click", update)
    return () => {
      cancelAnimationFrame(frame)
      form.removeEventListener("input", update)
      form.removeEventListener("change", update)
      form.removeEventListener("click", update)
    }
  }, [baseline, formRef, refresh])

  return { isDirty, markClean, refresh }
}
