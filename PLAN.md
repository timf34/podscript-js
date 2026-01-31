# Podscript - Podcast Transcription Tool

## Overview

A personal web app for transcribing podcasts. Paste a podcast link, pick an episode, get a clean searchable transcript. Built for speed and simplicity.

**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, deployed to Vercel.
**Transcription:** ElevenLabs Scribe API (speech-to-text with speaker diarization).
**Storage:** Single JSON file on S3. Fetched into memory on request, written back on changes. No database.

## Architecture

### How It Works

1. User pastes a podcast URL (Apple Podcasts link, direct RSS feed URL, or podcast website URL)
2. App resolves the URL to an RSS feed (using iTunes Search API for Apple Podcasts links, HTML scraping for website URLs, or direct if already RSS)
3. App parses the RSS feed and shows a list of episodes
4. User picks an episode
5. App downloads the audio, sends it to ElevenLabs Scribe, gets back a transcript with speaker labels and timestamps
6. Transcript is saved to S3 (JSON) and displayed to the user
7. User can read, search within the transcript, and export as markdown or HTML

### S3 Storage Layer

All data lives in a single `transcripts.json` file on S3. The file contains an array of transcript objects. On any read operation, fetch the file from S3 and parse it. On any write operation, update the in-memory array and write the full file back to S3.

For a personal app with a few hundred transcripts this is perfectly fine. No database driver, no migrations, no managed service beyond S3.

The S3 storage should be implemented as a clean module so it could be swapped for a database later if needed.

**S3 bucket structure:**
```
podscript-data/
  transcripts.json        # array of all transcript metadata + content
```

**Transcript object shape:**
```typescript
interface TranscriptSegment {
  speaker: string;        // e.g. "Speaker 1", "Speaker 2"
  text: string;
  start: number;          // seconds
  end: number;            // seconds
}

interface Transcript {
  id: string;                  // uuid
  podcastName: string;
  episodeTitle: string;
  episodeUrl: string;          // original URL the user pasted or the episode link
  audioUrl: string;            // direct mp3 URL from RSS
  segments: TranscriptSegment[];
  rawText: string;             // plain text concatenation for search
  durationSeconds: number;
  createdAt: string;           // ISO datetime
}
```

**Storage module functions (`/lib/services/storage.ts`):**
```
fetchTranscripts(): Promise<Transcript[]>
saveTranscript(transcript: Transcript): Promise<void>
getTranscript(id: string): Promise<Transcript | null>
getAllTranscriptsMeta(): Promise<Array<Omit<Transcript, 'segments' | 'rawText'>>>
deleteTranscript(id: string): Promise<void>
```

Use `@aws-sdk/client-s3` to read/write the JSON file. Keep it simple - no caching layer, just fetch and write. The file will be small enough that this is fast.

## Implementation Phases

### Phase 1: Project Setup

Create the Next.js 14 project with App Router, TypeScript, and Tailwind.

```
pnpm create next-app podscript --typescript --tailwind --app --src-dir --use-pnpm
```

Install dependencies:
```
pnpm add @aws-sdk/client-s3 fast-xml-parser cheerio uuid
pnpm add -D @types/uuid
```

Create `.env.example`:
```
ELEVENLABS_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-west-1
S3_BUCKET_NAME=podscript-data
```

Set up the folder structure:
```
/src
  /app
    /page.tsx                    # home - URL input + recent transcripts
    /transcript/[id]/page.tsx    # transcript viewer
    /api
      /resolve/route.ts          # POST - resolve URL to RSS, return episodes
      /transcribe/route.ts       # POST - transcribe an episode, save, return result
      /transcripts/route.ts      # GET - list all transcripts (metadata only)
      /transcripts/[id]/route.ts # GET - full transcript, DELETE - remove
      /transcripts/[id]/export/route.ts  # GET ?format=md|html
  /lib
    /services
      /storage.ts                # S3 JSON store
      /rss.ts                    # URL resolution + RSS parsing
      /transcription.ts          # ElevenLabs Scribe integration
    /types.ts                    # shared TypeScript types
  /components
    /URLInput.tsx                # paste URL input component
    /EpisodePicker.tsx           # episode list from RSS feed
    /TranscriptViewer.tsx        # main transcript reading view
    /TranscriptSearch.tsx        # in-page search within a transcript
    /TranscriptList.tsx          # list of saved transcripts
    /ExportButtons.tsx           # markdown/html export buttons
```

### Phase 2: S3 Storage Layer

Implement `/lib/services/storage.ts`.

