import { describe, beforeEach, it, expect } from '@jest/globals';
import { getSettings, saveSettings } from '../../services/settingsService';
import type { Settings } from '../../types';

describe('settingsService', () => {
  const SETTINGS_KEY = 'documentExpertSettings';

  beforeEach(() => {
    // Clear localStorage mock before each test
    localStorage.clear();
  });

  it('should return default settings when nothing is in localStorage', () => {
    const settings = getSettings();
    expect(settings).toEqual({
      provider: 'google',
      googleApiKey: '',
      openRouterApiKey: '',
      mistralApiKey: '',
      model: 'gemini-3-flash-preview',
      theme: 'system',
      pdfChunkSize: 5
    });
  });

  it('should save settings to localStorage', () => {
    const newSettings: Partial<Settings> = {
      provider: 'openrouter',
      openRouterApiKey: 'test-key',
      theme: 'dark',
    };
    saveSettings(newSettings);
    
    const stored = localStorage.getItem(SETTINGS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);

    expect(parsed.provider).toBe('openrouter');
    expect(parsed.theme).toBe('dark');
    expect(parsed.providers.openrouter.apiKey).toBe('test-key');
    // Default model for openrouter should be retained if not provided
    expect(parsed.providers.openrouter.model).toBe('google/gemini-2.5-flash');
    // Check that other provider settings are untouched
    expect(parsed.providers.google.model).toBe('gemini-3-flash-preview');
  });

  it('should retrieve saved settings from localStorage for the active provider', () => {
    const testStoredSettings = {
        provider: 'openrouter',
        theme: 'light',
        providers: {
            google: { model: 'gemini-3-flash-preview', apiKey: '' },
            openrouter: { apiKey: 'retrieved-key', model: 'anthropic/claude-3-haiku' },
            mistral: { apiKey: '', model: 'mistral-large-latest' },
        },
        pdfChunkSize: 10
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(testStoredSettings));

    const settings = getSettings();
    expect(settings).toEqual({
      provider: 'openrouter',
      openRouterApiKey: 'retrieved-key',
      googleApiKey: '',
      mistralApiKey: '',
      model: 'anthropic/claude-3-haiku',
      theme: 'light',
      pdfChunkSize: 10
    });
  });
  
  it('should merge saved settings with defaults if a key is missing', () => {
     const partialStoredSettings = {
      provider: 'openrouter',
      // theme is missing
      providers: {
        openrouter: { apiKey: 'partial-key' }, // model is missing
        // google and mistral settings are missing
      }
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(partialStoredSettings));
    
    const settings = getSettings();
    // getSettings() should return the thin settings for 'openrouter'
    expect(settings).toEqual({
      provider: 'openrouter',
      openRouterApiKey: 'partial-key',
      googleApiKey: '',
      mistralApiKey: '',
      model: 'google/gemini-2.5-flash', // from default
      theme: 'system', // from default
      pdfChunkSize: 5 // from default
    });
  });
});
