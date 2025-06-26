
import { useState, useEffect, useCallback, useRef } from 'react';
import { SpeechRecognitionHook } from '../types';
import { UTTERANCE_SILENCE_TIMEOUT_MS } from '../constants';

const getSpeechRecognition = (): SpeechRecognitionStatic | null => {
  if (typeof window !== 'undefined') {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  return null;
};

interface UseSpeechRecognitionProps {
  utteranceSilenceTimeoutMs?: number;
}

const useSpeechRecognition = (
  { utteranceSilenceTimeoutMs = UTTERANCE_SILENCE_TIMEOUT_MS }: UseSpeechRecognitionProps = {}
): SpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalizedUtterance, setFinalizedUtterance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const manualStopRef = useRef<boolean>(false);
  const currentUtteranceRef = useRef<string>('');
  const utteranceFinalizationTimeoutRef = useRef<number | null>(null);

  const clearFinalizedUtterance = useCallback(() => {
    setFinalizedUtterance('');
  }, []);

  const processCurrentUtterance = useCallback(() => {
    if (currentUtteranceRef.current.trim()) {
      setFinalizedUtterance(currentUtteranceRef.current.trim());
      currentUtteranceRef.current = '';
      setInterimTranscript(''); // Clear interim transcript as current utterance is finalized
    }
    if (utteranceFinalizationTimeoutRef.current) {
      clearTimeout(utteranceFinalizationTimeoutRef.current);
      utteranceFinalizationTimeoutRef.current = null;
    }
  }, []);
  
  const initializeRecognition = useCallback(() => {
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser.');
      setHasPermission(false);
      return null;
    }

    const recognitionInstance: SpeechRecognition = new SpeechRecognitionAPI();
    recognitionInstance.continuous = true; // Key change for continuous listening
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onstart = () => {
      setIsListening(true);
      setError(null);
      // No need to set hasPermission here, it's checked/set elsewhere earlier
    };

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalSegmentThisEvent = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalSegmentThisEvent += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      setInterimTranscript(interim);

      if (finalSegmentThisEvent) {
        currentUtteranceRef.current += finalSegmentThisEvent;
      }

      // If interim results are coming, or final results just came, reset the silence timer
      if (interim || finalSegmentThisEvent) {
        if (utteranceFinalizationTimeoutRef.current) {
          clearTimeout(utteranceFinalizationTimeoutRef.current);
        }
        utteranceFinalizationTimeoutRef.current = window.setTimeout(() => {
          processCurrentUtterance();
        }, utteranceSilenceTimeoutMs);
      }
    };

    recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        setError(null); 
        // 'no-speech' will lead to 'onend'. If continuous, onend will try to restart.
        // We might still want to finalize any buffered utterance if 'no-speech' occurs after some speech.
        // However, the general timeout mechanism should cover this.
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission denied. Please enable microphone access in your browser settings.');
        setHasPermission(false);
        manualStopRef.current = true; // Prevent restart attempts if permission is the issue
        processCurrentUtterance(); // Process anything captured before permission error
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false); // Recognition has stopped or failed to start
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
      
      // If recognition ends (for any reason other than manual stop), and there's pending utterance, process it.
      if (!manualStopRef.current) {
        processCurrentUtterance();
      }
      
      // If not a manual stop and permission is granted, try to restart to maintain continuous session
      if (!manualStopRef.current && hasPermission !== false && recognitionRef.current) {
        try {
          // Only restart if not already trying to stop.
          // This check might be redundant if manualStopRef is managed well.
          if (!manualStopRef.current) { 
             recognitionRef.current.start();
          }
        } catch (e) {
          // This catch is for errors during .start() itself.
          // 'onstart' will set isListening to true if successful.
           if (event && (event as SpeechRecognitionErrorEvent).error !== 'aborted') { // Avoid error if aborted by stopListening
            console.warn("Could not restart recognition on 'onend':", e);
            // setError('Speech recognition session ended and could not restart.');
           }
        }
      }
    };
    
    return recognitionInstance;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, utteranceSilenceTimeoutMs, processCurrentUtterance]);


  useEffect(() => {
    if (hasPermission === null && !recognitionRef.current) {
        // Attempt to initialize early if permission state is unknown, to potentially trigger browser checks or pre-warm.
        // This primarily helps in setting up the instance. Actual permission check/prompt often happens on first .start().
        const rec = initializeRecognition();
        if (rec) {
            recognitionRef.current = rec;
        }
    }
    
    return () => {
      if (recognitionRef.current) {
        manualStopRef.current = true; // Ensure it's marked as manual stop for cleanup
        recognitionRef.current.onresult = null; // Detach handlers
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (utteranceFinalizationTimeoutRef.current) {
        clearTimeout(utteranceFinalizationTimeoutRef.current);
      }
    };
  }, [initializeRecognition, hasPermission]);


  const startListening = useCallback(() => {
    manualStopRef.current = false;
    currentUtteranceRef.current = ''; // Clear any previous utterance
    setInterimTranscript('');
    clearFinalizedUtterance(); // Clear any previously finalized utterance from state

    if (!recognitionRef.current) {
        const rec = initializeRecognition();
        if (rec) {
            recognitionRef.current = rec;
        } else {
            setError('Speech recognition could not be initialized.');
            return;
        }
    }
      
    if (recognitionRef.current && !isListening) {
      if (hasPermission === false) {
        setError('Cannot start listening: Microphone permission was denied.');
        return;
      }
      try {
        recognitionRef.current.start();
      } catch (e) {
        // This error can happen if .start() is called while it's already starting or in an invalid state
        if (e instanceof DOMException && e.name === 'InvalidStateError') {
             console.warn("Speech recognition start attempted in an invalid state.", e);
             // It might already be listening or trying to, so setIsListening(true) in onstart will handle it.
        } else {
            setError('Failed to start speech recognition.');
            console.error("Error starting recognition:", e);
        }
      }
    }
  }, [isListening, clearFinalizedUtterance, hasPermission, initializeRecognition]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    if (utteranceFinalizationTimeoutRef.current) {
      clearTimeout(utteranceFinalizationTimeoutRef.current);
      utteranceFinalizationTimeoutRef.current = null;
    }
    // Process any remaining utterance before stopping
    processCurrentUtterance();

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    setIsListening(false); // Explicitly set, as onend might not fire immediately or if already stopped.
  }, [isListening, processCurrentUtterance]);

  useEffect(() => {
    if (hasPermission === null) {
      const SpeechRecognitionAPI = getSpeechRecognition();
      if (!SpeechRecognitionAPI) {
        setHasPermission(false);
        setError('Speech recognition is not supported in this browser.');
      } else if (navigator.permissions) {
        navigator.permissions.query({ name: 'microphone' as PermissionName }).then(permissionStatus => {
          setHasPermission(permissionStatus.state === 'granted');
          if (permissionStatus.state === 'denied') {
            setError('Microphone permission denied. Please enable microphone access in your browser settings.');
          }
          permissionStatus.onchange = () => {
            const newPermissionState = permissionStatus.state === 'granted';
            setHasPermission(newPermissionState);
             if (!newPermissionState) {
                setError('Microphone permission denied. Please enable microphone access in your browser settings.');
                // If permission is revoked while listening, stop the session.
                if (isListening) stopListening(); 
             } else {
                setError(null); 
             }
          };
        }).catch(() => {
            // Fallback: permission status will be known after first startListening attempt.
        });
      }
    }
  }, [hasPermission, isListening, stopListening]);


  return { 
    isListening, 
    interimTranscript, 
    finalizedUtterance,
    clearFinalizedUtterance,
    startListening, 
    stopListening, 
    error, 
    hasPermission,
  };
};

export default useSpeechRecognition;
