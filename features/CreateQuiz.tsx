import React, { useState, useCallback, useRef } from 'react';
import { createQuiz, correctQuiz } from '../services/aiService';
import Spinner from '../components/Spinner';
import type { QuizQuestion, UserAnswer, QuizResult, QuestionType } from '../types';
import { useAppContext } from '../AppContext';
import { ApiLimitError } from '../services/aiService';
import FileUpload from '../components/FileUpload';
import { extractTextFromFile } from '../services/textExtractorService';
import * as notificationService from '../services/notificationService';

type Stage = 'config' | 'generating' | 'taking' | 'scoring' | 'results';
type QuizMode = 'chat' | 'file';

const CreateQuiz: React.FC = () => {
  const [stage, setStage] = useState<Stage>('config');
  const [quizMode, setQuizMode] = useState<QuizMode>('chat');
  
  // Config state
  const [file, setFile] = useState<File | null>(null);
  const [chatTopic, setChatTopic] = useState('');
  const [textContent, setTextContent] = useState('');
  const [numQuestions, setNumQuestions] = useState<string>('5');
  const [customNumQuestions, setCustomNumQuestions] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType | 'hybrid'>('hybrid');
  const [customInstructions, setCustomInstructions] = useState('');

  // Quiz state
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswer>({});
  const [results, setResults] = useState<{ score: number; results: QuizResult[] } | null>(null);
  const [unansweredError, setUnansweredError] = useState<number | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { setInterruptedTask } = useAppContext();
  
  const resetAll = () => {
    setStage('config');
    setQuizMode('chat');
    setFile(null);
    setChatTopic('');
    setTextContent('');
    setNumQuestions('5');
    setCustomNumQuestions('');
    setQuestionType('hybrid');
    setCustomInstructions('');
    setQuiz([]);
    setUserAnswers({});
    setResults(null);
    setIsLoading(false);
    setLoadingMessage('');
    setError('');
    setUnansweredError(null);
  };

  const handleFileSelect = async (files: File[]) => {
    const selectedFile = files?.[0];
    if (selectedFile) {
        const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!acceptedTypes.includes(selectedFile.type)) {
            setError('نوع الملف غير مدعوم. الرجاء اختيار PDF, DOCX, أو TXT.');
            return;
        }

        setFile(selectedFile);
        setIsLoading(true);
        setError('');
        
        try {
            const text = await extractTextFromFile(selectedFile, setLoadingMessage);
            if (!text.trim()) {
              throw new Error("الملف فارغ أو لا يحتوي على نص قابل للاستخراج.");
            }
            setTextContent(text);
        } catch (err: any) {
            setError(err.message);
            setFile(null);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }
  };

  const resumableGenerateQuiz = async (context: string, finalNumQuestions: number, qType: string, customInstr: string) => {
    setIsLoading(true);
    setLoadingMessage('يقوم الذكاء الاصطناعي بإنشاء الاختبار...');
    setStage('generating');

    try {
        if (isNaN(finalNumQuestions) || finalNumQuestions < 1) {
            throw new Error("الرجاء إدخال عدد صالح من الأسئلة.");
        }

        const result = await createQuiz(context, finalNumQuestions, qType, customInstr);
        if (result.quiz && result.quiz.length > 0) {
            setQuiz(result.quiz);
            questionRefs.current = Array(result.quiz.length).fill(null);
            setStage('taking');
            notificationService.notify('✅ اختبارك جاهز!', {
                body: `تم إنشاء اختبار من ${file ? `"${file.name}"` : `موضوع "${chatTopic}"`}.`,
            });
        } else {
            throw new Error('لم يتمكن الذكاء الاصطناعي من إنشاء اختبار. حاول مرة أخرى.');
        }
    } catch (err: any) {
        if (err instanceof ApiLimitError) {
            setInterruptedTask({
                serviceId: 'quiz',
                resume: () => resumableGenerateQuiz(context, finalNumQuestions, qType, customInstr),
                context: {} 
            });
        } else {
            setError(err.message);
            setStage('config');
             notificationService.notify('❌ فشل إنشاء الاختبار', {
                body: `حدث خطأ أثناء إنشاء الاختبار.`,
            });
        }
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const handleGenerateQuiz = async () => {
    setError('');
    const context = quizMode === 'file' ? textContent : chatTopic;
    if (!context.trim()) {
      setError(quizMode === 'file' ? 'الرجاء رفع ملف صالح أولاً.' : 'الرجاء إدخال موضوع للمحادثة.');
      return;
    }
    const finalNumQuestions = numQuestions === 'more' ? parseInt(customNumQuestions, 10) : parseInt(numQuestions, 10);
    resumableGenerateQuiz(context, finalNumQuestions, questionType, customInstructions);
  };

  const resumableSubmitAnswers = async (currentQuiz: QuizQuestion[], currentAnswers: UserAnswer) => {
    setIsLoading(true);
    setLoadingMessage('يقوم الذكاء الاصطناعي بتصحيح إجاباتك...');
    setStage('scoring');
    setError('');

    try {
        const result = await correctQuiz(currentQuiz, currentAnswers);
        setResults(result);
        setStage('results');
    } catch (err: any) {
        if (err instanceof ApiLimitError) {
            setInterruptedTask({
                serviceId: 'quiz',
                resume: () => resumableSubmitAnswers(currentQuiz, currentAnswers),
                context: {}
            });
            setStage('taking'); 
        } else {
            setError(err.message);
            setStage('taking');
        }
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }
  
  const handleAnswerChange = (questionIndex: number, answer: string) => {
    if (unansweredError === questionIndex) {
        setUnansweredError(null);
    }
    setUserAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };
  
  const handleSubmitAnswers = async () => {
    setUnansweredError(null);
    for (let i = 0; i < quiz.length; i++) {
        if (!userAnswers[i] || userAnswers[i].toString().trim() === '') {
            setUnansweredError(i);
            const element = document.getElementById(`question-container-${i}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
    resumableSubmitAnswers(quiz, userAnswers);
  };

  const renderQuestion = (q: QuizQuestion, index: number) => {
    const questionTitleId = `question-title-${index}`;
    return (
        <div id={`question-container-${index}`} ref={el => questionRefs.current[index] = el} data-question-index={index} className="scroll-mt-8">
            <h3 id={questionTitleId} className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">
                {`السؤال ${index + 1}: ${q.question}`}
            </h3>
            
            {q.type === 'multiple-choice' && (
                 <fieldset role="radiogroup" aria-labelledby={questionTitleId}>
                    <legend className="sr-only">{q.question}</legend>
                    <div className="space-y-3">
                        {q.options?.map((option, optIndex) => (
                            <label key={optIndex} className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600">
                                <input
                                    type="radio"
                                    name={`question-${index}`}
                                    value={option}
                                    className="ml-3"
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    checked={userAnswers[index] === option}
                                />
                                {option}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}
            {q.type === 'true-false' && (
                <fieldset role="radiogroup" aria-labelledby={questionTitleId}>
                    <legend className="sr-only">{q.question}</legend>
                    <div className="flex gap-4">
                        <label className="flex-1 p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-bold border-slate-300 dark:border-slate-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-slate-700 has-[:checked]:bg-green-100 dark:has-[:checked]:bg-green-900/50 has-[:checked]:border-green-600">
                            <input type="radio" name={`question-${index}`} value="صواب" className="sr-only" onChange={(e) => handleAnswerChange(index, e.target.value)} checked={userAnswers[index] === 'صواب'} />
                            صواب
                        </label>
                         <label className="flex-1 p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-bold border-slate-300 dark:border-slate-600 hover:border-red-500 hover:bg-red-50 dark:hover:bg-slate-700 has-[:checked]:bg-red-100 dark:has-[:checked]:bg-red-900/50 has-[:checked]:border-red-600">
                            <input type="radio" name={`question-${index}`} value="خطأ" className="sr-only" onChange={(e) => handleAnswerChange(index, e.target.value)} checked={userAnswers[index] === 'خطأ'} />
                            خطأ
                        </label>
                    </div>
                </fieldset>
            )}
            {q.type === 'open-ended' && (
                <div>
                    <textarea
                        id={`answer-${index}`}
                        rows={3}
                        value={userAnswers[index] || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        placeholder="اكتب إجابتك هنا..."
                        aria-labelledby={questionTitleId}
                    />
                </div>
            )}
            {unansweredError === index && <p role="alert" className="text-red-500 text-sm mt-2 font-semibold">الرجاء الإجابة على هذا السؤال للمتابعة.</p>}
        </div>
    );
  };

  const renderResult = (result: QuizResult, index: number) => {
    const resultColor = result.isCorrect ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    return (
        <div key={index} className={`p-4 border-b ${resultColor}`}>
            <h3 className="text-lg font-semibold mb-2">{index + 1}. {result.question}</h3>
            <p className="text-sm">
                <span className="font-bold">إجابتك: </span>
                <span className={result.isCorrect ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>
                    {result.userAnswer || 'لم تتم الإجابة'} {result.isCorrect ? '✅' : '❌'}
                    <span className="sr-only">{result.isCorrect ? '(إجابة صحيحة)' : '(إجابة خاطئة)'}</span>
                </span>
            </p>
            {!result.isCorrect && (
                <p className="text-sm mt-1">
                    <span className="font-bold">الإجابة الصحيحة: </span>
                    <span className="text-green-800 dark:text-green-300">{result.correctAnswer}</span>
                </p>
            )}
        </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg flex flex-col items-center justify-center h-96">
        <Spinner />
        <p className="mt-4 text-slate-600 dark:text-slate-300 font-semibold" aria-live="polite">{loadingMessage}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
    {stage === 'config' && (
      <div className="flex flex-col items-center max-w-3xl mx-auto">
        <div role="tablist" className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg mb-6">
            <button role="tab" aria-selected={quizMode === 'chat'} onClick={() => setQuizMode('chat')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${quizMode === 'chat' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                محادثة مباشرة
            </button>
             <button role="tab" aria-selected={quizMode === 'file'} onClick={() => setQuizMode('file')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${quizMode === 'file' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                رفع مستند
            </button>
        </div>

        {quizMode === 'chat' ? (
            <div className="w-full">
                <label htmlFor="chat-topic" className="block text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">اكتب موضوعًا لإنشاء اختبار عنه:</label>
                <textarea
                    id="chat-topic"
                    rows={4}
                    value={chatTopic}
                    onChange={(e) => setChatTopic(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    placeholder="مثال: تاريخ استكشاف الفضاء، أساسيات الطهي الإيطالي..."
                />
            </div>
        ) : (
            <div className="w-full">
                 <FileUpload
                    onFileSelect={handleFileSelect}
                    acceptedFileTypes=".pdf,.docx,.txt"
                    promptText={file ? file.name : 'اسحب وأفلت ملف (PDF, DOCX, TXT) هنا أو انقر للاختيار'}
                />
                {file && (
                     <div className="mt-4 w-full">
                        <label htmlFor="custom-instructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">تعليمات مخصصة للذكاء الاصطناعي:</label>
                        <textarea
                            id="custom-instructions"
                            rows={2}
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                            placeholder="مثال: ركز على التواريخ والأحداث الرئيسية، اجعل الأسئلة للمبتدئين..."
                            aria-describedby="instructions-help"
                        />
                         <p id="instructions-help" className="text-xs text-slate-500 dark:text-slate-400 mt-1">اكتب التعليمات الخاصة بمصدر الأسئلة.</p>
                     </div>
                )}
            </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 w-full">
            <div>
                 <label htmlFor="num-questions" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">عدد الأسئلة:</label>
                 <select id="num-questions" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800">
                     {[...Array(28)].map((_, i) => <option key={i+3} value={i+3}>{i+3}</option>)}
                     <option value="more">أكثر...</option>
                 </select>
                 {numQuestions === 'more' && (
                     <div className="mt-2">
                        <label htmlFor="custom-num-questions" className="sr-only">أدخل عدد الأسئلة</label>
                        <input
                            id="custom-num-questions"
                            type="number"
                            value={customNumQuestions}
                            onChange={(e) => setCustomNumQuestions(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                            placeholder="أدخل العدد"
                        />
                     </div>
                 )}
            </div>
             <div>
                 <label htmlFor="question-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">نوع الأسئلة:</label>
                 <select id="question-type" value={questionType} onChange={(e) => setQuestionType(e.target.value as any)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800">
                    <option value="hybrid">نمط مختلط</option>
                    <option value="multiple-choice">اختيار من متعدد</option>
                    <option value="true-false">صح أو خطأ</option>
                    <option value="open-ended">إجابة مفتوحة</option>
                 </select>
            </div>
        </div>
        
        <button
            id="primary-action-button"
            title="Cmd/Ctrl + Enter"
            onClick={handleGenerateQuiz}
            className="mt-8 w-full bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
            disabled={(quizMode === 'file' && !file) || (quizMode === 'chat' && !chatTopic)}
        >
            إنشاء الاختبار
        </button>
      </div>
    )}

    {stage === 'taking' && (
      <div className="w-full text-right">
        <h2 className="text-2xl font-bold mb-6 text-slate-700 dark:text-slate-200 text-center">الاختبار جاهز!</h2>
        <div className="space-y-8">
            {quiz.map((q, index) => (
                <div key={index} className="p-6 bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-700 rounded-xl">
                    {renderQuestion(q, index)}
                </div>
            ))}
            <button id="primary-action-button" title="Cmd/Ctrl + Enter" onClick={handleSubmitAnswers} className="w-full bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors">
            إرسال الإجابات
            </button>
        </div>
      </div>
    )}

    {stage === 'results' && results && (
      <div className="w-full text-right">
          <div className="text-center p-6 bg-blue-100 dark:bg-blue-900/50 rounded-lg mb-6" aria-live="assertive">
            <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200">نتيجتك النهائية: {results.score} / 100</h2>
          </div>
          <div className="space-y-2">
            {results.results.map(renderResult)}
          </div>
          <button onClick={resetAll} className="mt-8 w-full bg-slate-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-700 transition-colors">
              البدء من جديد
          </button>
      </div>
    )}

    {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
    </div>
  );
};

export default CreateQuiz;
