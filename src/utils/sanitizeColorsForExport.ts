export function sanitizeColorsForExport(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;

  // Color functions html2canvas cannot parse
  const unsafeFunctions = ['lab(', 'lch(', 'oklab(', 'oklch('];

  const containsUnsafeColor = (value: string | null): boolean =>
    value ? unsafeFunctions.some((fn) => value.includes(fn)) : false;

  // If the computed value is unsafe, return the fallback; otherwise return the resolved value.
  // Both paths are inlined into the clone so html2canvas never has to re-resolve class-based styles.
  const resolvedOrFallback = (value: string, fallback: string): string =>
    containsUnsafeColor(value) ? fallback : value;

  // CRITICAL: read from ORIGINAL elements while they are still attached to the DOM.
  // getComputedStyle on detached (cloned) elements does not resolve CSS class styles —
  // Tailwind v4 oklch colors are invisible to detached elements. Reading from the original
  // gives us the real resolved values; inlining them into the clone makes inline styles
  // win over any class-based css when html2canvas processes the offscreen clone.
  const originalEls = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
  const cloneEls = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];

  originalEls.forEach((origEl, i) => {
    const cloneEl = cloneEls[i];
    if (!cloneEl) return;

    const computed = window.getComputedStyle(origEl);

    cloneEl.style.color = resolvedOrFallback(computed.color, '#000000');
    cloneEl.style.backgroundColor = resolvedOrFallback(computed.backgroundColor, 'transparent');
    cloneEl.style.borderColor = resolvedOrFallback(computed.borderColor, '#000000');
    cloneEl.style.borderTopColor = resolvedOrFallback(computed.borderTopColor, '#000000');
    cloneEl.style.borderRightColor = resolvedOrFallback(computed.borderRightColor, '#000000');
    cloneEl.style.borderBottomColor = resolvedOrFallback(computed.borderBottomColor, '#000000');
    cloneEl.style.borderLeftColor = resolvedOrFallback(computed.borderLeftColor, '#000000');
    cloneEl.style.outlineColor = resolvedOrFallback(computed.outlineColor, '#000000');

    // SVG properties — only apply if the browser reports a value (empty on non-SVG elements)
    if (computed.fill) cloneEl.style.fill = resolvedOrFallback(computed.fill, '#000000');
    if (computed.stroke) cloneEl.style.stroke = resolvedOrFallback(computed.stroke, 'none');
  });

  return clone;
}
