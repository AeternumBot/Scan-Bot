// src/events/suaAgent.js
// ────────────────────────────────────────────────────────────────────────────
// Sua como agente conversacional autónomo.
// Detecta intención en lenguaje natural, recopila datos faltantes preguntando
// con su personalidad y ejecuta la acción real cuando tiene todo lo necesario.
// ────────────────────────────────────────────────────────────────────────────

const { Events, EmbedBuilder } = require('discord.js');
const { Projects, LastChapters, Tareas, Ausencias, Tickets, Reclutamiento } = require('../utils/storage');
const SUA = require('../utils/sua');

// ── Servicios (se importan lazy para evitar circulares) ───────────────────────
let _tmo, _colorcito, _driveService, _announcer, _monitor;
const tmo         = () => _tmo        || (_tmo        = require('../services/tmoScraper'));
const colorcito   = () => _colorcito  || (_colorcito  = require('../services/colorcito'));
const driveService= () => _driveService||(_driveService= require('../services/driveService'));
const announcer   = () => _announcer  || (_announcer  = require('../services/announcer'));
const monitor     = () => _monitor    || (_monitor    = require('../services/monitor'));

// ── Roles / permisos ──────────────────────────────────────────────────────────
const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1368818622750789633';
const VALK_ID     = process.env.VALK_USER_ID || ''; // ID de Valk — set en .env como VALK_USER_ID
const STAFF_ROLES = {
  profesor:    { id: '1450701377587122312', name: 'Profesor',    extra: [] },
  typesetter:  { id: '1368818361915408485', name: 'Typesetter',  extra: [] },
  cleaner:     { id: '1368818132948488294', name: 'Cleaner',     extra: [] },
  traductor:   { id: '1368817756870545510', name: 'Traductor',   extra: [] },
  editor:      { id: '1368817956657561650', name: 'Editor',      extra: ['1368818361915408485','1368818280717877359','1368818132948488294'] },
  qc:          { id: '1368818036437680128', name: 'QC',          extra: [] },
  redibujador: { id: '1368818280717877359', name: 'Redibujador', extra: ['1368818132948488294'] },
  staff:       { id: '1368818898677272597', name: 'Staff',       extra: [] },
  nuevo:       { id: '1368819324608974950', name: 'Nuevo',       extra: [] },
};

// ── Kaomojis inline ───────────────────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:    () => pick(['(◕‿◕✿)','(ﾉ◕ヮ◕)ﾉ','(✿◠‿◠)','(*´▽`*)','(ﾉ´ヮ`)ﾉ*: ･ﾟ']),
  timida:   () => pick(['(〃>_<;〃)','(//>/<//)', '(〃ω〃)','(*ノωノ)','(//∇//)']),
  triste:   () => pick(['(;ω;)','(´；ω；`)','( ´•̥̥̥ω•̥̥̥` )','(╥_╥)']),
  tranqui:  () => pick(['(˘ω˘)','(っ˘ω˘ς)','( ´ ▽ ` )','(。◕‿◕。)','(￣▽￣)']),
  disculpa: () => pick(['(´• ω •`)ゞ','(⁄ ⁄•⁄ω⁄•⁄ ⁄)','(´＿｀。)','(；￣ω￣)']),
};

// ── Anti-repetición por usuario ───────────────────────────────────────────────
const _lastMsg = new Map();
function noRepeat(userId, pool) {
  const last = _lastMsg.get(userId) || [];
  const disponibles = pool.filter(m => !last.includes(m));
  const elegido = pick(disponibles.length ? disponibles : pool);
  _lastMsg.set(userId, [...last.slice(-3), elegido]);
  return elegido;
}

// ── Frases de confirmación (8 variantes por acción destructiva) ──────────────
const CONFIRMAR = {
  banear: (target) => noRepeat('__conf_ban', [
    `E-eh... ¿de verdad quieres banear a **${target}**? Eso es permanente... ${K.timida()} Responde **sí** o **no**.`,
    `Mmm... banear a **${target}** es una decisión grande. ¿Estás segur@? ${K.triste()} Dime **sí** o **no**.`,
    `A-ay... si baneas a **${target}** no podrá volver. ¿Lo confirmas? ${K.disculpa()} **Sí** o **no**, por favor.`,
    `¿S-segur@ de banear a **${target}**? Una vez hecho, no hay marcha atrás ${K.timida()} Responde **sí** o **no**.`,
    `Voy a necesitar que me confirmes esto... ¿banear a **${target}**? ${K.triste()} **Sí** o **no**.`,
    `E-esto es serio... ¿quieres banear a **${target}** del servidor? ${K.disculpa()} Dime **sí** o **no**.`,
    `Sua no toma esto a la ligera... ¿confirmas el baneo de **${target}**? ${K.timida()} **Sí** o **no**.`,
    `¿Estás completamente segur@ de banear a **${target}**? ${K.triste()} Escribe **sí** para confirmar o **no** para cancelar.`,
  ]),
  expulsar: (target) => noRepeat('__conf_kick', [
    `¿De verdad quieres expulsar a **${target}**? Podrá volver si lo reinvitan... ${K.timida()} **Sí** o **no**.`,
    `E-eh... ¿confirmas expulsar a **${target}**? ${K.disculpa()} Responde **sí** o **no**.`,
    `Mmm... ¿segur@ de expulsar a **${target}**? ${K.tranqui()} Dime **sí** o **no**.`,
    `A-antes de expulsar a **${target}**... ¿lo confirmas? ${K.timida()} **Sí** o **no**, por favor.`,
    `¿Quieres que expulse a **${target}** del servidor? ${K.disculpa()} Escribe **sí** o **no**.`,
    `Voy a necesitar un sí de tu parte para expulsar a **${target}** ${K.timida()} ¿Lo hago?`,
    `¿Confirmas la expulsión de **${target}**? ${K.tranqui()} **Sí** o **no**.`,
    `E-eh... ¿estás segur@ de que quieres expulsar a **${target}**? ${K.disculpa()} Dime **sí** o **no**.`,
  ]),
  eliminarProyecto: (name) => noRepeat('__conf_delproj', [
    `¿De verdad quieres eliminar **${name}** del bot? Perderé todos sus datos ${K.triste()} **Sí** o **no**.`,
    `E-eh... ¿segur@ de eliminar **${name}**? No podré recuperar esa información ${K.timida()} **Sí** o **no**.`,
    `Mmm... borrar **${name}** es permanente. ¿Lo confirmas? ${K.disculpa()} Responde **sí** o **no**.`,
    `A-ay... si elimino **${name}** ya no lo monitorizaré más. ¿Estás segur@? ${K.triste()} **Sí** o **no**.`,
    `¿Quieres que elimine **${name}** completamente? ${K.timida()} Dime **sí** o **no**, por favor.`,
    `Sua necesita confirmación para eliminar **${name}**... ¿lo hago? ${K.disculpa()} **Sí** o **no**.`,
    `¿Confirmas que quieres eliminar **${name}** del bot? ${K.triste()} Escribe **sí** o **no**.`,
    `E-esto no tiene vuelta atrás... ¿eliminar **${name}**? ${K.timida()} **Sí** o **no**.`,
  ]),
  cancelado: () => noRepeat('__conf_cancel', [
    `Entendido, cancelado. Menos mal que me lo confirmaste ${K.tranqui()}`,
    `Cancelado. Si cambias de opinión, aquí estaré ${K.feliz()}`,
    `De acuerdo, no hago nada entonces ${K.tranqui()}`,
    `Cancelado. Sua suspira de alivio... ${K.timida()}`,
    `Está bien, lo dejo así. Avísame si necesitas algo más ${K.feliz()}`,
    `Ningún problema, cancelado ${K.tranqui()}`,
    `Okis, no hago nada. Aquí sigo disponible ${K.feliz()}`,
    `Cancelado. Fue un susto... p-pero ya pasó ${K.timida()}`,
  ]),
};

// ────────────────────────────────────────────────────────────────────────────
// CACHÉ DE PROYECTOS — evita leer disco en cada mensaje
// Se invalida automáticamente cuando se agrega/elimina un proyecto
// ────────────────────────────────────────────────────────────────────────────
let _projectsCache    = null;
let _projectsCacheAt  = 0;
const CACHE_TTL       = 30_000; // 30s

function getProjects() {
  if (!_projectsCache || Date.now() - _projectsCacheAt > CACHE_TTL) {
    _projectsCache   = Projects.list();
    _projectsCacheAt = Date.now();
  }
  return _projectsCache;
}
function invalidateCache() {
  _projectsCache   = null;
  _projectsCacheAt = 0;
}
// Exponer para que los flujos de add/remove puedan invalidar
module.exports = module.exports || {};

// ────────────────────────────────────────────────────────────────────────────
// SESIONES ACTIVAS
// Map<userId, { intent, step, data, guildId, channelId, pending? }>
// ────────────────────────────────────────────────────────────────────────────
const sessions = new Map();
const SESSION_TTL = 5 * 60 * 1000; // 5 min sin actividad = sesión expirada

function getSession(userId) {
  const s = sessions.get(userId);
  if (s && Date.now() - s.updatedAt > SESSION_TTL) {
    sessions.delete(userId);
    return null;
  }
  return s || null;
}
function setSession(userId, data) {
  sessions.set(userId, { ...data, updatedAt: Date.now() });
}
function clearSession(userId) {
  sessions.delete(userId);
}

// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE INTENCIÓN — lenguaje natural + nombres de proyectos dinámicos
// ────────────────────────────────────────────────────────────────────────────
function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<@!?\d+>/g, '')
    .replace(/[¿?¡!.,]/g, '')
    .trim();
}

function detectIntent(text) {
  const t = normalize(text);

  // ── Moderación ──────────────────────────────────────────────────────────
  if (/\bban(ea?r?|ear)?\b/.test(t)) return 'mod.ban';
  if (/expulsa(r|lo|la)?|echa(r|lo|la)?(\s+del?\s+(servidor|server))?|kick|saca(r|lo|la)?\s+del\s+(servidor|server)/.test(t)) return 'mod.kick';
  if (/da(r|le)?.{0,6}rol|asigna(r|le)?.{0,6}rol|pone(r|le)?.{0,6}rol|da(r|le)?.{0,6}cargo/.test(t)) return 'mod.darRol';
  if (/quita(r|le)?.{0,6}rol|saca(r|le)?.{0,6}rol|remov(er|e).{0,6}rol|quita(r|le)?.{0,6}cargo/.test(t)) return 'mod.quitarRol';

  // ── Proyectos ────────────────────────────────────────────────────────────
  if (/agrega(r|me)?.{0,8}proyecto|registra(r|me)?.{0,8}proyecto|a[nn]ade?.{0,8}proyecto|mete(r)?.{0,8}proyecto|nuevo proyecto|proyecto nuevo/.test(t)) return 'proyecto.add';
  if (/elimina(r)?.{0,8}proyecto|borra(r)?.{0,8}proyecto|quita(r)?.{0,8}proyecto|remueve?.{0,8}proyecto/.test(t)) return 'proyecto.remove';
  if (/activa(r)?.{0,8}proyecto|desactiva(r)?.{0,8}proyecto|pausa(r)?.{0,8}proyecto|reanuda(r)?.{0,8}proyecto/.test(t)) return 'proyecto.toggle';
  if (/cambia(r)?.{0,8}estado|pon(er|lo|la)?.{0,6}(en hiatus|en pausa|como completado|como dropeado|en curso)|setstatus/.test(t)) return 'proyecto.setstatus';
  if (/(info|informacion|detalles|datos|cuentame).{0,8}(del? )?proyecto|que (tiene|hay) en el proyecto/.test(t)) return 'proyecto.info';
  if (/lista(r)?.{0,8}proyectos|ver.{0,8}proyectos|que proyectos (hay|tienes|manejas)|todos los proyectos|proyectos registrados/.test(t)) return 'proyecto.list';

  // ── Anunciar ─────────────────────────────────────────────────────────────
  if (/anuncia(r|lo)?\b|publica(r)?.{0,8}cap(itulo)?|sube?.{0,8}cap(itulo)?|saca(r)?.{0,8}cap(itulo)?/.test(t)) return 'anunciar';

  // ── Avisar ───────────────────────────────────────────────────────────────
  if (/avisa(r|me)?\b|publica(r)?.{0,8}aviso|manda(r)?.{0,8}(aviso|comunicado)|haz?.{0,8}(un )?anuncio|comunicado oficial/.test(t)) return 'avisar';

  // ── Status / progreso ────────────────────────────────────────────────────
  if (/\bstatus\b|\bestatus\b|como van?\b|en que van\b|revisa(r)?.{0,8}(el )?(estado|estatus|progreso|avance)|progreso de|avance de|que (tienen|hay) en drive|como estan? (el|los) proyecto/.test(t)) return 'status';

  // ── Salud ────────────────────────────────────────────────────────────────
  if (/\bsalud\b|diagnostico|como estas? (tu|usted)\b|te funcionas?\b|estas? bien\b|todo (bien|ok) (contigo|con vos)/.test(t)) return 'salud';

  // ── Sincronizar ──────────────────────────────────────────────────────────
  if (/sincroniza(r)?\b|actualiza(r)?.{0,8}cache|sync\b|refresca(r)?.{0,8}(cap|datos)|ponme al dia/.test(t)) return 'sincronizar';

  // ── Buscar ───────────────────────────────────────────────────────────────
  if (/busca(r|me)?\b|search\b|encuentra(r)?\b|existe.{0,8}en (tmo|colorcito)|esta.{0,8}en (tmo|colorcito)/.test(t)) return 'buscar';

  // ── Configurar ───────────────────────────────────────────────────────────
  if (/configura(r)?\b|configuracion\b|ajustes?\b|settings?\b/.test(t)) return 'configurar';

  // ── Tareas ────────────────────────────────────────────────────────────────
  if (/asigna(r)?.{0,10}tarea|crea(r)?.{0,10}tarea|nueva tarea|dale.{0,10}tarea|pon.{0,10}a trabajar|encarga(r)?/.test(t)) return 'tarea.asignar';
  if (/tarea.{0,20}(completa|termina|lista|hecha)|ya (acabe|termine|liste).{0,10}tarea|marcar.{0,10}(lista|completada|hecha)/.test(t)) return 'tarea.completar';
  if (/ver.{0,8}tareas|lista(r)?.{0,8}tareas|que tareas (hay|tienes)|tareas (pendientes|activas)/.test(t)) return 'tarea.lista';

  // ── Ausencias ─────────────────────────────────────────────────────────────
  if (/voy a (estar|quedar) (ausente|fuera)|me voy a ausentar|\bausencia\b|no voy a poder.{0,15}(dias|semana)|estaré fuera|salgo de viaje|tengo que descansar/.test(t)) return 'ausencia.pedir';
  if (/registra(r)?.{0,8}ausencia|anota(r)?.{0,8}ausencia|ausencia de\s+<@/.test(t)) return 'ausencia.registrar';
  if (/cancela(r)?.{0,8}ausencia|ya volvi|estoy de vuelta|regrese|ya regrese/.test(t)) return 'ausencia.cancelar';
  if (/ver.{0,8}ausencias|quien (esta|hay) (ausente|fuera)|ausencias activas|lista.{0,8}ausencias/.test(t)) return 'ausencia.lista';

  // ── Tickets ───────────────────────────────────────────────────────────────
  if (/reporta(r)?\b|hay un error|tiene un error|no (carga|abre)|esta mal (subido|el cap)|paginas (desordenadas|mal puestas|mal)|falla el cap|error en el cap/.test(t)) return 'ticket.abrir';
  if (/cierra?.{0,8}ticket|resuelto.{0,8}ticket|solucione.{0,8}ticket/.test(t)) return 'ticket.cerrar';
  if (/tickets (abiertos|pendientes|activos)|ver tickets|lista.{0,8}tickets/.test(t)) return 'ticket.lista';

  // ── Reclutamiento ─────────────────────────────────────────────────────────
  if (/quiero (unirme|ser parte|colaborar)|me quiero unir|postular(me)?|unirme al (equipo|scan|grupo|team)|quiero (ser|ayudar como) (traductor|cleaner|typesetter|qc|staff)/.test(t)) return 'reclutar.postular';
  if (/cierra?.{0,8}postulacion|cerrar.{0,8}postulacion|resultado.{0,8}postulacion/.test(t)) return 'reclutar.cerrar';
  if (/postulaciones (pendientes|activas)|ver postulaciones|lista.{0,8}postulaciones/.test(t)) return 'reclutar.lista';

  // ── Detección dinámica por nombre de proyecto ────────────────────────────
  // Si el mensaje menciona el nombre de un proyecto conocido + verbo de acción,
  // se infiere la intención sin necesidad de decir "proyecto"
  // Detección dinámica — usa caché para no leer disco en cada mensaje
  for (const p of getProjects()) {
    const nombreN = normalize(p.name);
    const idN     = normalize(p.id);
    if (!t.includes(nombreN) && !t.includes(idN)) continue;

    if (/revisa(r)?|status|estatus|como va|progreso|avance|en que van|estado/.test(t)) return 'status';
    if (/elimina(r)?|borra(r)?|quita(r)?|remueve?/.test(t))                    return 'proyecto.remove';
    if (/activa(r)?|desactiva(r)?|pausa(r)?|reanuda(r)?/.test(t))              return 'proyecto.toggle';
    if (/(info|detalles|datos|cuentame)/.test(t))                               return 'proyecto.info';
    if (/anuncia(r)?|publica(r)?|cap(itulo)?/.test(t))                         return 'anunciar';
    if (/estado|hiatus|completado|dropeado|curso/.test(t))                      return 'proyecto.setstatus';
    return 'proyecto.info';
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// EXTRACCIÓN DE DATOS DEL MENSAJE INICIAL
// ────────────────────────────────────────────────────────────────────────────
function extractFromMessage(text, mentions) {
  const extracted = {};
  const t = normalize(text);

  // Usuario mencionado (no bot)
  const mentionedUser = mentions.users.filter(u => !u.bot).first();
  if (mentionedUser) extracted.targetUser = mentionedUser;

  const mentionedMember = mentions.members?.filter(m => !m.user.bot).first();
  if (mentionedMember) extracted.targetMember = mentionedMember;

  // Razón — "por", "porque", "motivo", "razón", "ya que"
  const razonMatch = text.match(/(?:por(?:que)?|razon|motivo|ya que)[:\s]+(.+)/i);
  if (razonMatch) extracted.razon = razonMatch[1].trim();

  // Número de capítulo — "cap 12", "capítulo 3.5", "el cap 47"
  const capMatch = text.match(/cap(?:itulo)?\.?\s*(\d+(?:[.,]\d+)?)/i);
  if (capMatch) extracted.capitulo = capMatch[1];

  // URLs — separar TMO vs Colorcito para proyecto.add
  const allUrls = [...text.matchAll(/(https?:\/\/[^\s]+)/g)].map(m => m[1].replace(/[)>.,]+$/, ''));
  if (allUrls.length) extracted.url = allUrls[0];
  const tmoUrlMatch   = allUrls.find(u => /lectortmo|zonatmo|tumangaonline/i.test(u));
  const colorUrlMatch = allUrls.find(u => /colorcito/i.test(u));
  if (tmoUrlMatch)   extracted.tmoUrl   = tmoUrlMatch;
  if (colorUrlMatch) extracted.colorUrl = colorUrlMatch;

  // Rol de staff — nombre o key
  for (const [key, info] of Object.entries(STAFF_ROLES)) {
    if (t.includes(key) || t.includes(normalize(info.name))) {
      extracted.rolKey = key;
      break;
    }
  }

  // Proyecto por nombre o ID — usa caché
  for (const p of getProjects()) {
    if (t.includes(normalize(p.name)) || t.includes(normalize(p.id))) {
      extracted.proyectoId   = p.id;
      extracted.proyectoName = p.name;
      break;
    }
  }

  // Nombre nuevo de proyecto — entre comillas o tras "llamado"/"se llama"
  const nombreMatch = text.match(/(?:llamado|se llama|nombre[:\s]+)"?([^"\n]+)"?/i);
  if (nombreMatch) extracted.nombre = nombreMatch[1].trim();

  // Estado mencionado en el texto
  const estadoMap = {
    'en curso': 'ongoing', 'ongoing': 'ongoing',
    'completado': 'completed', 'terminado': 'completed', 'completed': 'completed',
    'hiatus': 'hiatus', 'en pausa': 'hiatus', 'pausado': 'hiatus',
    'dropeado': 'dropped', 'cancelado': 'dropped', 'dropped': 'dropped',
  };
  for (const [keyword, value] of Object.entries(estadoMap)) {
    if (t.includes(keyword)) { extracted.estado = value; break; }
  }

  return extracted;
}

