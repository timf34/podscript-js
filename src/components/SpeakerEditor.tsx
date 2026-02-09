"use client";

import { useState } from "react";

interface SpeakerEditorProps {
  speakers: string[];
  speakerLabels: Record<string, string>;
  onSave: (labels: Record<string, string>) => Promise<void>;
}

function getSpeakerDisplayName(speaker: string): string {
  const match = speaker.match(/speaker_(\d+)/);
  if (match) {
    return `Speaker ${parseInt(match[1], 10) + 1}`;
  }
  return speaker;
}

export default function SpeakerEditor({
  speakers,
  speakerLabels,
  onSave,
}: SpeakerEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>(speakerLabels);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(labels);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to save speaker labels:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLabelChange = (speaker: string, value: string) => {
    setLabels((prev) => ({
      ...prev,
      [speaker]: value,
    }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        Edit Speakers
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Edit Speaker Names</h3>

        <div className="space-y-4 mb-6">
          {speakers.map((speaker) => (
            <div key={speaker} className="flex items-center gap-3">
              <label className="text-sm text-neutral-500 w-24 shrink-0">
                {getSpeakerDisplayName(speaker)}
              </label>
              <input
                type="text"
                value={labels[speaker] || ""}
                onChange={(e) => handleLabelChange(speaker, e.target.value)}
                placeholder={getSpeakerDisplayName(speaker)}
                className="flex-1 px-3 py-2 text-sm rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
            className="px-4 py-2 text-sm rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
