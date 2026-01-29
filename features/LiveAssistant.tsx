import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { getSettings } from '../services/settingsService';
import FileUpload from '../components/FileUpload';
import Spinner from '../components/Spinner';
import { extractTextFromFile } from '../services/textExtractorService';

const LiveAssistant: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('جاهز');
  const [error, setError] = useState('');
  const [fileContext, setFileContext] = useState('');
  
  // Refs for audio processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const handleFileSelect = async (files: File[]) => {
      if (files.length > 0) {
          const selectedFile = files[0];
          setFile(selectedFile);
          setIsLoading(true);
          setStatus('جاري استخراج محتوى الملف...');
          try {
              const text = await extractTextFromFile(selectedFile, (msg) => setStatus(msg));
              setFileContext(text);
              setStatus('تم تحميل الملف. يمكنك بدء المحادثة الآن.');
          } catch (err: any) {
              setError(err.message);
              setFile(null);
          } finally {
              setIsLoading(false);
          }
      }
  };

  const startSession = async () => {
    const settings = getSettings();
    const apiKey = settings.googleApiKey || process.env.API_KEY;
    
    if (!apiKey) {
        setError("مفتاح Google API غير موجود في الإعدادات.");
        return;
    }
    if (settings.provider !== 'google') {
        setError("هذه الميزة متاحة فقط مع مزود Google حالياً.");
        return;
    }

    setIsLoading(true);
    setError('');
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Setup Audio Contexts
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const config = {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: `You are a helpful document assistant interacting in Arabic.
            The user has uploaded a document with the following content:
            ---
            ${fileContext ? fileContext.substring(0, 20000) : 'No document provided yet.'}
            ---
            Answer questions based on this document. Keep responses concise and natural for voice.`,
        };

        // Using a promise to handle the session connection
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    setStatus('متصل. تحدث الآن!');
                    setIsSessionActive(true);
                    setIsLoading(false);

                    const inputCtx = inputAudioContextRef.current;
                    if(!inputCtx) return;

                    const source = inputCtx.createMediaStreamSource(stream);
                    const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                             session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputCtx.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                     const outputCtx = outputAudioContextRef.current;
                     if (!outputCtx) return;

                     const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                     if (base64Audio) {
                         // Initialize time if needed
                         if (nextStartTimeRef.current < outputCtx.currentTime) {
                             nextStartTimeRef.current = outputCtx.currentTime;
                         }

                         try {
                             const audioBuffer = await decodeAudioData(
                                 decode(base64Audio),
                                 outputCtx,
                                 24000,
                                 1
                             );
                             
                             const source = outputCtx.createBufferSource();
                             source.buffer = audioBuffer;
                             source.connect(outputCtx.destination);
                             source.addEventListener('ended', () => {
                                 sourcesRef.current.delete(source);
                             });
                             
                             source.start(nextStartTimeRef.current);
                             nextStartTimeRef.current += audioBuffer.duration;
                             sourcesRef.current.add(source);
                         } catch (e) {
                             console.error("Error decoding audio", e);
                         }
                     }

                     if (message.serverContent?.interrupted) {
                         for (const source of sourcesRef.current.values()) {
                             source.stop();
                         }
                         sourcesRef.current.clear();
                         nextStartTimeRef.current = 0;
                     }
                },
                onclose: () => {
                    setStatus('انتهت الجلسة');
                    setIsSessionActive(false);
                },
                onerror: (e) => {
                    console.error(e);
                    setError('حدث خطأ في الاتصال');
                    setIsSessionActive(false);
                }
            },
            config,
        });
        
        sessionRef.current = sessionPromise;

    } catch (e: any) {
        setError(e.message || "فشل بدء الجلسة الصوتية");
        setIsLoading(false);
    }
  };

  const stopSession = async () => {
      if (sessionRef.current) {
          const session = await sessionRef.current;
          session.close();
      }
      if (inputAudioContextRef.current) {
          inputAudioContextRef.current.close();
      }
      if (outputAudioContextRef.current) {
          outputAudioContextRef.current.close();
      }
      setIsSessionActive(false);
      setStatus('تم قطع الاتصال');
  };

  // Helper functions
  function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  function encode(bytes: Uint8Array) {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  }

  function decode(base64: string) {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
  }

  async function decodeAudioData(
      data: Uint8Array,
      ctx: AudioContext,
      sampleRate: number,
      numChannels: number,
  ): Promise<AudioBuffer> {
      const dataInt16 = new Int16Array(data.buffer);
      const frameCount = dataInt16.length / numChannels;
      const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

      for (let channel = 0; channel < numChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          for (let i = 0; i < frameCount; i++) {
              channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
          }
      }
      return buffer;
  }

  useEffect(() => {
      return () => {
          // Cleanup on unmount
          stopSession();
      };
  }, []);

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg text-center">
        <div className="mb-8">
            <div className="w-24 h-24 mx-auto bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">المساعد الصوتي المباشر</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2">تحدث مع مستنداتك بشكل طبيعي</p>
        </div>

        {!file && (
             <div className="mb-6">
                <FileUpload
                    onFileSelect={handleFileSelect}
                    acceptedFileTypes=".pdf,.docx,.txt"
                    promptText="اختر مستنداً للتحدث معه"
                />
            </div>
        )}

        {file && (
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-6">
                 <p className="font-semibold text-slate-700 dark:text-slate-200">{file.name}</p>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{status}</p>
            </div>
        )}

        {file && (
            <div className="flex justify-center gap-4">
                 {!isSessionActive ? (
                     <button
                        onClick={startSession}
                        disabled={isLoading || !fileContext}
                        className="bg-indigo-600 text-white font-bold py-4 px-10 rounded-full hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                     >
                        {isLoading ? <Spinner /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                بدء المحادثة
                            </>
                        )}
                     </button>
                 ) : (
                     <button
                        onClick={stopSession}
                        className="bg-red-600 text-white font-bold py-4 px-10 rounded-full hover:bg-red-700 transition-all shadow-lg animate-pulse"
                     >
                        إنهاء المحادثة
                     </button>
                 )}
            </div>
        )}
        
        {error && <p className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded">{error}</p>}
    </div>
  );
};

export default LiveAssistant;