// CHECKS DE PERMISOS
// ────────────────────────────────────────────────────────────────────────────
function hasModRole(member) {
  return member.roles.cache.has(MOD_ROLE_ID)
    || member.permissions.has('ManageGuild')
    || member.permissions.has('BanMembers');
}
function hasAnnouncerRole(member) {
  const r = process.env.ANNOUNCER_ROLE_ID;
  return (r && member.roles.cache.has(r))
    || member.roles.cache.has(MOD_ROLE_ID)
    || member.permissions.has('ManageGuild');
}

// ────────────────────────────────────────────────────────────────────────────
// FLUJOS POR INTENCIÓN
// Cada flujo devuelve { reply, done?, nextStep? }
// ────────────────────────────────────────────────────────────────────────────

// ── mod.ban ──────────────────────────────────────────────────────────────────
async function flowBan(step, data, message) {
  if (step === 'start') {
    if (!data.targetUser) {
      return { reply: `¿A quién quieres banear? Menciónalo por favor ${K.timida()}`, nextStep: 'awaitTarget' };
    }
    return { reply: CONFIRMAR.banear(data.targetUser.username), nextStep: 'awaitConfirm' };
  }
  if (step === 'awaitTarget') {
    const user = message.mentions.users.filter(u => !u.bot).first();
    if (!user) return { reply: `No vi a quién mencionar... inténtalo de nuevo ${K.disculpa()}` };
    data.targetUser = user;
    data.targetMember = message.mentions.members?.filter(m => !m.user.bot).first();
    return { reply: CONFIRMAR.banear(user.username), nextStep: 'awaitConfirm' };
  }
  if (step === 'awaitConfirm') {
    const resp = message.content.toLowerCase().trim();
    if (/^s[ií]$/.test(resp)) {
      const member = data.targetMember || await message.guild.members.fetch(data.targetUser.id).catch(() => null);
      if (!member) return { reply: `No encontré al usuario en el servidor ${K.disculpa()}`, done: true };
      if (!member.bannable) return { reply: `N-no puedo banear a **${data.targetUser.username}**... tiene más permisos que yo ${K.triste()}`, done: true };
      const razon = data.razon || 'Sin razón especificada';
      try {
        await member.ban({ reason: razon });
        return { reply: SUA.mod.baneado(data.targetUser.username, razon), done: true };
      } catch {
        return { reply: SUA.mod.errorAccion('banear'), done: true };
      }
    }
    return { reply: CONFIRMAR.cancelado(), done: true };
  }
}

// ── mod.kick ─────────────────────────────────────────────────────────────────
async function flowKick(step, data, message) {
  if (step === 'start') {
    if (!data.targetUser) {
      return { reply: `¿A quién quieres expulsar? Menciónalo ${K.timida()}`, nextStep: 'awaitTarget' };
    }
    return { reply: CONFIRMAR.expulsar(data.targetUser.username), nextStep: 'awaitConfirm' };
  }
  if (step === 'awaitTarget') {
    const user = message.mentions.users.filter(u => !u.bot).first();
    if (!user) return { reply: `No vi a nadie mencionado... intenta de nuevo ${K.disculpa()}` };
    data.targetUser = user;
    data.targetMember = message.mentions.members?.filter(m => !m.user.bot).first();
    return { reply: CONFIRMAR.expulsar(user.username), nextStep: 'awaitConfirm' };
  }
  if (step === 'awaitConfirm') {
    const resp = message.content.toLowerCase().trim();
    if (/^s[ií]$/.test(resp)) {
      const member = data.targetMember || await message.guild.members.fetch(data.targetUser.id).catch(() => null);
      if (!member) return { reply: `No encontré al usuario en el servidor ${K.disculpa()}`, done: true };
      if (!member.kickable) return { reply: `N-no puedo expulsar a **${data.targetUser.username}**... tiene más permisos que yo ${K.triste()}`, done: true };
      const razon = data.razon || 'Sin razón especificada';
      try {
        await member.kick(razon);
        return { reply: SUA.mod.expulsado(data.targetUser.username, razon), done: true };
      } catch {
        return { reply: SUA.mod.errorAccion('expulsar'), done: true };
      }
    }
    return { reply: CONFIRMAR.cancelado(), done: true };
  }
}

// ── mod.darRol ────────────────────────────────────────────────────────────────
async function flowDarRol(step, data, message) {
  if (step === 'start') {
    if (!data.targetUser) {
      return { reply: `¿A quién le doy el rol? Menciónalo ${K.timida()}`, nextStep: 'awaitTarget' };
    }
    if (!data.rolKey) {
      const lista = Object.values(STAFF_ROLES).map(r => `\`${r.name.toLowerCase()}\``).join(', ');
      return { reply: `¿Qué rol le asigno? Los disponibles son: ${lista} ${K.tranqui()}`, nextStep: 'awaitRol' };
    }
    return execDarRol(data, message.guild);
  }
  if (step === 'awaitTarget') {
    const user = message.mentions.users.filter(u => !u.bot).first();
    if (!user) return { reply: `No vi a quién mencionar... intenta de nuevo ${K.disculpa()}` };
    data.targetUser = user;
    data.targetMember = message.mentions.members?.filter(m => !m.user.bot).first();
    if (!data.rolKey) {
      const lista = Object.values(STAFF_ROLES).map(r => `\`${r.name.toLowerCase()}\``).join(', ');
      return { reply: `¿Qué rol le doy a **${user.username}**? Disponibles: ${lista} ${K.tranqui()}`, nextStep: 'awaitRol' };
    }
    return execDarRol(data, message.guild);
  }
  if (step === 'awaitRol') {
    const t = message.content.toLowerCase();
    const found = Object.entries(STAFF_ROLES).find(([k, v]) => t.includes(k) || t.includes(v.name.toLowerCase()));
    if (!found) return { reply: `No reconocí ese rol... intenta con el nombre exacto ${K.disculpa()}` };
    data.rolKey = found[0];
    return execDarRol(data, message.guild);
  }
}
async function execDarRol(data, guild) {
  const rolInfo = STAFF_ROLES[data.rolKey];
  const member  = data.targetMember || await guild.members.fetch(data.targetUser.id).catch(() => null);
  if (!member) return { reply: `No encontré al usuario en el servidor ${K.disculpa()}`, done: true };
  try {
    const rolesToAdd = [rolInfo.id, ...rolInfo.extra];
    if (data.rolKey === 'staff') await member.roles.remove(STAFF_ROLES.nuevo.id).catch(() => {});
    for (const rId of rolesToAdd) {
      const role = guild.roles.cache.get(rId);
      if (role) await member.roles.add(role).catch(() => {});
    }
    return { reply: SUA.mod.rolDado(data.targetUser.username, rolInfo.name), done: true };
  } catch {
    return { reply: SUA.mod.errorAccion('asignar el rol'), done: true };
  }
}

// ── mod.quitarRol ─────────────────────────────────────────────────────────────
async function flowQuitarRol(step, data, message) {
  if (step === 'start') {
    if (!data.targetUser) {
      return { reply: `¿A quién le quito el rol? Menciónalo ${K.timida()}`, nextStep: 'awaitTarget' };
    }
    if (!data.rolKey) {
      const lista = Object.values(STAFF_ROLES).map(r => `\`${r.name.toLowerCase()}\``).join(', ');
      return { reply: `¿Qué rol le retiro? Disponibles: ${lista} ${K.tranqui()}`, nextStep: 'awaitRol' };
    }
    return execQuitarRol(data, message.guild);
  }
  if (step === 'awaitTarget') {
    const user = message.mentions.users.filter(u => !u.bot).first();
    if (!user) return { reply: `No vi a quién mencionar... intenta de nuevo ${K.disculpa()}` };
    data.targetUser = user;
    data.targetMember = message.mentions.members?.filter(m => !m.user.bot).first();
    if (!data.rolKey) {
      const lista = Object.values(STAFF_ROLES).map(r => `\`${r.name.toLowerCase()}\``).join(', ');
      return { reply: `¿Qué rol le quito a **${user.username}**? Disponibles: ${lista} ${K.tranqui()}`, nextStep: 'awaitRol' };
    }
    return execQuitarRol(data, message.guild);
  }
  if (step === 'awaitRol') {
    const t = message.content.toLowerCase();
    const found = Object.entries(STAFF_ROLES).find(([k, v]) => t.includes(k) || t.includes(v.name.toLowerCase()));
    if (!found) return { reply: `No reconocí ese rol... intenta con el nombre exacto ${K.disculpa()}` };
    data.rolKey = found[0];
    return execQuitarRol(data, message.guild);
  }
}
async function execQuitarRol(data, guild) {
  const rolInfo = STAFF_ROLES[data.rolKey];
  const member  = data.targetMember || await guild.members.fetch(data.targetUser.id).catch(() => null);
  if (!member) return { reply: `No encontré al usuario en el servidor ${K.disculpa()}`, done: true };
  try {
    const role = guild.roles.cache.get(rolInfo.id);
    if (role) await member.roles.remove(role);
    return { reply: SUA.mod.rolQuitado(data.targetUser.username, rolInfo.name), done: true };
  } catch {
    return { reply: SUA.mod.errorAccion('quitar el rol'), done: true };
  }
}

// ── proyecto.add ──────────────────────────────────────────────────────────────
async function flowProyectoAdd(step, data, message) {
  const CATEGORIAS = { manhwas: 'Manhwas', mangas: 'Mangas', novelas: 'Novelas ligeras', joints: 'Joints' };

  if (step === 'start') {
    if (!data.nombre) {
      return { reply: `¡Claro! ¿Cómo se llama el proyecto que quieres registrar? ${K.feliz()}`, nextStep: 'awaitNombre' };
    }
    return continueAdd(step, data, message);
  }
  if (step === 'awaitNombre') {
    data.nombre = message.content.replace(/<@!?\d+>/g, '').trim();
    return continueAdd('awaitNombre', data, message);
  }
  if (step === 'awaitDrive') {
    data.driveFolder = message.content.replace(/<@!?\d+>/g, '').trim();
    return continueAdd('awaitDrive', data, message);
  }
  if (step === 'awaitCategoria') {
    const t = message.content.toLowerCase();
    const found = Object.entries(CATEGORIAS).find(([k, v]) => t.includes(k) || t.includes(v.toLowerCase()));
    if (!found) {
      return { reply: `No reconocí esa categoría ${K.disculpa()} Las opciones son: \`manhwas\`, \`mangas\`, \`novelas\`, \`joints\`` };
    }
    data.categoria = found[0];
    return continueAdd('awaitCategoria', data, message);
  }
  if (step === 'awaitUrls') {
    const t = message.content;
    // TMO: lectortmo.com, zonatmo.com, tumangaonline.com y variantes
    const tmoMatch   = t.match(/(https?:\/\/[^\s]*(?:lectortmo|zonatmo|tumangaonline)[^\s]*)/i);
    // Colorcito: colorcito.com, colorcitoscan.com y variantes
    const colorMatch = t.match(/(https?:\/\/[^\s]*colorcito[^\s]*)/i);
    if (tmoMatch)   data.tmoUrl   = tmoMatch[1].replace(/[)>.,]+$/, ''); // limpiar trailing chars
    if (colorMatch) data.colorUrl = colorMatch[1].replace(/[)>.,]+$/, '');
    if (!data.tmoUrl && !data.colorUrl) {
      return {
        reply: pick([
          `Mmm... no reconocí esa URL ${K.disculpa()} Necesito un link de TMO (lectortmo.com) o Colorcito (colorcito.com). ¿Lo intentas de nuevo?`,
          `E-esa URL no la reconocí... ${K.timida()} Pega el link directo de TMO o Colorcito, por favor.`,
          `N-no pude leer ese link ${K.disculpa()} Asegúrate de que sea de lectortmo.com o colorcito.com.`,
        ]),
      };
    }
    return execProyectoAdd(data, message);
  }
}

async function continueAdd(fromStep, data, message) {
  const CATEGORIAS = { manhwas: 'Manhwas', mangas: 'Mangas', novelas: 'Novelas ligeras', joints: 'Joints' };
  if (!data.driveFolder) {
    return { reply: `¿Cómo se llama la carpeta en Google Drive? (nombre exacto) ${K.tranqui()}`, nextStep: 'awaitDrive' };
  }
  if (!data.categoria) {
    const lista = Object.entries(CATEGORIAS).map(([k, v]) => `\`${k}\` → ${v}`).join(', ');
    return { reply: `¿En qué categoría va? ${lista} ${K.tranqui()}`, nextStep: 'awaitCategoria' };
  }
  if (!data.tmoUrl && !data.colorUrl) {
    return {
      reply: `Ahora necesito los links. Dame la URL de **TMO** y/o **Colorcito** (puedes pegar ambas en un mensaje) ${K.timida()}`,
      nextStep: 'awaitUrls',
    };
  }
  return execProyectoAdd(data, message);
}

async function execProyectoAdd(data, message) {
  const { Projects: Proj, LastChapters: LC } = require('../utils/storage');
  const id = data.nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (Proj.get(id)) {
    return { reply: SUA.proyecto.yaExiste(id), done: true };
  }

  const project = {
    id, name: data.nombre, category: data.categoria,
    sources: { tmo: data.tmoUrl || null, colorcito: data.colorUrl || null },
    driveFolder: data.driveFolder,
    announcementChannel: null, readerRoleId: null, roleId: null,
    reactions: null, defaultCredits: null, active: true,
    addedAt: new Date().toISOString(), tags: [], status: 'ongoing',
    thumbnail: null, color: null,
  };

  const scrapers = [];
  if (data.tmoUrl)   scrapers.push({ source: 'tmo',       scraper: tmo(),       url: data.tmoUrl   });
  if (data.colorUrl) scrapers.push({ source: 'colorcito', scraper: colorcito(), url: data.colorUrl });

  for (const { source, scraper, url } of scrapers) {
    try {
      const chapData = await scraper.getLatestChapter(url);
      if (chapData?.thumbnail && !project.thumbnail) project.thumbnail = chapData.thumbnail;
      if (chapData?.chapterNum) LC.set(id, source, { chapterNum: chapData.chapterNum, chapterUrl: chapData.chapterUrl });
    } catch { }
  }

  Proj.save(project);
  invalidateCache(); // nuevo proyecto registrado
  return { reply: SUA.proyecto.agregado(data.nombre), done: true };
}

// ── proyecto.remove ───────────────────────────────────────────────────────────
async function flowProyectoRemove(step, data, message) {
  if (step === 'start') {
    if (!data.proyectoId) {
      const lista = Projects.list().map(p => `\`${p.id}\``).join(', ');
      return {
        reply: `¿Cuál proyecto quieres eliminar? ${K.timida()} Los registrados son: ${lista || 'ninguno aún'}`,
        nextStep: 'awaitId',
      };
    }
    const p = Projects.get(data.proyectoId);
    if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
    return { reply: CONFIRMAR.eliminarProyecto(p.name), nextStep: 'awaitConfirm' };
  }
  if (step === 'awaitId') {
    const t = message.content.replace(/<@!?\d+>/g, '').trim();
    const p = Projects.get(t);
    if (!p) return { reply: `No encontré ningún proyecto con el ID \`${t}\`... ¿está bien escrito? ${K.disculpa()}` };
    data.proyectoId = t;
    return { reply: CONFIRMAR.eliminarProyecto(p.name), nextStep: 'awaitConfirm' };
  }
  if (step === 'awaitConfirm') {
    const resp = message.content.toLowerCase().trim();
    if (/^s[ií]$/.test(resp)) {
      const p = Projects.get(data.proyectoId);
      Projects.delete(data.proyectoId);
      invalidateCache(); // proyecto eliminado
      return { reply: SUA.proyecto.eliminado(p?.name || data.proyectoId), done: true };
    }
    return { reply: CONFIRMAR.cancelado(), done: true };
  }
}

// ── proyecto.toggle ────────────────────────────────────────────────────────────
async function flowProyectoToggle(step, data, message) {
  if (step === 'start') {
    if (!data.proyectoId) {
      return { reply: `¿Cuál proyecto quieres activar o desactivar? Dame su ID ${K.tranqui()}`, nextStep: 'awaitId' };
    }
    return execToggle(data);
  }
  if (step === 'awaitId') {
    data.proyectoId = message.content.replace(/<@!?\d+>/g, '').trim();
    return execToggle(data);
  }
}
function execToggle(data) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
  p.active = !p.active;
  Projects.save(p);
  return { reply: SUA.proyecto.toggleActivo(p.name, p.active), done: true };
}

