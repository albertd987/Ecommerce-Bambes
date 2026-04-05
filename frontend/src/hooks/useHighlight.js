export function useHighlight() {
  const triggerHighlight = (target) => {
    const el = document.querySelector(`[data-highlight="${target}"]`)
    if (!el) return
    el.classList.add('ui-highlight-pulse')
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => el.classList.remove('ui-highlight-pulse'), 3000)
  }
  return { triggerHighlight }
}
