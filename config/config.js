// config/config.js — Configuración central del bot

module.exports = {

  // ─── REACCIONES ────────────────────────────────────────────────────────────
  REACTIONS: {
    newChapter: [
      '🇼', '🇦', '🇮', '🇫', '🇺', '🇸',
      '<:685826heypretty:1460781288838397993>',
      '🇬', '🇴', '🇩',
      '<:32221latom:1460780859299856394>',
      '<:a_:1329566030766542868>',
      '<:anime:1329566031626240142>',
      '<a:misathumb:1460781426768347229>',
      '<a:70315inlove:1460781214729244814>',
      '<:f_0:1460780989902094483>',
      '<:cute:1329566039779967159>',
    ],
    newProject:   ['🎉', '✨', '🆕'],
    completed:    ['✅', '🏆', '🎊'],
    hiatusReturn: ['😱', '🙌', '💯'],
  },

  // ─── TEXTO FIJO AL PIE DE CADA ANUNCIO ────────────────────────────────────
  ANNOUNCEMENT_FOOTER: [
    '💬 Comparte tu bendición (o tus quejas) en el canal de discusión.',
    '⚠️ Si no es COLORCITO, no es sagrado.',
  ],

  // ─── CATEGORÍAS DE PROYECTOS ───────────────────────────────────────────────
  CATEGORIES: {
    manhwas:  { name: 'Manhwas',         emoji: '🇰🇷', folder: 'Manhwas'         },
    mangas:   { name: 'Mangas',          emoji: '🇯🇵', folder: 'Mangas'          },
    novelas:  { name: 'Novelas ligeras', emoji: '📚',  folder: 'Novelas ligeras' },
    joints:   { name: 'Joints',          emoji: '🤝',  folder: 'Joints'          },
  },

  // ─── ESTRUCTURA DE CARPETAS POR CAPÍTULO ──────────────────────────────────
  CHAPTER_FOLDERS: {
    raw:   { prefixes: ['raw'],   label: 'Raw',   emoji: '📥', trackCredits: false },
    clean: { prefixes: ['clean'], label: 'Clean', emoji: '🧹', trackCredits: true  },
    trad:  { prefixes: ['tradu', 'trad', 'traduccion', 'traducción', 'tl'], label: 'Traducción', emoji: '📝', trackCredits: true },
    final: { prefixes: ['final', 'typeo', 'type', 'ts'], label: 'Final/Typeo', emoji: '✏️', trackCredits: true },
  },

  // ─── ESTADO ────────────────────────────────────────────────────────────────
  STATUS_EMOJI: {
    done:    '✅',
    partial: '🟡',
    empty:   '❌',
    unknown: '❓',
  },

  // ─── COLORES ───────────────────────────────────────────────────────────────
  COLORS: {
    announcement: 0xFF6B9D,
    status:       0x5865F2,
    success:      0x57F287,
    error:        0xED4245,
    warning:      0xFEE75C,
    info:         0xEB459E,
  },

  // ─── FUENTES ───────────────────────────────────────────────────────────────
  SOURCES: {
    colorcito: { name: 'COLORCITO', emoji: '🔗', label: 'COLORCITO', url: 'https://colorcitoscan.com' },
  },

  // ─── MISC ──────────────────────────────────────────────────────────────────
  RETRY_DELAY_MS: 5000,
  MAX_RETRIES:    3,

  // ─── ARCHIVOS DE DATOS ─────────────────────────────────────────────────────
  DATA_FILES: {
    projects:      './data/projects.json',
    lastChapters:  './data/last_chapters.json',
    driveCache:    './data/drive_cache.json',

  },
};