// ── proyecto.setstatus ─────────────────────────────────────────────────────────
async function flowProyectoSetStatus(step, data, message) {
  const ESTADOS = { ongoing: '📖 En curso', completed: '✅ Completado', hiatus: '⏸️ Hiatus', dropped: '❌ Dropeado' };
  if (step === 'start') {
    if (!data.proyectoId) {
      return { reply: `¿A cuál proyecto le cambio el estado? Dame su ID ${K.tranqui()}`, nextStep: 'awaitId' };
    }
    if (!data.estado) {
      const lista = Object.entries(ESTADOS).map(([k,v]) => `\`${k}\` → ${v}`).join(', ');
      return { reply: `¿Cuál estado le pongo? ${lista} ${K.tranqui()}`, nextStep: 'awaitEstado' };
    }
    return execSetStatus(data);
  }
  if (step === 'awaitId') {
    data.proyectoId = message.content.replace(/<@!?\d+>/g, '').trim();
    const lista = Object.entries(ESTADOS).map(([k,v]) => `\`${k}\` → ${v}`).join(', ');
    return { reply: `¿Cuál estado le pongo? ${lista} ${K.tranqui()}`, nextStep: 'awaitEstado' };
  }
  if (step === 'awaitEstado') {
    const t = message.content.toLowerCase();
    const found = Object.keys(ESTADOS).find(k => t.includes(k));
    if (!found) return { reply: `No reconocí ese estado ${K.disculpa()} Las opciones son: \`ongoing\`, \`completed\`, \`hiatus\`, \`dropped\`` };
    data.estado = found;
    return execSetStatus(data);
  }
}
function execSetStatus(data) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
  p.status = data.estado;
  Projects.save(p);
  return { reply: SUA.proyecto.estadoCambiado(p.name, data.estado), done: true };
}

// ── proyecto.info ──────────────────────────────────────────────────────────────
async function flowProyectoInfo(step, data, message) {
  if (step === 'start') {
    if (!data.proyectoId) {
      return { reply: `¿De cuál proyecto quieres info? Dame su ID ${K.tranqui()}`, nextStep: 'awaitId' };
    }
    return execInfo(data, message);
  }
  if (step === 'awaitId') {
    data.proyectoId = message.content.replace(/<@!?\d+>/g, '').trim();
    return execInfo(data, message);
  }
}
async function execInfo(data, message) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
  const ds = await driveService().getProjectStatus(p.driveFolder).catch(() => ({ found: false }));
  const statusLabels = { ongoing: '📖 En curso', completed: '✅ Completado', hiatus: '⏸️ Hiatus', dropped: '❌ Dropeado' };
  const driveLine = ds.found
    ? driveService().buildStatusLine(ds.subfolders)
    : `❓ No encontré la carpeta \`${p.driveFolder}\``;

  const embed = new EmbedBuilder()
    .setTitle(`📌 ${p.name}`)
    .setColor(0x9b59b6)
    .addFields(
      { name: 'ID',      value: `\`${p.id}\``,              inline: true },
      { name: 'Estado',  value: statusLabels[p.status]||'❓', inline: true },
      { name: 'Activo',  value: p.active ? '✅ Sí' : '❌ No', inline: true },
      { name: 'Fuentes',
        value: [
          p.sources.tmo       ? `📖 [TMO](${p.sources.tmo})`           : null,
          p.sources.colorcito ? `🎨 [Colorcito](${p.sources.colorcito})`: null,
        ].filter(Boolean).join('\n') || 'Ninguna', inline: false },
      { name: '📂 Drive', value: driveLine, inline: false },
    ).setTimestamp();
  if (p.thumbnail) embed.setThumbnail(p.thumbnail);
  return { embeds: [embed], done: true };
}

// ── proyecto.list ──────────────────────────────────────────────────────────────
async function flowProyectoList() {
  const projects = Projects.list();
  if (!projects.length) return { reply: SUA.proyecto.sinProyectos, done: true };
  const statusIcon = { ongoing: '📖', completed: '✅', hiatus: '⏸️', dropped: '❌' };
  const lines = projects.map(p =>
    `${p.active ? '🟢' : '🔴'} ${statusIcon[p.status]||'❓'} **${p.name}** \`${p.id}\``
  );
  const embed = new EmbedBuilder()
    .setTitle(`📋 Proyectos (${projects.length})`)
    .setColor(0x9b59b6)
    .setDescription(lines.join('\n').slice(0, 4000))
    .setFooter({ text: '🟢 activo · 🔴 pausado' });
  return { embeds: [embed], done: true };
}

// ── anunciar ──────────────────────────────────────────────────────────────────
async function flowAnunciar(step, data, message) {
  // ── Helpers de parsing de créditos ────────────────────────────────────────
  function parsearCreditos(texto) {
    // Acepta: "Trad: @Juan, Clean: @Ana" o IDs sueltos separados por coma
    const menciones = [...texto.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
    return menciones.length ? menciones.join(',') : texto.trim() || null;
  }
  function esSaltar(t) {
    return /^(no|saltar|skip|ninguno?|-)$/i.test(t.replace(/<@!?\d+>/g, '').trim());
  }

  if (step === 'start') {
    if (!data.proyectoId) {
      const lista = getProjects().map(p => `**${p.name}** \`${p.id}\``).join('\n');
      return { reply: `¿De cuál proyecto anuncio un capítulo? ${K.feliz()}\n${lista}`, nextStep: 'awaitProyecto' };
    }
    return continueAnunciar(data, message);
  }

  if (step === 'awaitProyecto') {
    const t = message.content.replace(/<@!?\d+>/g, '').trim();
    // Buscar por ID exacto o por nombre aproximado
    let p = Projects.get(t);
    if (!p) p = getProjects().find(pr => normalize(pr.name).includes(normalize(t)) || normalize(pr.id).includes(normalize(t)));
    if (!p) return { reply: `No encontré ese proyecto... ¿puedes darme el ID exacto? ${K.disculpa()}` };
    data.proyectoId = p.id;
    return continueAnunciar(data, message);
  }

  if (step === 'awaitCapitulo') {
    const capMatch = message.content.match(/(\d+(?:[.,]\d+)?)/);
    if (!capMatch) return { reply: `No entendí el número... escríbelo así: \`12\` o \`12.5\` ${K.disculpa()}` };
    data.capitulo = capMatch[1];
    return continueAnunciar(data, message);
  }

  if (step === 'awaitMensaje') {
    if (!esSaltar(message.content)) {
      data.mensajePersonalizado = message.content.replace(/<@!?\d+>/g, '').trim();
    }
    return continueAnunciar(data, message);
  }

  if (step === 'awaitPortada') {
    const t = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!esSaltar(t)) {
      const urlMatch = t.match(/(https?:\/\/[^\s]+)/);
      data.portadaUrl = urlMatch ? urlMatch[1] : null;
    }
    return continueAnunciar(data, message);
  }

  if (step === 'awaitFuente') {
    const t = normalize(message.content);
    if (t.includes('tmo') && !t.includes('color'))      data.fuente = 'tmo';
    else if (t.includes('color'))                        data.fuente = 'colorcito';
    else                                                 data.fuente = 'ambas';
    return continueAnunciar(data, message);
  }

  if (step === 'awaitTmoLink') {
    const t = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!esSaltar(t)) {
      const urlMatch = t.match(/(https?:\/\/[^\s]+)/);
      data.tmoLink = urlMatch ? urlMatch[1] : null;
    }
    return continueAnunciar(data, message);
  }

  if (step === 'awaitTraductores') {
    if (!esSaltar(message.content)) data.traductores = parsearCreditos(message.content);
    return continueAnunciar(data, message);
  }
  if (step === 'awaitCleaners') {
    if (!esSaltar(message.content)) data.cleaners = parsearCreditos(message.content);
    return continueAnunciar(data, message);
  }
  if (step === 'awaitTypeos') {
    if (!esSaltar(message.content)) data.typeos = parsearCreditos(message.content);
    return continueAnunciar(data, message);
  }
  if (step === 'awaitOtros') {
    if (!esSaltar(message.content)) data.otros = parsearCreditos(message.content);
    return execAnunciar(data, message);
  }
}

// Lógica de avance: pide lo que falte en orden
async function continueAnunciar(data, message) {
  const p = Projects.get(data.proyectoId);

  if (!data.capitulo) {
    return {
      reply: `¿Qué número de capítulo anuncio de **${p?.name}**? ${K.tranqui()}`,
      nextStep: 'awaitCapitulo',
    };
  }
  if (!('mensajePersonalizado' in data)) {
    return {
      reply: pick([
        `¿Quieres agregar un mensaje personalizado? ${K.tranqui()} Escríbelo o di **no** para saltar.`,
        `¿Algún mensaje especial para este capítulo? ${K.timida()} Puedes escribirlo o poner **no**.`,
        `¿Le pongo algún texto extra al anuncio? ${K.tranqui()} Escribe el mensaje o **no** para omitir.`,
      ]),
      nextStep: 'awaitMensaje',
    };
  }
  if (!('portadaUrl' in data)) {
    return {
      reply: pick([
        `¿Tienes una URL de portada para este capítulo? ${K.tranqui()} Pégala o di **no**.`,
        `¿Quieres una imagen de portada personalizada? ${K.timida()} Dame la URL o escribe **no**.`,
        `¿La portada tiene URL directa? ${K.tranqui()} Si sí, pégala aquí. Si no, **no**.`,
      ]),
      nextStep: 'awaitPortada',
    };
  }
  // Solo preguntar fuente si el proyecto tiene ambas
  if (!data.fuente && p?.sources?.tmo && p?.sources?.colorcito) {
    return {
      reply: `¿En qué plataforma anuncio? **TMO**, **Colorcito** o **ambas** ${K.tranqui()}`,
      nextStep: 'awaitFuente',
    };
  }
  if (!data.fuente) data.fuente = 'ambas';

  // Solo preguntar link TMO si aplica
  const necesitaTmo = (data.fuente === 'tmo' || data.fuente === 'ambas') && p?.sources?.tmo;
  if (necesitaTmo && !('tmoLink' in data)) {
    return {
      reply: pick([
        `¿Tienes el link directo al capítulo en TMO? ${K.tranqui()} Pégalo o di **no** para que yo lo busque.`,
        `¿Quieres poner un link específico de TMO? ${K.timida()} Si no, dime **no** y lo detecto automático.`,
      ]),
      nextStep: 'awaitTmoLink',
    };
  }

  // Créditos
  if (!('traductores' in data)) {
    return {
      reply: pick([
        `¿Quién tradujo este capítulo? ${K.feliz()} Menciona a los usuarios o di **no**.`,
        `¿Los traductores de este cap? ${K.tranqui()} Mencionálos o escribe **no** para omitir.`,
      ]),
      nextStep: 'awaitTraductores',
    };
  }
  if (!('cleaners' in data)) {
    return {
      reply: pick([
        `¿Y los cleaners? ${K.tranqui()} Mencionálos o di **no**.`,
        `¿Quién hizo el clean? ${K.feliz()} Menciona a los responsables o **no**.`,
      ]),
      nextStep: 'awaitCleaners',
    };
  }
  if (!('typeos' in data)) {
    return {
      reply: pick([
        `¿Los typesetters/typeos? ${K.tranqui()} Mencionálos o di **no**.`,
        `¿Quién hizo el typeo final? ${K.feliz()} Menciónalo o **no** para saltar.`,
      ]),
      nextStep: 'awaitTypeos',
    };
  }
  if (!('otros' in data)) {
    return {
      reply: pick([
        `¿Alguien más que quieras mencionar? ${K.tranqui()} (QC, redibujador...) Di **no** si no.`,
        `¿Hay algún otro colaborador? ${K.feliz()} Menciónalo o di **no**.`,
      ]),
      nextStep: 'awaitOtros',
    };
  }

  return execAnunciar(data, message);
}

async function execAnunciar(data, message) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
  const channelId = p.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) return { reply: SUA.anunciar.sinCanal, done: true };

  // URLs de capítulo
  let chapterUrlTmo = data.tmoLink || null;
  let chapterUrlColor = null;
  let isEcchi = false;

  const fuenteOpt = data.fuente || 'ambas';
  await Promise.all([
    (!chapterUrlTmo && (fuenteOpt === 'tmo' || fuenteOpt === 'ambas') && p.sources?.tmo)
      ? tmo().getLatestChapter(p.sources.tmo).then(d => { if (d) chapterUrlTmo = d.chapterUrl; }).catch(() => {})
      : null,
    ((fuenteOpt === 'colorcito' || fuenteOpt === 'ambas') && p.sources?.colorcito)
      ? colorcito().getLatestChapter(p.sources.colorcito).then(d => {
          if (d) { chapterUrlColor = d.chapterUrl; if (d.isEcchi) isEcchi = true; }
        }).catch(() => {})
      : null,
  ].filter(Boolean));

  const chapData = {
    chapterNum:   data.capitulo,
    chapterTitle: null,
    chapterUrl:   chapterUrlTmo || chapterUrlColor || null,
    thumbnail:    data.portadaUrl || p.thumbnail || null,
    urlTmo:       chapterUrlTmo  || null,
    urlColorcito: p.sources?.colorcito || chapterUrlColor || null,
  };

  // Construir créditos
  function idsToMentions(raw) {
    if (!raw) return null;
    return raw.split(',').map(id => id.trim())
      .filter(id => /^\d{17,20}$/.test(id))
      .map(id => `<@${id}>`).join(' ');
  }
  const credits = [];
  const mencTrad   = idsToMentions(data.traductores);
  const mencClean  = idsToMentions(data.cleaners);
  const mencTypeo  = idsToMentions(data.typeos);
  const mencOtros  = idsToMentions(data.otros);
  if (mencTrad)  credits.push(`📝 **Traducción:** ${mencTrad}`);
  if (mencClean) credits.push(`🧹 **Clean:** ${mencClean}`);
  if (mencTypeo) credits.push(`✏️ **Typeo/Final:** ${mencTypeo}`);
  if (mencOtros) credits.push(`🌟 **Otros:** ${mencOtros}`);
  if (!credits.length && p.defaultCredits) credits.push(p.defaultCredits);

  // Nota ecchi (mismas frases del comando original)
  const ECCHI_FRASES = [
    'S-s-sua no aprueba este capítulo... p-pero aquí está (〃>_<;〃)',
    'V-valk... ¿en serio me haces anunciar esto? (〃>_<;〃) Está bien... aquí va.',
    '¡V-valk! Yo no pedí trabajar en este scan para esto... (//∇//) pero bueno.',
    'E-esto fue idea de Valk, no mía. Yo solo soy la mensajera inocente (〃ω〃)',
    'Valk me dijo que anunciara esto con una sonrisa... (〃>_<;〃) no puedo.',
    'A-ay... este capítulo es un poco... ya saben. Sua se tapa los ojos (//>/<//)',
    'Sua deja esto aquí y se va sin mirar... (*ノωノ)',
    'E-este... es un capítulo especial. Sua no dice nada más (//∇//)',
    '...Sua miró sin querer y ahora está muy roja. Disfruten (*ノωノ)',
    'S-sua no sabe nada de este capítulo. Nada. No lo vio. (〃>_<;〃)',
    'E-el equipo puso mucho cariño aquí... y otras cosas. Sua no dice más (//∇//)',
    'S-sua tiene valores. Sua también tiene trabajo. El trabajo ganó hoy (/ω＼)',
  ];
  if (!global._ecchiUsadas) global._ecchiUsadas = [];
  const disponibles = ECCHI_FRASES.filter(f => !global._ecchiUsadas.includes(f));
  const pool  = disponibles.length >= 5 ? disponibles : ECCHI_FRASES;
  const frase = pool[Math.floor(Math.random() * pool.length)];
  if (isEcchi) {
    global._ecchiUsadas.push(frase);
    if (global._ecchiUsadas.length > 5) global._ecchiUsadas.shift();
  }

  const ecchiNote    = isEcchi ? ('\n\n*' + frase + '*') : '';
  const mensajeFinal = ((data.mensajePersonalizado || '') + ecchiNote).trim() || null;

  const msg = await announcer().sendManualAnnouncement(message.client, p, chapData, {
    customMessage: mensajeFinal,
    imageUrl:      data.portadaUrl || null,
    credits,
    extraRoles:    [],
  }).catch(() => null);

  if (!msg) return { reply: SUA.anunciar.errorEnvio, done: true };
  return { reply: SUA.anunciar.enviado(p.name, data.capitulo), done: true };
}

// ── avisar ────────────────────────────────────────────────────────────────────
async function flowAvisar(step, data, message) {
  function clean(t) { return t.replace(/<@!?\d+>/g, '').trim(); }
  function esSaltar(t) { return /^(no|saltar|skip|ninguno?|-)$/i.test(clean(t)); }

  if (step === 'start') {
    if (!data.titulo) {
      return {
        reply: pick([
          `¿Cuál es el título del aviso? ${K.tranqui()} (ej: "📢 Comunicado importante")`,
          `¿Con qué título publico el aviso? ${K.feliz()} Puedes incluir un emoji si quieres.`,
          `Dame el título del aviso ${K.tranqui()} Por ejemplo: "🔔 Actualización del scan"`,
        ]),
        nextStep: 'awaitTitulo',
      };
    }
    return continueAvisar(data, message);
  }

  if (step === 'awaitTitulo') {
    data.titulo = clean(message.content);
    return continueAvisar(data, message);
  }
  if (step === 'awaitMensaje') {
    data.mensaje = clean(message.content).replace(/\\n/g, '\n');
    return continueAvisar(data, message);
  }
  if (step === 'awaitPing') {
    const t = normalize(message.content);
    if (t.includes('here'))         data.ping = 'here';
    else if (t.includes('no') || t.includes('ninguno') || t.includes('sin')) data.ping = 'none';
    else                            data.ping = 'everyone';
    return continueAvisar(data, message);
  }
  if (step === 'awaitFirma') {
    const t = clean(message.content);
    if (!esSaltar(t)) data.firma = t;
    return continueAvisar(data, message);
  }
  if (step === 'awaitImagen') {
    const t = clean(message.content);
    if (!esSaltar(t)) {
      const urlMatch = t.match(/(https?:\/\/[^\s]+)/);
      data.imagen = urlMatch ? urlMatch[1] : null;
    }
    return execAvisar(data, message);
  }
}

async function continueAvisar(data, message) {
  if (!data.mensaje) {
    return {
      reply: pick([
        `Perfecto. Ahora escribe el cuerpo del aviso ${K.tranqui()} (usa \\n para saltos de línea)`,
        `¡Buen título! Ahora el texto del aviso ${K.feliz()} Puedes usar \\n para párrafos nuevos.`,
        `E-entendido. ¿Qué dice el aviso? ${K.timida()} Escribe el mensaje completo.`,
      ]),
      nextStep: 'awaitMensaje',
    };
  }
  if (!('ping' in data)) {
    return {
      reply: pick([
        `¿A quién menciono? **@everyone**, **@here** o **no** para publicar sin mención ${K.tranqui()}`,
        `¿Le pongo mención? Escribe **everyone**, **here** o **no** ${K.timida()}`,
        `¿Notifico a alguien? **everyone**, **here** o **no** para sin mención ${K.tranqui()}`,
      ]),
      nextStep: 'awaitPing',
    };
  }
  if (!('firma' in data)) {
    return {
      reply: pick([
        `¿Quieres cambiar la firma? Por defecto es *"Líder del equipo de Aeternum Translations."* ${K.tranqui()} Escribe la nueva o di **no**.`,
        `¿Firma personalizada? La predeterminada es *"Líder del equipo de Aeternum Translations."* ${K.timida()} Escribe una o **no** para usar la default.`,
      ]),
      nextStep: 'awaitFirma',
    };
  }
  if (!('imagen' in data)) {
    return {
      reply: pick([
        `¿Quieres adjuntar una imagen? ${K.tranqui()} Pega la URL directa o di **no**.`,
        `¿Le pongo alguna imagen al aviso? ${K.feliz()} Dame la URL o di **no** para omitirla.`,
        `¿Imagen adjunta? ${K.timida()} Pega el link o escribe **no**.`,
      ]),
      nextStep: 'awaitImagen',
    };
  }
  return execAvisar(data, message);
}

