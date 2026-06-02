"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaService = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class JavaService {
    constructor() {
        this.cached = null;
    }
    getCachedInstallations() {
        return this.cached || [];
    }
    async detectInstallations() {
        const installations = [];
        const commonPaths = [];
        const isWin = process.platform === 'win32';
        if (isWin) {
            commonPaths.push('C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java', `${process.env.LOCALAPPDATA}\\Programs\\Common\\Oracle\\Java`, `${process.env.PROGRAMFILES}\\Amazon Corretto`, `${process.env.PROGRAMFILES}\\AdoptOpenJDK`, `${process.env.PROGRAMFILES}\\Eclipse Adoptium`, `${process.env.PROGRAMFILES}\\Temurin`, `${process.env.PROGRAMFILES}\\Oracle\\Java`, `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\AdoptOpenJDK`, `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Eclipse Adoptium`, `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Temurin`, `${process.env.USERPROFILE}\\scoop\\apps\\temurin`, `${process.env.USERPROFILE}\\scoop\\apps\\oraclejdk`, `${process.env.USERPROFILE}\\scoop\\apps\\openjdk`, `C:\\ProgramData\\Oracle\\Java\\javapath`);
            try {
                const result = (0, child_process_1.execSync)('where java 2>nul', { encoding: 'utf-8' });
                result.trim().split('\n').filter(Boolean).forEach(p => {
                    const resolved = path.resolve(p.trim());
                    if (!installations.find(i => i.path === resolved)) {
                        installations.push({ path: resolved, version: '', architecture: '' });
                    }
                });
            }
            catch { }
            try {
                const javaHome = process.env.JAVA_HOME;
                if (javaHome) {
                    const javaBin = path.join(javaHome, 'bin', 'java.exe');
                    if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
                        installations.push({ path: javaBin, version: '', architecture: '' });
                    }
                }
            }
            catch { }
            try {
                const jdkHome = process.env.JDK_HOME;
                if (jdkHome) {
                    const javaBin = path.join(jdkHome, 'bin', 'java.exe');
                    if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
                        installations.push({ path: javaBin, version: '', architecture: '' });
                    }
                }
            }
            catch { }
        }
        else {
            commonPaths.push('/usr/lib/jvm', '/usr/lib/jvm/java', '/usr/local/lib/jvm');
            try {
                const result = (0, child_process_1.execSync)('which java 2>/dev/null || echo ""', { encoding: 'utf-8' });
                const trimmed = result.trim();
                if (trimmed) {
                    installations.push({ path: trimmed, version: '', architecture: '' });
                }
            }
            catch { }
            try {
                const javaHome = process.env.JAVA_HOME;
                if (javaHome) {
                    const javaBin = path.join(javaHome, 'bin', 'java');
                    if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
                        installations.push({ path: javaBin, version: '', architecture: '' });
                    }
                }
            }
            catch { }
        }
        for (const basePath of commonPaths) {
            if (fs.existsSync(basePath)) {
                try {
                    const entries = fs.readdirSync(basePath);
                    for (const entry of entries) {
                        const fullPath = path.join(basePath, entry);
                        if (fs.statSync(fullPath).isDirectory()) {
                            const javaBin = isWin ? path.join(fullPath, 'bin', 'java.exe') : path.join(fullPath, 'bin', 'java');
                            if (fs.existsSync(javaBin) && !installations.find(i => i.path === javaBin)) {
                                installations.push({ path: javaBin, version: '', architecture: '' });
                            }
                        }
                    }
                }
                catch { }
            }
        }
        for (const inst of installations) {
            try {
                inst.version = this.getJavaVersion(inst.path);
            }
            catch { }
        }
        this.cached = installations;
        return installations;
    }
    getJavaVersion(javaPath) {
        try {
            const result = (0, child_process_1.execSync)(`"${javaPath}" -version 2>&1`, { encoding: 'utf-8' });
            const match = result.match(/(?:"(\d+\.\d+[^"]*)"|(\d+\.\d+\.\d+))/);
            return match ? (match[1] || match[2]) : 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    validateJava(javaPath) {
        try {
            if (!fs.existsSync(javaPath))
                return { valid: false };
            const version = this.getJavaVersion(javaPath);
            return { valid: true, version };
        }
        catch {
            return { valid: false };
        }
    }
}
exports.JavaService = JavaService;