- Use `@aws-sdk/client-s3` with `GetObjectCommand` and `PutObjectCommand`
- `fetchTranscripts()` - GET the JSON file, parse, return array. If the file doesn't exist yet (first run), return empty array.
- `saveTranscript(transcript)` - fetch current array, push new transcript, write back to S3
- `getTranscript(id)` - fetch array, find by id
- `getAllTranscriptsMeta()` - fetch array, return without segments/rawText (keep responses lightweight)
- `deleteTranscript(id)` - fetch array, filter out by id, write back

Handle the case where `transcripts.json` doesn't exist yet gracefully (return `[]`).

### Phase 3: RSS Resolution and Parsing

Implement `/lib/services/rss.ts`.

**`resolveToRssFeed(url: string): Promise<{feedUrl: string, podcastName: string}>`**

Handle these URL types:
1. **Direct RSS feed URL** (ends in `.xml` or `.rss`, or returns XML content type) - use directly
2. **Apple Podcasts URL** (contains `podcasts.apple.com`) - extract the podcast ID, hit `https://itunes.apple.com/lookup?id={id}&entity=podcast` to get the `feedUrl` from the response
3. **Generic website URL** - fetch the page HTML, use cheerio to look for `<link rel="alternate" type="application/rss+xml">` in the head. Also try common feed paths like `/feed`, `/rss`, `/feed.xml`
4. **Podcast Addict links** - these typically redirect to the underlying podcast URL, so follow redirects and then try the above strategies

If resolution fails, return a clear error message suggesting the user try pasting the direct RSS feed URL.

**`parseEpisodes(feedUrl: string): Promise<Episode[]>`**

```typescript
interface Episode {
  title: string;
  description: string;       // strip HTML tags, truncate to ~200 chars
  publishDate: string;        // ISO date
  audioUrl: string;           // from <enclosure> tag
  duration: string;           // from <itunes:duration>
}
```

- Use `fast-xml-parser` to parse the RSS XML
- Extract episodes from `<item>` elements
- Get audio URL from `<enclosure url="...">` attribute
- Return most recent 50 episodes, sorted newest first

### Phase 4: Transcription Service

Implement `/lib/services/transcription.ts`.

**`transcribeAudio(audioUrl: string): Promise<TranscriptionResult>`**

```typescript
interface TranscriptionResult {
  segments: TranscriptSegment[];
  rawText: string;
  durationSeconds: number;
}
```

Steps:
1. Download the audio file from the URL into a Buffer (use `fetch`)
2. Send to ElevenLabs Scribe API:
   - `POST https://api.elevenlabs.io/v1/speech-to-text`
   - Multipart form data with the audio file
   - Set `diarize: true` for speaker detection
   - Set `timestamps_granularity: segment`
3. Parse the response into our `TranscriptSegment[]` format
4. Build `rawText` by concatenating all segment text
5. Calculate total duration from the last segment's end time

**Important:** This will be a long-running operation (minutes for a long podcast). The API route should handle this gracefully - consider using a streaming response or polling pattern. For v1, a simple long-running request with a generous timeout is fine, but make sure the UI shows a clear loading state.

**ElevenLabs Scribe API details:**
- Endpoint: `POST https://api.elevenlabs.io/v1/speech-to-text`
- Auth: `xi-api-key` header
- Body: multipart form with `file` (audio), `model_id` = `scribe_v1`, `diarize` = `true`, `timestamps_granularity` = `segment`
- Response includes `words` array with speaker labels and timestamps
- Group words into segments by speaker changes and natural pauses

Define a `TranscriptionService` interface so we could swap ElevenLabs for another provider later:
```typescript
interface TranscriptionService {
  transcribe(audioUrl: string): Promise<TranscriptionResult>;
}
```

### Phase 5: API Routes

**`POST /api/resolve`**
- Body: `{ url: string }`
- Calls `resolveToRssFeed(url)` then `parseEpisodes(feedUrl)`
- Returns: `{ podcastName: string, feedUrl: string, episodes: Episode[] }`

**`POST /api/transcribe`**
- Body: `{ audioUrl: string, episodeTitle: string, podcastName: string, episodeUrl: string }`
- Calls `transcribeAudio(audioUrl)`
- Saves result to S3 via `saveTranscript()`
- Returns the full `Transcript` object
- Set a long timeout on this route (ElevenLabs can take a few minutes for long episodes)
- In `next.config.js`, set `maxDuration` to 300 (5 minutes) for this route

**`GET /api/transcripts`**
- Returns `getAllTranscriptsMeta()` - list of transcripts without full content

