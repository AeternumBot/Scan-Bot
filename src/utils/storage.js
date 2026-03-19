// src/utils/storage.js — Persistencia local en JSON
const fs   = require('fs-extra');
const path = require('path');
const { DATA_FILES } = require('../../config/config');

// Asegura que el directorio data/ exista
fs.ensureDirSync('./data');

// ── Helpers genéricos ────────────────────────────────────────────────────────

function readJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readJSONSync(filePath);
    }
  } catch (e) {
    console.error(`[Storage] Error leyendo ${filePath}:`, e.message);
  }
  return defaultValue;
}

function writeJSON(filePath, data) {
  try {
    fs.outputJSONSync(filePath, data, { spaces: 2 });
    return true;
  } catch (e) {
    console.error(`[Storage] Error escribiendo ${filePath}:`, e.message);
    return false;
  }
}

// ── Proyectos ─────────────────────────────────────────────────────────────────

const Projects = {
  getAll() { return readJSON(DATA_FILES.projects, {}); },
  get(id)  { return this.getAll()[id] || null; },

  save(project) {
    const all = this.getAll();
    all[project.id] = { ...all[project.id], ...project };
    return writeJSON(DATA_FILES.projects, all);
  },

  delete(id) {
    const all = this.getAll();
    if (!all[id]) return false;
    delete all[id];
    return writeJSON(DATA_FILES.projects, all);
  },

  list()           { return Object.values(this.getAll()); },
  findByName(name) { return this.list().find(p => p.name.toLowerCase().includes(name.toLowerCase())) || null; },
};

// ── Últimos capítulos vistos ──────────────────────────────────────────────────

const LastChapters = {
  getAll() { return readJSON(DATA_FILES.lastChapters, {}); },

  get(projectId, source) {
    return this.getAll()[projectId]?.[source] || null;
  },

  set(projectId, source, data) {
    const all = this.getAll();
    if (!all[projectId]) all[projectId] = {};
    all[projectId][source] = { ...data, seenAt: new Date().toISOString() };
    return writeJSON(DATA_FILES.lastChapters, all);
  },
};

// ── Caché de Drive ────────────────────────────────────────────────────────────

const DriveCache = {
  getAll() { return readJSON(DATA_FILES.driveCache, {}); },
  get(projectId) { return this.getAll()[projectId] || null; },

  set(projectId, data) {
    const all = this.getAll();
    all[projectId] = { ...data, cachedAt: new Date().toISOString() };
    return writeJSON(DATA_FILES.driveCache, all);
  },

  invalidate(projectId) {
    const all = this.getAll();
    delete all[projectId];
    return writeJSON(DATA_FILES.driveCache, all);
  },
};

// ── Tareas ────────────────────────────────────────────────────────────────────
/*
  Estructura de una tarea:
  {
    id: "task_1234567890",
    projectId: "slug-proyecto",
    projectName: "Nombre del proyecto",
    capitulo: "45",
    labor: "traduccion",          // descripcion de la labor
    asignadoId: "discord-user-id",
    asignadoName: "Username",
    creadoPor: "discord-user-id",
    creadoAt: "ISO timestamp",
    ultimoRecordatorio: "ISO timestamp",
    completada: false,
    completadaAt: null,
  }
*/

const Tareas = {
  getAll() { return readJSON(DATA_FILES.tareas, {}); },
  get(id)  { return this.getAll()[id] || null; },

  save(tarea) {
    const all = this.getAll();
    all[tarea.id] = tarea;
    return writeJSON(DATA_FILES.tareas, all);
  },

  delete(id) {
    const all = this.getAll();
    delete all[all];
    return writeJSON(DATA_FILES.tareas, all);
  },

  list()              { return Object.values(this.getAll()); },
  listActivas()       { return this.list().filter(t => !t.completada); },
  listPorUsuario(uid) { return this.listActivas().filter(t => t.asignadoId === uid); },

  create({ projectId, projectName, capitulo, labor, asignadoId, asignadoName, creadoPor }) {
    const id = `task_${Date.now()}`;
    const tarea = {
      id, projectId, projectName, capitulo, labor,
      asignadoId, asignadoName, creadoPor,
      creadoAt: new Date().toISOString(),
      ultimoRecordatorio: new Date().toISOString(),
      completada: false,
      completadaAt: null,
    };
    this.save(tarea);
    return tarea;
  },

  completar(id) {
    const tarea = this.get(id);
    if (!tarea) return null;
    tarea.completada   = true;
    tarea.completadaAt = new Date().toISOString();
    this.save(tarea);
    return tarea;
  },

  actualizarRecordatorio(id) {
    const tarea = this.get(id);
    if (!tarea) return null;
    tarea.ultimoRecordatorio = new Date().toISOString();
    this.save(tarea);
    return tarea;
  },
};

// ── Ausencias ─────────────────────────────────────────────────────────────────
/*
  {
    id: "absence_1234567890",
    usuarioId: "discord-user-id",
    usuarioName: "Username",
    razon: "Texto libre",
    desde: "ISO timestamp",
    hasta: "ISO timestamp",      // fecha de retorno esperada
    estado: "activa" | "vencida" | "cancelada",
    creadoPor: "discord-user-id",  // puede ser el mismo usuario o un admin
    notificado: false,             // true cuando Sua ya notificó al vencerse
  }
*/

