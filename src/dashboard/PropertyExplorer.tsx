import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronsUpDown, MapPin, X } from 'lucide-react';
import { api, currency, formatNumber, toNumber, type PropertyRecord } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import type { DashboardFiltersState } from './DashboardFilters';

const columnHelper = createColumnHelper<PropertyRecord>();

interface Props {
  filters: DashboardFiltersState;
  selectedPropertyId?: number | null;
  selectedParcelId?: string | null;
  onSelectProperty?: (r: PropertyRecord) => void;
}

export default function PropertyExplorer({ filters, selectedPropertyId, selectedParcelId, onSelectProperty }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] = useState<PropertyRecord | null>(null);

  const search = useQuery({
    queryKey: ['properties', filters, limit],
    queryFn: () => api.searchProperties({ ...filters, limit }),
    staleTime: 30_000,
  });

  // Reflect externally selected property (e.g. from map clicks). A parcel clicked
  // on the map may fall outside the visible table rows, so resolve it by parcel_id.
  const externalSelectedQuery = useQuery({
    queryKey: ['property-by-parcel', selectedParcelId],
    queryFn: () =>
      api.searchProperties({ q: String(selectedParcelId), limit: 5 }).then((r) => r.results[0] ?? null),
    enabled: selectedParcelId != null && !selected,
    staleTime: 60_000,
  });

  const effectiveSelected =
    selected ?? externalSelectedQuery.data ?? (selectedParcelId != null
      ? (search.data?.results.find((r) => r.parcel_id === selectedParcelId) ?? null)
      : null);

  const handleSelect = (r: PropertyRecord) => {
    setSelected(r);
    onSelectProperty?.(r);
  };
  const handleClose = () => {
    setSelected(null);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('situs_address', {
        header: 'Address',
        cell: (info) => {
          const r = info.row.original;
          return (
            <div>
              <div className="font-medium text-slate-800">{r.situs_address ?? '—'}</div>
              <div className="text-xs text-slate-400">
                {r.situs_city ?? ''}{r.situs_zip ? `, ${r.situs_zip}` : ''}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('parcel_id', {
        header: 'Parcel',
        cell: (info) => (
          <span className="font-mono text-xs text-slate-500">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('owner_info', {
        header: 'Owner',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('market_value_total', {
        header: 'Value',
        sortingFn: 'basic',
        cell: (info) => {
          const v = toNumber(info.getValue());
          return <span className="font-medium tabular-nums">{v ? currency(v) : '—'}</span>;
        },
      }),
      columnHelper.accessor('living_area', {
        header: 'Living (sqft)',
        cell: (info) => (info.getValue() ? formatNumber(info.getValue()!) : '—'),
      }),
      columnHelper.accessor('year_built', {
        header: 'Built',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('landuse_description', {
        header: 'Type',
        cell: (info) => {
          const v = info.getValue();
          return v ? <Badge variant="secondary">{v}</Badge> : '—';
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <button
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-violet-700"
            title="Select on map"
            onClick={() => handleSelect(info.row.original)}
          >
            <MapPin className="size-4" />
          </button>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: search.data?.results ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const total = search.data?.total ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm text-slate-500">Property Explorer</CardTitle>
          <p className="text-xs text-slate-400">
            {search.isLoading ? 'Searching…' : `${formatNumber(total)} matching properties`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(filters.q || filters.city || filters.minValue !== undefined || filters.maxValue !== undefined) && (
            <Badge variant="secondary" className="gap-1">
              {[
                filters.q && `q: ${filters.q}`,
                filters.city && filters.city,
                filters.minValue !== undefined && `min $${formatNumber(filters.minValue)}`,
                filters.maxValue !== undefined && `max $${formatNumber(filters.maxValue)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Badge>
          )}
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {search.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : search.data && search.data.results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-slate-500"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="inline-flex cursor-pointer items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() &&
                            (header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="size-3" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 text-slate-300" />
                            ))}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-400">
            {filters.q || filters.city || filters.minValue !== undefined || filters.maxValue !== undefined
              ? 'No properties match the current filters.'
              : 'No properties found.'}
          </div>
        )}
      </CardContent>

      {/* Detail panel */}
      {effectiveSelected && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{effectiveSelected.situs_address ?? effectiveSelected.parcel_id}</h3>
                <Badge>{effectiveSelected.landuse_description ?? '—'}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {effectiveSelected.situs_city}{effectiveSelected.situs_zip ? `, ${effectiveSelected.situs_zip}` : ''} · {effectiveSelected.parcel_id}
              </p>
            </div>
            <button
              className="rounded p-1 text-slate-400 hover:bg-slate-100"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Detail label="Market value" value={toNumber(effectiveSelected.market_value_total) ? currency(toNumber(effectiveSelected.market_value_total)) : '—'} />
            <Detail label="Assessed value" value={toNumber(effectiveSelected.assessed_value_total) ? currency(toNumber(effectiveSelected.assessed_value_total)) : '—'} />
            <Detail label="Year built" value={effectiveSelected.year_built?.toString() ?? '—'} />
            <Detail label="Beds" value={effectiveSelected.bedrooms?.toString() ?? '—'} />
            <Detail label="Baths" value={[effectiveSelected.full_baths, effectiveSelected.half_baths].filter((b) => b != null).join(' / ') || '—'} />
            <Detail label="Living area" value={effectiveSelected.living_area ? `${formatNumber(effectiveSelected.living_area)} sqft` : '—'} />
            <Detail label="Owner" value={effectiveSelected.owner_info ?? '—'} span />
            <Detail label="Mailing" value={effectiveSelected.owner_mailing_address ?? '—'} span />
          </dl>
        </div>
      )}
    </Card>
  );
}

function Detail({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}