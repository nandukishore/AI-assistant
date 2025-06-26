
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationTurn } from './types';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import { generateAnswerStream } from './services/geminiService';
import Controls from './components/Controls';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import { SparklesIcon, UserIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import { QuestionMarkCircleIcon as QuestionMarkCircleIconSolid, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { UTTERANCE_SILENCE_TIMEOUT_MS } from './constants';

const App: React.FC = () => {
  const [apiKeyVerified, setApiKeyVerified] = useState<boolean | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    isListening,
    interimTranscript,
    finalizedUtterance,
    clearFinalizedUtterance,
    startListening,
    stopListening,
    error: speechError,
    hasPermission: micPermission,
  } = useSpeechRecognition({ utteranceSilenceTimeoutMs: UTTERANCE_SILENCE_TIMEOUT_MS });

  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof process.env.API_KEY === 'string' && process.env.API_KEY.trim() !== '') {
      setApiKeyVerified(true);
    } else {
      setApiKeyVerified(false);
      setGlobalError("Gemini API key is not configured. Please set the API_KEY environment variable.");
    }
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, interimTranscript]);

  const handleToggleSession = useCallback(() => {
    if (!apiKeyVerified) {
      setGlobalError("Cannot start session: API key not configured.");
      return;
    }
    if (micPermission === false) { 
      setGlobalError("Cannot start session: Microphone permission denied. Please enable it in browser settings.");
      return;
    }
     if (micPermission === null && speechError && speechError.includes('not supported')) {
      setGlobalError("Cannot start session: Microphone not supported by browser.");
      return;
    }

    setIsSessionActive(prev => {
      const nextState = !prev;
      if (nextState) {
        setGlobalError(null); 
        startListening();
      } else {
        stopListening();
      }
      return nextState;
    });
  }, [apiKeyVerified, startListening, stopListening, micPermission, speechError]);

  const handleClearConversation = useCallback(() => {
    if (window.confirm("Are you sure you want to clear the entire conversation history? This action cannot be undone.")) {
      setConversation([]);
    }
  }, []);

  useEffect(() => {
    if (finalizedUtterance && isSessionActive) {
      const newTurnId = Date.now().toString();
      const newTurn: ConversationTurn = {
        id: newTurnId,
        utterance: finalizedUtterance,
        answer: '', 
        answerError: null,
        isProcessingAnswer: true,
      };
      setConversation(prev => [...prev, newTurn]);
      clearFinalizedUtterance(); 

      const processStream = async () => {
        try {
          for await (const chunk of generateAnswerStream(finalizedUtterance)) {
            const textChunk = chunk.text;
            if (textChunk) {
              setConversation(prev =>
                prev.map(turn =>
                  turn.id === newTurnId ? { ...turn, answer: (turn.answer || '') + textChunk } : turn
                )
              );
            }
          }
        } catch (err) {
          console.error("Answer generation stream error:", err);
          const errorMessage = err instanceof Error ? err.message : "Failed to get answer stream.";
          setConversation(prev =>
            prev.map(turn =>
              turn.id === newTurnId
                ? { ...turn, answerError: errorMessage, isProcessingAnswer: false }
                : turn
            )
          );
        } finally {
          setConversation(prev =>
            prev.map(turn =>
              turn.id === newTurnId ? { ...turn, isProcessingAnswer: false } : turn
            )
          );
        }
      };

      processStream();
    }
  }, [finalizedUtterance, isSessionActive, clearFinalizedUtterance]);


  if (apiKeyVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="p-4 bg-gray-800 shadow-xl border-b-2 border-gray-700/70">
        <div className="flex items-center justify-center">
          <QuestionMarkCircleIconSolid className="w-10 h-10 mr-3 text-yellow-400" />
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 text-center">
            AI Query Assistant
          </h1>
          {apiKeyVerified !== null && (
            apiKeyVerified ? (
              <CheckCircleIcon 
                className="w-7 h-7 ml-3 text-green-500" 
                aria-label="API Key configured" 
                title="API Key configured"
              />
            ) : (
              <XCircleIcon 
                className="w-7 h-7 ml-3 text-red-500" 
                aria-label="API Key missing or invalid" 
                title="API Key missing or invalid"
              />
            )
          )}
        </div>
      </header>

      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6">
        {globalError && <ErrorMessage message={globalError} />}
        
        <Controls 
          isInterviewActive={isSessionActive}
          isListening={isListening}
          onToggleInterview={handleToggleSession}
          micError={speechError}
          hasMicPermission={micPermission}
          onClearConversation={handleClearConversation}
          hasHistory={conversation.length > 0}
        />

        {apiKeyVerified === false && !globalError && (
             <ErrorMessage message="Gemini API key is not configured. Please set the API_KEY environment variable." />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div 
            className={`bg-gray-800 p-6 rounded-lg shadow-xl h-48 flex flex-col transition-all duration-300 ease-in-out
                        ${isSessionActive && isListening ? 'ring-2 ring-sky-500 animate-pulse' : 'ring-1 ring-gray-700'}`}
          >
            <h2 className="text-xl font-semibold text-sky-300 mb-3 flex items-center">
              <UserIcon className="w-6 h-6 mr-2" /> Your Current Question
            </h2>
            {isSessionActive && isListening && interimTranscript && (
              <p className="text-lg text-gray-300 italic flex-grow overflow-y-auto">{interimTranscript}</p>
            )}
            {isSessionActive && isListening && !interimTranscript && (
              <p className="text-lg text-gray-500 italic flex-grow">Listening for your question...</p>
            )}
            {!isSessionActive && conversation.length === 0 && (
                 <p className="text-lg text-gray-500 italic flex-grow">Click 'Start Session' above and speak your mind. I'm ready to listen!</p>
            )}
             {!isSessionActive && conversation.length > 0 && (
                 <p className="text-lg text-gray-500 italic flex-grow">Session paused. Review your Q&A log or click 'Start Session' for more.</p>
            )}
            {isSessionActive && !isListening && !interimTranscript && conversation.find(t => t.isProcessingAnswer && t.utterance === finalizedUtterance) && (
              <p className="text-lg text-gray-400 italic flex-grow">Processing: "{finalizedUtterance}"</p>
            )}
             {isSessionActive && !isListening && !interimTranscript && !conversation.find(t => t.isProcessingAnswer && t.utterance === finalizedUtterance) && (
              <p className="text-lg text-gray-500 italic flex-grow">Session active. Waiting for your next question or processing previous.</p>
            )}
          </div>

          <div className="bg-gray-800 p-0 rounded-lg shadow-xl lg:row-span-2 max-h-[calc(100vh-320px)] lg:max-h-[calc(100vh-280px)] overflow-y-auto" 
               aria-live="polite" aria-atomic="false">
             <h2 className="text-xl font-semibold text-sky-300 mb-0 sticky top-0 bg-gray-800/80 backdrop-blur-sm py-3 px-6 z-10 border-b border-gray-700/50">
                Q&A Log
             </h2>
            {conversation.length === 0 && !isSessionActive && apiKeyVerified && (
              <div className="text-center p-8 md:p-10 m-4 bg-slate-700/60 rounded-xl shadow-2xl">
                <SparklesIcon className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 text-yellow-400 opacity-90" />
                <h3 className="text-2xl md:text-3xl font-bold text-gray-100 mb-3">
                  Welcome!
                </h3>
                <p className="text-md md:text-lg text-sky-200 mb-4 md:mb-6">
                  Click "Start Session" to begin your voice conversation.
                </p>
                <p className="text-sm text-gray-400">
                  Ensure your microphone is enabled. Your queries and my responses will appear here.
                </p>
              </div>
            )}
             {conversation.length === 0 && isSessionActive && (
              <p className="text-gray-500 p-6">Your questions and AI answers will appear here.</p>
            )}
            <div className="space-y-5 p-4 md:p-6"> {/* Increased spacing between turns */}
              {conversation.map(turn => (
                <div key={turn.id} className="animate-turn-in space-y-3">
                  {/* User Question Bubble */}
                  <div className="p-4 bg-sky-800/70 rounded-lg shadow-md border border-sky-700/50">
                    <h3 className="text-md font-semibold text-sky-100 flex items-center mb-1.5">
                      <UserIcon className="w-5 h-5 mr-2.5 flex-shrink-0" /> You:
                    </h3>
                    <p className="text-gray-100 whitespace-pre-wrap ml-7">{turn.utterance}</p>
                  </div>

                  {/* AI Answer Bubble */}
                  <div className="p-4 bg-slate-700/80 rounded-lg shadow-md border border-slate-600/50">
                    <h3 className="text-md font-semibold text-yellow-200 flex items-center mb-1.5">
                      <ChatBubbleBottomCenterTextIcon className="w-5 h-5 mr-2.5 flex-shrink-0" /> AI:
                    </h3>
                    <div className="ml-7">
                      {turn.isProcessingAnswer && !turn.answer && <div className="py-2"><LoadingSpinner size="sm" /></div>}
                      {turn.answerError && <ErrorMessage message={turn.answerError} />}
                      {turn.answer && <p className="text-gray-200 whitespace-pre-wrap">{turn.answer}</p>}
                      {turn.isProcessingAnswer && turn.answer && <span className="text-xs text-gray-400 italic"> (generating...)</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={conversationEndRef} /> 
            </div>
          </div>
        </div>
      </main>
      <footer className="p-4 bg-gray-800 text-center text-sm text-gray-400 border-t-2 border-gray-700/70">
        Powered by Gemini API & React. AI responses may not always be accurate. Verify critical information.
      </footer>
    </div>
  );
};

export default App;