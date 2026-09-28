/**
 * Per-view document.title with a stable product suffix, so operator tabs can
 * tell the sign-in screen from the live dashboard.
 */
import { useEffect } from 'react';

export const PRODUCT_TITLE = 'Jackson County Property Intelligence';

export function formatDocumentTitle(view: string): string {
  return `${view} · ${PRODUCT_TITLE}`;
}

/** Sets document.title while mounted; restores the previous title on unmount. */
export function useDocumentTitle(view: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = formatDocumentTitle(view);
    return () => {
      document.title = previous;
    };
  }, [view]);
}
