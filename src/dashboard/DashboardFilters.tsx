import { Search } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export interface DashboardFiltersState {
  q?: string;
  city?: string;
  minValue?: number;
  maxValue?: number;
}

interface Props {
  value: DashboardFiltersState;
  onChange: (next: DashboardFiltersState) => void;
  className?: string;
}

const CITIES = [
  'KANSAS CITY',
  'INDEPENDENCE',
  'LEES SUMMIT',
  'BLUE SPRINGS',
  'RAYTOWN',
  'GRANDVIEW',
  'UNINCORPORATED',
  'GRAIN VALLEY',
  'OAK GROVE',
  'GREENWOOD',
  'SUGAR CREEK',
  'LAKE LOTAWANA',
  'SIBLEY',
];

export default function DashboardFilters({ value, onChange, className }: Props) {
  const set = (patch: Partial<DashboardFiltersState>) => onChange({ ...value, ...patch });

  return (
    <form
      className={cn('flex flex-wrap items-center gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        // Search triggered via the Explorer's query key (filters already live-update)
        onChange({ ...value });
      }}
    >
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-8"
          placeholder="Address, parcel, owner…"
          value={value.q ?? ''}
          onChange={(e) => set({ q: e.target.value })}
        />
      </div>
      <Select
        className="w-40"
        value={value.city ?? ''}
        onChange={(e) => set({ city: e.target.value || undefined })}
      >
        <option value="">All cities</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
      <Input
        className="w-28"
        type="number"
        min={0}
        placeholder="Min $"
        value={value.minValue ?? ''}
        onChange={(e) => set({ minValue: e.target.value ? Number(e.target.value) : undefined })}
      />
      <Input
        className="w-28"
        type="number"
        min={0}
        placeholder="Max $"
        value={value.maxValue ?? ''}
        onChange={(e) => set({ maxValue: e.target.value ? Number(e.target.value) : undefined })}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange({})}
        disabled={Object.keys(value).length === 0}
      >
        Reset
      </Button>
    </form>
  );
}