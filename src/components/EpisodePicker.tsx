"use client";

import { Episode } from "@/lib/types";

interface EpisodePickerProps {
  podcastName: string;
  episodes: Episode[];
  onSelect: (episode: Episode) => void;
  onBack: () => void;
  isTranscribing: boolean;
  transcribingEpisode: string | null;
}

export default function EpisodePicker({
  podcastName,
  episodes,
  onSelect,
  onBack,
  isTranscribing,
  transcribingEpisode,
}: EpisodePickerProps) {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">{podcastName}</h2>
          <p className="text-neutral-500">{episodes.length} episodes</p>
        </div>
        <button
          onClick={onBack}
          disabled={isTranscribing}
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-50"
        >
          ← Start over
        </button>
      </div>

      {isTranscribing && (
        <div className="mb-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full" />
            <div>
              <p className="font-medium">Transcribing...</p>
              <p className="text-sm text-neutral-500">
                This usually takes a few minutes. Please wait.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {episodes.map((episode, index) => (
          <button
            key={episode.guid || index}
            onClick={() => onSelect(episode)}
            disabled={isTranscribing}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              transcribingEpisode === episode.audioUrl
                ? "border-neutral-400 dark:border-neutral-500 bg-neutral-100 dark:bg-neutral-800"
                : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{episode.title}</h3>
                {episode.description && (
                  <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                    {episode.description}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-neutral-400 shrink-0">
                <div>{formatDate(episode.publishDate)}</div>
                {episode.duration && <div>{episode.duration}</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
