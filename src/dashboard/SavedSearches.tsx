/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authenticated saved filter bookmarks. Backed by /api/dashboard/saved-searches
 * (Postgres). Never writes owner PII to localStorage or the Pages shell.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, type SavedSearchQueryParams } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { runtimeConfig } from '../config/runtime';
import type { DashboardFiltersState } from './DashboardFilters';

interface Props {
  filters: DashboardFiltersState;
  onApply: (next: DashboardFiltersState) => void;
}

function toQueryParams(filters: DashboardFiltersState): SavedSearchQueryParams {
  const params: SavedSearchQueryParams = {};
  if (filters.q?.trim()) params.q = filters.q.trim();
  if (filters.city?.trim()) params.city = filters.city.trim();
  if (filters.minValue != null) params.minValue = filters.minValue;
  if (filters.maxValue != null) params.maxValue = filters.maxValue;
  return params;
}

function fromQueryParams(params: SavedSearchQueryParams): DashboardFiltersState {
  return {
    q: typeof params.q === 'string' ? params.q : undefined,
    city: typeof params.city === 'string' ? params.city : undefined,
    minValue: typeof params.minValue === 'number' ? params.minValue : undefined,
    maxValue: typeof params.maxValue === 'number' ? params.maxValue : undefined,
  };
}

function defaultLabel(filters: DashboardFiltersState): string {
  const parts: string[] = [];
  if (filters.city) parts.push(filters.city);
  if (filters.q?.trim()) parts.push(filters.q.trim().slice(0, 40));
  if (filters.minValue != null || filters.maxValue != null) {
    const min = filters.minValue != null ? `$${filters.minValue.toLocaleString()}` : '$0';
    const max = filters.maxValue != null ? `$${filters.maxValue.toLocaleString()}` : 'Any';
    parts.push(`${min}–${max}`);
  }
  return parts.join(' · ') || 'Current filters';
}

export default function SavedSearches({ filters, onApply }: Props) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const enabled = !runtimeConfig.isPagesBuild;

  const list = useQuery({
    queryKey: ['saved-searches'],
    queryFn: api.listSavedSearches,
    enabled,
  });

  const create = useMutation({
    mutationFn: api.createSavedSearch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      setLabel('');
      setSaving(false);
    },
  });

  const remove = useMutation({
    mutationFn: api.deleteSavedSearch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
    },
  });

  const params = useMemo(() => toQueryParams(filters), [filters]);
  const canSave = Object.keys(params).length > 0;

  if (!enabled) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3" data-testid="saved-searches">
      <div className="flex flex-wrap items-center gap-2">
        <Bookmark className="size-4 text-violet-700" aria-hidden />
        <span className="text-sm font-medium text-slate-700">Saved searches</span>
        {!saving ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canSave || create.isPending}
            onClick={() => {
              setLabel(defaultLabel(filters));
              setSaving(true);
            }}
            data-testid="saved-search-start"
          >
            <BookmarkPlus className="mr-1 size-3.5" />
            Save current filters
          </Button>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                label: label.trim() || defaultLabel(filters),
                query_params: params,
              });
            }}
          >
            <Input
              className="h-8 w-56"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
              maxLength={120}
              data-testid="saved-search-label"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={create.isPending} data-testid="saved-search-confirm">
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSaving(false)}>
              Cancel
            </Button>
          </form>
        )}
      </div>

      {list.isError && (
        <p className="mt-2 text-xs text-rose-700" role="alert">
          Could not load saved searches.
        </p>
      )}

      {list.data?.items?.length ? (
        <ul className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white" data-testid="saved-search-list">
          {list.data.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <button
                type="button"
                className="min-w-0 flex-1 text-left text-slate-800 hover:text-violet-800"
                onClick={() => onApply(fromQueryParams(item.query_params))}
                data-testid="saved-search-apply"
                data-search-id={item.id}
              >
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {Object.entries(item.query_params)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' · ') || 'empty'}
                </span>
              </button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Delete ${item.label}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(item.id)}
                data-testid="saved-search-delete"
                data-search-id={item.id}
              >
                <Trash2 className="size-3.5 text-rose-600" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !list.isLoading && (
          <p className="mt-2 text-xs text-slate-500" data-testid="saved-search-empty">
            No saved searches yet. Set filters, then bookmark them here.
          </p>
        )
      )}
    </div>
  );
}
