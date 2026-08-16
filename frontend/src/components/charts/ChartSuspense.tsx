import { Suspense, useEffect, useState, type ReactNode } from 'react';
import ChartSkeleton from '../skeletons/ChartSkeleton';

type ChartSuspenseProps = {
  children: ReactNode;
  height?: number;
  label?: string;
};

/**
 * Suspense fallback for `React.lazy`-loaded chart modules (Recharts splits per route/tab).
 * Mounting `children` is deferred one idle tick past the initial paint so a chart's
 * lazy-loaded chunk doesn't fetch+parse on the same task as the surrounding page content --
 * under CPU throttling that main-thread work delayed paint of everything on the page, not
 * just the chart (seen via Lighthouse LCP on Standings, whose bar chart pulls in recharts).
 */
export function ChartSuspense({
  children,
  height = 280,
  label = 'Loading chart',
}: ChartSuspenseProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setReady(true), { timeout: 200 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!ready) return <ChartSkeleton height={height} label={label} />;

  return <Suspense fallback={<ChartSkeleton height={height} label={label} />}>{children}</Suspense>;
}
