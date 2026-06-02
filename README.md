# Aurora Launcher

A modern, custom Minecraft launcher built with Electron, React, and TypeScript.

## Features

- **Offline Mode** — Play with any username without a Microsoft account
- **Version Management** — Install any vanilla Minecraft version (releases and snapshots)
- **Reinstall / Delete** — Re-download or remove installed versions
- **Java Detection** — Auto-detects installed Java runtimes
- **Launch Configuration** — RAM allocation, Java args, resolution, fullscreen toggle
- **Dark Theme** — Modern dark UI inspired by Prism Launcher
- **Encrypted Storage** — Auth tokens encrypted with AES-256-GCM
- **Multiple Accounts** — Add and switch between offline accounts
- **Minecraft News** — Fetches latest news from Mojang
- **Logging System** — Built-in debug log viewer with real-time game output

## Prerequisites

- Node.js 18+
- npm 9+
- Java 8+ (for running Minecraft)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Building

```bash
# Compile TypeScript and build renderer
npm run build

# Package for your current platform
npm run package

# Package for specific platforms
npm run package:win     # Windows (.exe)
npm run package:linux   # Linux (.AppImage)
npm run package:mac     # macOS (.dmg)
```

## Auto-Update

The launcher supports automatic updates via GitHub Releases.
Configure the repository owner and name in `electron/main.ts`:

```ts
const REPO_OWNER = 'your-username'
const REPO_NAME = 'aurora-launcher'
```

## Project Structure

```
├── electron/
│   ├── main.ts                 # Electron main process
│   ├── preload.ts              # Context bridge / IPC
│   └── services/
│       ├── auth.service.ts     # Offline authentication
│       ├── java.service.ts     # Java detection
│       ├── launch.service.ts   # Game launch logic
│       ├── logs.service.ts     # Logging system
│       ├── minecraft.service.ts # Version install/management
│       ├── news.service.ts     # Mojang news feed
│       └── settings.service.ts # Settings persistence
├── src/
│   ├── App.tsx                 # Root component with routing
│   ├── components/
│   │   ├── Layout/Titlebar.tsx # Custom title bar
│   │   ├── Sidebar/Sidebar.tsx # Navigation sidebar
│   │   └── common/             # Shared UI components
│   ├── pages/
│   │   ├── Home.tsx            # Launch panel
│   │   ├── Accounts.tsx        # Account management
│   │   ├── Versions.tsx        # Version install/management
│   │   ├── Settings.tsx        # Launcher configuration
│   │   ├── News.tsx            # Minecraft news feed
│   │   └── Logs.tsx            # Debug log viewer
│   └── styles/global.css       # CSS variables + dark theme
├── shared/types.ts             # TypeScript interfaces
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── package.json
```

## Configuration

Settings are stored in `%APPDATA%/aurora-launcher/settings.json` (Windows)
or `~/.config/aurora-launcher/settings.json` (Linux/macOS).