const Ausencias = {
  getAll()    { return readJSON(DATA_FILES.ausencias, {}); },
  get(id)     { return this.getAll()[id] || null; },

  save(ausencia) {
    const all = this.getAll();
    all[ausencia.id] = ausencia;
    return writeJSON(DATA_FILES.ausencias, all);
  },

  list()         { return Object.values(this.getAll()); },
  listActivas()  { return this.list().filter(a => a.estado === 'activa'); },

  create({ usuarioId, usuarioName, razon, hasta, creadoPor }) {
    const id = `absence_${Date.now()}`;
    const ausencia = {
      id, usuarioId, usuarioName, razon,
      desde: new Date().toISOString(),
      hasta,
      estado: 'activa',
      creadoPor,
      notificado: false,
    };
    this.save(ausencia);
    return ausencia;
  },

  cancelar(id) {
    const a = this.get(id);
    if (!a) return null;
    a.estado = 'cancelada';
    this.save(a);
    return a;
  },

  marcarVencida(id) {
    const a = this.get(id);
    if (!a) return null;
    a.estado     = 'vencida';
    a.notificado = true;
    this.save(a);
    return a;
  },
};

// ── Tickets de error ──────────────────────────────────────────────────────────
/*
  {
    id: "ticket_001",
    numero: 1,
    usuarioId: "discord-user-id",
    usuarioName: "Username",
    proyectoId: "slug",
    proyectoName: "Nombre",
    capitulo: "45",
    tipoError: "mal_subido" | "desorden" | "no_carga" | "otro",
    plataforma: "tmo" | "colorcito",
    descripcion: "texto libre",
    channelId: "discord-channel-id",   // canal temporal creado
    estado: "abierto" | "cerrado",
    creadoAt: "ISO",
    cerradoAt: null,
    cerradoPor: null,
  }
*/

const Tickets = {
  getAll()   { return readJSON(DATA_FILES.tickets, { contador: 0, items: {} }); },

  get(id) {
    return this.getAll().items[id] || null;
  },

  getByChannel(channelId) {
    return this.list().find(t => t.channelId === channelId) || null;
  },

  save(ticket) {
    const all = this.getAll();
    all.items[ticket.id] = ticket;
    return writeJSON(DATA_FILES.tickets, all);
  },

  list()        { return Object.values(this.getAll().items || {}); },
  listAbiertos(){ return this.list().filter(t => t.estado === 'abierto'); },

  create({ usuarioId, usuarioName, proyectoId, proyectoName, capitulo, tipoError, plataforma, descripcion, channelId }) {
    const all = this.getAll();
    all.contador = (all.contador || 0) + 1;
    const numero = all.contador;
    const id     = `ticket_${String(numero).padStart(3, '0')}`;
    const ticket = {
      id, numero, usuarioId, usuarioName,
      proyectoId, proyectoName, capitulo,
      tipoError, plataforma, descripcion, channelId,
      estado: 'abierto',
      creadoAt: new Date().toISOString(),
      cerradoAt: null,
      cerradoPor: null,
    };
    all.items[id] = ticket;
    return writeJSON(DATA_FILES.tickets, all) ? ticket : null;
  },

  cerrar(id, cerradoPor) {
    const all  = this.getAll();
    const ticket = all.items[id];
    if (!ticket) return null;
    ticket.estado    = 'cerrado';
    ticket.cerradoAt = new Date().toISOString();
    ticket.cerradoPor = cerradoPor;
    all.items[id]    = ticket;
    writeJSON(DATA_FILES.tickets, all);
    return ticket;
  },
};

// ── Solicitudes de reclutamiento ──────────────────────────────────────────────
/*
  {
    id: "recruit_1234567890",
    usuarioId: "discord-user-id",
    usuarioName: "Username",
    rolInteres: "traductor" | "cleaner" | "typesetter" | "otro",
    experiencia: "texto",
    disponibilidad: "texto",
    motivacion: "texto",           // por qué quiere unirse
    proyectoInteres: "texto",      // qué proyecto le llamó la atención
    channelId: "canal-temporal",   // canal temporal creado en el servidor de staff
    estado: "pendiente" | "aceptado" | "rechazado" | "cerrado",
    creadoAt: "ISO",
    cerradoAt: null,
    gestionadoPor: null,
  }
*/

const Reclutamiento = {
  getAll() { return readJSON(DATA_FILES.reclutamiento, {}); },
  get(id)  { return this.getAll()[id] || null; },

  getByChannel(channelId) {
    return this.list().find(r => r.channelId === channelId) || null;
  },

  getByUsuario(usuarioId) {
    return this.list().find(r => r.usuarioId === usuarioId && r.estado === 'pendiente') || null;
  },

  save(solicitud) {
    const all = this.getAll();
    all[solicitud.id] = solicitud;
    return writeJSON(DATA_FILES.reclutamiento, all);
  },

  list()           { return Object.values(this.getAll()); },
  listPendientes() { return this.list().filter(r => r.estado === 'pendiente'); },

  create({ usuarioId, usuarioName, rolInteres, experiencia, disponibilidad, motivacion, proyectoInteres, channelId }) {
    const id = `recruit_${Date.now()}`;
    const solicitud = {
      id, usuarioId, usuarioName,
      rolInteres, experiencia, disponibilidad,
      motivacion, proyectoInteres, channelId,
      estado: 'pendiente',
      creadoAt: new Date().toISOString(),
      cerradoAt: null,
      gestionadoPor: null,
    };
    this.save(solicitud);
    return solicitud;
  },

  cerrar(id, gestionadoPor, estado = 'cerrado') {
    const all = this.getAll();
    const s   = all[id];
    if (!s) return null;
    s.estado        = estado;
    s.cerradoAt     = new Date().toISOString();
    s.gestionadoPor = gestionadoPor;
    all[id]         = s;
    writeJSON(DATA_FILES.reclutamiento, all);
    return s;
  },
};

module.exports = { Projects, LastChapters, DriveCache, Tareas, Ausencias, Tickets, Reclutamiento };
