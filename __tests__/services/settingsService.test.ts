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
      apiKey: '',
      model: 'gemini-2.5-flash',
      theme: 'system',
    });
  });

  it('should save settings to localStorage', () => {
    const newSettings: Partial<Settings> = {
      provider: 'openai',
      apiKey: 'test-key',
      theme: 'dark',
    };
    saveSettings(newSettings);
    
    const stored = localStorage.getItem(SETTINGS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);

    expect(parsed.provider).toBe('openai');
    expect(parsed.theme).toBe('dark');
    expect(parsed.providers.openai.apiKey).toBe('test-key');
    // Default model for openai should be retained if not provided
    expect(parsed.providers.openai.model).toBe('gpt-4o');
    // Check that other provider settings are untouched
    expect(parsed.providers.google.model).toBe('gemini-2.5-flash');
  });

  it('should retrieve saved settings from localStorage for the active provider', () => {
    const testStoredSettings = {
        provider: 'openai',
        theme: 'light',
        providers: {
            google: { model: 'gemini-2.5-flash' },
            openai: { apiKey: 'retrieved-key', model: 'openai/gpt-4' },
            openrouter: { apiKey: '', model: 'google/gemini-2.5-flash' },
        }
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(testStoredSettings));

    const settings = getSettings();
    expect(settings).toEqual({
      provider: 'openai',
      apiKey: 'retrieved-key',
      model: 'openai/gpt-4',
      theme: 'light',
    });
  });
  
  it('should merge saved settings with defaults if a key is missing', () => {
     const partialStoredSettings = {
      provider: 'openai',
      // theme is missing
      providers: {
        openai: { apiKey: 'partial-key' }, // model is missing
        // google and openrouter settings are missing
      }
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(partialStoredSettings));
    
    const settings = getSettings();
    // getSettings() should return the thin settings for 'openai'
    expect(settings).toEqual({
      provider: 'openai',
      apiKey: 'partial-key',
      model: 'gpt-4o', // from default
      theme: 'system', // from default
    });
  });
});