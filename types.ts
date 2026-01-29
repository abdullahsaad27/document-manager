import React from 'react';

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  implemented: boolean;
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'open-ended';

export interface QuizQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
}

export interface UserAnswer {
  [questionIndex: number]: string;
}

export interface QuizResult {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface StructuredContentItem {
  type: 'heading' | 'paragraph';
  content: string;
  level?: number;
}

export interface LibraryDocument {
  id?: number;
  name: string;
  fileType: string;
  content: StructuredContentItem[];
  createdAt: Date;
  documentType?: 'original' | 'summary' | 'analysis';
  sourceFileName?: string;
}


export interface TextItem {
  id: string;
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
}

export type TextEdit = {
  [textItemId: string]: string;
};

export type Rotation = 0 | 90 | 180 | 270;

export interface PageState {
  thumbnailUrl: string;
  rotation: Rotation;
  isDeleted: boolean;
  textItems: TextItem[];
  edits: TextEdit;
  hasText: boolean;
  formTextEdit?: string; // For form-based editing
}

// New types for settings
export type AiProvider = 'google' | 'openai' | 'openrouter' | 'mistral';
export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  provider: AiProvider;
  apiKey: string; // For OpenAI/OpenRouter
  mistralApiKey?: string; // New field for Mistral
  googleApiKey: string; // For user-provided Google Key
  model: string;
  theme: Theme;
  pdfChunkSize: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
}

export interface GoogleModel {
  id: string;
  name: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  chart?: any; // For chart.js config
}

// FIX: Define StagedFile here to be globally accessible.
// Allow staged file to carry extra context for complex navigation
export interface StagedFile extends File {
  context?: any;
}

export interface Template {
  id: string;
  name: string;
  type: 'summary' | 'correction';
  prompt: string;
}