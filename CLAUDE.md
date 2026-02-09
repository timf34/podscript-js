# Podscript - Project Context

## What This Is
A podcast/video transcription web app + CLI tool. Paste a podcast link or YouTube URL, get a searchable transcript using ElevenLabs Scribe API.

## Current State
- **CLI**: Working with direct RSS feeds and YouTube URLs
- **Web app**: Complete but untested (needs AWS credentials for S3 storage)
- **Podcast Addict scraping**: Still broken (403 even with User-Agent)

## Quick Start - CLI

```bash
# Build CLI first (required due to Node 18 compatibility)
npm run build:cli

# List episodes from a podcast RSS feed
npm run transcribe -- https://feeds.simplecast.com/JGE3yC0V --list

# Transcribe the most recent episode
npm run transcribe -- https://feeds.simplecast.com/JGE3yC0V --latest

# Transcribe a specific episode (by number from list)
npm run transcribe -- https://feeds.simplecast.com/JGE3yC0V --episode 3

# Output to specific file
npm run transcribe -- https://feeds.simplecast.com/JGE3yC0V --episode 3 --output my-transcript.md

# Transcribe a YouTube video (requires yt-dlp + ffmpeg)
npm run transcribe -- https://www.youtube.com/watch?v=VIDEO_ID
npm run transcribe -- https://youtu.be/VIDEO_ID --output transcript.md
```

## Key Files
```
src/
  cli.ts                 # Standalone CLI (working)
  app/                   # Next.js pages and API routes
  lib/services/
    rss.ts              # RSS resolution (web app version)
    transcription.ts    # ElevenLabs API integration
    storage.ts          # S3 JSON storage
  components/           # React components
dist/
  cli.js                # Compiled CLI
```

## Environment
- `.env` has ElevenLabs API key configured
- AWS credentials NOT yet configured (needed for S3 storage in web app)
- Node 18 on Windows (requires compiled CLI, tsx doesn't work)
- YouTube support requires `yt-dlp` (`pip install yt-dlp`) and `ffmpeg`

## To Run Web App
```bash
npm run dev
```
Note: Web app needs AWS credentials in `.env` for S3 storage to work.

## Known Issues
- Podcast Addict URLs return 403 (their site blocks scrapers)
- Production build fails on Windows due to ESM/undici issues (works on Vercel)
- Cheerio pinned to 1.0.0-rc.12 for Node 18 compatibility

## Workaround for Podcast Addict
Get the RSS feed URL directly from:
1. Podcast Addict app (shown in podcast details)
2. Apple Podcasts lookup
3. The podcast's website

Example: a16z Show RSS feed is `https://feeds.simplecast.com/JGE3yC0V`

## Test Podcast
The a16z Show: `https://feeds.simplecast.com/JGE3yC0V`
