import { useEffect, useRef } from "react";

const MAX_AUTO_PAGES = 8;

/**
 * When client-side filters hide most of a page (e.g. Home excludes Alarm),
 * keep pulling the next page until the filtered list has enough rows or
 * the feed is exhausted.
 */
export function useEnsureFilteredInboxRows(options: {
  filteredCount: number;
  pageSize: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  /** Reset the auto-page budget when filters change. */
  filterKey: string;
}) {
  const {
    filteredCount,
    pageSize,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    filterKey,
  } = options;
  const autoPagesRef = useRef(0);

  useEffect(() => {
    autoPagesRef.current = 0;
  }, [filterKey]);

  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;
    const minRows = Math.min(10, pageSize);
    if (filteredCount >= minRows) return;
    if (autoPagesRef.current >= MAX_AUTO_PAGES) return;
    autoPagesRef.current += 1;
    void loadMore();
  }, [
    filteredCount,
    pageSize,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  ]);
}
