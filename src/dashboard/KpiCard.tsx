import type { ReactNode } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value?: string;
  help?: string;
  trend?: number;
}

export default function KpiCard({ icon, label, value, help, trend }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{label}</span>
          <span className={cn('text-slate-400', trend !== undefined && (trend >= 0 ? 'text-emerald-600' : 'text-rose-600'))}>
            {icon}
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight">
          {value === undefined ? <Skeleton className="h-8 w-28" /> : value}
        </div>
        {help && <p className="mt-1 text-xs text-slate-400">{help}</p>}
      </CardContent>
    </Card>
  );
}