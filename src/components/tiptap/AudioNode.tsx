import React, { useState, useEffect, useRef } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Download, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  Music, 
  Loader2,
  FastForward
} from 'lucide-react';
import { r2Storage } from '../../lib/r2Client';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audioNode: {
      setAudioNode: (options: {
        src: string;
        title?: string;
        duration?: number;
        fileId?: string;
        r2Key?: string;
        mimeType?: string;
        size?: number;
      }) => ReturnType;
    };
  }
}

/**
 * Formats seconds into mm:ss
 */
function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format bytes into human readable size
 */
function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * React NodeView for the embedded Audio Player in TipTap
 */
export const AudioPlayerNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor
}) => {
  const { src, title = 'Nota de voz', duration = 0, size, mimeType } = node.attrs;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(title);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const instanceIdRef = useRef(`audio_${Math.random().toString(36).substring(2, 9)}`);

  // Sync title changes from node attributes
  useEffect(() => {
    setEditTitleValue(title);
  }, [title]);

  // Sync duration if loaded
  useEffect(() => {
    if (duration && duration > 0 && totalDuration === 0) {
      setTotalDuration(duration);
    }
  }, [duration, totalDuration]);

  // Handle global broadcast to pause this player if another audio starts
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail && customEvent.detail.id !== instanceIdRef.current) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    };

    window.addEventListener('secondbrain-audio-play', handleGlobalPlay);
    return () => {
      window.removeEventListener('secondbrain-audio-play', handleGlobalPlay);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !src) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Broadcast that this instance is playing so others pause
      window.dispatchEvent(
        new CustomEvent('secondbrain-audio-play', {
          detail: { id: instanceIdRef.current }
        })
      );

      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setHasError(false);
          })
          .catch((err) => {
            console.warn('Audio play failed:', err);
            setIsPlaying(false);
            setHasError(true);
            setErrorMessage('No se pudo reproducir este archivo de audio.');
          });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || isDraggingProgress) return;
    setCurrentTime(audioRef.current.currentTime);
    if (audioRef.current.duration && isFinite(audioRef.current.duration) && totalDuration !== audioRef.current.duration) {
      setTotalDuration(audioRef.current.duration);
      if (!duration || Math.abs(duration - audioRef.current.duration) > 1) {
        updateAttributes({ duration: Math.round(audioRef.current.duration) });
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (dur && isFinite(dur) && dur > 0) {
      setTotalDuration(dur);
      if (!duration || Math.abs(duration - dur) > 1) {
        updateAttributes({ duration: Math.round(dur) });
      }
    }
    setHasError(false);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleAudioError = () => {
    setIsPlaying(false);
    setHasError(true);
    setErrorMessage('Formato de audio incompatible o enlace no disponible.');
  };

  // Seek on progress bar click / drag
  const seekToPosition = (clientX: number) => {
    if (!progressBarRef.current || !audioRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const effectiveDur = totalDuration > 0 ? totalDuration : (audioRef.current.duration || 0);
    if (effectiveDur > 0) {
      const newTime = pct * effectiveDur;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingProgress(true);
    seekToPosition(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      seekToPosition(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleProgressBarTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches && e.touches[0]) {
      setIsDraggingProgress(true);
      seekToPosition(e.touches[0].clientX);

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (moveEvent.touches && moveEvent.touches[0]) {
          seekToPosition(moveEvent.touches[0].clientX);
        }
      };

      const handleTouchEnd = () => {
        setIsDraggingProgress(false);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };

      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (newVal: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = newVal;
    setVolume(newVal);
    if (newVal === 0) {
      setIsMuted(true);
      audioRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      audioRef.current.muted = false;
    }
  };

  const cyclePlaybackRate = () => {
    if (!audioRef.current) return;
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const handleSaveTitle = () => {
    const finalTitle = editTitleValue.trim() || 'Nota de voz';
    updateAttributes({ title: finalTitle });
    setIsEditingTitle(false);
  };

  const handleKeyDownTitle = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditTitleValue(title);
      setIsEditingTitle(false);
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsReplacing(true);
      setHasError(false);
      const res = await r2Storage.uploadFile(file, 'voice-notes');
      updateAttributes({
        src: res.url,
        r2Key: res.r2Key,
        title: file.name,
        size: res.size,
        mimeType: res.mime
      });
      setCurrentTime(0);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.src = res.url;
        audioRef.current.load();
      }
    } catch (err: any) {
      console.error('Error replacing audio:', err);
      setHasError(true);
      setErrorMessage('Error al subir el nuevo archivo de audio: ' + (err.message || 'Error de red'));
    } finally {
      setIsReplacing(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0;
  const isEditable = editor?.isEditable ?? true;

  // Wave bar count & animation
  const waveBars = [
    30, 60, 45, 80, 55, 95, 70, 40, 85, 65, 90, 50, 75, 60, 85, 45, 90, 70, 55, 35
  ];

  return (
    <NodeViewWrapper className="audio-player-wrapper my-4">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        className="hidden"
      />

      {/* Hidden file input for replacing audio */}
      <input
        type="file"
        ref={replaceInputRef}
        accept="audio/*"
        onChange={handleReplaceFile}
        className="hidden"
      />

      {/* Main Player Container */}
      <div
        contentEditable={false}
        className={`group relative rounded-2xl bg-gradient-to-r from-[#171725] via-[#1c1c2e] to-[#161624] border ${
          selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-[#2d2d44] hover:border-indigo-500/40'
        } p-3.5 sm:p-4 shadow-lg transition-all duration-200 select-none text-white`}
      >
        {/* Error notification banner if audio failed to load */}
        {hasError && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage || 'No se pudo reproducir este archivo de audio.'}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setHasError(false);
                  if (audioRef.current) {
                    audioRef.current.load();
                  }
                }}
                className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium transition"
              >
                Reintentar
              </button>
              {isEditable && (
                <button
                  type="button"
                  onClick={() => replaceInputRef.current?.click()}
                  className="px-2 py-1 rounded bg-[#252538] hover:bg-[#2d2d44] text-[11px] font-medium transition"
                >
                  Reemplazar
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4">
          {/* 1. Play / Pause Circular Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!src || isReplacing}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg transition transform active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30 ring-2 ring-amber-400/50'
                : 'bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/30'
            } disabled:opacity-50`}
            title={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
          >
            {isReplacing ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* 2. Middle Body: Title, Equalizer, Scrubber & Timers */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* Top row: Title + Animated Visualizer + Durations */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={handleKeyDownTitle}
                      autoFocus
                      className="px-2 py-0.5 rounded bg-[#101018] border border-indigo-500/70 text-xs sm:text-sm text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                      title="Guardar nombre"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitleValue(title);
                        setIsEditingTitle(false);
                      }}
                      className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Music className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span
                      onClick={() => isEditable && setIsEditingTitle(true)}
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        isEditable ? 'cursor-pointer hover:text-indigo-300 transition' : ''
                      }`}
                      title={isEditable ? 'Haz clic para renombrar esta nota de voz' : title}
                    >
                      {title}
                    </span>
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => setIsEditingTitle(true)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-white transition"
                        title="Renombrar nota de voz"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    {size ? (
                      <span className="hidden md:inline-block text-[10px] text-gray-500 bg-[#252538] px-1.5 py-0.5 rounded">
                        {formatBytes(size)}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Animated Sound Equalizer Waves */}
              <div className="hidden sm:flex items-center gap-0.5 h-4 px-2 shrink-0">
                {waveBars.map((baseH, idx) => {
                  const animStyle = isPlaying
                    ? {
                        height: `${Math.max(20, Math.min(100, baseH * (0.4 + 0.6 * Math.sin((idx * 2) + currentTime * 8))))}%`,
                        transition: 'height 0.1s ease'
                      }
                    : {
                        height: `${baseH * 0.35}%`,
                        transition: 'height 0.3s ease'
                      };
                  return (
                    <span
                      key={idx}
                      style={animStyle}
                      className={`w-[2.5px] rounded-full ${
                        isPlaying
                          ? 'bg-gradient-to-t from-indigo-500 to-cyan-400'
                          : 'bg-[#3b3b55]'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Time display: current / total */}
              <div className="text-[11px] sm:text-xs font-mono text-gray-400 shrink-0">
                <span className={isPlaying ? 'text-indigo-300 font-semibold' : 'text-gray-300'}>
                  {formatAudioTime(currentTime)}
                </span>
                <span className="text-gray-600 mx-1">/</span>
                <span>{formatAudioTime(totalDuration)}</span>
              </div>
            </div>

            {/* Bottom row: Interactive scrubber progress bar */}
            <div
              ref={progressBarRef}
              onMouseDown={handleProgressBarMouseDown}
              onTouchStart={handleProgressBarTouchStart}
              className="relative w-full h-2.5 sm:h-3 rounded-full bg-[#27273d] hover:bg-[#2e2e48] cursor-pointer transition flex items-center group/bar"
              title="Haz clic o arrastra para desplazarte en el audio"
            >
              {/* Progress track */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-[width] duration-75 relative"
                style={{ width: `${progressPercent}%` }}
              >
                {/* Scrubber thumb circle */}
                <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-indigo-600 scale-0 group-hover/bar:scale-100 transition-transform" />
              </div>
            </div>
          </div>

          {/* 3. Right Controls: Speed, Volume, Download, Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-1">
            {/* Playback speed toggle */}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="px-1.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-semibold text-gray-300 hover:text-white bg-[#25253a] hover:bg-[#2d2d46] border border-[#35354e] transition"
              title="Velocidad de reproducción"
            >
              {playbackRate}x
            </button>

            {/* Volume control with popover */}
            <div
              className="relative"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition"
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-amber-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Volume Slider dropdown */}
              {showVolumeSlider && (
                <div className="absolute bottom-full right-0 mb-2 p-2 rounded-xl bg-[#1d1d2c] border border-[#2f2f45] shadow-xl flex items-center gap-2 z-30 animate-fadeIn">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-500 cursor-pointer h-1.5 bg-[#2a2a3e] rounded-lg"
                  />
                  <span className="text-[10px] font-mono text-gray-400 w-6">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Download audio */}
            {src && (
              <a
                href={src}
                download={title || 'nota-de-voz'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition hidden sm:inline-flex"
                title="Descargar archivo de audio"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            {/* Editable Actions (Replace & Delete) */}
            {isEditable && (
              <>
                <button
                  type="button"
                  onClick={() => replaceInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition hidden sm:inline-flex"
                  title="Reemplazar archivo de audio"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => deleteNode()}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Eliminar reproductor del contenido (no borra el archivo original de la biblioteca)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

/**
 * TipTap Node Definition for Audio Player
 */
export const AudioNode = Node.create({
  name: 'audioNode',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-src') || element.getAttribute('src') || '',
        renderHTML: (attributes) => ({
          'data-src': attributes.src,
          src: attributes.src
        })
      },
      title: {
        default: 'Nota de voz',
        parseHTML: (element) => element.getAttribute('data-title') || 'Nota de voz',
        renderHTML: (attributes) => ({
          'data-title': attributes.title
        })
      },
      duration: {
        default: 0,
        parseHTML: (element) => {
          const val = element.getAttribute('data-duration');
          return val ? parseFloat(val) : 0;
        },
        renderHTML: (attributes) => ({
          'data-duration': attributes.duration
        })
      },
      fileId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-file-id') || '',
        renderHTML: (attributes) => ({
          'data-file-id': attributes.fileId
        })
      },
      r2Key: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-r2-key') || '',
        renderHTML: (attributes) => ({
          'data-r2-key': attributes.r2Key
        })
      },
      mimeType: {
        default: 'audio/webm',
        parseHTML: (element) => element.getAttribute('data-mime') || 'audio/webm',
        renderHTML: (attributes) => ({
          'data-mime': attributes.mimeType
        })
      },
      size: {
        default: 0,
        parseHTML: (element) => {
          const val = element.getAttribute('data-size');
          return val ? parseInt(val, 10) : 0;
        },
        renderHTML: (attributes) => ({
          'data-size': attributes.size
        })
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="audio-player"]'
      },
      {
        tag: 'div.audio-player-block'
      },
      {
        tag: 'audio-player'
      },
      {
        tag: 'audio',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLAudioElement;
          return {
            src: element.src || element.getAttribute('src') || '',
            title: element.getAttribute('data-title') || 'Nota de voz',
            duration: parseFloat(element.getAttribute('data-duration') || '0') || 0,
            fileId: element.getAttribute('data-file-id') || '',
            r2Key: element.getAttribute('data-r2-key') || '',
            mimeType: element.getAttribute('data-mime') || 'audio/webm',
            size: parseInt(element.getAttribute('data-size') || '0', 10) || 0
          };
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'audio-player',
        class: 'audio-player-block my-3'
      }),
      [
        'audio',
        {
          src: HTMLAttributes.src || '',
          controls: 'true',
          'data-title': HTMLAttributes.title || 'Nota de voz',
          'data-duration': HTMLAttributes.duration || 0
        }
      ]
    ];
  },

  addCommands() {
    return {
      setAudioNode:
        (options) =>
        ({ commands }) => {
          return commands.insertContent([
            {
              type: this.name,
              attrs: options
            },
            {
              type: 'paragraph'
            }
          ]);
        }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioPlayerNodeView);
  }
});
