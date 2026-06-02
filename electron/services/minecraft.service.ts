import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'
import {
  VersionManifest,
  MinecraftVersion,
  VersionJson,
  AssetIndex,
  InstallProgress,
} from '../../shared/types'

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json'

export class MinecraftService extends EventEmitter {
  private basePath: string
  private manifest: VersionManifest | null = null

  constructor(basePath: string) {
    super()
    this.basePath = basePath
  }

  ensureDirectories() {
    const dirs = [
      path.join(this.basePath, 'versions'),
      path.join(this.basePath, 'assets'),
      path.join(this.basePath, 'assets', 'objects'),
      path.join(this.basePath, 'assets', 'indexes'),
      path.join(this.basePath, 'libraries'),
      path.join(this.basePath, 'natives'),
    ]
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    })
  }

  async fetchManifest(): Promise<VersionManifest> {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(VERSION_MANIFEST_URL)
    if (!response.ok) throw new Error(`Failed to fetch version manifest: ${response.status}`)
    const data: any = await response.json()
    this.manifest = {
      latest: data.latest,
      versions: data.versions.map((v: any) => ({
        id: v.id,
        type: v.type,
        url: v.url,
        time: v.time,
        releaseTime: v.releaseTime,
        installed: false,
      })),
    }
    this.scanInstalledVersions()
    return this.manifest
  }

  getManifestCached(): VersionManifest | null {
    return this.manifest
  }

  async checkForNewVersions(): Promise<string[]> {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(VERSION_MANIFEST_URL)
    if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`)
    const data: any = await response.json()

    if (!this.manifest) return []

    const knownIds = new Set(this.manifest.versions.map(v => v.id))
    const newVersions: string[] = []
    for (const v of data.versions) {
      if (!knownIds.has(v.id)) newVersions.push(v.id)
    }

    if (newVersions.length > 0) {
      this.manifest = {
        latest: data.latest,
        versions: data.versions.map((v: any) => ({
          id: v.id,
          type: v.type,
          url: v.url,
          time: v.time,
          releaseTime: v.releaseTime,
          installed: knownIds.has(v.id) && (this.manifest?.versions.find(mv => mv.id === v.id)?.installed || false),
        })),
      }
      this.scanInstalledVersions()
    }

    return newVersions
  }

  async fetchVersionJson(versionId: string): Promise<VersionJson> {
    if (!this.manifest) await this.fetchManifest()
    const version = this.manifest!.versions.find(v => v.id === versionId)
    if (!version) throw new Error(`Version ${versionId} not found in manifest`)

    const fetch = (await import('node-fetch')).default
    const response = await fetch(version.url)
    if (!response.ok) throw new Error(`Failed to fetch version JSON: ${response.status}`)
    return response.json()
  }

  getInstalledVersions(): string[] {
    const versionsDir = path.join(this.basePath, 'versions')
    if (!fs.existsSync(versionsDir)) return []
    try {
      return fs.readdirSync(versionsDir).filter(entry => {
        const dir = path.join(versionsDir, entry)
        return fs.statSync(dir).isDirectory()
      })
    } catch {
      return []
    }
  }

  private scanInstalledVersions() {
    if (!this.manifest) return
    const installed = this.getInstalledVersions()
    for (const version of this.manifest.versions) {
      version.installed = installed.includes(version.id)
    }
  }

  async installVersion(versionId: string): Promise<void> {
    this.ensureDirectories()
    const versionDir = path.join(this.basePath, 'versions', versionId)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    this.emit('progress', {
      versionId, status: 'downloading', progress: 0,
      message: `Starting installation of ${versionId}...`,
    } as InstallProgress)

    const versionJson = await this.fetchVersionJson(versionId)

    this.emit('progress', {
      versionId, status: 'downloading', progress: 5,
      message: 'Downloading version JSON...',
    } as InstallProgress)

    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2))

    this.emit('progress', {
      versionId, status: 'downloading', progress: 10,
      message: 'Downloading client jar...',
    } as InstallProgress)

    await this.downloadWithVerify(
      versionJson.downloads.client.url,
      path.join(versionDir, `${versionId}.jar`),
      versionJson.downloads.client.sha1,
    )

    this.emit('progress', {
      versionId, status: 'downloading', progress: 30,
      message: 'Downloading assets index...',
    } as InstallProgress)

    await this.downloadAssetIndex(versionJson.assetIndex)

    this.emit('progress', {
      versionId, status: 'downloading', progress: 35,
      message: 'Downloading assets...',
    } as InstallProgress)

    await this.downloadAssets(versionJson.assetIndex, versionId)

    this.emit('progress', {
      versionId, status: 'downloading', progress: 45,
      message: 'Downloading libraries...',
    } as InstallProgress)

    await this.downloadLibraries(versionJson.libraries)

    this.emit('progress', {
      versionId, status: 'done', progress: 100,
      message: `${versionId} installed successfully!`,
    } as InstallProgress)

    if (this.manifest) {
      const v = this.manifest.versions.find(v => v.id === versionId)
      if (v) v.installed = true
    }
  }

  deleteVersion(versionId: string): void {
    const versionDir = path.join(this.basePath, 'versions', versionId)
    if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true })
  }

  private async downloadWithVerify(url: string, destPath: string, expectedSha1?: string, retries = 3) {
    if (expectedSha1 && fs.existsSync(destPath)) {
      try {
        const fileBuffer = fs.readFileSync(destPath)
        const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex')
        if (hash === expectedSha1) return
      } catch {}
    }

    const fetch = (await import('node-fetch')).default
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = Buffer.from(await response.arrayBuffer())
        if (expectedSha1) {
          const hash = crypto.createHash('sha1').update(buffer).digest('hex')
          if (hash !== expectedSha1) {
            throw new Error(`SHA1 mismatch for ${path.basename(destPath)}`)
          }
        }
        const dir = path.dirname(destPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(destPath, buffer)
        return
      } catch (err) {
        if (attempt === retries - 1) throw err
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }

  private async downloadAssetIndex(assetIndex: AssetIndex) {
    const indexPath = path.join(this.basePath, 'assets', 'indexes', `${assetIndex.id}.json`)
    if (fs.existsSync(indexPath)) {
      try {
        const fileBuffer = fs.readFileSync(indexPath)
        const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex')
        if (hash === assetIndex.sha1) return
      } catch {}
    }
    await this.downloadWithVerify(assetIndex.url, indexPath, assetIndex.sha1)
  }

  private async downloadAssets(assetIndex: AssetIndex, versionId?: string) {
    const indexPath = path.join(this.basePath, 'assets', 'indexes', `${assetIndex.id}.json`)
    if (!fs.existsSync(indexPath)) return

    let raw: any
    try {
      raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    } catch {
      return
    }

    const objects: Record<string, { hash: string; size: number }> = raw.objects || raw
    const entries = Object.entries(objects).filter(([, info]) => info?.hash)
    const baseUrl = 'https://resources.download.minecraft.net'
    const total = entries.length
    let done = 0, skipped = 0
    const concurrency = 20

    const emitProgress = () => {
      const pct = total > 0 ? Math.round((done + skipped) / total * 100) : 100
      if (versionId) {
        this.emit('progress', {
          versionId, status: 'downloading' as const,
          progress: 35 + Math.round(pct * 0.10),
          message: `Downloading assets... ${done} new, ${skipped} cached (${total} total)`,
        } as InstallProgress)
      }
    }

    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency)
      await Promise.allSettled(batch.map(async ([, info]) => {
        const hash = info.hash
        const subDir = hash.substring(0, 2)
        const destPath = path.join(this.basePath, 'assets', 'objects', subDir, hash)
        if (fs.existsSync(destPath)) { skipped++; return }
        try {
          await this.downloadWithVerify(`${baseUrl}/${subDir}/${hash}`, destPath, hash)
          done++
        } catch { skipped++ }
      }))
      if (versionId && i % (concurrency * 5) === 0) emitProgress()
    }
    emitProgress()
  }

  private async downloadLibraries(libraries: any[]) {
    const isWin = process.platform === 'win32'
    const isLin = process.platform === 'linux'
    const isMac = process.platform === 'darwin'

    for (const lib of libraries) {
      if (lib.downloads?.artifact) {
        const artifact = lib.downloads.artifact
        try {
          await this.downloadWithVerify(artifact.url, path.join(this.basePath, 'libraries', ...artifact.path.split('/')), artifact.sha1)
        } catch (err) {
          console.warn(`Failed to download library ${lib.name}:`, err)
        }
      }
      if (lib.natives && lib.downloads?.classifiers) {
        for (const os of Object.keys(lib.natives)) {
          let classifier = lib.natives[os]
          if (isWin && os === 'windows') {
            classifier = classifier.replace('${arch}', process.arch === 'x64' ? '64' : '32')
          } else if (!((isWin && os === 'windows') || (isLin && os === 'linux') || (isMac && os === 'osx'))) {
            continue
          }
          const classifierEntry = lib.downloads.classifiers[classifier]
          if (classifierEntry) {
            try {
              await this.downloadWithVerify(classifierEntry.url, path.join(this.basePath, 'natives', classifier), classifierEntry.sha1)
            } catch (err) {
              console.warn(`Failed to download native lib ${classifier}:`, err)
            }
          }
        }
      }
    }
  }
}
