import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSettings, saveSettings, getTemplates, saveTemplate, deleteTemplate } from '../services/settingsService';
import { verifyApiKey, fetchOpenRouterModels } from '../services/aiService';
import * as notificationService from '../services/notificationService';
import type { Settings, OpenRouterModel, AiProvider, Theme, Template } from '../types';
import Spinner from '../components/Spinner';

interface SettingsProps {
  onSave: () => void;
}

const GOOGLE_MODELS = [
  { id: 'gemini-3-flash', name: 'Gemini 3.0 Flash (الأحدث - سرعة فائقة)' },
  { id: 'gemini-3-pro', name: 'Gemini 3.0 Pro (الأقوى - دقة متناهية)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (مستقر وسريع)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (اقتصادي)' }
];

const MISTRAL_MODELS = [
  { id: 'mistral-ocr-latest', name: 'Mistral OCR (متخصص للمستندات - الأفضل للـ PDF)' },
  { id: 'mistral-large-latest', name: 'Mistral Large (الأذكى للمحادثة)' },
  { id: 'mistral-medium-latest', name: 'Mistral Medium' },
  { id: 'mistral-small-latest', name: 'Mistral Small (السرعة)' },
  { id: 'pixtral-12b-latest', name: 'Pixtral 12B (للرؤية والتحليل)' }
];

