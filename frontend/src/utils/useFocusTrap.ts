import { useEffect, useRef } from 'react'

export function useFocusTrap(isOpen: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!isOpen) return

    // 1. Remember the previously focused element to restore when closing
    previousFocusRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    if (!container) return

    // 2. Transfer focus to the first focusable element inside the container, or container itself
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    } else {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    // 3. Handle KeyDown for Tab trapping and Escape closing
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault()
        onEscapeRef.current()
        return
      }

      if (e.key === 'Tab') {
        const elements = container?.querySelectorAll<HTMLElement>(focusableSelector)
        if (!elements || elements.length === 0) {
          e.preventDefault()
          return
        }

        const firstElement = elements[0]
        const lastElement = elements[elements.length - 1]

        if (elements.length === 1) {
          e.preventDefault()
          firstElement.focus()
          return
        }

        if (e.shiftKey) {
          if (
            document.activeElement === firstElement ||
            document.activeElement === container ||
            !container?.contains(document.activeElement)
          ) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (
            document.activeElement === lastElement ||
            !container?.contains(document.activeElement)
          ) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // 4. Restore focus on unmount / close
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  return containerRef
}