**`GET /api/transcripts/[id]`**
- Returns `getTranscript(id)` - full transcript with segments

**`DELETE /api/transcripts/[id]`**
- Calls `deleteTranscript(id)`
- Returns `{ success: true }`

**`GET /api/transcripts/[id]/export?format=md|html`**
- Fetches full transcript
- For `md`: generate markdown with `## Speaker N` headers, timestamps in brackets, text in paragraphs
- For `html`: generate a standalone HTML document with inline CSS, speaker labels colour-coded, timestamps styled. Should look good when opened in a browser standalone.
- Return as downloadable file with appropriate Content-Type and Content-Disposition headers

### Phase 6: UI

Keep the design clean, minimal, and focused on readability. This is a tool for reading, so typography matters most. Use a monochrome palette with subtle accent colours for speaker labels.

**Design direction:** Minimal, editorial. Think of it like a clean reading app. Good typography, generous whitespace, no clutter. Dark mode supported via Tailwind `dark:` classes.

**Typography:** Use a clean, highly readable serif or sans-serif for transcript body text. Something like `font-serif` for the transcript body to make long reads comfortable. Keep UI chrome in a clean sans-serif.

**Colour-coding speakers:** Assign each unique speaker a subtle, distinct colour for their label. Use muted tones - not bright primary colours. Something like slate blue, warm terra cotta, sage green, dusty purple, etc.

#### Home Page (`/`)

- Top: app name "podscript" in a simple wordmark
- Main: large input field with placeholder "Paste a podcast link..." and a submit button
- Below: if there are saved transcripts, show a list with episode title, podcast name, date, and duration. Clicking opens the transcript view. Show most recent first.
- Keep it simple - no sidebar, no complex navigation

#### Episode Picker (shown inline on home page after URL submission)

- After submitting a URL, the input area transitions to show the podcast name and a scrollable list of episodes
- Each episode shows: title, publish date, duration
- Click an episode to start transcription
- "Back" link to clear and start over
- Show a truncated description on hover or expand

#### Transcript View (`/transcript/[id]`)

This is the most important page - where the user spends their time reading.

- Header: podcast name, episode title, date, duration, export buttons
- Search bar: input field that filters/highlights matches within the transcript. Show match count ("3 of 12 matches"). Up/down arrows to jump between matches.
- Transcript body:
  - Each segment shows: speaker label (colour-coded), timestamp (subtle, clickable), text
  - Generous line height and paragraph spacing for readability
  - Speaker changes should be visually clear but not jarring
- Export buttons: "Download MD" and "Download HTML" in the header area
- Back link to home

#### Loading/Progress States

- When resolving a URL: simple spinner with "Resolving podcast feed..."
- When transcribing: this takes a while (1-5 minutes). Show a clear state like "Transcribing episode... this usually takes a few minutes" with a subtle animation. Don't show a fake progress bar.
- When fetching transcript list: skeleton loading states

### Phase 7: Polish and Edge Cases

- Handle invalid URLs gracefully with clear error messages
- Handle RSS feeds that don't have audio enclosures (video podcasts etc) - show a message
- Handle ElevenLabs API errors (rate limits, file too large, etc)
- Handle S3 connection errors
- Make sure the transcript view is responsive on mobile
- Add `<title>` tags for each page (e.g. "Episode Name - podscript")
- Add a simple favicon
- Test with a variety of real podcast RSS feeds to make sure parsing is robust

## Environment Variables

```
# ElevenLabs
ELEVENLABS_API_KEY=           # get from https://elevenlabs.io/app/settings/api-keys

# AWS S3
AWS_ACCESS_KEY_ID=            # IAM user with S3 read/write
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-west-1          # or wherever your bucket is
S3_BUCKET_NAME=podscript-data # create this bucket manually

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## S3 Setup

1. Create an S3 bucket called `podscript-data` (or whatever you prefer)
2. Create an IAM user with `s3:GetObject` and `s3:PutObject` permissions on that bucket
3. Bucket does not need to be public
4. No special configuration needed - just a private bucket

## Deployment

Deploy to Vercel:
1. Connect GitHub repo
2. Add environment variables in Vercel dashboard
3. Set the function max duration to 300s in Vercel project settings (needed for long transcriptions)
4. Deploy

## Future Enhancements (not for v1)

- Full-text search across all transcripts from the home page
- Audio player synced to transcript position
- Authentication (if sharing with others)
- Podcast search (search for a podcast by name instead of pasting a URL)
- Whisper self-hosted fallback if ElevenLabs credits run out
- Automatic summarisation of transcripts using an LLM
- Tags/folders for organising transcripts