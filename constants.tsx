
import React from 'react';
import type { Service } from './types';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const PDF_SERVICES: Service[] = [
  {
    id: 'edit',
    title: 'تعديل PDF',
    description: 'قم بتعديل النصوص، تدوير الصفحات أو حذفها من ملفات PDF.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
    implemented: true,
  },
   {
    id: 'extract-text-from-pdf',
    title: 'استخراج النص من PDF',
    description: 'استخرج النصوص من ملفات PDF المصورة أو المعقدة باستخدام الذكاء الاصطناعي.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 12v-1h6v1"/><path d="M12 11v6"/><path d="M11 17h2"/></svg>,
    implemented: true,
  },
   {
    id: 'sign-pdf',
    title: 'توقيع PDF',
    description: 'أضف توقيعك الإلكتروني إلى أي ملف PDF بسهولة.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12.5"/><path d="m16 16-2.3 2.3a1 1 0 0 0 0 1.4l.7.7c.4.4 1 .4 1.4 0L22 14l-4.5-4.5-2.3 2.3a1 1 0 0 0 0 1.4l.7.7c.4.4 1 .4 1.4 0Z"/></svg>,
    implemented: true,
  },
  {
    id: 'merge',
    title: 'دمج PDF',
    description: 'اجمع عدة ملفات PDF في ملف واحد منظم.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7h14"/></svg>,
    implemented: true,
  },
  {
    id: 'split',
    title: 'تقسيم PDF',
    description: 'قسّم ملف PDF كبير إلى ملفات أصغر أو استخرج صفحات معينة.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V2m-7 10h14"/></svg>,
    implemented: true,
  },
  {
    id: 'compress',
    title: 'ضغط PDF',
    description: 'قلل حجم ملفات PDF لتسهيل مشاركتها وتخزينها.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7-4-4-7 7"/></svg>,
    implemented: true,
  },
  {
    id: 'image-to-pdf',
    title: 'صور إلى PDF',
    description: 'حوّل صور JPG و PNG إلى ملف PDF واحد.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
    implemented: true,
  },
  {
    id: 'pdf-to-image',
    title: 'PDF إلى صور',
    description: 'حوّل صفحات PDF إلى صور عالية الجودة.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m10 14-2 2 4 4 4-4-2-2"/></svg>,
    implemented: true,
  },
  {
    id: 'protect',
    title: 'حماية PDF',
    description: 'أضف كلمة مرور لملفاتك أو أزلها.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    implemented: true,
  },
];

export const PPT_SERVICES: Service[] = [
    {
        id: 'analyze-pptx',
        title: 'تحليل وتلخيص',
        description: 'لخص العرض التقديمي واستخرج الصور والنصوص منه.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M10 12h4"/><path d="M12 10v4"/></svg>,
        implemented: true,
    },
    {
        id: 'generate-pptx',
        title: 'إنشاء عرض تقديمي',
        description: 'أنشئ عروضًا تقديمية من نصوص أو موضوعات بالذكاء الاصطناعي.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="m9 18 3-3-3-3"/></svg>,
        implemented: true,
    }
];

export const WORD_SERVICES: Service[] = [
    {
        id: 'word-assistant',
        title: 'مساعد Word الذكي',
        description: 'دردش مع مستندك، لخص المحتوى، أعد صياغة الفقرات، واستخرج المعلومات.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9h4"/></svg>,
        implemented: true,
    },
    {
        id: 'word-to-pdf',
        title: 'Word إلى PDF',
        description: 'حوّل مستندات DOCX إلى ملفات PDF قابلة للمشاركة.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-7.5a2.5 2.5 0 0 1 5 0V18"/><path d="M12 18H7.5a2.5 2.5 0 1 1 0-5H12"/><path d="m19 15-2-2-2 2"/></svg>,
        implemented: true,
    },
    {
        id: 'pdf-to-word',
        title: 'PDF إلى Word',
        description: 'استخرج النصوص من PDF وحوّلها إلى مستند DOCX.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 15v-5a2.5 2.5 0 1 0-5 0v5"/><path d="M12 15H9.5a2.5 2.5 0 1 1 0-5H12"/><path d="m7 12 2 2 2-2"/></svg>,
        implemented: true,
    },
];


export const SERVICES: Service[] = [
  {
    id: 'summarize',
    title: 'تلخيص المستندات',
    description: 'استخرج النقاط الرئيسية من مستنداتك الطويلة بذكاء.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
    implemented: true,
  },
  {
    id: 'live-assistant',
    title: 'المساعد الصوتي',
    description: 'تحدث مباشرة مع مستنداتك بصوت طبيعي باستخدام Gemini Live.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    implemented: true,
  },
  {
    id: 'quiz',
    title: 'إنشاء اختبارات',
    description: 'حوّل أي مستند أو موضوع إلى اختبار تفاعلي.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18h.01"/><path d="M12 15h.01"/><path d="M12 12h.01"/><path d="M12 9h.01"/></svg>,
    implemented: true,
  },
  {
    id: 'correct-text',
    title: 'تصحيح النصوص',
    description: 'صحح الأخطاء الإملائية والنحوية في نصوصك العربية بدقة.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 11 4 4L22 12"/></svg>,
    implemented: true,
  },
    {
    id: 'view',
    title: 'عرض وتحليل المستندات',
    description: 'اعرض مستنداتك واستخرج جدول محتويات ذكي تلقائياً.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
    implemented: true,
  },
  {
    id: 'ocr',
    title: 'استخراج النص من الصور',
    description: 'استخرج النصوص من ملفات الصور مباشرة مثل PNG و JPG.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05-9.19 22.31a1.25 1.25 0 0 1-1.77 0l-4.48-4.48a1.25 1.25 0 0 1 0-1.77l11.25-11.25a.25.25 0 0 1 .35 0l4.13 4.13a.25.25 0 0 1 0 .35Z"/><path d="m14 7 3 3"/></svg>,
    implemented: true,
  },
   {
    id: 'pdf-tools',
    title: 'أدوات PDF',
    description: 'مجموعة شاملة لتعديل، تحويل، وتنظيم ملفات PDF.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12.4 20.9a2 2 0 0 1-2.2-2.2l1.1-4.3-1.6-1.6a2 2 0 0 1 0-2.8l2.8-2.8a2 2 0 0 1 2.8 0l1.6 1.6 4.3-1.1a2 2 0 0 1 2.2 2.2l-1.1 4.3-1.6 1.6a2 2 0 0 1-2.8 0l-2.8-2.8a2 2 0 0 1 0-2.8Z"></path></svg>,
    implemented: true,
  },
   {
    id: 'word-tools',
    title: 'أدوات Word',
    description: 'حلل مستندات Word، لخصها، وتحدث معها باستخدام الذكاء الاصطناعي.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9h4"/></svg>,
    implemented: true,
  },
   {
    id: 'ppt-tools',
    title: 'أدوات PowerPoint',
    description: 'لخص العروض، استخرج الصور، وأنشئ عروضاً تقديمية جديدة.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M10 12h4"/><path d="M12 10v4"/></svg>,
    implemented: true,
  },
  {
    id: 'excel-tools',
    title: 'أدوات Excel',
    description: 'حلل البيانات بالذكاء الاصطناعي، اشرح الصيغ، وصدر الجداول.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h8"/></svg>,
    implemented: true,
  },
    {
    id: 'library',
    title: 'المكتبة',
    description: 'اعرض وأدر مستنداتك المحفوظة والمحللة.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
    implemented: true,
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    description: 'قم بإدارة إعدادات التطبيق ومفاتيح API الخاصة بك.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    implemented: true,
  }
];
