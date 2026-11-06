import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const dismissed = sessionStorage.getItem('pwa-install-dismissed') === 'true';
    if (dismissed) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    if (isIOS && isSafari) {
      setShowIOSHelp(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', 'true');
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="fixed bottom-20 left-3 right-3 z-[90] mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#171827]/95 p-4 text-white shadow-2xl backdrop-blur-xl sm:bottom-5">
      <button type="button" onClick={dismiss} aria-label="Cerrar" className="absolute right-3 top-3 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X size={17} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600">
          <Download size={21} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Instala Segundo Cerebro</p>
          <p className="mt-1 text-xs leading-relaxed text-white/65">
            Accede desde la pantalla de inicio como una aplicación, sin abrir una pestaña del navegador.
          </p>
        </div>
      </div>
      {installEvent ? (
        <button type="button" onClick={install} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500">
          Instalar aplicación
        </button>
      ) : showIOSHelp ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/80">
          <Share size={16} className="shrink-0" /> En Safari, pulsa Compartir y selecciona «Añadir a pantalla de inicio».
        </p>
      ) : null}
    </aside>
  );
}
