// src/services/driveService.js
// Integración con Google Drive — V4
// Estructura: Mi unidad/Aeternum Translations V0/<Categoría>/<Proyecto>/<NumCap>/<Raw|Clean|Tradu|Final>
//
// CAMBIOS V4:
//  - Scope cambiado a drive completo (lectura + escritura) para poder subir y crear carpetas
//  - _drive se invalida si se detecta cambio de credenciales (seguro para Railway)
//  - Nuevas funciones: createFolder, uploadFile, deleteFile, getStorageUsage
//  - Nueva función: ensureChapterFolders (crea la estructura Raw/Clean/Tradu/Final si no existe)
//  - Nueva función: uploadRawImages (sube imágenes a la carpeta Raw de un capítulo)
//  - Nueva función: deleteRawsFromProject (borra carpetas Raw de capítulos seleccionados)
//  - getBotStorageUsage devuelve uso actual en bytes y porcentaje respecto al límite configurado

const { google }   = require('googleapis');
const path         = require('path');
const fs           = require('fs-extra');
const { Readable } = require('stream');
const logger       = require('../utils/logger');
const { CHAPTER_FOLDERS, CATEGORIES, STATUS_EMOJI } = require('../../config/config');
const { DriveCache } = require('../utils/storage');

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

// Subcarpetas estándar que Sua crea dentro de cada capítulo
// El orden importa: así aparecerán en Drive
const STAGE_FOLDERS = ['Raw', 'Clean', 'Tradu', 'Final'];

let _drive = null;

// ── Cliente de Drive ──────────────────────────────────────────────────────────
// Prioridad:
//   1. OAuth2 con refresh token (GOOGLE_REFRESH_TOKEN en env) → usa la cuenta real
//      del propietario del Drive. Necesario para subir archivos en Drive personal
//      (las Service Accounts no tienen cuota y no pueden subir a Mi Unidad).
//   2. Service Account → fallback para lectura y casos con Shared Drive.

function getDriveClient() {
  if (_drive) return _drive;

  const refreshToken  = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId      = process.env.GOOGLE_CLIENT_ID;
  const clientSecret  = process.env.GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    // ── OAuth2 con la cuenta real del usuario ─────────────────────────────
    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3001/callback'   // redirect URI usado al generar el token
    );
    oauth2.setCredentials({ refresh_token: refreshToken });
    _drive = google.drive({ version: 'v3', auth: oauth2 });
    logger.info('Drive', 'Autenticado con OAuth2 (cuenta de usuario)');
  } else {
    // ── Service Account (fallback) ────────────────────────────────────────
    const keyValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './config/google-credentials.json';
    let auth;

    if (keyValue.trim().startsWith('{')) {
      const credentials = JSON.parse(keyValue);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else {
      const keyPath = path.resolve(keyValue);
      if (!fs.existsSync(keyPath)) throw new Error(`Credenciales no encontradas en: ${keyPath}`);
      auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    }

    _drive = google.drive({ version: 'v3', auth });
    logger.info('Drive', 'Autenticado con Service Account');
  }

  return _drive;
}

// Llama esto si necesitas forzar reconexión (ej: después de cambiar credenciales)
function invalidateDriveClient() {
  _drive = null;
}

// ── Helpers de lectura ────────────────────────────────────────────────────────

async function listFolder(folderId) {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    pageSize: 1000,
    orderBy: 'name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

function isFolder(f) { return f.mimeType === 'application/vnd.google-apps.folder'; }

function findByPrefix(items, prefixes) {
  return items.filter(isFolder).find(f =>
    prefixes.some(p => f.name.toLowerCase().startsWith(p.toLowerCase()))
  ) || null;
}

function extractCredit(folderName, prefixes) {
  for (const p of prefixes) {
    const lower = folderName.toLowerCase();
    if (lower.startsWith(p.toLowerCase())) {
      const rest = folderName.slice(p.length).trim();
      const credit = rest.replace(/^[\s\-]+/, '').trim();
      return credit || null;
    }
  }
  return null;
}

// ── Helpers de escritura (nuevos en V4) ───────────────────────────────────────

/**
 * Crea una carpeta en Drive dentro de un padre dado.
 * Si ya existe una carpeta con ese nombre exacto, devuelve la existente.
 * @param {string} name      Nombre de la carpeta a crear
 * @param {string} parentId  ID de la carpeta padre
 * @returns {Promise<{id: string, name: string}>}
 */
async function createFolder(name, parentId) {
  const drive = getDriveClient();

  // Verificar si ya existe para no crear duplicados
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}'`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0];
  }

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  return res.data;
}