const Settings: React.FC<SettingsProps> = ({ onSave }) => {
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [templates, setTemplates] = useState<Template[]>(getTemplates());
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Template form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<'summary' | 'correction'>('summary');

  // New state for notification permissions
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    // Reflect saved settings on component load
    const currentSettings = getSettings();
    setSettings(currentSettings);
    setTemplates(getTemplates());
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as AiProvider;
    let defaultModel = '';
    if (newProvider === 'mistral') defaultModel = 'mistral-ocr-latest';
    if (newProvider === 'google') defaultModel = 'gemini-3-flash';
    if (newProvider === 'openai') defaultModel = 'gpt-4o';

    setSettings(s => ({ ...s, provider: newProvider, model: defaultModel }));
    setOpenRouterModels([]);
    setModelSearch('');
    setError('');
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setSettings(s => ({ ...s, model: e.target.value }));
  }

  const handleFetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    setError('');
    try {
      const models = await fetchOpenRouterModels();
      setOpenRouterModels(models);
      if (models.length > 0 && !models.some(m => m.id === settings.model)) {
        setSettings(s => ({ ...s, model: models.find(m => m.id === 'google/gemini-3-flash-preview')?.id || models[0].id }));
      }
    } catch (e) {
      setError("فشل في جلب قائمة النماذج. تأكد من تكوين مفتاح OpenRouter على الخادم.");
      setOpenRouterModels([]);
    }
    setIsLoadingModels(false);
  }, [settings.model]);

  useEffect(() => {
    if (settings.provider === 'openrouter' && openRouterModels.length === 0) {
      handleFetchModels();
    }
  }, [settings.provider, openRouterModels.length, handleFetchModels]);


  const handleSave = async () => {
    setError('');

    // Create a complete settings object to save
    const settingsToSave: Settings = {
      ...settings,
    };

    saveSettings(settingsToSave);

    setSaveStatus('تم حفظ الإعدادات بنجاح!');
    setTimeout(() => setSaveStatus(''), 3000);
    onSave();
  };

  const handleRequestNotificationPermission = async () => {
    const permission = await notificationService.requestPermission();
    setNotificationPermission(permission);
  };

  const handleAddTemplate = () => {
    if (!newTemplateName.trim() || !newTemplatePrompt.trim()) return;

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: newTemplateName,
      type: newTemplateType,
      prompt: newTemplatePrompt
    };

    const updatedTemplates = saveTemplate(newTemplate);
    setTemplates(updatedTemplates);
    setNewTemplateName('');
    setNewTemplatePrompt('');
  };

  const handleDeleteTemplate = (id: string) => {
    const updatedTemplates = deleteTemplate(id);
    setTemplates(updatedTemplates);
  };

  const filteredModels = useMemo(() => {
    if (!modelSearch) return openRouterModels;
    return openRouterModels.filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()));
  }, [openRouterModels, modelSearch]);

  const renderProviderSettings = () => {
    switch (settings.provider) {
      case 'google':
        return (
          <div>
            <div className="mb-4">
              <label htmlFor="googleApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">مفتاح API الخاص بك</label>
              <input
                type="password"
                id="googleApiKey"
                value={settings.googleApiKey || ''}
                onChange={(e) => setSettings(s => ({ ...s, googleApiKey: e.target.value }))}
                placeholder="GOOGLE_API_KEY"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">يتم حفظ المفتاح محلياً في متصفحك. لن تحتاج لإدخاله مرة أخرى ما لم تقم بمسح بيانات التصفح.</p>
            </div>
            <div className="mt-4">
              <label htmlFor="googleModel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">النموذج</label>
              <select id="googleModel" value={settings.model || 'gemini-3-flash'} onChange={handleModelChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800">
                {GOOGLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        );
      case 'mistral':
        return (
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              يمكنك استخدام مفتاحك الخاص أو الاعتماد على مفتاح النظام إن وجد.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="mistralKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">مفتاح API الخاص بك</label>
                <input
                  type="password"
                  id="mistralKey"
                  value={settings.mistralApiKey || ''}
                  onChange={(e) => setSettings(s => ({ ...s, mistralApiKey: e.target.value }))}
                  placeholder="MISTRAL_API_KEY"
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="mistralModel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">النموذج</label>
                <select id="mistralModel" value={settings.model || 'mistral-ocr-latest'} onChange={handleModelChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800">
                  {MISTRAL_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        );
      case 'openai':
        return (
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              تم تكوين OpenAI API بشكل آمن على الخادم. حدد النموذج الذي ترغب في استخدامه.
            </p>
            <div className="mt-4">
              <label htmlFor="openaiModel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">النموذج</label>
              <input
                type="text"
                id="openaiModel"
                value={settings.model}
                onChange={handleModelChange}
                placeholder="e.g., gpt-4o"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
              />
            </div>
          </div>
        );
      case 'openrouter':
        return (
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              تم تكوين OpenRouter API بشكل آمن على الخادم. اختر من قائمة النماذج المتاحة.
            </p>
            <div className="mt-4">
              <label htmlFor="openrouterModel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">النموذج</label>
              {(isLoadingModels && openRouterModels.length === 0) ? <Spinner /> :
                (openRouterModels.length > 0 ? (
                  <>
                    <input
                      type="search"
                      placeholder="ابحث عن نموذج..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="w-full p-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                    />
                    <select id="openrouterModel" value={settings.model} onChange={handleModelChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800">
                      {filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400">لا توجد نماذج متاحة. يرجى التحقق من تكوين الخادم.</p>
                ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getPermissionStatusText = () => {
    switch (notificationPermission) {
      case 'granted': return <span className="text-green-600 dark:text-green-400 font-semibold">مفعّلة</span>;
      case 'denied': return <span className="text-red-500 dark:text-red-400 font-semibold">محظورة</span>;
      default: return <span className="text-slate-500 dark:text-slate-400 font-semibold">غير محدد</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">الإعدادات</h2>

      <div className="space-y-8">
        {/* Provider Settings */}
        <section>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b dark:border-slate-700">الذكاء الاصطناعي</h3>
          <div className="mb-4">
            <label htmlFor="ai-provider" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">مزود الخدمة</label>
            <select id="ai-provider" value={settings.provider} onChange={handleProviderChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800">
              <option value="google">Google (الافتراضي)</option>
              <option value="mistral">Mistral AI (مستضاف)</option>
              <option value="openai">OpenAI (مستضاف)</option>
              <option value="openrouter">OpenRouter (مستضاف)</option>
            </select>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-700 rounded-lg">
            {renderProviderSettings()}
          </div>
        </section>

        {/* PDF Extraction Settings */}
        <section>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b dark:border-slate-700">إعدادات معالجة PDF</h3>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-700 rounded-lg">
            <label htmlFor="chunkSize" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">عدد الصفحات في كل دفعة معالجة</label>
            <div className="relative">
              <select
                id="chunkSize"
                value={settings.pdfChunkSize || 5}
                onChange={(e) => setSettings(s => ({ ...s, pdfChunkSize: Number(e.target.value) }))}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 appearance-none"
              >
                {[1, 2, 3, 4, 5, 10, 15, 20, 25, 50].map(size => (
                  <option key={size} value={size}>{size} صفحات في كل طلب</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-slate-700 dark:text-slate-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              يحدد عدد الصفحات التي يتم إرسالها للذكاء الاصطناعي في المرة الواحدة.
              القيم الأقل تزيد الدقة وتقلل احتمالية الأخطاء، بينما القيم الأكبر تزيد السرعة.
            </p>
          </div>
        </section>

        {/* Template Settings */}
        <section>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b dark:border-slate-700">إدارة القوالب</h3>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-700 rounded-lg mb-4">
            <h4 className="font-semibold mb-3 text-sm text-slate-700 dark:text-slate-300">إضافة قالب جديد</h4>
            <div className="grid gap-3 mb-3">
              <input
                type="text"
                placeholder="اسم القالب (مثلاً: تلخيص قانوني)"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
              />
              <select
                value={newTemplateType}
                onChange={(e) => setNewTemplateType(e.target.value as any)}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
              >
                <option value="summary">تلخيص</option>
                <option value="correction">تصحيح</option>
              </select>
              <textarea
                placeholder="اكتب التعليمات الخاصة بالقالب هنا..."
                value={newTemplatePrompt}
                onChange={(e) => setNewTemplatePrompt(e.target.value)}
                rows={3}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
              />
            </div>
            <button onClick={handleAddTemplate} disabled={!newTemplateName || !newTemplatePrompt} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              إضافة القالب
            </button>
          </div>

          <div className="space-y-2">
            {templates.length === 0 ? <p className="text-sm text-slate-500">لا توجد قوالب محفوظة.</p> : templates.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md shadow-sm">
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.type === 'summary' ? 'تلخيص' : 'تصحيح'}</p>
                </div>
                <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:text-red-700 text-sm">حذف</button>
              </div>
            ))}
          </div>
        </section>

        {/* Appearance Settings */}
        <section>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b dark:border-slate-700">المظهر والإشعارات</h3>
          <div className="mb-4">
            <label htmlFor="theme" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">المظهر</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => setSettings(s => ({ ...s, theme: e.target.value as Theme }))}
              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
            >
              <option value="light">فاتح</option>
              <option value="dark">داكن</option>
              <option value="system">النظام</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-700 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">إشعارات المتصفح</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">لإعلامك عند اكتمال المهام في الخلفية</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{getPermissionStatusText()}</span>
              {notificationPermission === 'default' && (
                <button onClick={handleRequestNotificationPermission} className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700">
                  تفعيل
                </button>
              )}
            </div>
          </div>
        </section>

      </div>

      <div className="mt-8 pt-6 border-t dark:border-slate-700 flex justify-end items-center gap-4">
        {error && <p className="text-red-500 text-sm flex-grow">{error}</p>}
        {saveStatus && <p className="text-green-600 text-sm flex-grow">{saveStatus}</p>}
        <button id="primary-action-button" onClick={handleSave} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
          حفظ الإعدادات
        </button>
      </div>

    </div>
  );
};

export default Settings;