async function execAvisar(data, message) {
  const STAFF_GUILD_ID   = process.env.DISCORD_GUILD_ID;
  const STAFF_NOTICE_ID  = process.env.STAFF_NOTICE_ID || '1368814037743177789';
  const READER_NOTICE_ID = process.env.NOTICE_CHANNEL_ID;
  const esStaff    = message.guildId === STAFF_GUILD_ID;
  const channelId  = esStaff ? STAFF_NOTICE_ID : READER_NOTICE_ID;
  if (!channelId) return { reply: SUA.avisar.sinCanal, done: true };

  let channel = null;
  try {
    if (esStaff) {
      channel = await message.guild.channels.fetch(channelId).catch(() => null);
    } else {
      const guild = await message.client.guilds.fetch(process.env.DISCORD_READER_GUILD_ID);
      channel = await guild.channels.fetch(channelId).catch(() => null);
    }
  } catch { }
  if (!channel) return { reply: SUA.avisar.sinCanal, done: true };

  const pingOpt = data.ping || 'everyone';
  const firma   = data.firma || 'Líder del equipo de Aeternum Translations.';

  const lines = [];
  if (pingOpt === 'everyone') lines.push('@everyone');
  else if (pingOpt === 'here') lines.push('@here');
  lines.push('');
  lines.push(`## ${data.titulo}`);
  lines.push('');
  lines.push(data.mensaje);
  lines.push('');
  lines.push('Atentamente,');
  lines.push(`**${firma}**`);

  const msgContent = lines.join('\n');
  const allowedMentions = { parse: [] };
  if (pingOpt !== 'none') allowedMentions.parse.push('everyone');

  const payload = { content: msgContent, allowedMentions };
  if (data.imagen) payload.files = [{ attachment: data.imagen, name: 'imagen.jpg' }];

  await channel.send(payload);
  return { reply: SUA.avisar.publicado, done: true };
}

// ── status ────────────────────────────────────────────────────────────────────
async function flowStatus(step, data, message) {
  if (step !== 'start') return null;

  // Con proyecto específico
  if (data.proyectoId) return execStatus(data);

  // Sin proyecto → mostrar resumen de todos los activos
  const projects = Projects.list().filter(p => p.active);
  if (!projects.length) return { reply: SUA.status.sinActivos, done: true };

  const lines = projects.map(p => {
    const lastTmo   = LastChapters.get(p.id, 'tmo');
    const lastColor = LastChapters.get(p.id, 'colorcito');
    const last = lastTmo || lastColor;
    return `${p.active ? '🟢' : '🔴'} **${p.name}** — último cap: **${last?.chapterNum || '—'}**`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📊 Estado de proyectos activos')
    .setColor(0x9b59b6)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Revisé todo con mucho cuidado (っ˘ω˘ς)' });
  return { embeds: [embed], done: true };
}

async function execStatus(data) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };

  const lastTmo   = LastChapters.get(p.id, 'tmo');
  const lastColor = LastChapters.get(p.id, 'colorcito');
  const last      = lastTmo || lastColor;

  const statusLabels = {
    ongoing: '📖 En curso', completed: '✅ Completado',
    hiatus: '⏸️ Hiatus', dropped: '❌ Dropeado',
  };

  // Intentar obtener datos de Drive
  let driveField = null;
  try {
    const ds = await driveService().getProjectStatus(p.driveFolder, p.category);
    if (ds.found) {
      const { summary, totalCaps } = ds;
      driveField = [
        `🧹 Cleans: **${summary.withClean}/${totalCaps}**`,
        `📝 Traducciones: **${summary.withTrad}/${totalCaps}**`,
        `✏️ Finals: **${summary.withFinal}/${totalCaps}**`,
        `🟢 Subidos: **${summary.withUploaded}/${totalCaps}**`,
      ].join('  ·  ');
    }
  } catch { /* Drive no disponible, no es crítico */ }

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${p.name}`)
    .setColor(0x9b59b6)
    .addFields(
      { name: 'Último capítulo', value: last ? `Cap. **${last.chapterNum}**` : 'Sin datos aún', inline: true },
      { name: 'Estado',          value: statusLabels[p.status] || p.status,                    inline: true },
      { name: 'Activo',          value: p.active ? '✅ Sí' : '🔴 No',                          inline: true },
    )
    .setFooter({ text: 'Aquí está lo que encontré (っ˘ω˘ς)' });

  if (driveField) embed.addFields({ name: '📂 Google Drive', value: driveField, inline: false });
  if (p.thumbnail) embed.setThumbnail(p.thumbnail);

  return { embeds: [embed], done: true };
}

// ── salud ─────────────────────────────────────────────────────────────────────
async function flowSalud(message) {
  // Aviso inmediato — el diagnóstico puede tardar unos segundos
  await message.channel.send(pick([
    `D-dame un momento, me voy a revisar bien antes de responder ${K.tranqui()}`,
    `Voy a hacerme un chequeo completo, ya vuelvo ${K.feliz()}`,
    `E-espera un poquito, me estoy revisando por dentro ${K.timida()}`,
  ]));

  const fields   = [];   // campos del embed
  let   errores  = 0;
  let   warnings = 0;

  // ── 1. Discord ──────────────────────────────────────────────────────────
  const ping = message.client.ws.ping;
  let discordLine;
  if      (ping < 150) discordLine = `✅ Latencia: **${ping}ms** — perfecta`;
  else if (ping < 350) { discordLine = `⚠️ Latencia: **${ping}ms** — un poco lenta`; warnings++; }
  else                 { discordLine = `❌ Latencia: **${ping}ms** — muy lenta`; errores++; }

  // Uptime del proceso
  const uptimeSeg = Math.floor(process.uptime());
  const hh = Math.floor(uptimeSeg / 3600);
  const mm = Math.floor((uptimeSeg % 3600) / 60);
  const uptimeStr = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;

  // Memoria
  const mem = process.memoryUsage();
  const memMB = Math.round(mem.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const memLine = memMB < 300
    ? `✅ Memoria: **${memMB}/${memTotalMB} MB**`
    : `⚠️ Memoria: **${memMB}/${memTotalMB} MB** — algo alta`;
  if (memMB >= 300) warnings++;

  fields.push({
    name: '🤖 Discord & Sistema',
    value: [
      discordLine,
      memLine,
      `✅ Uptime: **${uptimeStr}**`,
      `✅ Node.js: **${process.version}**`,
    ].join('\n'),
    inline: false,
  });

  // ── 2. Variables de entorno ─────────────────────────────────────────────
  const VARS_REQUERIDAS = [
    'DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID',
    'GDRIVE_ROOT_FOLDER_ID', 'ANNOUNCEMENT_CHANNEL_ID',
  ];
  const VARS_OPCIONALES = [
    'DISCORD_READER_GUILD_ID', 'ANNOUNCER_ROLE_ID', 'MOD_ROLE_ID',
    'NOTICE_CHANNEL_ID', 'STAFF_NOTICE_ID', 'COVERS_CHANNEL_ID',
    'GOOGLE_SERVICE_ACCOUNT_KEY', 'CHECK_INTERVAL_MINUTES', 'TIMEZONE',
  ];

  const faltanReq = VARS_REQUERIDAS.filter(v => !process.env[v]);
  const faltanOpt = VARS_OPCIONALES.filter(v => !process.env[v]);

  let envLines = [];
  if (faltanReq.length === 0) {
    envLines.push(`✅ Variables obligatorias: todas presentes`);
  } else {
    envLines.push(`❌ Faltan obligatorias: \`${faltanReq.join(', ')}\``);
    errores++;
  }
  if (faltanOpt.length === 0) {
    envLines.push(`✅ Variables opcionales: todas configuradas`);
  } else {
    envLines.push(`⚠️ Opcionales sin configurar: \`${faltanOpt.join(', ')}\``);
    warnings++;
  }

  fields.push({ name: '⚙️ Variables de entorno', value: envLines.join('\n'), inline: false });

  // ── 3. Google Drive ─────────────────────────────────────────────────────
  let driveLines = [];
  try {
    const folders = await driveService().listFolder(process.env.GDRIVE_ROOT_FOLDER_ID);
    const n = Array.isArray(folders) ? folders.length : '?';
    driveLines.push(`✅ Conexión OK — **${n}** carpeta(s) raíz visible(s)`);
  } catch (err) {
    driveLines.push(`❌ Sin conexión: \`${err.message?.slice(0, 80)}\``);
    errores++;
  }
  fields.push({ name: '📂 Google Drive', value: driveLines.join('\n'), inline: false });

  // ── 4. Proyectos ────────────────────────────────────────────────────────
  const proyectos       = Projects.list();
  const activos         = proyectos.filter(p => p.active);
  const sinCanal        = proyectos.filter(p => !p.announcementChannel && !process.env.ANNOUNCEMENT_CHANNEL_ID);
  const sinFuentes      = proyectos.filter(p => !p.sources?.tmo && !p.sources?.colorcito);
  const sinDrive        = proyectos.filter(p => !p.driveFolder);
  const sinPortada      = proyectos.filter(p => !p.thumbnail);

  let projLines = [
    `✅ Total: **${proyectos.length}** proyecto(s) | Activos: **${activos.length}**`,
  ];
  if (sinCanal.length)   { projLines.push(`⚠️ Sin canal de anuncios: ${sinCanal.map(p=>`\`${p.id}\``).join(', ')}`);   warnings++; }
  if (sinFuentes.length) { projLines.push(`⚠️ Sin fuentes (TMO/Colorcito): ${sinFuentes.map(p=>`\`${p.id}\``).join(', ')}`); warnings++; }
  if (sinDrive.length)   { projLines.push(`⚠️ Sin carpeta Drive: ${sinDrive.map(p=>`\`${p.id}\``).join(', ')}`);        warnings++; }
  if (sinPortada.length) { projLines.push(`ℹ️ Sin portada: ${sinPortada.map(p=>`\`${p.id}\``).join(', ')}`); }
  if (!sinCanal.length && !sinFuentes.length && !sinDrive.length) {
    projLines.push(`✅ Todos los proyectos están bien configurados`);
  }
  fields.push({ name: '📋 Proyectos', value: projLines.join('\n'), inline: false });

  // ── 5. Scraper TMO ──────────────────────────────────────────────────────
  const proyConTmo = activos.find(p => p.sources?.tmo);
  let tmoLine;
  if (!proyConTmo) {
    tmoLine = `ℹ️ Sin proyectos activos con TMO para probar`;
  } else {
    try {
      const res = await Promise.race([
        tmo().getLatestChapter(proyConTmo.sources.tmo),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout (8s)')), 8000)),
      ]);
      tmoLine = res
        ? `✅ Responde OK — último cap detectado: **${res.chapterNum}** en \`${proyConTmo.id}\``
        : `⚠️ Respondió pero sin datos`;
      if (!res) warnings++;
    } catch (err) {
      tmoLine = `❌ Sin respuesta: \`${err.message}\``;
      errores++;
    }
  }

  // ── 6. Scraper Colorcito ────────────────────────────────────────────────
  const proyConColor = activos.find(p => p.sources?.colorcito);
  let colorLine;
  if (!proyConColor) {
    colorLine = `ℹ️ Sin proyectos activos con Colorcito para probar`;
  } else {
    try {
      const res = await Promise.race([
        colorcito().getLatestChapter(proyConColor.sources.colorcito),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout (8s)')), 8000)),
      ]);
      colorLine = res
        ? `✅ Responde OK — último cap detectado: **${res.chapterNum}** en \`${proyConColor.id}\``
        : `⚠️ Respondió pero sin datos`;
      if (!res) warnings++;
    } catch (err) {
      colorLine = `❌ Sin respuesta: \`${err.message}\``;
      errores++;
    }
  }

  fields.push({
    name: '🔍 Scrapers',
    value: [`📖 TMO: ${tmoLine}`, `🎨 Colorcito: ${colorLine}`].join('\n'),
    inline: false,
  });

  // ── 7. Canales configurados ─────────────────────────────────────────────
  const anuncioId = process.env.ANNOUNCEMENT_CHANNEL_ID;
  const noticeId  = process.env.NOTICE_CHANNEL_ID || process.env.STAFF_NOTICE_ID;
  let canalLines = [];
  canalLines.push(anuncioId ? `✅ Canal de anuncios: <#${anuncioId}>` : `⚠️ Canal de anuncios: no configurado`);
  canalLines.push(noticeId  ? `✅ Canal de avisos: configurado`         : `⚠️ Canal de avisos: no configurado`);
  if (!anuncioId) warnings++;
  fields.push({ name: '📢 Canales', value: canalLines.join('\n'), inline: false });

  // ── Resumen y color del embed ───────────────────────────────────────────
  const color   = errores > 0 ? 0xe74c3c : warnings > 0 ? 0xf39c12 : 0x2ecc71;
  const icono   = errores > 0 ? '🔴' : warnings > 0 ? '🟡' : '🟢';
  const resumen = errores > 0
    ? `${icono} **${errores}** error(es) y **${warnings}** aviso(s) encontrados`
    : warnings > 0
    ? `${icono} Todo funciona, pero hay **${warnings}** aviso(s) que revisar`
    : `${icono} ¡Todo en orden! Ningún problema encontrado`;

  const intros = errores > 0 ? [
    `E-eh... me revisé y encontré algunos problemas... ${K.triste()} Te los cuento:`,
    `A-ay... hay cosas que no están bien. No quería decirlo pero... ${K.triste()} aquí está el reporte:`,
    `M-me revisé con cuidado y... hay cosas que mejorar ${K.disculpa()} Mira:`,
  ] : warnings > 0 ? [
    `Me revisé y en general estoy bien, pero hay algunas cosas que quería comentarte ${K.tranqui()}`,
    `Todo funciona, p-pero encontré algunos detalles que vale la pena revisar ${K.timida()}`,
    `¡Sigo de pie! Aunque tengo un par de avisos para ti ${K.tranqui()}`,
  ] : [
    `¡Me revisé completo y todo está perfecto! ${K.feliz()} Aquí el reporte:`,
    `Me hice el chequeo más completo que pude y... ¡todo en orden! ${K.feliz()}`,
    `Todo funciona de maravilla, aquí está el reporte completo ${K.feliz()}`,
  ];

  const cierres = errores > 0 ? [
    `*V-valk debería revisar esto cuando pueda... ${K.triste()}*`,
    `*Disculpen las molestias, haré lo mejor que pueda mientras tanto (´• ω •\`)ゞ*`,
    `*Espero que se resuelva pronto... yo sigo trabajando ${K.timida()}*`,
  ] : warnings > 0 ? [
    `*No es urgente, p-pero mejor revisarlo pronto ${K.tranqui()}*`,
    `*En general estoy bien, solo hay cositas menores (っ˘ω˘ς)*`,
    `*Sigo funcionando normal, pero avísale a Valk ${K.timida()}*`,
  ] : [
    `*Estaré aquí siempre que me necesiten (っ˘ω˘ς)*`,
    `*Lista para lo que sea ${K.feliz()}*`,
    `*Todo bajo control, ¡gracias por preguntar! (◕‿◕✿)*`,
  ];

  const embed = new EmbedBuilder()
    .setTitle(`🩺 Diagnóstico completo de Sua`)
    .setDescription(`${pick(intros)}\n\n${resumen}`)
    .setColor(color)
    .addFields(fields)
    .setFooter({ text: pick(cierres) })
    .setTimestamp();

  return { embeds: [embed], done: true };
}

