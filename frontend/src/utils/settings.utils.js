// src/utils/settings.utils.js

import { writable } from "svelte/store";
import { getAuthHeaders } from "../stores/auth.store";

// Allowed variables for renaming schemes
export const ALLOWED_VARIABLES = {
    'TITLE': 'title',
    'ALBUM': 'album',
    'ARTIST': 'artist',
    'ALBUMARTIST': 'albumArtist',
    'YYYY': 'year',                  // Will extract just the year from date
    'TRACK': 'track',
    'DISK': 'disk',                  // Disk number
    'RELEASETYPE': 'releaseType',    // Release type (album, ep, etc.)
};

// All field names used in the folder overview
export const OVERVIEW_FIELD_NAMES = [
    'title',
    'album',
    'artist',
    'albumArtist',
    'track',
    'disk',
    'year',
    'genre',
    'unsyncedLyrics',
    'lyrics',
    'picture',
];

// Color theme defaults
export const defaultColors = {
    'color-primary': '#fd7d05',
    'color-badge-audio': '#fd7d05',
    'color-badge-image': '#6666ff',
    'color-badge-text': '#2e7d32',
};

// Default settings
const defaultSettings = {
    allowDeleteKey: true,
    folderScheme: "[[YYYY]] - [ALBUMARTIST] - [ALBUM]",          // Scheme for folders
    fileScheme: "[ALBUMARTIST] - [ALBUM] - [TRACK] - [TITLE]",   // Scheme for files
    replaceSpacesInFolders: false,                               // Setting for folders
    replaceSpacesInFiles: false,                                 // Setting for files
    enablePlayer: true,                                          // Player enabled by default
    overviewFields: [...OVERVIEW_FIELD_NAMES],                   // All fields selected by default
    recursiveOverview: false,                                    // Recursive overview flag
    ...defaultColors,                                            // Color defaults
};

// Load settings from localStorage
function loadSettings() {
    try {
        const saved = localStorage.getItem("appSettings");
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to ensure all fields exist
            return {
                ...defaultSettings,
                ...parsed
            };
            // Ensure all color keys are present
            for (const key of Object.keys(defaultColors)) {
                if (!(key in merged)) merged[key] = defaultColors[key];
            }
            return merged;
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
    }
    return defaultSettings;
}

// Create writable store
export const settings = writable(loadSettings());

// Save settings to localStorage
export function saveSettings(newSettings) {
    try {
        localStorage.setItem("appSettings", JSON.stringify(newSettings));
        settings.set(newSettings);
        applyThemeFromSettings(newSettings);
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}

// Updated to accept options parameter
export async function applyRenamingScheme(scheme, path, isFolder = true, options = {}) {
    try {
        const response = await fetch("/api/apply-renaming-scheme", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                path,
                scheme,
                isFolder,
                replaceSpaces: options.replaceSpaces || false  // Pass the option to backend
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Failed to apply renaming scheme");
        }

        return result;
    } catch (error) {
        throw new Error(`Failed to apply renaming scheme: ${error.message}`);
    }
}

// HSL helpers
function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h, s, l };
}

function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}

function adjustLightness(hex, deltaL, deltaS = 0) {
    const { h, s, l } = hexToHsl(hex);
    const newL = Math.min(1, Math.max(0, l + deltaL));
    const newS = Math.min(1, Math.max(0, s + deltaS));
    return hslToHex(h, newS, newL);
}

// Derivation constants
const FOCUS_LIGHTEN = 0.08;        // light mode focus: slightly lighter
const FOCUS_SATURATE = 0.25;       // more saturated
const DARK_LIGHTEN = 0.1;          // dark mode main: lighter
const FOCUS_DARK_LIGHTEN = 0.20;   // dark mode focus: lighter

// Generate full theme
export function generateFullTheme(colors) {
    const { 'color-primary': primary, 'color-badge-audio': badgeAudio, 'color-badge-image': badgeImage, 'color-badge-text': badgeText } = colors;

    // Derive all variants
    const primaryFocus = adjustLightness(primary, FOCUS_LIGHTEN, FOCUS_SATURATE);
    const primaryDark = adjustLightness(primary, DARK_LIGHTEN, 0);
    const primaryFocusDark = adjustLightness(primary, FOCUS_DARK_LIGHTEN, 0);

    const badgeAudioDark = adjustLightness(badgeAudio, DARK_LIGHTEN, 0);
    const badgeImageDark = adjustLightness(badgeImage, DARK_LIGHTEN, 0);
    const badgeTextDark = adjustLightness(badgeText, DARK_LIGHTEN, 0);

    const alpha = (hex, a) => hex + a;

    return {
        '--color-primary': primary,
        '--color-primary-focus': primaryFocus,
        '--color-primary-dark': primaryDark,
        '--color-primary-dark-focus': primaryFocusDark,
        '--color-primary-transparent': alpha(primary, '40'),
        '--color-primary-transparent-dark': alpha(primaryDark, '30'),
        '--color-lrc-playing-transparent': alpha(primary, '0d'),

        '--color-badge-audio': badgeAudio,
        '--color-badge-audio-dark': badgeAudioDark,
        '--color-badge-audio-background': alpha(badgeAudio, '40'),
        '--color-badge-audio-background-dark': alpha(badgeAudioDark, '30'),

        '--color-badge-image': badgeImage,
        '--color-badge-image-dark': badgeImageDark,
        '--color-badge-image-background': alpha(badgeImage, '26'),
        '--color-badge-image-background-dark': alpha(badgeImageDark, '33'),

        '--color-badge-text': badgeText,
        '--color-badge-text-dark': badgeTextDark,
        '--color-badge-text-background': alpha(badgeText, '26'),
        '--color-badge-text-background-dark': alpha(badgeTextDark, '33'),
    };
}

export function applyThemeFromSettings(settingsObj) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const bases = {
        'color-primary': settingsObj['color-primary'] || defaultColors['color-primary'],
        'color-badge-audio': settingsObj['color-badge-audio'] || defaultColors['color-badge-audio'],
        'color-badge-image': settingsObj['color-badge-image'] || defaultColors['color-badge-image'],
        'color-badge-text': settingsObj['color-badge-text'] || defaultColors['color-badge-text'],
    };
    const fullTheme = generateFullTheme(bases);
    for (const [key, value] of Object.entries(fullTheme)) {
        root.style.setProperty(key, value);
    }
}