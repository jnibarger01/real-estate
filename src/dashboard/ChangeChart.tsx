import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SalesTrendDatum } from '../lib/api';
import { currency } from '../lib/api';

export default function ChangeChart({ data }: { data: SalesTrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#94a3b8"
          tickFormatter={(v: number) => currency(v)}
          width={70}
        />
        <Tooltip
          formatter={(value: number | string) => [currency(Number(value)), 'Avg market value']}
          labelFormatter={(l) => `Year ${l}`}
        />
        <Line
          type="monotone"
          dataKey="avg_market_value"
          stroke="#7c3aed"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#7c3aed' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}