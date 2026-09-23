let nextHintId = 0

export function fieldHintMarkup(text: string): string {
  const id = `field-hint-${nextHintId++}`
  return `<span class="field-hint" x-data="{ open: false, placement: 'top', updatePlacement() { const rect = $refs.trigger.getBoundingClientRect(); const above = rect.top; const below = window.innerHeight - rect.bottom; this.placement = above < 180 && below > above ? 'bottom' : 'top'; } }" @click.outside="open = false" @resize.window="if (open) updatePlacement()" @scroll.window="if (open) updatePlacement()"><button x-ref="trigger" class="field-hint-trigger" type="button" aria-label="Покажи подсказката" aria-controls="${id}" :aria-expanded="open" @click.stop="open = !open; if (open) $nextTick(() => updatePlacement())"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.75 9a2.25 2.25 0 1 1 3.6 1.8c-.8.6-1.35 1.05-1.35 2.2M12 16.5h.01" /></svg></button><span id="${id}" class="field-hint-tooltip" role="tooltip" x-show="open" :class="{ 'is-open': open, 'is-below': placement === 'bottom' }" x-cloak>${text}</span></span>`
}
