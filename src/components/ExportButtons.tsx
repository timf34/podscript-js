"use client";

interface ExportButtonsProps {
  transcriptId: string;
}

export default function ExportButtons({ transcriptId }: ExportButtonsProps) {
  const handleExport = (format: "md" | "html") => {
    window.open(`/api/transcripts/${transcriptId}/export?format=${format}`, "_blank");
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport("md")}
        className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        Download MD
      </button>
      <button
        onClick={() => handleExport("html")}
        className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        Download HTML
      </button>
    </div>
  );
}