/**
 * Sube un archivo a Drive desde un Buffer en memoria.
 * @param {string} fileName   Nombre del archivo en Drive
 * @param {Buffer} buffer     Contenido del archivo
 * @param {string} mimeType   MIME type (ej: 'image/jpeg')
 * @param {string} parentId   ID de la carpeta destino
 * @returns {Promise<{id: string, name: string}>}
 */
async function uploadFile(fileName, buffer, mimeType, parentId) {
  const drive = getDriveClient();

  // Convertir Buffer a stream legible para la API de Drive
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  return res.data;
}

/**
 * Elimina un archivo o carpeta de Drive permanentemente (no a la papelera).
 * @param {string} fileId  ID del archivo o carpeta
 */
async function deleteFile(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/**
 * Obtiene el uso de almacenamiento de la cuenta de Drive.
 * Devuelve bytes usados y límite total.
 * @returns {Promise<{used: number, limit: number, percent: number}>}
 */
async function getStorageUsage() {
  const drive = getDriveClient();
  const res = await drive.about.get({
    fields: 'storageQuota',
  });

  const quota = res.data.storageQuota;
  const used  = parseInt(quota.usage || '0', 10);
  const limit = parseInt(quota.limit || '0', 10);
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return { used, limit, percent };
}

// ── Navegación a carpetas de proyecto ─────────────────────────────────────────

async function findProjectFolder(projectName, category) {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID no configurado');

  const rootItems = await listFolder(rootId);

  const catConfig = CATEGORIES[category];
  let searchFolder = rootId;

  if (catConfig) {
    const catFolder = rootItems.filter(isFolder).find(
      f => f.name.toLowerCase() === catConfig.folder.toLowerCase()
    );
    if (catFolder) searchFolder = catFolder.id;
  }

  const catItems = searchFolder === rootId ? rootItems : await listFolder(searchFolder);
  const projectFolder = catItems.filter(isFolder).find(
    f => f.name.toLowerCase() === projectName.toLowerCase()
  );

  return projectFolder || null;
}

// ── Gestión de estructura de capítulos (nuevo en V4) ──────────────────────────

/**
 * Garantiza que existan las 4 subcarpetas estándar dentro de la carpeta de un capítulo.
 * Crea las que falten. Devuelve un objeto con los IDs de cada subcarpeta.
 *
 * @param {string} chapterFolderId  ID de la carpeta del capítulo (ej: carpeta "07")
 * @returns {Promise<{Raw: string, Clean: string, Tradu: string, Final: string}>}
 */
async function ensureChapterFolders(chapterFolderId) {
  const existing = await listFolder(chapterFolderId);
  const folderIds = {};

  for (const stageName of STAGE_FOLDERS) {
    // Buscar si ya existe (comparación insensible a mayúsculas)
    const found = existing.filter(isFolder).find(
      f => f.name.toLowerCase() === stageName.toLowerCase()
    );

    if (found) {
      folderIds[stageName] = found.id;
    } else {
      // No existe, crearla
      const created = await createFolder(stageName, chapterFolderId);
      folderIds[stageName] = created.id;
      logger.info('Drive', `Carpeta creada: ${stageName} en ${chapterFolderId}`);
    }
  }

  return folderIds;
}

/**
 * Sube imágenes a la carpeta Raw de un capítulo específico.
 * Si la carpeta del capítulo no existe, la crea.
 * Si faltan subcarpetas (Raw, Clean, Tradu, Final), las crea también.
 *
 * @param {string} projectName   Nombre del proyecto (debe coincidir con carpeta en Drive)
 * @param {string} category      Categoría del proyecto ('manhwas', 'mangas', etc.)
 * @param {string} chapterNum    Número de capítulo como string (ej: '07', '12.5')
 * @param {Array<{name: string, buffer: Buffer, mimeType: string}>} images  Imágenes a subir
 * @returns {Promise<{
 *   success: boolean,
 *   projectFolderId: string,
 *   chapterFolderId: string,
 *   rawFolderId: string,
 *   uploaded: number,
 *   chapterCreated: boolean,
 *   foldersCreated: string[],
 *   storageWarning: boolean,
 *   storagePercent: number
 * }>}
 */
async function uploadRawImages(projectName, category, chapterNum, images) {
  // 1. Encontrar la carpeta del proyecto
  const projectFolder = await findProjectFolder(projectName, category);
  if (!projectFolder) {
    throw new Error(`No encontré la carpeta del proyecto "${projectName}" en Drive`);
  }

  // 2. Buscar o crear la carpeta del capítulo
  const chapterItems = await listFolder(projectFolder.id);
  let chapterFolder = chapterItems.filter(isFolder).find(
    f => f.name === chapterNum || f.name === String(parseInt(chapterNum, 10)).padStart(2, '0')
  );

  let chapterCreated = false;
  if (!chapterFolder) {
    // Crear la carpeta del capítulo con el número tal como viene
    chapterFolder = await createFolder(chapterNum, projectFolder.id);
    chapterCreated = true;
    logger.info('Drive', `Capítulo creado: ${chapterNum} en proyecto ${projectName}`);
  }

  // 3. Garantizar que existan Raw, Clean, Tradu, Final
  const stagesBefore = await listFolder(chapterFolder.id);
  const folderIds = await ensureChapterFolders(chapterFolder.id);
  const stagesAfter = await listFolder(chapterFolder.id);

  // Detectar cuáles se crearon nuevas (para reportarlo)
  const existingNames = new Set(stagesBefore.filter(isFolder).map(f => f.name.toLowerCase()));
  const foldersCreated = stagesAfter
    .filter(isFolder)
    .filter(f => !existingNames.has(f.name.toLowerCase()))
    .map(f => f.name);

  // 4. Subir las imágenes a la carpeta Raw
  const rawFolderId = folderIds['Raw'];
  let uploaded = 0;

  for (const img of images) {
    try {
      await uploadFile(img.name, img.buffer, img.mimeType, rawFolderId);
      uploaded++;
    } catch (err) {
      logger.error('Drive', `Error subiendo ${img.name}: ${err.message}`);
      // No abortar, seguir con las demás
    }
  }

  // 5. Verificar uso de almacenamiento
  let storageWarning = false;
  let storagePercent = 0;
  try {
    const storage = await getStorageUsage();
    storagePercent = storage.percent;
    if (storage.percent >= 95) {
      storageWarning = true;
      logger.warn('Drive', `⚠️ Almacenamiento al ${storage.percent}%`);
    }
  } catch {
    // No crítico si falla el check de almacenamiento
  }

  // Invalidar caché del proyecto para que el próximo /status muestre los datos nuevos
  DriveCache.invalidate(`${category || 'any'}__${projectName}`);

  return {
    success: uploaded > 0,
    projectFolderId: projectFolder.id,
    chapterFolderId: chapterFolder.id,
    rawFolderId,
    uploaded,
    total: images.length,
    chapterCreated,
    foldersCreated,
    storageWarning,
    storagePercent,
  };
}

/**
 * Elimina las carpetas Raw de los capítulos indicados de un proyecto.
 * Si chapterNums está vacío, elimina las Raws de TODOS los capítulos del proyecto.
 *
 * @param {string}   projectName   Nombre del proyecto
 * @param {string}   category      Categoría del proyecto
 * @param {string[]} chapterNums   Lista de números de capítulo (vacío = todos)
 * @returns {Promise<{deleted: number, skipped: number, errors: string[]}>}
 */
async function deleteRawsFromProject(projectName, category, chapterNums = []) {
  const projectFolder = await findProjectFolder(projectName, category);
  if (!projectFolder) {
    throw new Error(`No encontré la carpeta del proyecto "${projectName}" en Drive`);
  }

  const chapterItems = await listFolder(projectFolder.id);
  const TEMPLATE_FOLDERS = ['raw', 'clean', 'tradu', 'traduccion', 'traducción', 'tl', 'final', 'typeo', 'type', 'ts'];

  // Filtrar solo las carpetas de capítulos (no las plantilla)
  const capFolders = chapterItems.filter(f => {
    if (!isFolder(f)) return false;
    return !TEMPLATE_FOLDERS.includes(f.name.toLowerCase().trim());
  });

  // Si se especificaron capítulos concretos, filtrar
  const toProcess = chapterNums.length > 0
    ? capFolders.filter(f => chapterNums.includes(f.name))
    : capFolders;

  let deleted = 0;
  let skipped = 0;
  const errors = [];

  for (const capFolder of toProcess) {
    try {
      const subItems = await listFolder(capFolder.id);
      const rawFolder = subItems.filter(isFolder).find(
        f => f.name.toLowerCase() === 'raw'
      );

      if (!rawFolder) {
        skipped++;
        continue;
      }

      await deleteFile(rawFolder.id);
      deleted++;
      logger.info('Drive', `Raw eliminada: Cap. ${capFolder.name} de ${projectName}`);
    } catch (err) {
      errors.push(`Cap. ${capFolder.name}: ${err.message}`);
      logger.error('Drive', `Error eliminando Raw de Cap. ${capFolder.name}: ${err.message}`);
    }
  }

  // Invalidar caché
  DriveCache.invalidate(`${category || 'any'}__${projectName}`);

  return { deleted, skipped, errors };
}

// ── Análisis de capítulos ─────────────────────────────────────────────────────

async function analyzeChapters(projectFolderId) {
  const items = await listFolder(projectFolderId);
  const TEMPLATE_FOLDERS = ['raw', 'clean', 'tradu', 'traduccion', 'traducción', 'tl', 'final', 'typeo', 'type', 'ts'];
  const capFolders = items.filter(f => {
    if (!isFolder(f)) return false;
    const nameLower = f.name.toLowerCase().trim();
    return !TEMPLATE_FOLDERS.includes(nameLower);
  }).sort((a, b) => {
    const na = parseFloat(a.name) || 0;
    const nb = parseFloat(b.name) || 0;
    return na - nb;
  });

  const chapters = [];

  const chunkSize = 5;
  for (let i = 0; i < capFolders.length; i += chunkSize) {
    const chunk = capFolders.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(async capFolder => {
      const subItems = await listFolder(capFolder.id);
      const capData = { number: capFolder.name, folderId: capFolder.id, stages: {} };

      const stageEntries = Object.entries(CHAPTER_FOLDERS);
      const stageResults = await Promise.all(stageEntries.map(async ([key, cfg]) => {
        const stageFolder = findByPrefix(subItems, cfg.prefixes);
        if (!stageFolder) return [key, { exists: false, done: false, credit: null, fileCount: 0 }];

        const stageItems = await listFolder(stageFolder.id);
        const allFiles   = stageItems.filter(f => !isFolder(f));
        const fileCount  = allFiles.length;
        const credit     = cfg.trackCredits ? extractCredit(stageFolder.name, cfg.prefixes) : null;
        const done       = fileCount > 0;
        const uploaded   = key === 'final'
          ? allFiles.some(f => f.name.toLowerCase().startsWith('000.'))
          : false;
        return [key, { exists: true, done, credit, fileCount, uploaded, folderName: stageFolder.name, nameChanged: credit !== null }];
      }));

      stageResults.forEach(([key, val]) => { capData.stages[key] = val; });
      return capData;
    }));
    chapters.push(...chunkResults);
  }

  return chapters;
}

