import * as React from 'react';
import { cn } from '@/src/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} {...props} />;
}

export { Skeleton };