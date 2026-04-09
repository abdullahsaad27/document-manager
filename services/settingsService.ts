import type { Settings, AiProvider, Theme, Template } from '../types';

const SETTINGS_KEY = 'documentExpertSettings';

// This new structure will be stored in localStorage.
// It keeps settings for each provider separate.
interface StoredSettings {
    provider: AiProvider;
    theme: Theme;
    providers: {
        google: { model: string; apiKey: string; }; // apiKey here is the user's key
        openrouter: { model: string; apiKey: string; }; // Added apiKey for OpenRouter
        mistral: { model: string; apiKey: string; }; // Added apiKey for Mistral
    };
    templates: Template[];
    pdfChunkSize: number;
}

const DEFAULTS: StoredSettings = {
    provider: 'google',
    theme: 'system',
    providers: {
        google: { model: 'gemini-3-flash-preview', apiKey: '' },
        openrouter: { model: 'google/gemini-2.5-flash', apiKey: '' },
        mistral: { model: 'mistral-large-latest', apiKey: '' },
    },
    templates: [],
    pdfChunkSize: 5
};

const getStoredSettings = (): StoredSettings => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Deep-merge to ensure new properties from DEFAULTS are included
                return {
                    ...DEFAULTS,
                    ...parsed,
                    providers: {
                        google: { ...DEFAULTS.providers.google, ...(parsed.providers?.google || {}) },
                        openrouter: { ...DEFAULTS.providers.openrouter, ...(parsed.providers?.openrouter || {}) },
                        mistral: { ...DEFAULTS.providers.mistral, ...(parsed.providers?.mistral || {}) },
                    },
                    templates: parsed.templates || []
                };
            }
        }
    } catch (error) {
        console.error("Failed to parse stored settings from localStorage", error);
    }
    return JSON.parse(JSON.stringify(DEFAULTS));
}

const saveStoredSettings = (settings: StoredSettings) => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
    }
}

// getSettings now returns a "thin" object for the currently active provider.
export const getSettings = (): Settings => {
    const stored = getStoredSettings();
    const activeProvider = stored.provider;

    let model = '';
    let mistralApiKey = '';
    let openRouterApiKey = '';
    const googleApiKey = stored.providers.google.apiKey;

    switch (activeProvider) {
        case 'openrouter':
            model = stored.providers.openrouter.model;
            openRouterApiKey = stored.providers.openrouter.apiKey;
            break;
        case 'mistral':
            model = stored.providers.mistral.model;
            mistralApiKey = stored.providers.mistral.apiKey;
            break;
        case 'google':
        default:
            model = stored.providers.google.model;
            break;
    }

    return {
        provider: activeProvider,
        theme: stored.theme,
        openRouterApiKey,
        googleApiKey,
        mistralApiKey,
        model,
        pdfChunkSize: stored.pdfChunkSize || 5
    };
};

export const getTemplates = (): Template[] => {
    return getStoredSettings().templates;
};

export const saveTemplate = (template: Template) => {
    const stored = getStoredSettings();
    // Check if update or create
    const index = stored.templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
        stored.templates[index] = template;
    } else {
        stored.templates.push(template);
    }
    saveStoredSettings(stored);
    return stored.templates;
};

export const deleteTemplate = (id: string) => {
    const stored = getStoredSettings();
    stored.templates = stored.templates.filter(t => t.id !== id);
    saveStoredSettings(stored);
    return stored.templates;
};


// saveSettings now intelligently updates the "fat" stored object.
export const saveSettings = (settings: Partial<Settings>): Settings => {
    const stored = getStoredSettings();

    if (settings.provider) {
        stored.provider = settings.provider;
    }
    if (settings.theme) {
        stored.theme = settings.theme;
    }
    if (settings.pdfChunkSize) {
        stored.pdfChunkSize = settings.pdfChunkSize;
    }

    const providerToUpdate = settings.provider || stored.provider;

    switch (providerToUpdate) {
        case 'openrouter':
            if (settings.model) stored.providers.openrouter.model = settings.model;
            if (settings.openRouterApiKey !== undefined) stored.providers.openrouter.apiKey = settings.openRouterApiKey;
            break;
        case 'mistral':
            if (settings.model) stored.providers.mistral.model = settings.model;
            if (settings.mistralApiKey !== undefined) stored.providers.mistral.apiKey = settings.mistralApiKey;
            break;
        case 'google':
            if (settings.googleApiKey !== undefined) stored.providers.google.apiKey = settings.googleApiKey;
            if (settings.model) stored.providers.google.model = settings.model;
            break;
    }

    saveStoredSettings(stored);
    return getSettings();
};