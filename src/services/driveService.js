// src/services/driveService.js
// Integración con Google Drive
// Estructura: Mi unidad/Aeternum Translations V0/<Categoría>/<Proyecto>/<NumCap>/<Raw|Clean|Tradu|Final>

const { google }   = require('googleapis');
const path         = require('path');
const fs           = require('fs-extra');
const logger       = require('../utils/logger');
const { CHAPTER_FOLDERS, CATEGORIES, STATUS_EMOJI } = require('../../config/config');
const { DriveCache } = require('../utils/storage');

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

let _drive = null;

function getDriveClient() {
  if (_drive) return _drive;

  const keyValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './config/google-credentials.json';
  let auth;

  // Si el valor empieza con { es el JSON completo (Railway), si no es una ruta de archivo (local)
  if (keyValue.trim().startsWith('{')) {
    const credentials = JSON.parse(keyValue);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } else {
    const keyPath = path.resolve(keyValue);
    if (!fs.existsSync(keyPath)) throw new Error(`Credenciales no encontradas en: ${keyPath}`);
    auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }

  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function listFolder(folderId) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    pageSize: 1000,
    orderBy: 'name',
  });
  return res.data.files || [];
}

function isFolder(f) { return f.mimeType === 'application/vnd.google-apps.folder'; }

// Busca una subcarpeta cuyo nombre EMPIECE con alguno de los prefijos dados
function findByPrefix(items, prefixes) {
  return items.filter(isFolder).find(f =>
    prefixes.some(p => f.name.toLowerCase().startsWith(p.toLowerCase()))
  ) || null;
}

// Extrae el crédito del nombre de carpeta. Ej: "Clean - Valk" → "Valk"
function extractCredit(folderName, prefixes) {
  for (const p of prefixes) {
    const lower = folderName.toLowerCase();
    if (lower.startsWith(p.toLowerCase())) {
      const rest = folderName.slice(p.length).trim();
      // rest puede ser "" o " - Valk" o "- Valk"
      const credit = rest.replace(/^[\s\-]+/, '').trim();
      return credit || null;
    }
  }
  return null;
}

// ── Navegar hasta la carpeta del proyecto ─────────────────────────────────────

async function findProjectFolder(projectName, category) {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID no configurado');

  // Nivel 1: Aeternum Translations V0 (o lo que sea la raíz)
  const rootItems = await listFolder(rootId);

  // Nivel 2: Categoría (Manhwas / Mangas / etc.)
  const catConfig = CATEGORIES[category];
  let searchFolder = rootId;

  if (catConfig) {
    const catFolder = rootItems.filter(isFolder).find(
      f => f.name.toLowerCase() === catConfig.folder.toLowerCase()
    );
    if (catFolder) searchFolder = catFolder.id;
  }

  // Nivel 3: Proyecto
  const catItems = searchFolder === rootId ? rootItems : await listFolder(searchFolder);
  const projectFolder = catItems.filter(isFolder).find(
    f => f.name.toLowerCase() === projectName.toLowerCase()
  );

  return projectFolder || null;
}

// ── Analizar capítulos del proyecto ───────────────────────────────────────────

async function analyzeChapters(projectFolderId) {
  const items = await listFolder(projectFolderId);
  // Ignorar carpetas plantilla (Raw, Clean, Tradu, Final) que no son capítulos
  const TEMPLATE_FOLDERS = ['raw', 'clean', 'tradu', 'traduccion', 'traducción', 'tl', 'final', 'typeo', 'type', 'ts'];
  const capFolders = items.filter(f => {
    if (!isFolder(f)) return false;
    const nameLower = f.name.toLowerCase().trim();
    // Excluir si el nombre es exactamente una carpeta plantilla
    return !TEMPLATE_FOLDERS.includes(nameLower);
  }).sort((a, b) => {
    const na = parseFloat(a.name) || 0;
    const nb = parseFloat(b.name) || 0;
    return na - nb;
  });

  const chapters = [];

  for (const capFolder of capFolders) {
    const subItems = await listFolder(capFolder.id);
    const capData = {
      number: capFolder.name,
      folderId: capFolder.id,
      stages: {},
    };

    // Analizar cada stage (raw, clean, trad, final)
    for (const [key, cfg] of Object.entries(CHAPTER_FOLDERS)) {
      const stageFolder = findByPrefix(subItems, cfg.prefixes);

      if (!stageFolder) {
        capData.stages[key] = { exists: false, done: false, credit: null, fileCount: 0 };
        continue;
      }

      // Contar archivos dentro
      const stageItems = await listFolder(stageFolder.id);
      const fileCount = stageItems.filter(f => !isFolder(f)).length;

      // Extraer crédito del nombre si aplica (ej: "Clean - Valk" → "Valk")
      const credit = cfg.trackCredits ? extractCredit(stageFolder.name, cfg.prefixes) : null;

      // Completado si:
      //   (a) tiene archivos dentro, O
      //   (b) el nombre fue modificado respecto al prefijo base (ej: "Clean - Valk")
      const nameChanged = credit !== null; // tiene algo después del prefijo
      const done = fileCount > 0 || nameChanged;

      capData.stages[key] = {
        exists: true,
        done,
        credit,
        fileCount,
        folderName: stageFolder.name,
        nameChanged,
      };
    }

    chapters.push(capData);
  }

  return chapters;
}

