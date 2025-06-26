
export interface ConversationTurn {
  id: string;
  utterance: string; // User's question
  answer: string | null; // AI's answer
  answerError: string | null; // Error fetching answer
  isProcessingAnswer: boolean;
}

export interface SpeechRecognitionHook {
  isListening: boolean;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  hasPermission: boolean | null;
  finalizedUtterance: string; // The utterance deemed complete after silence.
  clearFinalizedUtterance: () => void; // To reset after App processes it.
}
