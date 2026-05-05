import { Suspense, type ReactNode } from 'react';
import ChartSkeleton from '../skeletons/ChartSkeleton';

type ChartSuspenseProps = {
  children: ReactNode;
  height?: number;
  label?: string;
};

/** Suspense fallback for `React.lazy`-loaded chart modules (Recharts splits per route/tab). */
export function ChartSuspense({
  children,
  height = 280,
  label = 'Loading chart',
}: ChartSuspenseProps) {
  return <Suspense fallback={<ChartSkeleton height={height} label={label} />}>{children}</Suspense>;
}
