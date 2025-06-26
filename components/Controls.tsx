
import React from 'react';
import { MicrophoneIcon, StopCircleIcon, PlayCircleIcon, ExclamationCircleIcon, TrashIcon } from '@heroicons/react/24/solid';

interface ControlsProps {
  isInterviewActive: boolean;
  isListening: boolean;
  onToggleInterview: () => void;
  micError: string | null;
  hasMicPermission: boolean | null;
  onClearConversation: () => void;
  hasHistory: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
  isInterviewActive: isSessionActive,
  isListening, 
  onToggleInterview: onToggleSession,
  micError,
  hasMicPermission,
  onClearConversation,
  hasHistory
}) => {
  const getStatus = () => {
    if (hasMicPermission === false) {
      return <span className="flex items-center text-red-400"><ExclamationCircleIcon className="w-5 h-5 mr-1" />Mic permission denied.</span>;
    }
    if (micError && micError.includes('not supported')) {
      return <span className="flex items-center text-yellow-400"><ExclamationCircleIcon className="w-5 h-5 mr-1" />Mic not supported.</span>;
    }
    if (micError) {
      return <span className="flex items-center text-red-400"><ExclamationCircleIcon className="w-5 h-5 mr-1" />Mic error.</span>;
    }
    if (!isSessionActive) {
      return <span className="text-gray-400">Session paused or not started.</span>;
    }
    if (isListening) {
      return <span className="flex items-center text-green-400 animate-pulse-opacity"><MicrophoneIcon className="w-5 h-5 mr-1" />Listening for question...</span>;
    }
    return <span className="text-yellow-400">Processing or idle...</span>;
  };

  return (
    <div className="p-4 bg-gray-800 shadow-lg rounded-lg flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
      <div className="text-sm min-h-[20px] sm:mr-4">
        {getStatus()}
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={onClearConversation}
          disabled={!hasHistory}
          className={`px-6 py-3 font-semibold rounded-md shadow-md transition-all duration-150 ease-in-out
                      flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
                      bg-slate-600 hover:bg-slate-700 text-white focus:ring-slate-500
                      transform hover:scale-105
                      ${!hasHistory ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
                    `}
          aria-label="Clear conversation history"
        >
          <TrashIcon className="w-6 h-6" />
          <span>Clear History</span>
        </button>
        <button
          onClick={onToggleSession}
          disabled={(hasMicPermission === false || (micError && micError.includes('not supported'))) && !isSessionActive}
          className={`px-6 py-3 font-semibold rounded-md shadow-md transition-all duration-150 ease-in-out
                      flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
                      transform hover:scale-105
                      ${isSessionActive 
                        ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500' 
                        : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'}
                      ${((hasMicPermission === false || (micError && micError.includes('not supported'))) && !isSessionActive) ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
                    `}
          aria-label={isSessionActive ? "Stop the current session" : "Start a new session"}
        >
          {isSessionActive ? (
            <>
              <StopCircleIcon className="w-7 h-7" />
              <span>Stop Session</span>
            </>
          ) : (
            <>
              <PlayCircleIcon className="w-7 h-7" />
              <span>Start Session</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Controls;
