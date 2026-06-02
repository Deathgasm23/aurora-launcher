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
exports.ModPlatformService = void 0;
const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://api.curseforge.com/v1';
class ModPlatformService {
    // Modrinth
    async searchModrinth(query, type, limit = 20, offset = 0) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            let url = `${MODRINTH_API}/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
            if (type)
                url += `&facets=${encodeURIComponent(JSON.stringify([['project_type:' + type]]))}`;
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'aurora-launcher/1.0' },
            });
            if (!resp.ok)
                return [];
            const data = await resp.json();
            return (data.hits || []).map((h) => ({
                slug: h.slug,
                title: h.title,
                description: h.description,
                project_type: h.project_type,
                client_side: h.client_side,
                server_side: h.server_side,
                icon_url: h.icon_url,
                downloads: h.downloads,
                followers: h.followers,
                categories: h.categories || [],
                versions: h.versions || [],
                latest_version: h.latest_version,
                date_modified: h.date_modified,
            }));
        }
        catch {
            return [];
        }
    }
    async getModrinthProject(slug) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch(`${MODRINTH_API}/project/${slug}`, {
                headers: { 'User-Agent': 'aurora-launcher/1.0' },
            });
            if (!resp.ok)
                return null;
            return resp.json();
        }
        catch {
            return null;
        }
    }
    async getModrinthVersions(projectId, gameVersions, loaders) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            let url = `${MODRINTH_API}/project/${projectId}/version`;
            const params = [];
            if (gameVersions?.length)
                params.push(`game_versions=${JSON.stringify(gameVersions)}`);
            if (loaders?.length)
                params.push(`loaders=${JSON.stringify(loaders)}`);
            if (params.length)
                url += '?' + params.join('&');
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'aurora-launcher/1.0' },
            });
            if (!resp.ok)
                return [];
            const data = await resp.json();
            return data.map((v) => ({
                id: v.id,
                project_id: v.project_id,
                name: v.name,
                version_number: v.version_number,
                game_versions: v.game_versions || [],
                loaders: v.loaders || [],
                files: (v.files || []).map((f) => ({
                    url: f.url,
                    filename: f.filename,
                    size: f.size,
                    sha1: f.hashes?.sha1 || '',
                    primary: f.primary || false,
                })),
                date_published: v.date_published,
            }));
        }
        catch {
            return [];
        }
    }
    async downloadModrinthFile(file, destPath) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch(file.url);
            if (!resp.ok)
                return false;
            const buf = Buffer.from(await resp.arrayBuffer());
            const dir = require('path').dirname(destPath);
            if (!require('fs').existsSync(dir)) {
                require('fs').mkdirSync(dir, { recursive: true });
            }
            require('fs').writeFileSync(destPath, buf);
            return true;
        }
        catch {
            return false;
        }
    }
    // CurseForge
    async searchCurseForge(query, gameVersion, classId, pageSize = 20, index = 0, apiKey) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            let url = `${CURSEFORGE_API}/mods/search?gameId=432&searchFilter=${encodeURIComponent(query)}&pageSize=${pageSize}&index=${index}`;
            if (gameVersion)
                url += `&gameVersion=${encodeURIComponent(gameVersion)}`;
            if (classId)
                url += `&classId=${classId}`;
            const resp = await fetch(url, {
                headers: {
                    'x-api-key': apiKey || '',
                    'Accept': 'application/json',
                },
            });
            if (!resp.ok)
                return [];
            const data = await resp.json();
            return (data.data || []).map((m) => ({
                id: m.id,
                name: m.name,
                slug: m.slug,
                summary: m.summary,
                logo: m.logo || { url: '' },
                downloadCount: m.downloadCount || 0,
                categories: m.categories || [],
                gameVersions: m.gameVersions || [],
                links: m.links || { websiteUrl: '' },
                dateModified: m.dateModified,
            }));
        }
        catch {
            return [];
        }
    }
    async getCurseForgeFiles(modId, gameVersion, apiKey) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            let url = `${CURSEFORGE_API}/mods/${modId}/files?pageSize=50`;
            if (gameVersion)
                url += `&gameVersion=${encodeURIComponent(gameVersion)}`;
            const resp = await fetch(url, {
                headers: {
                    'x-api-key': apiKey || '',
                    'Accept': 'application/json',
                },
            });
            if (!resp.ok)
                return [];
            const data = await resp.json();
            return (data.data || []).map((f) => ({
                id: f.id,
                modId: f.modId,
                fileName: f.fileName,
                downloadUrl: f.downloadUrl || '',
                fileLength: f.fileLength || 0,
                gameVersions: f.gameVersions || [],
                releaseType: f.releaseType || 'release',
            }));
        }
        catch {
            return [];
        }
    }
    async downloadCurseForgeFile(downloadUrl, destPath) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch(downloadUrl);
            if (!resp.ok)
                return false;
            const buf = Buffer.from(await resp.arrayBuffer());
            const dir = require('path').dirname(destPath);
            if (!require('fs').existsSync(dir)) {
                require('fs').mkdirSync(dir, { recursive: true });
            }
            require('fs').writeFileSync(destPath, buf);
            return true;
        }
        catch {
            return false;
        }
    }
    async getModrinthCategories() {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch(`${MODRINTH_API}/tag/category`, {
                headers: { 'User-Agent': 'aurora-launcher/1.0' },
            });
            if (!resp.ok)
                return [];
            const data = await resp.json();
            return data.map((c) => c.name);
        }
        catch {
            return [];
        }
    }
}
exports.ModPlatformService = ModPlatformService;
