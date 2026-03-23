export function sanitizeColorsForExport(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;

  const allElements = clone.querySelectorAll('*');

  allElements.forEach((el) => {
    const computed = window.getComputedStyle(el as HTMLElement);

    ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'].forEach((prop) => {
      const value = computed.getPropertyValue(prop);

      if (value && value.includes('lab')) {
        (el as HTMLElement).style.setProperty(prop, '#000000');
      }

      if (value && value.includes('lch')) {
        (el as HTMLElement).style.setProperty(prop, '#000000');
      }

      if (value && value.includes('oklab')) {
        (el as HTMLElement).style.setProperty(prop, '#000000');
      }
    });
  });

  return clone;
}
