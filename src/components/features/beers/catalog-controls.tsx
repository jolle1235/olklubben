"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  BEER_SORT_LABELS,
  BEER_SORTS,
  beerCatalogSearch,
  EVENT_FILTER_ALL,
  EVENT_FILTER_NONE,
  MAX_SEARCH_LENGTH,
  type BeerCatalogParams,
  type BeerSort,
} from "@/server/domain/beers/catalog";

const SEARCH_DEBOUNCE_MS = 300;

export type CatalogControlsProps = {
  /** The catalogue's path, /c/<clubId>/beers. */
  action: string;
  /** The choices in the URL, already parsed and resolved by the page. */
  params: BeerCatalogParams;
  /** Events for the filter, newest first, with a ready label. */
  events: { id: string; label: string }[];
};

const noopSubscribe = () => () => {};

/** Local state that follows a prop when the prop changes (e.g. back/forward). */
function useSyncedState<T>(value: T) {
  const [state, setState] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    setState(value);
  }
  return [state, setState] as const;
}

/**
 * Search, sort and event filter for the catalogue (SPEC §9.5 "Oversigt"). The
 * URL holds every choice (?q=&sort=&event=), so refresh, back and sharing
 * keep them.
 *
 * Without JavaScript it is a plain GET form with a "Vis" button. With it, the
 * selects apply at once and the search after a short pause, via
 * router.replace (no history entry per keystroke, no scroll jump). While the
 * new list loads, the form carries data-pending (the page dims the list).
 */
export function CatalogControls({ action, params, events }: CatalogControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const searchId = useId();
  const sortId = useId();
  const eventId = useId();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The search box keeps what is typed while its own (debounced) search loads;
  // it only follows the URL when the URL changes from elsewhere (back, reset).
  const [query, setQuery] = useState(params.q);
  const [submittedQuery, setSubmittedQuery] = useState(params.q);
  const [previousQ, setPreviousQ] = useState(params.q);
  if (params.q !== previousQ) {
    setPreviousQ(params.q);
    if (params.q !== submittedQuery) {
      setQuery(params.q);
      setSubmittedQuery(params.q);
    }
  }
  const [sort, setSort] = useSyncedState(params.sort);
  const [event, setEvent] = useSyncedState(params.event);

  useEffect(() => () => clearTimeout(debounce.current), []);

  function navigate(next: Partial<BeerCatalogParams>) {
    clearTimeout(debounce.current);
    const q = (next.q ?? query).trim().slice(0, MAX_SEARCH_LENGTH);
    setSubmittedQuery(q);
    const search = beerCatalogSearch({ q, sort: next.sort ?? sort, event: next.event ?? event });
    startTransition(() => router.replace(`${action}${search}`, { scroll: false }));
  }

  return (
    <form
      role="search"
      aria-label="Ølkataloget"
      action={action}
      method="get"
      data-pending={isPending || undefined}
      onSubmit={(formEvent) => {
        formEvent.preventDefault();
        navigate({ q: query });
      }}
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem] md:items-end"
    >
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Søg øl
        </label>
        {isPending ? (
          <Loader2Icon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 animate-spin text-slate"
          />
        ) : (
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate"
          />
        )}
        <Input
          id={searchId}
          type="search"
          name="q"
          value={query}
          onChange={(changeEvent) => {
            const value = changeEvent.target.value;
            setQuery(value);
            clearTimeout(debounce.current);
            debounce.current = setTimeout(() => navigate({ q: value }), SEARCH_DEBOUNCE_MS);
          }}
          placeholder="Søg øl…"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          maxLength={MAX_SEARCH_LENGTH}
          className="pl-11"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:contents">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={sortId} className="text-[0.95rem] leading-tight font-semibold text-ink">
            Sorter
          </label>
          <NativeSelect
            id={sortId}
            name="sort"
            value={sort}
            onChange={(changeEvent) => {
              const value = changeEvent.target.value as BeerSort;
              setSort(value);
              navigate({ sort: value });
            }}
          >
            {BEER_SORTS.map((option) => (
              <option key={option} value={option}>
                {BEER_SORT_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={eventId} className="text-[0.95rem] leading-tight font-semibold text-ink">
            Event
          </label>
          <NativeSelect
            id={eventId}
            name="event"
            value={event}
            onChange={(changeEvent) => {
              const value = changeEvent.target.value;
              setEvent(value);
              navigate({ event: value });
            }}
          >
            <option value={EVENT_FILTER_ALL}>Alle events</option>
            <option value={EVENT_FILTER_NONE}>Uden event</option>
            {events.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Without JavaScript the selects cannot apply themselves. */}
      {hydrated ? null : (
        <Button type="submit" variant="secondary" className="md:col-span-3 md:justify-self-start">
          Vis
        </Button>
      )}
    </form>
  );
}
