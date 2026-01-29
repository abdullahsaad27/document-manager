import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { summarizeText, ApiLimitError } from '../../services/aiService';
import * as settingsService from '../../services/settingsService';
import * as geminiService from '../../services/geminiService';

// Mock the dependencies
jest.mock('../../services/settingsService');
jest.mock('../../services/geminiService');

// Setup global fetch mock
// FIX: Use `any` to bypass strict fetch type definition mismatches in tests.
globalThis.fetch = jest.fn() as any;

const mockGetSettings = settingsService.getSettings as jest.Mock;
const mockGenerateText = geminiService.generateText as jest.Mock;
const mockFetch = globalThis.fetch as jest.Mock;

describe('aiService', () => {

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('summarizeText', () => {

    it('should call geminiService when provider is google', async () => {
      mockGetSettings.mockReturnValue({ provider: 'google', model: 'gemini-2.5-flash', googleApiKey: '' });
      mockGenerateText.mockResolvedValue('ملخص من Gemini');

      const result = await summarizeText('نص طويل', 'short');

      expect(mockGenerateText).toHaveBeenCalledWith(expect.stringContaining('نص طويل'));
      expect(result).toBe('ملخص من Gemini');
    });

    it('should call OpenAI API when provider is openai', async () => {
      mockGetSettings.mockReturnValue({ provider: 'openai', model: 'gpt-4o', apiKey: 'test-key' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ملخص من OpenAI' } }],
        }),
      } as any);

      const result = await summarizeText('نص طويل', 'short');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
      const fetchBody = JSON.parse((mockFetch.mock.calls[0] as any[])[1].body);
      expect(fetchBody.model).toBe('gpt-4o');
      expect(fetchBody.messages[0].content).toContain('نص طويل');
      expect(result).toBe('ملخص من OpenAI');
    });

    it('should call OpenRouter API when provider is openrouter', async () => {
        mockGetSettings.mockReturnValue({ provider: 'openrouter', model: 'google/gemini-pro', apiKey: 'test-key' });
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'ملخص من OpenRouter' } }],
          }),
        } as any);
  
        const result = await summarizeText('نص طويل', 'short');
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://openrouter.ai/api/v1/chat/completions',
          expect.any(Object)
        );
        const fetchBody = JSON.parse((mockFetch.mock.calls[0] as any[])[1].body);
        expect(fetchBody.model).toBe('google/gemini-pro');
        expect(result).toBe('ملخص من OpenRouter');
      });

    it('should throw ApiLimitError on 429 status from fetch', async () => {
        mockGetSettings.mockReturnValue({ provider: 'openai', model: 'gpt-4o', apiKey: 'test-key' });
        mockFetch.mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit exceeded' } }),
        } as any);
  
        await expect(summarizeText('test', 'short')).rejects.toThrow(ApiLimitError);
        await expect(summarizeText('test', 'short')).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw a generic error on other fetch failures', async () => {
        mockGetSettings.mockReturnValue({ provider: 'openai', model: 'gpt-4o', apiKey: 'test-key' });
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal Server Error' } }),
        } as any);
  
        await expect(summarizeText('test', 'short')).rejects.toThrow('An error occurred while communicating with the AI service: Internal Server Error');
      });
  });
});