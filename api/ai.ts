// This is a serverless function (e.g., for Vercel or Netlify).
// It acts as a secure proxy for AI API calls to protect API keys.

// When deploying, ensure environment variables OPENAI_API_KEY, OPENROUTER_API_KEY, and MISTRAL_API_KEY are set.

export const config = {
  runtime: 'edge', // Using edge runtime for performance
};

// Main handler for the serverless function
export default async function handler(req: Request) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Extract provider, action, userApiKey and relevant fields from the client request
    const { provider, action, userApiKey, model, messages, fileData, fileMimeType, ...body } = await req.json();

    let apiUrl = '';
    let apiKey = '';

    // Configuration for supported AI providers
    const providerConfig: { [key: string]: { apiUrl: string; apiKey: string } } = {
      openai: {
        apiUrl: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || ''
      },
      openrouter: {
        apiUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY || ''
      },
      mistral: {
        apiUrl: 'https://api.mistral.ai/v1',
        apiKey: process.env.MISTRAL_API_KEY || ''
      }
    };

    // Check if the requested provider is supported
    const currentProvider = providerConfig[provider];
    if (!currentProvider) {
      return new Response(JSON.stringify({ error: { message: 'Unsupported provider' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    apiUrl = currentProvider.apiUrl;
    
    // Priority: 1. userApiKey from UI, 2. API Key from environment
    apiKey = userApiKey || currentProvider.apiKey;

    // Check if the API key is configured
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: `API key for ${provider} is not configured. Please add it in Settings.` } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prepare headers for the external API call
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      // OpenRouter requires specific headers for tracking
      headers['HTTP-Referer'] = 'https://doc-expert-pro.vercel.app'; // Replace with your app's domain
      headers['X-Title'] = 'Document Expert';
    }

    let targetUrl = '';
    let fetchOptions: RequestInit = {};

    // Determine the target endpoint and method based on the requested action
    if (action === 'verify' || action === 'fetchModels') {
      targetUrl = `${apiUrl}/models`;
      fetchOptions = { method: 'GET', headers };
    } else if (action === 'ocr' && provider === 'mistral') {
      // Mistral OCR specific endpoint
      targetUrl = `${apiUrl}/ocr`;
      fetchOptions = { 
          method: 'POST', 
          headers, 
          body: JSON.stringify({
              model: model,
              document: {
                  type: 'content',
                  content: fileData,
                  filename: 'document_chunk.pdf'
              }
          }) 
      };
    } else {
      // Default: chat completions
      targetUrl = `${apiUrl}/chat/completions`;
      fetchOptions = { 
          method: 'POST', 
          headers, 
          body: JSON.stringify({
              model,
              messages,
              ...body
          }) 
      };
    }

    // Forward the request to the actual AI service
    const aiResponse = await fetch(targetUrl, fetchOptions);

    // Stream the response from the AI service directly back to the client
    return new Response(aiResponse.body, {
      status: aiResponse.status,
      statusText: aiResponse.statusText,
      headers: aiResponse.headers,
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: { message: `Internal Proxy Error: ${errorMessage}` } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}