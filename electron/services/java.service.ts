import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { JavaInstallation } from '../../shared/types'

export class JavaService {
  private cached: JavaInstallation[] | null = null

  getCachedInstallations(): JavaInstallation[] {
    return this.cached || []
  }

  async detectInstallations(): Promise<JavaInstallation[]> {
    const installations: JavaInstallation[] = []
    const commonPaths: string[] = []
    const isWin = process.platform === 'win32'

    if (isWin) {
      commonPaths.push(
        'C:\\Program Files\\Java',
        'C:\\Program Files (x86)\\Java',
        `${process.env.LOCALAPPDATA}\\Programs\\Common\\Oracle\\Java`,
        `${process.env.PROGRAMFILES}\\Amazon Corretto`,
        `${process.env.PROGRAMFILES}\\AdoptOpenJDK`,
        `${process.env.PROGRAMFILES}\\Eclipse Adoptium`,
        `${process.env.PROGRAMFILES}\\Temurin`,
        `${process.env.PROGRAMFILES}\\Oracle\\Java`,
        `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\AdoptOpenJDK`,
        `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Eclipse Adoptium`,
        `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Temurin`,
        `${process.env.USERPROFILE}\\scoop\\apps\\temurin`,
        `${process.env.USERPROFILE}\\scoop\\apps\\oraclejdk`,
        `${process.env.USERPROFILE}\\scoop\\apps\\openjdk`,
        `C:\\ProgramData\\Oracle\\Java\\javapath`,
      )

      try {
        const result = execSync('where java 2>nul', { encoding: 'utf-8' })
        result.trim().split('\n').filter(Boolean).forEach(p => {
          const resolved = path.resolve(p.trim())
          if (!installations.find(i => i.path === resolved)) {
            installations.push({ path: resolved, version: '', architecture: '' })
          }
        })
      } catch {}

      try {
        const javaHome = process.env.JAVA_HOME
        if (javaHome) {
          const javaBin = path.join(javaHome, 'bin', 'java.exe')
          if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
            installations.push({ path: javaBin, version: '', architecture: '' })
          }
        }
      } catch {}

      try {
        const jdkHome = process.env.JDK_HOME
        if (jdkHome) {
          const javaBin = path.join(jdkHome, 'bin', 'java.exe')
          if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
            installations.push({ path: javaBin, version: '', architecture: '' })
          }
        }
      } catch {}
    } else {
      commonPaths.push('/usr/lib/jvm', '/usr/lib/jvm/java', '/usr/local/lib/jvm')

      try {
        const result = execSync('which java 2>/dev/null || echo ""', { encoding: 'utf-8' })
        const trimmed = result.trim()
        if (trimmed) {
          installations.push({ path: trimmed, version: '', architecture: '' })
        }
      } catch {}

      try {
        const javaHome = process.env.JAVA_HOME
        if (javaHome) {
          const javaBin = path.join(javaHome, 'bin', 'java')
          if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
            installations.push({ path: javaBin, version: '', architecture: '' })
          }
        }
      } catch {}
    }

    for (const basePath of commonPaths) {
      if (fs.existsSync(basePath)) {
        try {
          const entries = fs.readdirSync(basePath)
          for (const entry of entries) {
            const fullPath = path.join(basePath, entry)
            if (fs.statSync(fullPath).isDirectory()) {
              const javaBin = isWin ? path.join(fullPath, 'bin', 'java.exe') : path.join(fullPath, 'bin', 'java')
              if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
                installations.push({ path: javaBin, version: '', architecture: '' })
              }
            }
          }
        } catch {}
      }
    }

    for (const inst of installations) {
      try {
        inst.version = this.getJavaVersion(inst.path)
      } catch {}
    }

    this.cached = installations
    return installations
  }

  getJavaVersion(javaPath: string): string {
    try {
      const result = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf-8' })
      const match = result.match(/(?:"(\d+\.\d+[^"]*)"|(\d+\.\d+\.\d+))/)
      return match ? (match[1] || match[2]) : 'unknown'
    } catch {
      return 'unknown'
    }
  }

  validateJava(javaPath: string): { valid: boolean; version?: string } {
    try {
      if (!fs.existsSync(javaPath)) return { valid: false }
      const version = this.getJavaVersion(javaPath)
      return { valid: true, version }
    } catch {
      return { valid: false }
    }
  }
}