// ── API pública (lectura) ─────────────────────────────────────────────────────

async function getProjectStatus(projectName, category = null, forceRefresh = false) {
  const cacheKey = `${category || 'any'}__${projectName}`;
  if (!forceRefresh) {
    const cached = DriveCache.get(cacheKey);
    if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) {
      return cached;
    }
  }

  try {
    const projectFolder = await findProjectFolder(projectName, category);

    if (!projectFolder) {
      return { found: false, error: `Carpeta "${projectName}" no encontrada en Drive` };
    }

    const chapters = await analyzeChapters(projectFolder.id);
    const totalCaps = chapters.length;
    const lastCap = chapters[chapters.length - 1] || null;

    const summary = {
      total:        totalCaps,
      withClean:    chapters.filter(c => c.stages.clean?.done).length,
      withTrad:     chapters.filter(c => c.stages.trad?.done).length,
      withFinal:    chapters.filter(c => c.stages.final?.done).length,
      withUploaded: chapters.filter(c => c.stages.final?.uploaded).length,
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

// ── Builders de estado (sin cambios) ─────────────────────────────────────────

function buildChapterStatusLine(cap) {
  const E = STATUS_EMOJI;
  const s = cap.stages;

  const sinClean = !s.clean?.exists && (s.trad?.done || s.final?.done);

  function icon(stage, key) {
    if (key === 'clean' && sinClean) return '➖';
    if (!stage?.exists) return E.unknown;
    if (!stage.done)    return E.empty;
    if (key === 'final' && stage.done) return stage.uploaded ? '🟢' : E.done;
    return E.done;
  }

  function label(stage, cfg, key) {
    if (key === 'clean' && sinClean) return `${cfg.label} (N/A)`;
    if (!stage?.done) return cfg.label;
    if (key === 'final' && stage.done) {
      const base = stage.credit ? `${cfg.label} (${stage.credit})` : cfg.label;
      return stage.uploaded ? `${base} — subido` : `${base} — listo, no subido`;
    }
    return stage.credit ? `${cfg.label} (${stage.credit})` : cfg.label;
  }

  return (
    `${icon(s.clean, 'clean')} ${label(s.clean, CHAPTER_FOLDERS.clean, 'clean')}  ` +
    `${icon(s.trad,  'trad')}  ${label(s.trad,  CHAPTER_FOLDERS.trad,  'trad')}  ` +
    `${icon(s.final, 'final')} ${label(s.final, CHAPTER_FOLDERS.final, 'final')}`
  );
}

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
  // Lectura (sin cambios)
  getProjectStatus,
  listAllProjects,
  listFolder,
  buildChapterStatusLine,
  buildCreditsFromDrive,
  analyzeChapters,
  findProjectFolder,
  // Escritura (nuevo V4)
  createFolder,
  uploadFile,
  deleteFile,
  uploadRawImages,
  deleteRawsFromProject,
  ensureChapterFolders,
  getStorageUsage,
  invalidateDriveClient,
};