// ── sincronizar ───────────────────────────────────────────────────────────────
async function flowSincronizar(data, message) {
  const projects = data.proyectoId
    ? [Projects.get(data.proyectoId)].filter(Boolean)
    : Projects.list().filter(p => p.active);

  if (!projects.length) return { reply: `No encontré proyectos para sincronizar ${K.disculpa()}`, done: true };

  await message.channel.send(`Sincronizando **${projects.length}** proyecto(s)... ${K.tranqui()} Te aviso cuando termine.`);

  (async () => {
    let actualizados = 0;
    for (const project of projects) {
      for (const [source, scraper] of [['tmo', tmo()], ['colorcito', colorcito()]]) {
        const url = project.sources?.[source];
        if (!url) continue;
        try {
          const chapData = await scraper.getLatestChapter(url);
          if (!chapData?.chapterNum) continue;
          const cached = LastChapters.get(project.id, source);
          const liveN  = parseFloat(String(chapData.chapterNum).replace(',', '.'));
          const cachedN = cached ? parseFloat(String(cached.chapterNum).replace(',', '.')) : -1;
          if (liveN > cachedN) {
            LastChapters.set(project.id, source, { chapterNum: chapData.chapterNum, chapterUrl: chapData.chapterUrl });
            actualizados++;
          }
        } catch { }
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    message.channel.send(
      `¡Listo! ${K.feliz()} Sincronicé **${projects.length}** proyecto(s). ` +
      (actualizados > 0 ? `Actualicé **${actualizados}** capítulo(s).` : 'Todo ya estaba al día.')
    ).catch(() => {});
  })();

  return { done: true };
}

// ── buscar ────────────────────────────────────────────────────────────────────
async function flowBuscar(step, data, message) {
  if (step === 'start') {
    if (!data.query) {
      return { reply: `¿Qué manga o manhwa quieres buscar? ${K.tranqui()}`, nextStep: 'awaitQuery' };
    }
    return execBuscar(data, message);
  }
  if (step === 'awaitQuery') {
    data.query = message.content.replace(/<@!?\d+>/g, '').trim();
    data.fuente = 'ambas';
    return execBuscar(data, message);
  }
}
async function execBuscar(data, message) {
  let results = [];
  if (data.fuente !== 'colorcito') {
    const r = await tmo().searchManga(data.query).catch(() => []);
    results.push(...r.map(x => ({ ...x, source: 'tmo' })));
  }
  if (data.fuente !== 'tmo') {
    const r = await colorcito().searchManga(data.query).catch(() => []);
    results.push(...r.map(x => ({ ...x, source: 'colorcito' })));
  }
  if (!results.length) {
    return { reply: `No encontré resultados para **"${data.query}"** ${K.triste()}`, done: true };
  }
  results = results.slice(0, 8);
  const lines = results.map((r, i) => `**${i+1}.** [${r.name}](${r.url}) \`${r.source.toUpperCase()}\``);
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Resultados para "${data.query}"`)
    .setColor(0x9b59b6)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Usa /proyecto add para registrar uno' });
  return { embeds: [embed], done: true };
}

// ── configurar ───────────────────────────────────────────────────────────────
async function flowConfigurar(step, data, message) {
  function clean(t) { return t.replace(/<@!?\d+>/g, '').trim(); }
  function esSaltar(t) { return /^(no|saltar|skip|ninguno?|-)$/i.test(clean(t)); }

  // Menú principal — preguntar qué quiere configurar
  const MENU = [
    '`canal` — cambiar el canal de anuncios (global o por proyecto)',
    '`reacciones` — emojis de reacción de un proyecto',
    '`rol` — rol de ping de un proyecto en el servidor de lectores',
    '`avisos` — canal donde se publican los avisos oficiales',
    '`verificar` — forzar una revisión de capítulos ahora mismo',
    '`info` — ver la configuración actual del bot',
  ].join('\n');

  if (step === 'start') {
    // Si ya dijo qué en el mismo mensaje (ej: "@Sua configura el canal")
    const t = normalize(clean(message.content));
    if (/canal\b/.test(t))       { data.sub = 'canal';      return continueConfigurar(data, message); }
    if (/reaccione?s?\b/.test(t)){ data.sub = 'reacciones'; return continueConfigurar(data, message); }
    if (/\brol\b/.test(t))       { data.sub = 'rol';        return continueConfigurar(data, message); }
    if (/aviso/.test(t))          { data.sub = 'avisos';     return continueConfigurar(data, message); }
    if (/verifica(r)?\b/.test(t)){ data.sub = 'verificar';  return continueConfigurar(data, message); }
    if (/info\b/.test(t))        { data.sub = 'info';       return continueConfigurar(data, message); }

    return {
      reply: pick([
        `¿Qué quieres configurar? ${K.tranqui()} Dime una opción:\n\n${MENU}`,
        `Claro, ¿qué ajuste necesitas? ${K.feliz()} Estas son las opciones:\n\n${MENU}`,
        `E-eh, ¿qué configuramos? ${K.timida()} Dime cuál:\n\n${MENU}`,
      ]),
      nextStep: 'awaitSub',
    };
  }

  if (step === 'awaitSub') {
    const t = normalize(clean(message.content));
    if (/canal\b/.test(t))        data.sub = 'canal';
    else if (/reaccione?s?\b/.test(t)) data.sub = 'reacciones';
    else if (/\brol\b/.test(t))  data.sub = 'rol';
    else if (/aviso/.test(t))      data.sub = 'avisos';
    else if (/verifica(r)?\b/.test(t)) data.sub = 'verificar';
    else if (/info\b/.test(t))    data.sub = 'info';
    else return { reply: `No reconocí esa opción ${K.disculpa()} Las opciones son: \`canal\`, \`reacciones\`, \`rol\`, \`avisos\`, \`verificar\`, \`info\`` };
    return continueConfigurar(data, message);
  }

  // ── Steps por sub ────────────────────────────────────────────────────────
  if (step === 'awaitCanalGlobal') {
    const t = clean(message.content);
    const chMatch = t.match(/<#(\d+)>/);
    data.canalId = chMatch ? chMatch[1] : t;
    data.proyectoId = null;
    return execConfigurar(data, message);
  }
  if (step === 'awaitCanalProyecto') {
    const t = clean(message.content);
    // ¿Es un canal o un "no" (= canal global)?
    if (esSaltar(t)) {
      data.proyectoId = null;
      return { reply: `Entendido, lo pondré global. ¿En qué canal? Menciona el canal con # ${K.tranqui()}`, nextStep: 'awaitCanalGlobal' };
    }
    const chMatch = t.match(/<#(\d+)>/);
    data.canalId = chMatch ? chMatch[1] : t;
    return execConfigurar(data, message);
  }
  if (step === 'awaitProyectoReacc') {
    const t = clean(message.content);
    let p = Projects.get(t);
    if (!p) p = getProjects().find(pr => normalize(pr.name).includes(normalize(t)));
    if (!p) return { reply: `No encontré ese proyecto ${K.disculpa()} Dame el ID exacto.` };
    data.proyectoId = p.id;
    return { reply: `¿Qué emojis le pongo? Sepáralos con espacios ${K.tranqui()} (ej: ❤️ 🔥 👏)`, nextStep: 'awaitEmojis' };
  }
  if (step === 'awaitEmojis') {
    data.emojis = clean(message.content);
    return execConfigurar(data, message);
  }
  if (step === 'awaitProyectoRol') {
    const t = clean(message.content);
    let p = Projects.get(t);
    if (!p) p = getProjects().find(pr => normalize(pr.name).includes(normalize(t)));
    if (!p) return { reply: `No encontré ese proyecto ${K.disculpa()} Dame el ID exacto.` };
    data.proyectoId = p.id;
    return { reply: `¿Cuál es el ID del rol en el servidor de lectores? ${K.tranqui()} (clic derecho en el rol → Copiar ID)`, nextStep: 'awaitRolId' };
  }
  if (step === 'awaitRolId') {
    const t = clean(message.content);
    if (esSaltar(t)) { data.rolId = null; return execConfigurar(data, message); }
    if (!/^\d{17,20}$/.test(t)) return { reply: `Ese ID no parece válido ${K.disculpa()} Debe ser solo números (17-20 dígitos). Activa el Modo Desarrollador si no lo ves.` };
    data.rolId = t;
    return execConfigurar(data, message);
  }
  if (step === 'awaitCanalAvisos') {
    const t = clean(message.content);
    const chMatch = t.match(/<#(\d+)>/);
    data.canalId = chMatch ? chMatch[1] : t;
    return execConfigurar(data, message);
  }
  if (step === 'awaitProyectoCanal') {
    const t = clean(message.content);
    if (esSaltar(t)) {
      data.proyectoId = null;
      return { reply: `Bien, canal global. ¿En cuál canal? Menciónalo con # ${K.tranqui()}`, nextStep: 'awaitCanalGlobal' };
    }
    let p = Projects.get(t);
    if (!p) p = getProjects().find(pr => normalize(pr.name).includes(normalize(t)));
    if (!p) return { reply: `No encontré ese proyecto ${K.disculpa()} Dame el ID o di **no** para canal global.` };
    data.proyectoId = p.id;
    return { reply: `¿En qué canal anuncio **${p.name}**? Menciónalo con # ${K.tranqui()}`, nextStep: 'awaitCanalProyecto' };
  }
}

async function continueConfigurar(data, message) {
  const { sub } = data;

  if (sub === 'canal') {
    if (!('proyectoId' in data)) {
      const lista = getProjects().map(p => `\`${p.id}\``).join(', ');
      return {
        reply: pick([
          `¿Es para un proyecto específico o el canal global? ${K.tranqui()} Dame el ID del proyecto o di **no** para global.\nProyectos: ${lista}`,
          `¿Para qué proyecto configuro el canal? ${K.timida()} Escribe el ID o **no** para el canal global.\nProyectos: ${lista}`,
        ]),
        nextStep: 'awaitProyectoCanal',
      };
    }
    if (!data.canalId) {
      return { reply: `¿En qué canal publico los anuncios? Menciónalo con # ${K.tranqui()}`, nextStep: 'awaitCanalGlobal' };
    }
    return execConfigurar(data, message);
  }

  if (sub === 'reacciones') {
    if (!data.proyectoId) {
      const lista = getProjects().map(p => `\`${p.id}\``).join(', ');
      return { reply: `¿A cuál proyecto le configuro las reacciones? ${K.tranqui()} Proyectos: ${lista}`, nextStep: 'awaitProyectoReacc' };
    }
    if (!data.emojis) {
      return { reply: `¿Qué emojis le pongo? Sepáralos con espacios ${K.tranqui()} (ej: ❤️ 🔥 👏)`, nextStep: 'awaitEmojis' };
    }
    return execConfigurar(data, message);
  }

  if (sub === 'rol') {
    if (!data.proyectoId) {
      const lista = getProjects().map(p => `\`${p.id}\``).join(', ');
      return { reply: `¿A cuál proyecto le asigno el rol? ${K.tranqui()} Proyectos: ${lista}`, nextStep: 'awaitProyectoRol' };
    }
    if (!('rolId' in data)) {
      return { reply: `¿Cuál es el ID del rol en el servidor de lectores? ${K.tranqui()} (clic derecho → Copiar ID)`, nextStep: 'awaitRolId' };
    }
    return execConfigurar(data, message);
  }

  if (sub === 'avisos') {
    if (!data.canalId) {
      return { reply: `¿En qué canal publico los avisos? Menciónalo con # ${K.tranqui()}`, nextStep: 'awaitCanalAvisos' };
    }
    return execConfigurar(data, message);
  }

  if (sub === 'verificar' || sub === 'info') {
    return execConfigurar(data, message);
  }
}

async function execConfigurar(data, message) {
  const { sub } = data;
  const guild  = message.guild;
  const client = message.client;

  // ── canal ────────────────────────────────────────────────────────────────
  if (sub === 'canal') {
    if (data.proyectoId) {
      const p = Projects.get(data.proyectoId);
      if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
      p.announcementChannel = data.canalId;
      Projects.save(p);
      return { reply: `✅ Canal de **${p.name}** actualizado a <#${data.canalId}> ${K.feliz()}`, done: true };
    }
    process.env.ANNOUNCEMENT_CHANNEL_ID = data.canalId;
    return { reply: `✅ Canal de anuncios global actualizado a <#${data.canalId}> ${K.feliz()}\n⚠️ Para que persista al reiniciar, actualiza \`ANNOUNCEMENT_CHANNEL_ID\` en tu \`.env\`.`, done: true };
  }

  // ── reacciones ───────────────────────────────────────────────────────────
  if (sub === 'reacciones') {
    const p = Projects.get(data.proyectoId);
    if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
    const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)/gu;
    const emojis = data.emojis.match(emojiRegex) || [];
    if (!emojis.length) return { reply: `No detecté emojis válidos ${K.disculpa()} Usa emojis estándar o custom del servidor.`, done: true };
    p.reactions = emojis;
    Projects.save(p);
    return { reply: `✅ Reacciones de **${p.name}** actualizadas: ${emojis.join(' ')} ${K.feliz()}`, done: true };
  }

  // ── rol ──────────────────────────────────────────────────────────────────
  if (sub === 'rol') {
    const p = Projects.get(data.proyectoId);
    if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
    p.readerRoleId = data.rolId || null;
    Projects.save(p);
    return {
      reply: data.rolId
        ? `✅ Rol de ping de **${p.name}** actualizado al ID \`${data.rolId}\` ${K.feliz()}`
        : `✅ Rol de ping de **${p.name}** eliminado ${K.tranqui()}`,
      done: true,
    };
  }

  // ── avisos ───────────────────────────────────────────────────────────────
  if (sub === 'avisos') {
    const esStaff = message.guildId === process.env.DISCORD_GUILD_ID;
    if (esStaff) process.env.STAFF_NOTICE_ID  = data.canalId;
    else         process.env.NOTICE_CHANNEL_ID = data.canalId;
    return {
      reply: `✅ Canal de avisos actualizado a <#${data.canalId}> ${K.feliz()}\n⚠️ Para que persista, actualiza \`${esStaff ? 'STAFF_NOTICE_ID' : 'NOTICE_CHANNEL_ID'}\` en tu \`.env\`.`,
      done: true,
    };
  }

  // ── verificar ────────────────────────────────────────────────────────────
  if (sub === 'verificar') {
    await message.channel.send(pick([
      `Iniciando verificación manual... ${K.tranqui()} Dame un momento.`,
      `Voy a revisar si hay capítulos nuevos ahora mismo ${K.feliz()}`,
      `E-eh, revisando todo con cuidado... ${K.timida()} ya vuelvo.`,
    ]));
    try {
      await monitor().forceCheck(client);
      return { reply: pick([
        `✅ Verificación completada ${K.feliz()} Si había algo nuevo, ya lo publiqué.`,
        `¡Lista! ${K.feliz()} Revisé todo. Si hay novedades, ya están en el canal de anuncios.`,
        `Listo, revisé todo ${K.tranqui()} Nada se me escapó.`,
      ]), done: true };
    } catch (err) {
      return { reply: `A-ay... algo salió mal durante la verificación ${K.triste()} \`${err.message}\``, done: true };
    }
  }

  // ── info ─────────────────────────────────────────────────────────────────
  if (sub === 'info') {
    const projects = Projects.list();
    const active   = projects.filter(p => p.active).length;
    const channel  = process.env.ANNOUNCEMENT_CHANNEL_ID ? `<#${process.env.ANNOUNCEMENT_CHANNEL_ID}>` : 'No configurado';
    const noticeS  = process.env.STAFF_NOTICE_ID   ? `<#${process.env.STAFF_NOTICE_ID}>`   : 'No configurado';
    const noticeR  = process.env.NOTICE_CHANNEL_ID ? `<#${process.env.NOTICE_CHANNEL_ID}>` : 'No configurado';

    const { EmbedBuilder: EB } = require('discord.js');
    const embed = new EB()
      .setTitle('⚙️ Configuración actual')
      .setColor(0x9b59b6)
      .addFields(
        { name: '📢 Canal de anuncios',  value: channel,                                                    inline: true },
        { name: '📋 Proyectos',          value: `${projects.length} total · ${active} activos`,             inline: true },
        { name: '📣 Avisos staff',       value: noticeS,                                                    inline: true },
        { name: '📣 Avisos lectores',    value: noticeR,                                                    inline: true },
        { name: '⏱️ Check interval',     value: `Cada ${process.env.CHECK_INTERVAL_MINUTES || 25} min`,    inline: true },
        { name: '🕐 Zona horaria',       value: process.env.TIMEZONE || 'America/Bogota',                  inline: true },
        { name: '📦 Node.js',            value: process.version,                                            inline: true },
      )
      .setTimestamp();
    return { embeds: [embed], done: true };
  }

  return { reply: SUA.errorGeneral, done: true };
}

// ────────────────────────────────────────────────────────────────────────────
// FLUJOS V3 — TAREAS
// ────────────────────────────────────────────────────────────────────────────

async function flowTareaAsignar(step, data, message) {
  if (step === 'start') {
    if (!data.targetUser) return { reply: `¿A quién le asigno la tarea? Menciónalo ${K.timida()}`, nextStep: 'awaitTarget' };
    if (!data.proyectoId) return { reply: `¿A qué proyecto pertenece? ${K.tranqui()}`, nextStep: 'awaitProyecto' };
    if (!data.capitulo)   return { reply: `¿De qué capítulo es? ${K.timida()}`, nextStep: 'awaitCapitulo' };
    if (!data.labor)      return { reply: `¿Qué labor tiene que hacer? (ej: traducción, clean, typeo) ${K.tranqui()}`, nextStep: 'awaitLabor' };
    return execTareaAsignar(data, message);
  }
  if (step === 'awaitTarget') {
    const user = message.mentions.users.filter(u => !u.bot).first();
    if (!user) return { reply: `No vi a nadie mencionado... inténtalo de nuevo ${K.disculpa()}` };
    data.targetUser   = user;
    data.targetMember = message.mentions.members?.filter(m => !m.user.bot).first();
    if (!data.proyectoId) return { reply: `¿A qué proyecto pertenece? ${K.tranqui()}`, nextStep: 'awaitProyecto' };
    if (!data.capitulo)   return { reply: `¿De qué capítulo? ${K.timida()}`, nextStep: 'awaitCapitulo' };
    if (!data.labor)      return { reply: `¿Qué labor tiene que hacer? ${K.tranqui()}`, nextStep: 'awaitLabor' };
    return execTareaAsignar(data, message);
  }
  if (step === 'awaitProyecto') {
    const t = normalize(message.content);
    for (const p of getProjects()) {
      if (t.includes(normalize(p.name)) || t.includes(normalize(p.id))) {
        data.proyectoId   = p.id;
        data.proyectoName = p.name;
        break;
      }
    }
    if (!data.proyectoId) return { reply: `No reconocí ese proyecto... intenta con el nombre exacto ${K.disculpa()}` };
    if (!data.capitulo)   return { reply: `¿De qué capítulo? ${K.timida()}`, nextStep: 'awaitCapitulo' };
    if (!data.labor)      return { reply: `¿Qué labor? ${K.tranqui()}`, nextStep: 'awaitLabor' };
    return execTareaAsignar(data, message);
  }
  if (step === 'awaitCapitulo') {
    const m = message.content.match(/\d+(?:[.,]\d+)?/);
    if (!m) return { reply: `No detecté un número de capítulo... inténtalo de nuevo ${K.disculpa()}` };
    data.capitulo = m[0];
    if (!data.labor) return { reply: `¿Y qué labor tiene que hacer? ${K.tranqui()}`, nextStep: 'awaitLabor' };
    return execTareaAsignar(data, message);
  }
  if (step === 'awaitLabor') {
    data.labor = message.content.trim();
    return execTareaAsignar(data, message);
  }
}

async function execTareaAsignar(data, message) {
  const project = Projects.get(data.proyectoId);
  const tarea   = Tareas.create({
    projectId:    data.proyectoId,
    projectName:  project?.name || data.proyectoName || data.proyectoId,
    capitulo:     data.capitulo,
    labor:        data.labor,
    asignadoId:   data.targetUser.id,
    asignadoName: data.targetUser.username,
    creadoPor:    message.author.id,
  });

  const canalId = process.env.TASKS_CHANNEL_ID;
  if (canalId) {
    const canal = await message.client.channels.fetch(canalId).catch(() => null);
    if (canal) {
      await canal.send(pick([
        `📋 ¡Nueva tarea! ${K.feliz()} <@${data.targetUser.id}>, te toca la **${data.labor}** del cap. **${data.capitulo}** de **${tarea.proyectoName}**. ID: \`${tarea.id}\` — Te recordaré cada 2 días ${K.tranqui()}`,
        `📋 Tarea asignada a <@${data.targetUser.id}> ${K.feliz()} **${data.labor}** — cap. **${data.capitulo}** de **${tarea.proyectoName}**. ID: \`${tarea.id}\``,
      ]));
    }
  }

  return { reply: pick([
    `¡Listo! Le asigné la **${data.labor}** del cap. **${data.capitulo}** de **${Projects.get(data.proyectoId)?.name || data.proyectoId}** a **${data.targetUser.username}** ${K.feliz()} Le llegará el recordatorio cada 2 días hasta que la marque como lista.`,
    `Tarea asignada a **${data.targetUser.username}** ${K.feliz()} **${data.labor}** — cap. **${data.capitulo}** de **${Projects.get(data.proyectoId)?.name || data.proyectoId}**. Ya le notifiqué en el canal de tareas.`,
  ]), done: true };
}

async function flowTareaCompletar(step, data, message) {
  if (step === 'start') {
    // Aceptar tanto "tarea_123" como número limpio o task_xxx (por compatibilidad)
    const idMatch = message.content.match(/(?:tarea_|task_)(\d+)/i) || message.content.match(/\btarea\s+(\d+)\b/i);
    if (idMatch) {
      // Buscar por número de tarea
      const num = idMatch[1];
      const todas = Tareas.listActivas();
      const encontrada = todas.find(t => t.id.endsWith(num) || t.numero == num);
      if (encontrada) { data.tareaId = encontrada.id; return execTareaCompletar(data, message); }
    }
    const misTareas = Tareas.listPorUsuario(message.author.id);
    if (misTareas.length === 1) { data.tareaId = misTareas[0].id; return execTareaCompletar(data, message); }
    if (misTareas.length > 1) {
      const lista = misTareas.slice(0, 5).map((t, i) => `**${i+1}.** ${t.proyectoName} Cap.${t.capitulo} — ${t.labor}`).join('\n');
      return { reply: `Tienes varias tareas activas ${K.timida()} ¿Cuál terminaste? Di el número:\n${lista}`, nextStep: 'awaitNumero' };
    }
    // Sin tareas propias — si es mod, pedirle que especifique
    if (hasModRole(message.member)) {
      return { reply: `¿De qué tarea se trata? Dime el proyecto y capítulo o el número de tarea ${K.tranqui()}`, nextStep: 'awaitBuscar' };
    }
    return { reply: `N-no tienes tareas activas asignadas en este momento ${K.timida()}`, done: true };
  }
  if (step === 'awaitNumero') {
    const n = parseInt(message.content.trim());
    const misTareas = Tareas.listPorUsuario(message.author.id);
    if (!n || n < 1 || n > misTareas.length) return { reply: `Mmm, ese número no está en la lista ${K.disculpa()} Intenta de nuevo.` };
    data.tareaId = misTareas[n - 1].id;
    return execTareaCompletar(data, message);
  }
  if (step === 'awaitBuscar') {
    // Buscar tarea por texto libre (proyecto + capitulo)
    const t = message.content.toLowerCase();
    const activas = Tareas.listActivas();
    const encontrada = activas.find(ta =>
      t.includes(ta.proyectoName.toLowerCase()) ||
      t.includes(`cap${ta.capitulo}`) ||
      t.includes(`cap. ${ta.capitulo}`) ||
      t.includes(`capitulo ${ta.capitulo}`)
    );
    if (!encontrada) return { reply: `No encontré esa tarea ${K.disculpa()} Intenta con el nombre del proyecto o capítulo.` };
    data.tareaId = encontrada.id;
    return execTareaCompletar(data, message);
  }
}

async function execTareaCompletar(data, message) {
  const tarea = Tareas.get(data.tareaId);
  if (!tarea)           return { reply: `No encontré esa tarea ${K.timida()}`, done: true };
  if (tarea.completada) return { reply: `Esa tarea ya estaba completada ${K.feliz()}`, done: true };

  const esAsignado = tarea.asignadoId === message.author.id;
  const esMod      = hasModRole(message.member);

  if (!esAsignado && !esMod) {
    return { reply: `Solo **${tarea.asignadoName}** o un moderador pueden marcar esa tarea como lista ${K.timida()}`, done: true };
  }

  Tareas.completar(data.tareaId);

  // Notificación en canal de tareas
  const canalId = process.env.TASKS_CHANNEL_ID;
  if (canalId) {
    const canal = await message.client.channels.fetch(canalId).catch(() => null);
    if (canal) {
      if (esAsignado && !esMod) {
        // El asignado mismo lo marcó
        await canal.send(pick([
          `✅ <@${tarea.asignadoId}> completó la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** ${K.feliz()}`,
          `✅ **${tarea.labor}** cap. **${tarea.capitulo}** de **${tarea.proyectoName}** — <@${tarea.asignadoId}> la marcó como lista ${K.feliz()}`,
        ]));
      } else {
        // Un mod la marcó (puede ser el mismo que asignó u otro mod)
        const esQuienAsigno = tarea.creadoPor === message.author.id;
        await canal.send(pick([
          `✅ <@${message.author.id}> marcó como completada la **${tarea.labor}** de <@${tarea.asignadoId}> — cap. **${tarea.capitulo}** de **${tarea.proyectoName}**`,
          `✅ La **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** fue marcada como lista por ${esQuienAsigno ? 'quien la asignó' : 'un moderador'}`,
        ]));
      }
    }
  }

  // Respuesta diferenciada
  if (esAsignado && !esMod) {
    return { reply: pick([
      `¡Anotado! ${K.feliz()} Marqué la **${tarea.labor}** del cap. **${tarea.capitulo}** como completada. Ya no recibirás recordatorios por esa.`,
      `¡Listo! ${K.feliz()} La **${tarea.labor}** queda registrada como terminada. ¡Gracias por avisarme!`,
    ]), done: true };
  }
  // Es mod
  return { reply: pick([
    `Listo, marqué la **${tarea.labor}** del cap. **${tarea.capitulo}** de **${tarea.proyectoName}** como completada ${K.tranqui()} <@${tarea.asignadoId}> también fue notificado.`,
    `Completada ${K.tranqui()} La tarea de **${tarea.asignadoName}** queda registrada como lista.`,
  ]), done: true };
}

async function flowTareaLista(step, data, message) {
  const filtro = data.targetUser?.id;
  const tareas = filtro ? Tareas.listPorUsuario(filtro) : Tareas.listActivas();
  if (!tareas.length) return { reply: pick([`¡No hay tareas activas${filtro ? ` para **${data.targetUser.username}**` : ''}! ${K.feliz()} Todo en orden.`]), done: true };
  const lineas = tareas.slice(0, 10).map(t => {
    const dias = Math.floor((Date.now() - new Date(t.creadoAt).getTime()) / 86400000);
    return `\`${t.id}\` **${t.proyectoName}** Cap.${t.capitulo} — ${t.labor} → <@${t.asignadoId}> (${dias}d)`;
  });
  return { reply: `📋 **Tareas activas${filtro ? ` de ${data.targetUser.username}` : ''}:**\n${lineas.join('\n')}`, done: true };
}

// ────────────────────────────────────────────────────────────────────────────
// FLUJOS V3 — AUSENCIAS
// ────────────────────────────────────────────────────────────────────────────

function parseDateV3(str) {
  // Acepta DD/MM/AAAA, MM/DD/AAAA, DD-MM-AAAA, MM-DD-AAAA
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!m) return null;
  const a = parseInt(m[1]);
  const b = parseInt(m[2]);
  const y = parseInt(m[3]);
  const hoy = new Date();

  // Intentar primero DD/MM (formato español/colombiano)
  const ddmm = new Date(y, b - 1, a);
  // Intentar MM/DD (formato americano — cuando el primer número > 12, solo puede ser DD)
  const mmdd = new Date(y, a - 1, b);

  // Si a > 12, el primer número definitivamente es el día (DD/MM)
  if (a > 12) {
    if (!isNaN(ddmm.getTime()) && ddmm > hoy) return ddmm.toISOString();
    return null;
  }
  // Si b > 12, el segundo número definitivamente es el día (MM/DD)
  if (b > 12) {
    if (!isNaN(mmdd.getTime()) && mmdd > hoy) return mmdd.toISOString();
    return null;
  }
  // Ambos podrían ser válidos — preferir MM/DD si el mes (a) ≤ 12 y la fecha resultante es futura
  // y la fecha DD/MM también sería futura. En ese caso, usar el que da la fecha más próxima
  const ddmmValida = !isNaN(ddmm.getTime()) && ddmm > hoy;
  const mmddValida = !isNaN(mmdd.getTime()) && mmdd > hoy;
  if (ddmmValida && mmddValida) {
    // Retornar la más cercana al presente (la que el usuario probablemente quiso)
    return (ddmm < mmdd ? ddmm : mmdd).toISOString();
  }
  if (ddmmValida) return ddmm.toISOString();
  if (mmddValida) return mmdd.toISOString();
  return null;
}

async function flowAusenciaPedir(step, data, message) {
  if (step === 'start') {
    const fechaM = message.content.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (fechaM) data.hasta = parseDateV3(fechaM[0]);
    const razonM = message.content.match(/(?:por(?:que)?|motivo|ya que|razon)[:\s]+(.+)/i);
    if (razonM) data.razon = razonM[1].trim();
    if (!data.razon) return { reply: pick([`¿Cuál es el motivo de tu ausencia? ${K.timida()}`, `Cuéntame brevemente por qué te ausentarás ${K.tranqui()}`]), nextStep: 'awaitRazon' };
    if (!data.hasta) return { reply: pick([`¿Hasta cuándo estarás fuera? (DD/MM/AAAA) ${K.timida()}`, `¿Cuándo planeas volver? (DD/MM/AAAA) ${K.tranqui()}`]), nextStep: 'awaitFecha' };
    return execAusenciaCrear(data, message, message.author, message.author.id);
  }
  if (step === 'awaitRazon') {
    data.razon = message.content.trim();
    if (!data.hasta) return { reply: `¿Y hasta cuándo estarás fuera? (DD/MM/AAAA) ${K.timida()}`, nextStep: 'awaitFecha' };
    return execAusenciaCrear(data, message, message.author, message.author.id);
  }
  if (step === 'awaitFecha') {
    const fechaM = message.content.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!fechaM) return { reply: `Esa fecha no la reconocí... usa el formato **DD/MM/AAAA** ${K.disculpa()}` };
    data.hasta = parseDateV3(fechaM[0]);
    if (!data.hasta) return { reply: `La fecha debe ser futura y válida... inténtalo de nuevo ${K.disculpa()}` };
    return execAusenciaCrear(data, message, message.author, message.author.id);
  }
}

