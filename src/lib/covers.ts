export interface PresetCover {
  id: string;
  name: string;
  category: 'minimal' | 'gradient' | 'artistic' | 'dark';
  color: string;
  bgGradient: string;
  patternSvg?: string;
  badgeColor: string;
}

export const PRESET_COVERS: PresetCover[] = [
  {
    id: 'cover-navy-gold',
    name: 'Azul Noche & Oro',
    category: 'gradient',
    color: '#1e3a8a',
    bgGradient: 'from-[#0f172a] via-[#1e293b] to-[#1e3a8a]',
    badgeColor: '#fbbf24',
    patternSvg: 'radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.25) 0%, transparent 50%)'
  },
  {
    id: 'cover-emerald-zen',
    name: 'Esmeralda Zen',
    category: 'artistic',
    color: '#059669',
    bgGradient: 'from-[#064e3b] via-[#047857] to-[#10b981]',
    badgeColor: '#6ee7b7',
    patternSvg: 'radial-gradient(circle at 20% 80%, rgba(110, 231, 183, 0.2) 0%, transparent 50%)'
  },
  {
    id: 'cover-sunset-purple',
    name: 'Atardecer Púrpura',
    category: 'gradient',
    color: '#7c3aed',
    bgGradient: 'from-[#3b0764] via-[#6b21a8] to-[#c026d3]',
    badgeColor: '#f472b6',
    patternSvg: 'linear-gradient(135deg, rgba(244, 114, 182, 0.2) 0%, transparent 60%)'
  },
  {
    id: 'cover-terracotta',
    name: 'Terracota Cálido',
    category: 'minimal',
    color: '#c2410c',
    bgGradient: 'from-[#7c2d12] via-[#9a3412] to-[#ea580c]',
    badgeColor: '#fdba74',
    patternSvg: 'radial-gradient(circle at 70% 30%, rgba(253, 186, 116, 0.25) 0%, transparent 50%)'
  },
  {
    id: 'cover-obsidian-gold',
    name: 'Obsidiana & Platino',
    category: 'dark',
    color: '#09090b',
    bgGradient: 'from-[#09090b] via-[#18181b] to-[#27272a]',
    badgeColor: '#e4e4e7',
    patternSvg: 'linear-gradient(45deg, rgba(228, 228, 231, 0.1) 25%, transparent 25%)'
  },
  {
    id: 'cover-ocean-teal',
    name: 'Océano Profundo',
    category: 'artistic',
    color: '#0e7490',
    bgGradient: 'from-[#164e63] via-[#0891b2] to-[#06b6d4]',
    badgeColor: '#67e8f9',
    patternSvg: 'radial-gradient(circle at 30% 70%, rgba(103, 232, 249, 0.25) 0%, transparent 60%)'
  },
  {
    id: 'cover-rose-wood',
    name: 'Madera de Rosa',
    category: 'minimal',
    color: '#be185d',
    bgGradient: 'from-[#831843] via-[#9d174d] to-[#db2777]',
    badgeColor: '#fbcfe8',
    patternSvg: 'linear-gradient(180deg, rgba(251, 207, 232, 0.15) 0%, transparent 70%)'
  },
  {
    id: 'cover-amber-leather',
    name: 'Cuero Ámbar',
    category: 'minimal',
    color: '#b45309',
    bgGradient: 'from-[#451a03] via-[#78350f] to-[#d97706]',
    badgeColor: '#fde68a',
    patternSvg: 'linear-gradient(120deg, rgba(253, 230, 138, 0.18) 0%, transparent 60%)'
  },
  {
    id: 'cover-aurora-cyan',
    name: 'Aurora Boreal',
    category: 'artistic',
    color: '#0284c7',
    bgGradient: 'from-[#082f49] via-[#0284c7] to-[#10b981]',
    badgeColor: '#38bdf8',
    patternSvg: 'radial-gradient(ellipse at bottom, rgba(56, 189, 248, 0.3) 0%, transparent 70%)'
  },
  {
    id: 'cover-vintage-crimson',
    name: 'Carmesí Clásico',
    category: 'dark',
    color: '#991b1b',
    bgGradient: 'from-[#450a0a] via-[#7f1d1d] to-[#b91c1c]',
    badgeColor: '#fca5a5',
    patternSvg: 'linear-gradient(45deg, rgba(252, 165, 165, 0.15) 0%, transparent 65%)'
  },
  {
    id: 'cover-slate-modern',
    name: 'Gris Ejecutivo',
    category: 'dark',
    color: '#334155',
    bgGradient: 'from-[#0f172a] via-[#1e293b] to-[#475569]',
    badgeColor: '#94a3b8',
    patternSvg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, transparent 50%)'
  },
  {
    id: 'cover-sakura-indigo',
    name: 'Sakura & Índigo',
    category: 'artistic',
    color: '#4f46e5',
    bgGradient: 'from-[#1e1b4b] via-[#4338ca] to-[#ec4899]',
    badgeColor: '#f43f5e',
    patternSvg: 'radial-gradient(circle at 50% 20%, rgba(244, 63, 94, 0.25) 0%, transparent 50%)'
  }
];

export function getCoverById(id?: string): PresetCover {
  return PRESET_COVERS.find(c => c.id === id) || PRESET_COVERS[0];
}
