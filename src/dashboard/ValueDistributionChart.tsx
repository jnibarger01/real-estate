import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ValueDistributionDatum } from '../lib/api';
import { formatNumber } from '../lib/api';

export default function ValueDistributionChart({ data }: { data: ValueDistributionDatum[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.bucket_min >= 1_000_000 ? '1M+' : `$${(d.bucket_min / 1000).toFixed(0)}K`,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" interval={2} />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#94a3b8"
          tickFormatter={(v: number) => formatNumber(v)}
          width={56}
        />
        <Tooltip
          formatter={(value: number | string, name: string) => [formatNumber(Number(value)), 'Properties']}
          labelFormatter={(l, payload) => {
            const item = payload?.[0]?.payload as ValueDistributionDatum | undefined;
            return item ? `${currencyLabel(item)} — ${currencyLabel(item, true)}` : String(l);
          }}
        />
        <Bar dataKey="property_count" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function currencyLabel(item: ValueDistributionDatum, high = false): string {
  const v = high ? item.bucket_max : item.bucket_min;
  if (v >= 1_000_000) return '$1M+';
  return `$${Math.round(v / 1000)}K`;
}