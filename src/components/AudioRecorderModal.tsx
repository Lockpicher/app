import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  Clock, 
  Volume2, 
  FileText 
} from 'lucide-react';
import { storage } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebookId?: string | null;
  onSaveVoiceNote: (data: {
    title: string;
    audioUrl: string;
    durationSeconds: number;
    transcription?: string;
    transcriptionStatus: 'none' | 'pending' | 'completed' | 'error';
    notebookId?: string | null;
  }) => Promise<void>;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isOpen,
  onClose,
  notebookId,
  onSaveVoiceNote
}) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  
  // Status states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [transcriptionStatus, setTranscriptionStatus] = useState<'none' | 'pending' | 'completed' | 'error'>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setRecordingState('idle');
      setElapsedSeconds(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setTitle(`Nota de voz ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
      setIsProcessing(false);
      setProcessingStep('');
      setTranscriptionText('');
      setTranscriptionStatus('none');
      setErrorMessage(null);
    } else {
      stopRecordingCleanup();
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error closing media recorder:', e);
      }
    }
  };

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingState('stopped');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setRecordingState('recording');

      // Start elapsed timer
      setElapsedSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accediendo al micrófono:', err);
      setErrorMessage('No se pudo acceder al micrófono: ' + (err.message || 'Verifica los permisos en tu navegador'));
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Upload to InsForge Storage and trigger ElevenLabs STT
  const handleSaveAndTranscribe = async () => {
    if (!audioBlob) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      // 1. Upload to Cloudflare R2 / Storage
      setProcessingStep('Subiendo audio a Cloudflare R2...');
      const fileName = `voice_${Date.now()}.${audioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`;
      const uploadResult = await r2Storage.uploadFile(audioBlob, 'audio', fileName);
      console.log('Audio subido exitosamente:', uploadResult.url);

      // 2. Trigger server-side transcription with ElevenLabs
      setProcessingStep('Transcribiendo con ElevenLabs Scribe IA...');
      let finalTranscription = '';
      let status: 'completed' | 'error' | 'none' = 'none';

      try {
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio_url: uploadResult.url,
            language_code: 'es'
          })
        });

        const transcribeData = await transcribeRes.json();

        if (transcribeRes.ok && transcribeData.text) {
          finalTranscription = transcribeData.text;
          status = 'completed';
          setTranscriptionText(finalTranscription);
          setTranscriptionStatus('completed');
        } else {
          status = 'error';
          setTranscriptionStatus('error');
          console.warn('ElevenLabs API:', transcribeData.error);
          setErrorMessage(transcribeData.error || 'No se pudo generar la transcripción automática.');
        }
      } catch (err: any) {
        status = 'error';
        setTranscriptionStatus('error');
        console.warn('Error llamando a endpoint de transcripción:', err);
        setErrorMessage('Servicio de transcripción no disponible temporalmente. El audio se guardó con éxito.');
      }

      // 3. Save the note in InsForge
      setProcessingStep('Guardando nota de voz en tu cuaderno...');
      await onSaveVoiceNote({
        title: title.trim() || 'Nota de voz',
        audioUrl: uploadResult.url,
        durationSeconds: elapsedSeconds,
        transcription: finalTranscription || undefined,
        transcriptionStatus: status,
        notebookId: notebookId || undefined
      });

      onClose();
    } catch (err: any) {
      console.error('Error guardando nota de voz:', err);
      setErrorMessage('Error al guardar: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#181824] border border-[#2d2d42] rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#252538] flex items-center justify-between bg-[#14141e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Grabadora de Voz & Transcripción</h3>
              <p className="text-[11px] text-gray-400">Impulsado por ElevenLabs Scribe STT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252538] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="px-6 py-2.5 bg-amber-950/60 border-b border-amber-800/60 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Note Title */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Título de la Nota de Voz
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Ideas sobre el nuevo lanzamiento..."
              className="w-full px-3 py-2 bg-[#121218] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-red-500 font-medium"
            />
          </div>

          {/* Recording Canvas */}
          <div className="p-8 bg-[#12121a] rounded-2xl border border-[#262638] flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Animated Pulses when recording */}
            {recordingState === 'recording' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-40 h-40 rounded-full bg-red-500/10 animate-ping" />
                <span className="w-56 h-56 rounded-full bg-red-500/5 animate-pulse" />
              </div>
            )}

            {/* Timer */}
            <div className="text-4xl font-mono font-bold text-white mb-3 tracking-wider">
              {formatTimer(elapsedSeconds)}
            </div>

            <p className="text-xs text-gray-400 mb-6">
              {recordingState === 'idle' && 'Presiona el botón para iniciar la grabación'}
              {recordingState === 'recording' && 'Grabando audio... Habla claramente'}
              {recordingState === 'paused' && 'Grabación pausada'}
              {recordingState === 'stopped' && 'Grabación lista para guardar y transcribir'}
            </p>

            {/* Audio Preview if stopped */}
            {recordingState === 'stopped' && audioUrl && (
              <div className="w-full mb-6">
                <audio controls src={audioUrl} className="w-full h-10 rounded-lg" />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4 relative z-10">
              {recordingState === 'idle' && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-900/40 transition transform hover:scale-105"
                  title="Iniciar Grabación"
                >
                  <Mic className="w-7 h-7" />
                </button>
              )}

              {recordingState === 'recording' && (
                <>
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="w-12 h-12 rounded-full bg-[#28283a] hover:bg-[#34344c] text-white flex items-center justify-center transition"
                    title="Pausar"
                  >
                    <Pause className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-900/40 transition transform hover:scale-105 animate-pulse"
                    title="Detener y Finalizar"
                  >
                    <Square className="w-6 h-6" />
                  </button>
                </>
              )}

              {recordingState === 'paused' && (
                <>
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition"
                    title="Reanudar Grabación"
                  >
                    <Play className="w-6 h-6 ml-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-12 h-12 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center transition"
                    title="Detener Grabación"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </>
              )}

              {recordingState === 'stopped' && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#252538] hover:bg-[#303046] text-gray-300 rounded-xl text-xs font-medium transition"
                  title="Grabar de nuevo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Grabar de nuevo
                </button>
              )}
            </div>
          </div>

          {/* Processing status banner */}
          {isProcessing && (
            <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-xl flex items-center gap-3 text-xs text-blue-200">
              <span className="w-3 h-3 rounded-full bg-blue-400 animate-ping" />
              <span>{processingStep}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#252538] flex items-center justify-between bg-[#14141e]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-400 hover:text-white rounded-xl transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveAndTranscribe}
            disabled={!audioBlob || isProcessing}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4" />
            {isProcessing ? 'Procesando...' : 'Guardar y Transcribir'}
          </button>
        </div>
      </div>
    </div>
  );
};
