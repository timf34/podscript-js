"use client";

import { useState, useEffect, useCallback } from "react";

interface TranscriptSearchProps {
  onSearch: (query: string) => void;
  matchCount: number;
  currentMatch: number;
  onNext: () => void;
  onPrevious: () => void;
}

export default function TranscriptSearch({
  onSearch,
  matchCount,
  currentMatch,
  onNext,
  onPrevious,
}: TranscriptSearchProps) {
  const [query, setQuery] = useState("");

  const debouncedSearch = useCallback(
    (value: string) => {
      const timeoutId = setTimeout(() => {
        onSearch(value);
      }, 200);
      return () => clearTimeout(timeoutId);
    },
    [onSearch]
  );

  useEffect(() => {
    const cleanup = debouncedSearch(query);
    return cleanup;
  }, [query, debouncedSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    }
    if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search transcript..."
          className="w-full px-4 py-2 pr-24 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 placeholder:text-neutral-400"
        />
        {query && matchCount > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            {currentMatch} of {matchCount}
          </div>
        )}
      </div>
      {query && matchCount > 0 && (
        <div className="flex gap-1">
          <button
            onClick={onPrevious}
            className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Previous match (Shift+Enter)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          <button
            onClick={onNext}
            className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Next match (Enter)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