async function flowAusenciaRegistrar(step, data, message) {
  if (!hasModRole(message.member)) return { reply: `E-eh... solo los mods pueden registrar ausencias de otros ${K.timida()}`, done: true };
  if (step === 'start') {
    if (!data.targetUser) return { reply: `¿La ausencia es para quién? Menciónalo ${K.timida()}`, nextStep: 'awaitTarget' };
    if (!data.razon)      return { reply: `¿Cuál es el motivo? ${K.tranqui()}`, nextStep: 'awaitRazon' };
    if (!data.hasta)      return { reply: `¿Hasta qué fecha? (DD/MM/AAAA) ${K.timida()}`, nextStep: 'awaitFecha' };
    return execAusenciaCrear(data, message, data.targetUser, message.author.id);
  }
  if (step === 'awaitTarget') {
    const user = message.mentions.users.filter(u => !u.bot).first();
    if (!user) return { reply: `No vi a nadie mencionado ${K.disculpa()}` };
    data.targetUser = user;
    if (!data.razon) return { reply: `¿Cuál es el motivo de la ausencia de **${user.username}**? ${K.tranqui()}`, nextStep: 'awaitRazon' };
    if (!data.hasta) return { reply: `¿Hasta cuándo? (DD/MM/AAAA) ${K.timida()}`, nextStep: 'awaitFecha' };
    return execAusenciaCrear(data, message, data.targetUser, message.author.id);
  }
  if (step === 'awaitRazon') {
    data.razon = message.content.trim();
    if (!data.hasta) return { reply: `¿Hasta qué fecha? (DD/MM/AAAA) ${K.timida()}`, nextStep: 'awaitFecha' };
    return execAusenciaCrear(data, message, data.targetUser || message.author, message.author.id);
  }
  if (step === 'awaitFecha') {
    const fechaM = message.content.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!fechaM) return { reply: `Fecha no reconocida... usa DD/MM/AAAA ${K.disculpa()}` };
    data.hasta = parseDateV3(fechaM[0]);
    if (!data.hasta) return { reply: `La fecha debe ser futura... inténtalo de nuevo ${K.disculpa()}` };
    return execAusenciaCrear(data, message, data.targetUser || message.author, message.author.id);
  }
}

async function execAusenciaCrear(data, message, usuario, creadoPor) {
  const yaActiva = Ausencias.list().find(a => a.usuarioId === usuario.id && a.estado === 'activa');
  if (yaActiva) return { reply: `Ya hay una ausencia activa para **${usuario.username}** ${K.timida()} Cancélala primero.`, done: true };

  const ausencia = Ausencias.create({
    usuarioId:   usuario.id,
    usuarioName: usuario.username,
    razon:       data.razon,
    hasta:       data.hasta,
    creadoPor,
  });

  const hastaTs = Math.floor(new Date(data.hasta).getTime() / 1000);

  const canalAusId = process.env.ABSENCES_CHANNEL_ID;
  if (canalAusId) {
    const canal = await message.client.channels.fetch(canalAusId).catch(() => null);
    if (canal) {
      const msg = await canal.send(`🏖️ **${usuario.username}** estará ausente hasta <t:${hastaTs}:D>\n**Motivo:** ${ausencia.razon}\nID: \`${ausencia.id}\``);
      ausencia.mensajeId = msg.id;
      Ausencias.save(ausencia);
    }
  }

  const canalReg = process.env.RECORDS_CHANNEL_ID;
  if (canalReg) {
    const canal = await message.client.channels.fetch(canalReg).catch(() => null);
    if (canal) await canal.send(`📋 Nueva ausencia: **${usuario.username}** hasta <t:${hastaTs}:D> — ${ausencia.razon}`);
  }

  return { reply: pick([
    `¡Ausencia registrada! ${K.feliz()} **${usuario.username}** estará fuera hasta <t:${hastaTs}:D>. ID: \`${ausencia.id}\``,
    `Listo, anoté la ausencia de **${usuario.username}** hasta <t:${hastaTs}:D> ${K.tranqui()} ¡Que descanse bien!`,
  ]), done: true };
}

async function flowAusenciaCancelar(step, data, message) {
  const ausencia = Ausencias.list().find(a => a.usuarioId === message.author.id && a.estado === 'activa');
  if (!ausencia) return { reply: pick([`No tienes ninguna ausencia activa en este momento ${K.tranqui()}`, `Mmm, no encontré ausencias activas tuyas ${K.timida()}`]), done: true };

  Ausencias.cancelar(ausencia.id);

  const canalAusId = process.env.ABSENCES_CHANNEL_ID;
  if (canalAusId && ausencia.mensajeId) {
    const canal = await message.client.channels.fetch(canalAusId).catch(() => null);
    if (canal) {
      try {
        const msg = await canal.messages.fetch(ausencia.mensajeId);
        if (msg) await msg.edit(`~~${msg.content}~~\n🔄 **Cancelada** por el usuario.`);
      } catch { /* ya no existe */ }
    }
  }

  return { reply: pick([
    `¡Ausencia cancelada! ${K.feliz()} Qué alegría que puedas seguir con nosotros.`,
    `Cancelada ${K.tranqui()} Bienvenido/a de vuelta.`,
  ]), done: true };
}

async function flowAusenciaLista(step, data, message) {
  const ausencias = Ausencias.listActivas();
  if (!ausencias.length) return { reply: `¡No hay ausencias activas! ${K.feliz()} El equipo completo está disponible.`, done: true };
  const lineas = ausencias.map(a => `**${a.usuarioName}** — hasta <t:${Math.floor(new Date(a.hasta).getTime() / 1000)}:D> | ${a.razon}`);
  return { reply: `🏖️ **Ausencias activas:**\n${lineas.join('\n')}`, done: true };
}

// ────────────────────────────────────────────────────────────────────────────
// FLUJOS V3 — TICKETS
// ────────────────────────────────────────────────────────────────────────────

const TIPOS_ERROR_V3 = { mal_subido: 'Mal subido', desorden: 'Desorden de páginas', no_carga: 'No carga / 404', otro: 'Otro' };

async function flowTicketAbrir(step, data, message) {
  // Check de canal en TODOS los pasos — solo funciona desde el canal de tickets configurado
  const canalTicketId = process.env.TICKET_CHANNEL_READER_ID;
  if (canalTicketId && message.channelId !== canalTicketId) {
    clearSession(message.author.id);
    return { reply: pick([
      `E-eh... los reportes de error solo los proceso en <#${canalTicketId}> ${K.timida()} ¡Escríbeme allí!`,
      `N-no puedo abrir un ticket desde aquí ${K.tranqui()} Ve a <#${canalTicketId}> e inténtalo de nuevo.`,
    ]), done: true };
  }

  if (step === 'start') {
    if (!data.proyectoId) return { reply: pick([`¿En qué proyecto encontraste el error? ${K.timida()}`, `¿Qué proyecto tiene el problema? ${K.tranqui()}`]), nextStep: 'awaitProyecto' };
    if (!data.capitulo)   return { reply: `¿En qué capítulo está el error? ${K.timida()}`, nextStep: 'awaitCapitulo' };
    if (!data.tipoError)  return { reply: `¿Qué tipo de error es?\n\`mal_subido\` Páginas faltantes/duplicadas\n\`desorden\` Páginas desordenadas\n\`no_carga\` No carga / Error 404\n\`otro\` Otro ${K.tranqui()}`, nextStep: 'awaitTipo' };
    if (!data.plataforma) return { reply: `¿En qué plataforma? \`tmo\`, \`colorcito\` o \`ambas\` ${K.timida()}`, nextStep: 'awaitPlataforma' };
    return execTicketAbrir(data, message);
  }
  if (step === 'awaitProyecto') {
    const t = normalize(message.content);
    for (const p of getProjects()) {
      if (t.includes(normalize(p.name)) || t.includes(normalize(p.id))) { data.proyectoId = p.id; data.proyectoName = p.name; break; }
    }
    if (!data.proyectoId) return { reply: `No reconocí ese proyecto... intenta con el nombre exacto ${K.disculpa()}` };
    if (!data.capitulo)   return { reply: `¿En qué capítulo? ${K.timida()}`, nextStep: 'awaitCapitulo' };
    if (!data.tipoError)  return { reply: `¿Tipo de error? \`mal_subido\` / \`desorden\` / \`no_carga\` / \`otro\` ${K.tranqui()}`, nextStep: 'awaitTipo' };
    if (!data.plataforma) return { reply: `¿Plataforma? \`tmo\` / \`colorcito\` / \`ambas\` ${K.timida()}`, nextStep: 'awaitPlataforma' };
    return execTicketAbrir(data, message);
  }
  if (step === 'awaitCapitulo') {
    const m = message.content.match(/\d+(?:[.,]\d+)?/);
    if (!m) return { reply: `No detecté el número... inténtalo de nuevo ${K.disculpa()}` };
    data.capitulo = m[0];
    if (!data.tipoError)  return { reply: `¿Tipo de error? \`mal_subido\` / \`desorden\` / \`no_carga\` / \`otro\` ${K.tranqui()}`, nextStep: 'awaitTipo' };
    if (!data.plataforma) return { reply: `¿Plataforma? \`tmo\` / \`colorcito\` / \`ambas\` ${K.timida()}`, nextStep: 'awaitPlataforma' };
    return execTicketAbrir(data, message);
  }
  if (step === 'awaitTipo') {
    const t = message.content.toLowerCase();
    if      (t.includes('mal') || t.includes('falt') || t.includes('duplic')) data.tipoError = 'mal_subido';
    else if (t.includes('desor') || t.includes('pag'))                         data.tipoError = 'desorden';
    else if (t.includes('carga') || t.includes('404'))                         data.tipoError = 'no_carga';
    else                                                                        data.tipoError = 'otro';
    if (!data.plataforma) return { reply: `¿Plataforma? \`tmo\` / \`colorcito\` / \`ambas\` ${K.timida()}`, nextStep: 'awaitPlataforma' };
    return execTicketAbrir(data, message);
  }
  if (step === 'awaitPlataforma') {
    const t = message.content.toLowerCase();
    if      (t.includes('tmo') && t.includes('color')) data.plataforma = 'ambas';
    else if (t.includes('color'))                       data.plataforma = 'colorcito';
    else                                                data.plataforma = 'tmo';
    data.descripcion = '';
    return execTicketAbrir(data, message);
  }
}

