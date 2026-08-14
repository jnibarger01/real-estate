import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PropertyTypeDatum } from '../lib/api';
import { formatNumber } from '../lib/api';

const COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#6d28d9', '#8b5cf6', '#ddd6fe', '#7e22ce', '#9ca3af'];

export default function PropertyTypesChart({ data }: { data: PropertyTypeDatum[] }) {
  const chartData = data.map((d) => ({
    name: d.label,
    count: d.property_count,
    pct: d.pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v: number) => formatNumber(v)} />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 11 }}
          stroke="#94a3b8"
        />
        <Tooltip
          formatter={(value: number | string, name: string) => [formatNumber(Number(value)), 'Properties']}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}