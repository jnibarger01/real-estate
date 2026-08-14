import * as React from 'react';
import { cn } from '@/src/lib/utils';

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & { variant?: 'default' | 'outline' | 'secondary' }) {
  const styles = {
    default: 'bg-violet-100 text-violet-800 border-transparent',
    outline: 'border-slate-200 text-slate-600',
    secondary: 'bg-slate-100 text-slate-700 border-transparent',
  }[variant ?? 'default'];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles,
        className
      )}
      {...props}
    />
  );
}

export { Badge };