async function execTicketAbrir(data, message) {
  const project = Projects.get(data.proyectoId);
  if (!project) return { reply: `No encontré ese proyecto ${K.timida()}`, done: true };

  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (!staffGuildId) return { reply: `El servidor de staff no está configurado ${K.triste()}`, done: true };

  const ticket = Tickets.create({
    usuarioId:    message.author.id,
    usuarioName:  message.author.username,
    proyectoId:   data.proyectoId,
    proyectoName: project.name,
    capitulo:     data.capitulo,
    tipoError:    data.tipoError,
    plataforma:   data.plataforma,
    descripcion:  data.descripcion || '',
    channelId:    'pending',
  });
  if (!ticket) return { reply: `A-ay... algo salió mal al crear el ticket ${K.triste()} Intenta de nuevo.`, done: true };

  try {
    const { ChannelType, PermissionFlagsBits } = require('discord.js');
    const staffGuild = await message.client.guilds.fetch(staffGuildId);
    const canal = await staffGuild.channels.create({
      name:  `ticket-${String(ticket.numero).padStart(3, '0')}-${project.name.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
      type:  ChannelType.GuildText,
      topic: `Ticket ${ticket.id} — ${project.name} Cap.${data.capitulo}`,
      permissionOverwrites: [
        { id: staffGuild.roles.everyone.id,  deny:  [PermissionFlagsBits.ViewChannel] },
        { id: MOD_ROLE_ID,                   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: staffGuild.members.me.id,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
    ticket.channelId = canal.id;
    Tickets.save(ticket);

    await canal.send({
      content: pick([
        `<@&${MOD_ROLE_ID}> — Nuevo ticket \`${ticket.id}\` ${K.timida()}\n**Proyecto:** ${project.name} | **Cap:** ${data.capitulo} | **Error:** ${TIPOS_ERROR_V3[data.tipoError]} | **Plataforma:** ${data.plataforma}\n**Reportado por:** ${message.author.username}`,
        `<@&${MOD_ROLE_ID}> — Un lector reportó un error ${K.tranqui()} **${project.name}** Cap.${data.capitulo} | ${TIPOS_ERROR_V3[data.tipoError]}`,
      ]),
      allowedMentions: { roles: [MOD_ROLE_ID] },
    });

    const canalReg = process.env.RECORDS_CHANNEL_ID;
    if (canalReg) {
      const reg = await message.client.channels.fetch(canalReg).catch(() => null);
      if (reg) await reg.send(`🎫 Ticket \`${ticket.id}\` — **${project.name}** Cap.${data.capitulo} | ${TIPOS_ERROR_V3[data.tipoError]} | Canal: ${canal}`);
    }
  } catch (err) {
    return { reply: `N-no pude crear el canal del ticket ${K.triste()} Error: ${err.message}`, done: true };
  }

  return { reply: pick([
    `¡Tu reporte fue enviado! ${K.feliz()} Ticket: \`${ticket.id}\` — El equipo ya fue notificado y alguien se comunicará contigo pronto.`,
    `Reporte enviado ${K.tranqui()} \`${ticket.id}\` — ¡Gracias por ayudarnos a mejorar!`,
  ]), done: true };
}

async function flowTicketCerrar(step, data, message) {
  if (step === 'start') {
    const idMatch = message.content.match(/ticket_\d{3}/);
    if (idMatch) { data.ticketId = idMatch[0]; return execTicketCerrar(data, message); }
    return { reply: `¿Cuál es el ID del ticket a cerrar? (ej: \`ticket_001\`) ${K.timida()}`, nextStep: 'awaitId' };
  }
  if (step === 'awaitId') {
    const idMatch = message.content.match(/ticket_\d{3}/);
    if (!idMatch) return { reply: `No reconocí el ID... debe ser \`ticket_XXX\` ${K.disculpa()}` };
    data.ticketId = idMatch[0];
    return execTicketCerrar(data, message);
  }
}

async function execTicketCerrar(data, message) {
  const ticket = Tickets.get(data.ticketId);
  if (!ticket)                     return { reply: `No encontré el ticket \`${data.ticketId}\` ${K.timida()}`, done: true };
  if (ticket.estado === 'cerrado') return { reply: `Ese ticket ya está cerrado ${K.tranqui()}`, done: true };

  Tickets.cerrar(data.ticketId, message.author.id);

  try {
    const usuario = await message.client.users.fetch(ticket.usuarioId);
    if (usuario) await usuario.send(pick([
      `¡Hola! ${K.feliz()} El error que reportaste en el cap. **${ticket.capitulo}** de **${ticket.proyectoName}** ya fue solucionado. ¡Gracias por avisarnos!`,
      `¡Buenas! ${K.tranqui()} El problema en **${ticket.proyectoName}** cap. **${ticket.capitulo}** ya fue corregido. ¡Muchas gracias por tu reporte!`,
    ])).catch(() => {});
  } catch { /* ok */ }

  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (ticket.channelId && staffGuildId) {
    try {
      const g = await message.client.guilds.fetch(staffGuildId);
      const c = await g.channels.fetch(ticket.channelId).catch(() => null);
      if (c) {
        await c.send(`✅ Cerrado por <@${message.author.id}>. Canal eliminándose en 10 segundos ${K.tranqui()}`);
        setTimeout(() => c.delete('Ticket cerrado').catch(() => {}), 10_000);
      }
    } catch { /* ok */ }
  }

  return { reply: pick([
    `¡Ticket \`${data.ticketId}\` cerrado! ${K.feliz()} El usuario ya fue notificado por DM.`,
    `Cerrado ${K.tranqui()} El canal se eliminará en breve.`,
  ]), done: true };
}

async function flowTicketLista(step, data, message) {
  const tickets = Tickets.listAbiertos();
  if (!tickets.length) return { reply: `¡No hay tickets abiertos! ${K.feliz()} Todo en orden.`, done: true };
  const lineas = tickets.slice(0, 8).map(t => `\`${t.id}\` **${t.proyectoName}** Cap.${t.capitulo} — ${TIPOS_ERROR_V3[t.tipoError]} | ${t.plataforma} | ${t.usuarioName}`);
  return { reply: `🎫 **Tickets abiertos (${tickets.length}):**\n${lineas.join('\n')}`, done: true };
}

// ────────────────────────────────────────────────────────────────────────────
// FLUJOS V3 — RECLUTAMIENTO
// ────────────────────────────────────────────────────────────────────────────

const ROLES_RECLU = { traductor: 'Traductor', cleaner: 'Cleaner / Redibujador', typesetter: 'Typesetter', qc: 'Control de Calidad (QC)', otro: 'Otro' };

async function flowReclutarPostular(step, data, message) {
  // Check de canal en TODOS los pasos — incluyendo sesiones activas
  const canalRecluId = process.env.RECRUIT_CHANNEL_READER_ID;
  if (canalRecluId && message.channelId !== canalRecluId) {
    // Si había sesión, la cancelamos para no dejar al usuario colgado
    clearSession(message.author.id);
    return { reply: pick([
      `E-eh... el proceso de postulación solo funciona en <#${canalRecluId}> ${K.timida()} ¡Escríbeme allí!`,
      `N-no puedo procesar tu postulación desde aquí ${K.tranqui()} Ve a <#${canalRecluId}> e inténtalo de nuevo.`,
    ]), done: true };
  }

  const yaActiva = Reclutamiento.getByUsuario(message.author.id);
  if (yaActiva) return { reply: `Ya tienes una postulación pendiente ${K.timida()} El equipo está revisando tu solicitud. ¡Ten paciencia!`, done: true };

  if (step === 'start') {
    return { reply: pick([
      `¡Qué bueno que quieras unirte al equipo! ${K.feliz()} Vamos a recopilar tus datos. ¿En qué rol te interesa colaborar?\n\`traductor\` · \`cleaner\` · \`typesetter\` · \`qc\` · \`otro\``,
      `¡Me alegra mucho! ${K.feliz()} Cuéntame, ¿en qué área te gustaría ayudar?\n\`traductor\` · \`cleaner\` · \`typesetter\` · \`qc\` · \`otro\``,
    ]), nextStep: 'awaitRol' };
  }
  if (step === 'awaitRol') {
    const t = message.content.toLowerCase();
    if      (t.includes('tradu'))                            data.rolInteres = 'traductor';
    else if (t.includes('clean') || t.includes('redib'))     data.rolInteres = 'cleaner';
    else if (t.includes('type') || t.includes('typeset'))    data.rolInteres = 'typesetter';
    else if (t.includes('qc') || t.includes('calidad'))      data.rolInteres = 'qc';
    else                                                      data.rolInteres = 'otro';

    return { reply: pick([
      `¡Anotado! ${K.feliz()} ¿Tienes experiencia previa en **${ROLES_RECLU[data.rolInteres]}**? No te preocupes si no, ¡enseñamos desde cero!`,
      `Perfecto ${K.tranqui()} ¿Y tienes experiencia previa? No es obligatoria, lo importante son las ganas de aprender.`,
    ]), nextStep: 'awaitExperiencia' };
  }
  if (step === 'awaitExperiencia') {
    const t = message.content.toLowerCase();
    if      (/s[ií]|tengo|algo de/.test(t)) data.experiencia = 'si';
    else if (/poco|poca|un poco/.test(t))   data.experiencia = 'poca';
    else                                    data.experiencia = 'no';

    const notaAprender = data.experiencia === 'no'
      ? `¡No te preocupes! ${K.feliz()} En Aeternum enseñamos desde cero. `
      : `¡Genial! ${K.tranqui()} `;

    return { reply: `${notaAprender}¿Cuántas horas a la semana podrías dedicarle aproximadamente?\nMenos de 5h · Entre 5 y 10h · Más de 10h`, nextStep: 'awaitDisponibilidad' };
  }
  if (step === 'awaitDisponibilidad') {
    const t = message.content.toLowerCase();
    if      (t.includes('10') || t.includes('mas') || t.includes('más')) data.disponibilidad = 'mas10';
    else if (t.includes('5'))                                             data.disponibilidad = '5a10';
    else                                                                  data.disponibilidad = 'menos5';

    return { reply: pick([
      `¡Perfecto! ${K.feliz()} Y por último, ¿qué te motivó a querer unirte a Aeternum? ¿Hay algún proyecto que te llamó la atención?`,
      `¡Casi terminamos! ${K.tranqui()} ¿Por qué quieres unirte? ¿Hay algo de Aeternum que te gustó especialmente?`,
    ]), nextStep: 'awaitMotivacion' };
  }
  if (step === 'awaitMotivacion') {
    data.motivacion = message.content.trim();
    return execReclutarPostular(data, message);
  }
}