// ── API pública ───────────────────────────────────────────────────────────────

async function getProjectStatus(projectName, category = null) {
  const cacheKey = `${category || 'any'}__${projectName}`;
  const cached = DriveCache.get(cacheKey);
  if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const projectFolder = await findProjectFolder(projectName, category);

    if (!projectFolder) {
      return { found: false, error: `Carpeta "${projectName}" no encontrada en Drive` };
    }

    const chapters = await analyzeChapters(projectFolder.id);
    const totalCaps = chapters.length;
    const lastCap = chapters[chapters.length - 1] || null;

    // Resumen general
    const summary = {
      total: totalCaps,
      withClean: chapters.filter(c => c.stages.clean?.done).length,
      withTrad:  chapters.filter(c => c.stages.trad?.done).length,
      withFinal: chapters.filter(c => c.stages.final?.done).length,
    };

    const result = {
      found: true,
      projectName: projectFolder.name,
      folderId: projectFolder.id,
      folderUrl: `https://drive.google.com/drive/folders/${projectFolder.id}`,
      chapters,
      summary,
      lastCap,
      totalCaps,
    };

    DriveCache.set(cacheKey, result);
    return result;

  } catch (err) {
    logger.error('Drive', `Error en getProjectStatus("${projectName}"): ${err.message}`);
    return { found: false, error: err.message };
  }
}

async function listAllProjects() {
  try {
    const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
    if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID no configurado');

    const results = [];
    const rootItems = await listFolder(rootId);

    // Buscar en cada categoría
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      const catFolder = rootItems.filter(isFolder).find(
        f => f.name.toLowerCase() === cat.folder.toLowerCase()
      );
      if (!catFolder) continue;

      const catItems = await listFolder(catFolder.id);
      catItems.filter(isFolder).forEach(f => {
        results.push({ name: f.name, category: key, id: f.id, modifiedTime: f.modifiedTime });
      });
    }

    return results;
  } catch (err) {
    logger.error('Drive', `Error listando proyectos: ${err.message}`);
    return [];
  }
}

// Genera línea de estado resumida para un capítulo
function buildChapterStatusLine(cap) {
  const E = STATUS_EMOJI;
  const s = cap.stages;

  function icon(stage) {
    if (!stage?.exists) return E.unknown;
    if (!stage.done)    return E.empty;
    return E.done;
  }

  function label(stage, cfg) {
    if (!stage?.done) return cfg.label;
    return stage.credit ? `${cfg.label} (${stage.credit})` : cfg.label;
  }

  return (
    `${icon(s.clean)} ${label(s.clean, CHAPTER_FOLDERS.clean)}  ` +
    `${icon(s.trad)}  ${label(s.trad, CHAPTER_FOLDERS.trad)}  ` +
    `${icon(s.final)} ${label(s.final, CHAPTER_FOLDERS.final)}`
  );
}

// Genera el resumen de créditos de un capítulo
function buildCreditsFromDrive(cap) {
  const credits = [];
  for (const [key, cfg] of Object.entries(CHAPTER_FOLDERS)) {
    if (!cfg.trackCredits) continue;
    const stage = cap.stages[key];
    if (stage?.done && stage.credit) {
      credits.push(`${cfg.emoji} **${cfg.label}:** ${stage.credit}`);
    }
  }
  return credits;
}

module.exports = {
  getProjectStatus,
  listAllProjects,
  listFolder,
  buildChapterStatusLine,
  buildCreditsFromDrive,
  analyzeChapters,
};
