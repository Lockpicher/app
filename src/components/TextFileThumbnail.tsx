import React, { useState, useEffect } from 'react';
import { FileText, Code, FileCode2 } from 'lucide-react';
import { AppAttachment } from '../lib/types';
import { r2Storage } from '../lib/r2Client';

// In-memory LRU snippet cache
const textSnippetCache = new Map<string, string>();

interface TextFileThumbnailProps {
  file: AppAttachment;
  className?: string;
  maxLines?: number;
}

export function isTextAttachment(file: AppAttachment): boolean {
  const mime = (file.mime_type || '').toLowerCase();
  const name = file.file_name.toLowerCase();
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/xml' ||
    mime === 'application/x-yaml'
  ) {
    return true;
  }
  return /\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|html|css|scss|xml|log|yaml|yml|py|sql|sh|bat|env|ini|conf|toml|c|cpp|h|java|php|rb|rs|go)$/i.test(name);
}

export function getFileExtensionBadge(fileName: string): { label: string; color: string; border: string; bg: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';

  switch (ext) {
    case 'md':
    case 'markdown':
      return { label: 'MD', color: 'text-emerald-400', border: 'border-emerald-600/40', bg: 'bg-emerald-950/70' };
    case 'json':
      return { label: 'JSON', color: 'text-amber-400', border: 'border-amber-600/40', bg: 'bg-amber-950/70' };
    case 'csv':
    case 'tsv':
      return { label: 'CSV', color: 'text-teal-400', border: 'border-teal-600/40', bg: 'bg-teal-950/70' };
    case 'js':
    case 'jsx':
      return { label: 'JS', color: 'text-yellow-400', border: 'border-yellow-600/40', bg: 'bg-yellow-950/70' };
    case 'ts':
    case 'tsx':
      return { label: 'TS', color: 'text-cyan-400', border: 'border-cyan-600/40', bg: 'bg-cyan-950/70' };
    case 'py':
      return { label: 'PY', color: 'text-indigo-400', border: 'border-indigo-600/40', bg: 'bg-indigo-950/70' };
    case 'html':
    case 'xml':
      return { label: ext.toUpperCase(), color: 'text-orange-400', border: 'border-orange-600/40', bg: 'bg-orange-950/70' };
    case 'css':
    case 'scss':
      return { label: ext.toUpperCase(), color: 'text-pink-400', border: 'border-pink-600/40', bg: 'bg-pink-950/70' };
    case 'sql':
      return { label: 'SQL', color: 'text-blue-400', border: 'border-blue-600/40', bg: 'bg-blue-950/70' };
    case 'sh':
    case 'bat':
      return { label: 'SH', color: 'text-lime-400', border: 'border-lime-600/40', bg: 'bg-lime-950/70' };
    case 'yaml':
    case 'yml':
      return { label: 'YML', color: 'text-rose-400', border: 'border-rose-600/40', bg: 'bg-rose-950/70' };
    default:
      return { label: ext.toUpperCase().slice(0, 4), color: 'text-gray-300', border: 'border-gray-700/60', bg: 'bg-gray-800/80' };
  }
}

export const TextFileThumbnail: React.FC<TextFileThumbnailProps> = ({ file, className = '', maxLines = 6 }) => {
  const [snippet, setSnippet] = useState<string | null>(textSnippetCache.get(file.id) || null);
  const [isLoading, setIsLoading] = useState(!snippet);
  const badge = getFileExtensionBadge(file.file_name);

  useEffect(() => {
    let isMounted = true;
    if (snippet) return;

    const url = r2Storage.getDisplayUrl(file);
    if (!url) {
      setIsLoading(false);
      return;
    }

    fetch(url, { headers: { Range: 'bytes=0-1024' } })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load text preview');
        const text = await res.text();
        if (isMounted) {
          const cleanSnippet = text.slice(0, 600).replace(/\r\n/g, '\n');
          textSnippetCache.set(file.id, cleanSnippet);
          setSnippet(cleanSnippet);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file.id, snippet]);

  const lines = snippet ? snippet.split('\n').slice(0, maxLines) : [];

  return (
    <div className={`relative w-full h-full bg-[#13131a] overflow-hidden flex flex-col p-2.5 select-none font-mono text-[9px] ${className}`}>
      {/* Document top badge & line */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#242436] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold border tracking-wider ${badge.color} ${badge.border} ${badge.bg}`}>
            {badge.label}
          </span>
          <span className="text-[10px] text-gray-500 font-sans truncate max-w-[100px]">
            {file.file_name}
          </span>
        </div>
        <FileCode2 className={`w-3.5 h-3.5 ${badge.color} opacity-70`} />
      </div>

      {/* Snippet body or skeleton */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="space-y-1.5 animate-pulse pt-1">
            <div className="h-2 bg-gray-800 rounded w-5/6" />
            <div className="h-2 bg-gray-800 rounded w-full" />
            <div className="h-2 bg-gray-800 rounded w-4/6" />
            <div className="h-2 bg-gray-800 rounded w-3/4" />
            <div className="h-2 bg-gray-800 rounded w-2/3" />
          </div>
        ) : lines.length > 0 ? (
          <div className="flex gap-2 leading-[1.3] text-gray-300/90 overflow-hidden">
            {/* Line numbers */}
            <div className="text-gray-600 text-right select-none pr-1.5 border-r border-[#222233] shrink-0 text-[8px]">
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            {/* Text lines */}
            <div className="overflow-hidden truncate flex-1 space-y-[1px]">
              {lines.map((line, idx) => (
                <div key={idx} className="truncate text-gray-300 font-mono tracking-tight">
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1 text-gray-500">
            <FileText className="w-5 h-5 opacity-40" />
            <span className="text-[9px] font-sans">Archivo de texto</span>
          </div>
        )}

        {/* Bottom smooth fade to card background */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#13131a] via-[#13131a]/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
