import { chartSurfaceHexFromDocument } from '../utils/chartColorContrast';

/**
 * Hex background behind charts (resolved `html` background from CSS).
 */
export function useChartSurfaceHex(): string {
  return chartSurfaceHexFromDocument();
}
