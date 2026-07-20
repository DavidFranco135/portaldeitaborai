export const exportToPDF = async (elementId: string, filename: string) => {
  const html2pdf = (await import('html2pdf.js')).default;
  const element = document.getElementById(elementId);
  if (!element) return;

  // Fix: replace oklch colors with hex before rendering
  // html2pdf uses jsPDF/html2canvas which don't support oklch (Tailwind v4 default)
  const styleSheets = Array.from(document.styleSheets);
  const fixedStyles: HTMLStyleElement[] = [];

  try {
    // Inject a style override that replaces oklch with safe hex values
    const safeStyle = document.createElement('style');
    safeStyle.id = '__pdf_safe_colors';
    safeStyle.textContent = `
      #${elementId}, #${elementId} * {
        --tw-bg-opacity: 1;
        color-scheme: light !important;
      }
      /* Override any oklch vars that might bleed through */
      #${elementId} { background-color: #ffffff !important; }
    `;
    document.head.appendChild(safeStyle);
    fixedStyles.push(safeStyle);

    const opt = {
      margin: [6, 6, 6, 6],
      filename,
      image: { type: 'jpeg' as const, quality: 0.97 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc: Document) => {
          // On the cloned document, walk all elements and replace oklch computed styles
          const allEls = clonedDoc.querySelectorAll('*');
          allEls.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const computed = window.getComputedStyle(htmlEl);

            // Properties that might carry oklch
            const props = [
              'color', 'backgroundColor', 'borderColor',
              'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
              'outlineColor', 'boxShadow',
            ];

            props.forEach((prop) => {
              const val = computed.getPropertyValue(prop);
              if (val && val.includes('oklch')) {
                // Replace with fallback
                htmlEl.style.setProperty(prop, prop.toLowerCase().includes('background') ? '#ffffff' : '#000000', 'important');
              }
            });
          });
        },
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'landscape' as const,
        compress: true,
      },
    };

    element.classList.add('pdf-exporting');
    await html2pdf().set(opt).from(element).save();
  } finally {
    element.classList.remove('pdf-exporting');
    fixedStyles.forEach(s => s.remove());
  }
};
