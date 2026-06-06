# Aurora Launcher v2.0.1

## New Features
- **Modrinth integration** — browse, search, and install resource packs and shader packs directly from Modrinth
- **Download progress bars** — real-time progress shown during Modrinth installs
- **Install confirmation modals** — preview project on Modrinth before installing
- **Custom version discovery** — auto-detects OptiFine, Forge, Fabric installations on disk
- **Shader packs page** — full Modrinth browsing with loader filters (Iris/OptiFine/Forge/Fabric/NeoForge/Quilt)
- **Resource packs page** — Modrinth browsing with game version filters
- **Shader loader info banner** — prominent links to Iris, OptiFine, Oculus
- **Expanded game version filters** — 35 versions from 1.16.1 through 26.1
- **News page** — Mojang launchercontent feed with pagination and caching
- **Screenshots gallery** — view, upload to Imgur, copy to clipboard
- **Worlds management** — backup/restore/delete world saves
- **Custom cursor removed** — back to default OS cursor

## Improvements
- **Faster startup** — lazy-loaded pages (`React.lazy`), deferred log file reading
- **Faster game launch** — removed redundant parent version JSON re-read in classpath builder
- **OptiFine support** — proper inheritsFrom resolution, Maven coordinate library parsing, no external LaunchWrapper needed
- **Steampunk theme polish** — purple-tinted colors replaced with warm brass/copper palette
- **Custom version badges** — "Custom" filter tab with copper-colored badge
- **Settings** — open config folder button now works properly
- **Data directory** — migrated from `aurora-launcher` to `Aurora Launcher`

## Fixes
- Missing `openSettingsFolder` IPC handler — config folder button now opens correctly
- Redundant parent JSON re-read on every game launch
- LaunchWrapper fallback removed — OptiFine ships its own compatible wrapper
- All purple/blue-tinted background colors replaced with warm tones
- Custom versions show "Invalid Date" no more — date hidden when empty

## Technical
- TypeScript throughout
- Streamed Modrinth downloads with IPC progress events
- React.lazy code splitting
- AES-256-GCM encrypted account storage
- Automatic migration of old data directory
