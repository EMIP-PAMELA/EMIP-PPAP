export function sanitizeColorsForExport(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;

  const allElements = clone.querySelectorAll('*');

  // Unsupported color functions that html2canvas cannot parse
  const unsafeFunctions = ['lab(', 'lch(', 'oklab(', 'oklch('];

  // Helper to check if a color value contains unsupported functions
  const containsUnsafeColor = (value: string | null): boolean => {
    return value ? unsafeFunctions.some((fn) => value.includes(fn)) : false;
  };

  allElements.forEach((el) => {
    const computed = window.getComputedStyle(el as HTMLElement);
    const htmlEl = el as HTMLElement;

    // Text color
    if (containsUnsafeColor(computed.color)) {
      console.warn('Sanitized unsupported color:', computed.color);
      htmlEl.style.color = '#000000';
    }

    // Background color
    if (containsUnsafeColor(computed.backgroundColor)) {
      console.warn('Sanitized unsupported backgroundColor:', computed.backgroundColor);
      htmlEl.style.backgroundColor = '#ffffff';
    }

    // Border colors
    if (containsUnsafeColor(computed.borderColor)) {
      htmlEl.style.borderColor = '#000000';
    }

    if (containsUnsafeColor(computed.borderTopColor)) {
      htmlEl.style.borderTopColor = '#000000';
    }

    if (containsUnsafeColor(computed.borderRightColor)) {
      htmlEl.style.borderRightColor = '#000000';
    }

    if (containsUnsafeColor(computed.borderBottomColor)) {
      htmlEl.style.borderBottomColor = '#000000';
    }

    if (containsUnsafeColor(computed.borderLeftColor)) {
      htmlEl.style.borderLeftColor = '#000000';
    }

    // Outline color
    if (containsUnsafeColor(computed.outlineColor)) {
      htmlEl.style.outlineColor = '#000000';
    }

    // SVG fill and stroke
    if (containsUnsafeColor(computed.fill)) {
      htmlEl.style.fill = '#000000';
    }

    if (containsUnsafeColor(computed.stroke)) {
      htmlEl.style.stroke = '#000000';
    }
  });

  return clone;
}
