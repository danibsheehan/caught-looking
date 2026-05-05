import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  STATCAST_SCATTER_DOT_R,
  STATCAST_SCATTER_FILL_OPACITY,
  statcastSprayDiamondPath,
} from '../../utils/statcastMarkerGeometry';
import { StatcastScatterShapeCircle, StatcastScatterShapeDiamond } from './statcastMarkers';

function renderInSvg(node: ReactNode) {
  return render(
    <svg>
      <g>{node}</g>
    </svg>,
  );
}

describe('statcastMarkers', () => {
  it('renders diamond marker path with defaults and geometry mapping', () => {
    const { container } = renderInSvg(<StatcastScatterShapeDiamond cx={20} cy={30} fill="#f50" />);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path).toHaveAttribute('d', statcastSprayDiamondPath(20, 30, STATCAST_SCATTER_DOT_R));
    expect(path).toHaveAttribute('fill', '#f50');
    expect(path).toHaveAttribute('fill-opacity', String(STATCAST_SCATTER_FILL_OPACITY));
    expect(path).toHaveAttribute('stroke', 'var(--border)');
    expect(path).toHaveAttribute('stroke-width', '1');
  });

  it('renders circle marker and honors custom stroke styles', () => {
    const { container } = renderInSvg(
      <StatcastScatterShapeCircle cx={14} cy={24} fill="#08f" stroke="#111" strokeWidth={3} />,
    );
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
    expect(circle).toHaveAttribute('cx', '14');
    expect(circle).toHaveAttribute('cy', '24');
    expect(circle).toHaveAttribute('r', String(STATCAST_SCATTER_DOT_R));
    expect(circle).toHaveAttribute('fill', '#08f');
    expect(circle).toHaveAttribute('stroke', '#111');
    expect(circle).toHaveAttribute('stroke-width', '3');
  });

  it('uses safe defaults when marker props are omitted', () => {
    const { container } = renderInSvg(<StatcastScatterShapeCircle />);
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
    expect(circle).toHaveAttribute('cx', '0');
    expect(circle).toHaveAttribute('cy', '0');
    expect(circle).toHaveAttribute('stroke', 'var(--border)');
    expect(circle).toHaveAttribute('stroke-width', '1');
  });
});