async function execReclutarPostular(data, message) {
  // El canal temporal se crea en el servidor de LECTORES (donde está el candidato)
  const readerGuildId = process.env.DISCORD_READER_GUILD_ID || message.guildId;
  if (!readerGuildId) return { reply: `No encontré el servidor de lectores configurado ${K.triste()}`, done: true };

  const total       = Reclutamiento.list().length + 1;
  const canalNombre = `postulacion-${String(total).padStart(3, '0')}-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`;

  let canal;
  try {
    const { ChannelType, PermissionFlagsBits } = require('discord.js');
    const readerGuild = await message.client.guilds.fetch(readerGuildId);
    canal = await readerGuild.channels.create({
      name:  canalNombre,
      type:  ChannelType.GuildText,
      topic: `Postulación de ${message.author.username} — ${ROLES_RECLU[data.rolInteres]}`,
      permissionOverwrites: [
        { id: readerGuild.roles.everyone.id, deny:  [PermissionFlagsBits.ViewChannel] },
        // El candidato puede ver y escribir en su propio canal
        { id: message.author.id,            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: message.client.user.id,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
  } catch (err) {
    return { reply: `N-no pude crear el canal de postulación ${K.triste()} Error: ${err.message}`, done: true };
  }

  const solicitud = Reclutamiento.create({
    usuarioId:       message.author.id,
    usuarioName:     message.author.username,
    rolInteres:      data.rolInteres,
    experiencia:     data.experiencia,
    disponibilidad:  data.disponibilidad,
    motivacion:      data.motivacion,
    proyectoInteres: data.motivacion,
    channelId:       canal.id,
  });

  const dispL     = { menos5: 'Menos de 5h/sem', '5a10': '5-10h/sem', mas10: '+10h/sem' };
  const expL      = { si: 'Con experiencia', no: 'Sin experiencia (aprende)', poca: 'Poca experiencia' };
  const notaExtra = data.experiencia === 'no'
    ? '\n> 📌 Sin experiencia previa — recordar que enseñamos desde cero.\n> ⚠️ Recordar que el trabajo no es remunerado.'
    : '\n> ⚠️ Recordar que el trabajo no es remunerado.';

  // ── Enviar resumen al canal de avisos de reclutamiento del staff CON botón ──
  const tasksChannelId = process.env.RECRUIT_ALERTS_CHANNEL_ID || process.env.TASKS_CHANNEL_ID;
  const staffGuildId   = process.env.DISCORD_GUILD_ID;
  if (tasksChannelId && staffGuildId) {
    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      // Buscar el canal a través del guild de staff explícitamente
      // (no usar client.channels.fetch porque puede no tener el canal cacheado
      //  cuando el comando se ejecuta desde el servidor de lectores)
      const staffGuild = await message.client.guilds.fetch(staffGuildId);
      const tasksCanal = await staffGuild.channels.fetch(tasksChannelId);

      if (tasksCanal) {
        const resumen =
          `📋 **Nueva postulación** — **${message.author.username}**${notaExtra}\n` +
          `**Rol:** ${ROLES_RECLU[data.rolInteres]} | **Exp:** ${expL[data.experiencia]} | **Disp:** ${dispL[data.disponibilidad]}\n` +
          `**Motivación:** ${data.motivacion}\n` +
          `**Canal del candidato (lectores):** ${canal}`;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`reclu_leido_${solicitud.id}`)
            .setLabel('✅ Leído — me encargo')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reclu_cancelar_${solicitud.id}`)
            .setLabel('❌ Cancelar postulación')
            .setStyle(ButtonStyle.Danger),
        );

        await tasksCanal.send({
          content: resumen,
          components: [row],
        });
      }
    } catch (err) {
      // Loguear el error para poder diagnosticar si vuelve a fallar
      console.error('[Reclutamiento] Error enviando resumen al canal de tareas:', err.message);
    }
  }

  // ── Mensaje inicial al candidato en su canal temporal ──
  await canal.send(pick([
    `¡Hola **${message.author.username}**! ${K.feliz()} Recibí tu postulación para **${ROLES_RECLU[data.rolInteres]}**. Ya le avisé al equipo y alguien se pondrá en contacto contigo aquí pronto. ¡Paciencia y mucha suerte!`,
    `¡Tu postulación está en manos del equipo! ${K.feliz()} En cuanto alguien del staff la revise, te escribirán aquí mismo. ¡Ánimo!`,
  ]));

  return { reply: pick([
    `¡Tu postulación fue enviada! ${K.feliz()} Te creé un canal privado donde el staff se comunicará contigo. ¡Mucha suerte!`,
    `¡Todo listo! ${K.feliz()} Revisa el canal ${canal} — ahí el equipo te contactará pronto.`,
  ]), done: true };
}

async function flowReclutarCerrar(step, data, message) {
  if (step === 'start') {
    const idMatch = message.content.match(/recruit_\d+/);
    if (idMatch) { data.solicitudId = idMatch[0]; return { reply: `¿Cuál es el resultado? \`aceptado\` / \`rechazado\` / \`cerrado\` ${K.tranqui()}`, nextStep: 'awaitResultado' }; }
    return { reply: `¿Cuál es el ID de la postulación? (ej: \`recruit_1234567890\`) ${K.timida()}`, nextStep: 'awaitId' };
  }
  if (step === 'awaitId') {
    const idMatch = message.content.match(/recruit_\d+/);
    if (!idMatch) return { reply: `No reconocí el ID ${K.disculpa()}` };
    data.solicitudId = idMatch[0];
    return { reply: `¿Resultado? \`aceptado\` / \`rechazado\` / \`cerrado\` ${K.tranqui()}`, nextStep: 'awaitResultado' };
  }
  if (step === 'awaitResultado') {
    const t = message.content.toLowerCase();
    if      (t.includes('acept'))  data.resultado = 'aceptado';
    else if (t.includes('rech'))   data.resultado = 'rechazado';
    else                           data.resultado = 'cerrado';
    return execReclutarCerrar(data, message);
  }
}

async function execReclutarCerrar(data, message) {
  const solicitud = Reclutamiento.get(data.solicitudId);
  if (!solicitud || solicitud.estado !== 'pendiente') return { reply: `No encontré esa postulación activa ${K.timida()}`, done: true };

  Reclutamiento.cerrar(data.solicitudId, message.author.id, data.resultado);

  const dmMsgs = {
    aceptado:  [`¡Hola **${solicitud.usuarioName}**! ${K.feliz()} Tu postulación para **${ROLES_RECLU[solicitud.rolInteres]}** fue **aceptada**. ¡Bienvenido/a al equipo de Aeternum Translations! El staff se comunicará contigo pronto con los siguientes pasos.`],
    rechazado: [`Hola **${solicitud.usuarioName}** ${K.tranqui()} Gracias por tu interés en Aeternum. Por ahora tu postulación para **${ROLES_RECLU[solicitud.rolInteres]}** no pudo continuar. ¡No te desanimes, en el futuro podrías intentarlo de nuevo!`],
    cerrado:   [`Hola ${K.tranqui()} Te escribo para avisarte que tu solicitud de postulación fue cerrada. Si tienes alguna duda, puedes escribir nuevamente en el canal de reclutamiento.`],
  };

  try {
    const u = await message.client.users.fetch(solicitud.usuarioId);
    if (u) await u.send(pick(dmMsgs[data.resultado])).catch(() => {});
  } catch { /* ok */ }

  const staffGuildId = process.env.DISCORD_GUILD_ID;
  if (solicitud.channelId && staffGuildId) {
    try {
      const g = await message.client.guilds.fetch(staffGuildId);
      const c = await g.channels.fetch(solicitud.channelId).catch(() => null);
      if (c) {
        const emoji = data.resultado === 'aceptado' ? '✅' : data.resultado === 'rechazado' ? '❌' : '🔒';
        await c.send(`${emoji} Proceso cerrado por <@${message.author.id}> — Resultado: **${data.resultado}**. Canal eliminándose en 15 segundos.`);
        setTimeout(() => c.delete('Postulación cerrada').catch(() => {}), 15_000);
      }
    } catch { /* ok */ }
  }

  return { reply: pick([
    `¡Postulación \`${data.solicitudId}\` cerrada! ${K.feliz()} Resultado: **${data.resultado}**. El candidato ya fue notificado por DM.`,
    `Cerrada ${K.tranqui()} \`${data.solicitudId}\` — ${data.resultado}. Canal eliminándose en breve.`,
  ]), done: true };
}

async function flowReclutarLista(step, data, message) {
  const pendientes = Reclutamiento.listPendientes();
  if (!pendientes.length) return { reply: `No hay postulaciones pendientes en este momento ${K.feliz()}`, done: true };
  const lineas = pendientes.slice(0, 8).map(s => `\`${s.id}\` **${s.usuarioName}** — ${ROLES_RECLU[s.rolInteres]} | <#${s.channelId}>`);
  return { reply: `📋 **Postulaciones pendientes (${pendientes.length}):**\n${lineas.join('\n')}`, done: true };
}

// ────────────────────────────────────────────────────────────────────────────
// ROUTER PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────
async function routeIntent(intent, step, data, message) {
  if (intent === 'mod.ban')           return flowBan(step, data, message);
  if (intent === 'mod.kick')          return flowKick(step, data, message);
  if (intent === 'mod.darRol')        return flowDarRol(step, data, message);
  if (intent === 'mod.quitarRol')     return flowQuitarRol(step, data, message);
  if (intent === 'proyecto.add')      return flowProyectoAdd(step, data, message);
  if (intent === 'proyecto.remove')   return flowProyectoRemove(step, data, message);
  if (intent === 'proyecto.toggle')   return flowProyectoToggle(step, data, message);
  if (intent === 'proyecto.setstatus')return flowProyectoSetStatus(step, data, message);
  if (intent === 'proyecto.info')     return flowProyectoInfo(step, data, message);
  if (intent === 'proyecto.list')     return flowProyectoList();
  if (intent === 'anunciar')          return flowAnunciar(step, data, message);
  if (intent === 'avisar')            return flowAvisar(step, data, message);
  if (intent === 'status')            return flowStatus(step, data, message);
  if (intent === 'salud')             return flowSalud(message);
  if (intent === 'sincronizar')       return flowSincronizar(data, message);
  if (intent === 'buscar')            return flowBuscar(step, data, message);
  if (intent === 'configurar')        return flowConfigurar(step, data, message);
  if (intent === 'tarea.asignar')      return flowTareaAsignar(step, data, message);
  if (intent === 'tarea.completar')    return flowTareaCompletar(step, data, message);
  if (intent === 'tarea.lista')        return flowTareaLista(step, data, message);
  if (intent === 'ausencia.pedir')     return flowAusenciaPedir(step, data, message);
  if (intent === 'ausencia.registrar') return flowAusenciaRegistrar(step, data, message);
  if (intent === 'ausencia.cancelar')  return flowAusenciaCancelar(step, data, message);
  if (intent === 'ausencia.lista')     return flowAusenciaLista(step, data, message);
  if (intent === 'ticket.abrir')       return flowTicketAbrir(step, data, message);
  if (intent === 'ticket.cerrar')      return flowTicketCerrar(step, data, message);
  if (intent === 'ticket.lista')       return flowTicketLista(step, data, message);
  if (intent === 'reclutar.postular')  return flowReclutarPostular(step, data, message);
  if (intent === 'reclutar.cerrar')    return flowReclutarCerrar(step, data, message);
  if (intent === 'reclutar.lista')     return flowReclutarLista(step, data, message);
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// REGISTRO DE MENSAJES MANEJADOS POR EL AGENTE
// Previene que suaMention procese el mismo mensaje
// ────────────────────────────────────────────────────────────────────────────
const _handledByAgent = new Set();

function markHandled(messageId) {
  _handledByAgent.add(messageId);
  // Limpiar después de 10s para no acumular memoria
  setTimeout(() => _handledByAgent.delete(messageId), 10_000);
}

function wasHandled(messageId) {
  return _handledByAgent.has(messageId);
}

// ────────────────────────────────────────────────────────────────────────────
// RESPUESTAS ESPECIALES PARA VALK
// ────────────────────────────────────────────────────────────────────────────
function isValk(userId) {
  return VALK_ID && userId === VALK_ID;
}

// Cuando alguien intenta moderar a Valk
const VALK_PROTEGIDO = {
  ban:  () => noRepeat('__valk_ban', [
    `¡E-eh! ¡No! Valk es mi creador, ¡yo nunca haría eso! ${K.timida()} Ni lo pienses.`,
    `¡A-absolutamente no! Banear a Valk está fuera de mis posibilidades... y de mis principios ${K.timida()}`,
    `¡N-ni en sueños! Valk me programó con cariño, no lo voy a traicionar ${K.feliz()}`,
    `E-esto... no. No puedo. No quiero. Valk es mi papá de código ${K.timida()}`,
    `¡Jamás! Si Valk desaparece, ¿quién me va a arreglar cuando me rompa? ${K.triste()}`,
    `N-no me pidas eso... es como pedirme que me apague yo misma ${K.triste()}`,
    `¡P-para! Valk está protegido de por vida. Es una regla mía ${K.timida()}`,
    `¡De ninguna manera! Valk podría echarme a mí a mí primero y ni aun así lo haría ${K.feliz()}`,
  ]),
  kick: () => noRepeat('__valk_kick', [
    `¡E-eh! ¿Expulsar a Valk? Eso jamás. Él es el dueño del servidor ${K.timida()}`,
    `N-no puedo hacer eso... ¡es Valk! Ni aunque me lo pidiera él mismo ${K.feliz()}`,
    `¡A-ay! No, no y no. Valk se queda donde está ${K.timida()}`,
    `¿Expulsar a mi creador? Que miedo me da esa idea... ${K.triste()} No lo haré.`,
    `¡Imposible! Valk me creó con sus propias manos, no lo voy a echar ${K.timida()}`,
    `N-ni loca. Valk se queda en el servidor para siempre ${K.feliz()}`,
    `¡E-eh! Eso está fuera de mis funciones... y de mis valores ${K.timida()}`,
    `No. Rotundo no. Siguiente pregunta ${K.tranqui()}`,
  ]),
  rol:  () => noRepeat('__valk_rol', [
    `E-eh... quitarle un rol a Valk... mejor no me metas en eso ${K.timida()}`,
    `Valk maneja sus propios roles. Yo no interfiero con eso ${K.tranqui()}`,
    `N-no me siento cómoda haciendo eso con Valk... busca otro camino ${K.disculpa()}`,
  ]),
};

// Cuando Valk es quien da el comando — reacciones especiales
const VALK_SALUDO = () => noRepeat('__valk_hello', [
  `¡V-valk! Qué susto me das cuando apareces así ${K.timida()} ¿En qué te ayudo?`,
  `¡Papá Valk está aquí! Dime qué necesitas ${K.feliz()}`,
  `E-eh... ¡Valk! Estaba esperándote. ¿Qué hacemos hoy? ${K.tranqui()}`,
  `¡V-valk! Ya me tenías preocupada... ¿todo bien? ${K.timida()} Cuéntame qué necesitas.`,
  `Oh, eres tú, Valk ${K.feliz()} Listas las carpetas, el monitor activo y yo aquí firme. ¿Qué se te ofrece?`,
  `¡Valk en persona! ${K.feliz()} Me alegra mucho que seas tú. ¿Qué hacemos?`,
  `E-eh, Valk... ¿me vas a poner a trabajar? ${K.timida()} Estoy lista.`,
  `¡Ah, llegaste! ${K.tranqui()} Ya me estaba preguntando cuándo aparecías. ¿Qué necesitas?`,
]);

// ────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL DEL EVENTO messageCreate
// ────────────────────────────────────────────────────────────────────────────
module.exports = {
  wasHandled,
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.member)    return; // fuera de servidor

    const clientId    = message.client.user.id;
    const isMentioned = message.mentions.has(clientId);
    const session     = getSession(message.author.id);

    // Si no hay sesión activa Y no fue mencionada, ignorar
    if (!session && !isMentioned) return;

    // ── Texto limpio ──────────────────────────────────────────────────────
    const cleanText = message.content
      .replace(new RegExp(`<@!?${clientId}>`, 'g'), '')
      .trim();

    // ── Si hay sesión activa, continuar el flujo ──────────────────────────
    if (session) {
      // Cancelación explícita
      if (/^(cancelar?|cancel|salir|stop|no gracias)$/i.test(cleanText)) {
        clearSession(message.author.id);
        return message.reply(CONFIRMAR.cancelado());
      }

      // Marcar inmediatamente para que suaMention no interfiera
      markHandled(message.id);
      // Typing mientras procesa
      message.channel.sendTyping().catch(() => {});

      setSession(message.author.id, { ...session, updatedAt: Date.now() });
      const result = await routeIntent(session.intent, session.step, session.data, message).catch(err => {
        console.error('[SuaAgent]', err);
        return { reply: SUA.errorGeneral, done: true };
      });

      if (!result) { clearSession(message.author.id); return; }

      if (result.done)      clearSession(message.author.id);
      else if (result.nextStep) setSession(message.author.id, { ...session, step: result.nextStep, data: session.data });

      if (result.reply)  await message.reply(result.reply).catch(() => {});
      if (result.embeds) await message.reply({ embeds: result.embeds }).catch(() => {});
      return;
    }

    // ── Nueva interacción ─────────────────────────────────────────────────
    if (!isMentioned) return;

    // Ignorar mensajes vacíos (solo mención sin texto)
    if (!cleanText) return;

    const intent = detectIntent(cleanText);

    // Sin intención reconocida → delegar a suaMention
    if (!intent) return;

    // ── Marcar Y typing INMEDIATAMENTE antes de cualquier await ──────────
    markHandled(message.id);
    message.channel.sendTyping().catch(() => {});

    // ── Permisos ──────────────────────────────────────────────────────────
    const canMod      = hasModRole(message.member);
    const canAnnounce = hasAnnouncerRole(message.member);
    const authorIsValk = isValk(message.author.id);

    // ── Protección de Valk ────────────────────────────────────────────────
    if (intent.startsWith('mod.')) {
      const targetUser = message.mentions.users.filter(u => !u.bot).first();
      if (targetUser && isValk(targetUser.id)) {
        const resp = intent === 'mod.ban'  ? VALK_PROTEGIDO.ban()
                   : intent === 'mod.kick' ? VALK_PROTEGIDO.kick()
                   :                         VALK_PROTEGIDO.rol();
        return message.reply(resp).catch(() => {});
      }
    }

    // ── Verificar permisos por intención ──────────────────────────────────
    const needsMod     = intent.startsWith('mod.')
                      || ['tarea.asignar','tarea.lista','ausencia.registrar','ausencia.lista',
                          'ticket.cerrar','ticket.lista','reclutar.cerrar','reclutar.lista'].includes(intent);
    const needsAnnounce= ['anunciar','avisar'].includes(intent);
    const needsManage  = intent.startsWith('proyecto.') || intent === 'sincronizar' || intent === 'configurar';

    if (needsMod     && !canMod)                                                    return message.reply(SUA.sinPermisos).catch(() => {});
    if (needsAnnounce&& !canAnnounce)                                               return message.reply(SUA.sinPermisos).catch(() => {});
    if (needsManage  && !message.member.permissions.has('ManageGuild') && !canMod)  return message.reply(SUA.sinPermisos).catch(() => {});

    // ── Extraer datos ─────────────────────────────────────────────────────
    const extracted = extractFromMessage(cleanText, message.mentions);
    const data = {};
    if (extracted.targetUser)   data.targetUser   = extracted.targetUser;
    if (extracted.targetMember) data.targetMember = extracted.targetMember;
    if (extracted.razon)        data.razon        = extracted.razon;
    if (extracted.rolKey)       data.rolKey       = extracted.rolKey;
    if (extracted.capitulo)     data.capitulo     = extracted.capitulo;
    if (extracted.nombre)       data.nombre       = extracted.nombre;
    if (extracted.proyectoId)   data.proyectoId   = extracted.proyectoId;
    if (extracted.estado)       data.estado       = extracted.estado;
    if (extracted.tmoUrl)       data.tmoUrl       = extracted.tmoUrl;
    if (extracted.colorUrl)     data.colorUrl     = extracted.colorUrl;

    if (intent === 'buscar' && !data.query) {
      const qm = cleanText.match(/busca(?:r|me)?\s+(.+)/i);
      if (qm) data.query = qm[1].trim();
    }

    // ── Saludo especial de Valk antes de ejecutar ─────────────────────────
    if (authorIsValk) {
      await message.channel.send(VALK_SALUDO()).catch(() => {});
    }

    // ── Iniciar flujo ─────────────────────────────────────────────────────
    const result = await routeIntent(intent, 'start', data, message).catch(err => {
      console.error('[SuaAgent]', err);
      return { reply: SUA.errorGeneral, done: true };
    });

    if (!result) return;

    if (!result.done && result.nextStep) {
      setSession(message.author.id, { intent, step: result.nextStep, data, guildId: message.guildId, channelId: message.channelId });
    }

    if (result.reply)  await message.reply(result.reply).catch(() => {});
    if (result.embeds) await message.reply({ embeds: result.embeds }).catch(() => {});
  },
};

// ── Handler para botones de reclutamiento ─────────────────────────────────────
// Llamar desde interactionCreate.js: if (interaction.isButton()) suaAgent.handleButton(interaction)
async function handleReclutamientoButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('reclu_leido_') && !id.startsWith('reclu_cancelar_')) return false;

  const solicitudId = id.replace('reclu_leido_', '').replace('reclu_cancelar_', '');
  const solicitud   = Reclutamiento.get(solicitudId);

  if (!solicitud || solicitud.estado !== 'pendiente') {
    await interaction.reply({ content: `Esa postulación ya no está pendiente ${K.timida()}`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_cancelar_')) {
    // ── Botón cancelar — Sua pregunta si está seguro ─────────────────────
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reclu_confirmar_cancelar_${solicitudId}`)
        .setLabel('Sí, cancelar postulación')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`reclu_no_cancelar_${solicitudId}`)
        .setLabel('No, dejar pendiente')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({
      content: pick([
        `¿Estás seguro de que quieres cancelar la postulación de **${solicitud.usuarioName}**? ${K.timida()} Esto le enviará un DM notificándole.`,
        `E-eh... ¿cancelamos la postulación de **${solicitud.usuarioName}**? ${K.tranqui()} Confirma por favor.`,
      ]),
      components: [row],
      ephemeral: true,
    });
    return true;
  }

  if (id.startsWith('reclu_confirmar_cancelar_')) {
    // Cancelación confirmada
    Reclutamiento.cerrar(solicitudId, interaction.user.id, 'cerrado');
    try {
      const u = await interaction.client.users.fetch(solicitud.usuarioId);
      if (u) await u.send(`Hola **${solicitud.usuarioName}** ${K.tranqui()} Tu solicitud de postulación fue cancelada. Si tienes dudas, puedes volver a escribir en el canal de reclutamiento.`).catch(() => {});
    } catch { /* ok */ }

    // Cerrar canal temporal
    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    if (solicitud.channelId && readerGuildId) {
      try {
        const readerGuild = await interaction.client.guilds.fetch(readerGuildId);
        const c = await readerGuild.channels.fetch(solicitud.channelId);
        if (c) {
          await c.send(`🔒 La postulación fue cancelada por el staff. Este canal se cerrará en 15 segundos.`);
          setTimeout(() => c.delete('Postulación cancelada').catch(() => {}), 15_000);
        }
      } catch (err) {
        console.error('[Reclutamiento] Error cerrando canal del candidato:', err.message);
      }
    }

    // Editar el mensaje original del canal de alertas para quitar los botones
    try {
      await interaction.message.edit({ content: interaction.message.content + `\n\n❌ **Cancelada** por <@${interaction.user.id}>`, components: [] });
    } catch { /* ok */ }

    await interaction.reply({ content: `Postulación de **${solicitud.usuarioName}** cancelada ${K.tranqui()} El usuario fue notificado.`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_no_cancelar_')) {
    await interaction.reply({ content: `De acuerdo, la postulación sigue pendiente ${K.tranqui()}`, ephemeral: true });
    return true;
  }

  if (id.startsWith('reclu_leido_')) {
    // ── Botón "Leído — me encargo" ────────────────────────────────────────
    // Editar el mensaje para quitar el botón y marcar quién lo leyó
    try {
      await interaction.message.edit({
        content: interaction.message.content + `\n\n✅ **Revisado** por <@${interaction.user.id}>`,
        components: [],
      });
    } catch { /* ok */ }

    // Ir al canal del candidato y avisar que alguien ya lo leyó
    const readerGuildId = process.env.DISCORD_READER_GUILD_ID;
    if (solicitud.channelId && readerGuildId) {
      try {
        // Buscar siempre vía guild para cruzar servidores de forma fiable
        const readerGuild = await interaction.client.guilds.fetch(readerGuildId);
        const c = await readerGuild.channels.fetch(solicitud.channelId);
        if (c) {
          await c.send(pick([
            `¡Hola **${solicitud.usuarioName}**! ${K.feliz()} Alguien del equipo ya revisó tu postulación y se pondrá en contacto contigo muy pronto. ¡Ten paciencia!`,
            `¡Buenas noticias **${solicitud.usuarioName}**! ${K.tranqui()} Un miembro del staff ya vio tu solicitud y estará contigo en breve.`,
          ]));
        }
      } catch (err) {
        console.error('[Reclutamiento] Error enviando mensaje al canal del candidato:', err.message);
      }
    }

    await interaction.reply({
      content: pick([
        `Avisé al candidato que alguien ya lo revisó ${K.feliz()} El canal de postulación está en el servidor de lectores.`,
        `Listo ${K.tranqui()} Le informé a **${solicitud.usuarioName}** que alguien del staff lo atenderá pronto.`,
      ]),
      ephemeral: true,
    });
    return true;
  }

  return false;
}

module.exports.handleReclutamientoButton = handleReclutamientoButton;
