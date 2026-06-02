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
exports.NewsService = void 0;
function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const title = content.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() || 'Minecraft Update';
        const link = content.match(/<link[^>]*>([^<]*)<\/link>/)?.[1]?.trim() || '#';
        const description = content.match(/<description[^>]*>([^<]*)<\/description>/)?.[1]?.trim() || '';
        const pubDateStr = content.match(/<pubDate[^>]*>([^<]*)<\/pubDate>/)?.[1]?.trim();
        items.push({
            title,
            link,
            description,
            pubDate: pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString(),
        });
    }
    return items;
}
const FETCH_TIMEOUT = 8000;
const fetchWithTimeout = async (url, fetch) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
        return await fetch(url, { signal: controller.signal });
    }
    finally {
        clearTimeout(timeout);
    }
};
class NewsService {
    async fetchNews() {
        const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
        const allItems = [];
        const results = await Promise.allSettled([
            this.fetchMojangNews(fetch),
            this.fetchBlogRSS(fetch),
        ]);
        for (const result of results) {
            if (result.status === 'fulfilled')
                allItems.push(...result.value);
        }
        if (allItems.length === 0) {
            return [{
                    title: 'Minecraft Java Edition',
                    link: 'https://www.minecraft.net',
                    description: 'Welcome to Aurora Launcher. News feed unavailable.',
                    pubDate: new Date().toISOString(),
                }];
        }
        allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        return allItems;
    }
    async fetchMojangNews(fetch) {
        try {
            const response = await fetchWithTimeout('https://launchercontent.mojang.com/v2/javaPatchNotes.json', fetch);
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.entries)
                return [];
            return data.entries.map((entry) => ({
                title: entry.title || 'Minecraft Update',
                link: entry.version ? `https://www.minecraft.net/en-us/article/minecraft-${entry.version.replace(/\./g, '-')}` : '#',
                description: entry.shortText || entry.title || '',
                pubDate: entry.date || new Date().toISOString(),
            }));
        }
        catch {
            return [];
        }
    }
    async fetchBlogRSS(fetch) {
        try {
            const response = await fetchWithTimeout('https://www.minecraft.net/en-us/feeds/minecraft-blog/rss', fetch);
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return parseRSS(await response.text());
        }
        catch {
            return [];
        }
    }
}
exports.NewsService = NewsService;
