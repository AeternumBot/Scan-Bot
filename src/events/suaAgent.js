// src/events/suaAgent.js
// ────────────────────────────────────────────────────────────────────────────
// Sua como agente conversacional autónomo.
// Detecta intención en lenguaje natural, recopila datos faltantes preguntando
// con su personalidad y ejecuta la acción real cuando tiene todo lo necesario.
// ────────────────────────────────────────────────────────────────────────────

const { Events, EmbedBuilder } = require('discord.js');
const { Projects, LastChapters } = require('../utils/storage');
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
  if (/\bstatus\b|como van?\b|en que van\b|revisa(r)?.{0,8}(el )?(estado|progreso|avance)|progreso de|avance de|que (tienen|hay) en drive|como estan? (el|los) proyecto/.test(t)) return 'status';

  // ── Salud ────────────────────────────────────────────────────────────────
  if (/\bsalud\b|diagnostico|como estas? (tu|usted)\b|te funcionas?\b|estas? bien\b|todo (bien|ok) (contigo|con vos)/.test(t)) return 'salud';

  // ── Sincronizar ──────────────────────────────────────────────────────────
  if (/sincroniza(r)?\b|actualiza(r)?.{0,8}cache|sync\b|refresca(r)?.{0,8}(cap|datos)|ponme al dia/.test(t)) return 'sincronizar';

  // ── Buscar ───────────────────────────────────────────────────────────────
  if (/busca(r|me)?\b|search\b|encuentra(r)?\b|existe.{0,8}en (tmo|colorcito)|esta.{0,8}en (tmo|colorcito)/.test(t)) return 'buscar';

  // ── Detección dinámica por nombre de proyecto ────────────────────────────
  // Si el mensaje menciona el nombre de un proyecto conocido + verbo de acción,
  // se infiere la intención sin necesidad de decir "proyecto"
  const proyectos = Projects.list();
  for (const p of proyectos) {
    const nombreN = normalize(p.name);
    const idN     = normalize(p.id);
    if (!t.includes(nombreN) && !t.includes(idN)) continue;

    if (/revisa(r)?|status|como va|progreso|avance|en que van|estado/.test(t)) return 'status';
    if (/elimina(r)?|borra(r)?|quita(r)?|remueve?/.test(t))                    return 'proyecto.remove';
    if (/activa(r)?|desactiva(r)?|pausa(r)?|reanuda(r)?/.test(t))              return 'proyecto.toggle';
    if (/(info|detalles|datos|cuentame)/.test(t))                               return 'proyecto.info';
    if (/anuncia(r)?|publica(r)?|cap(itulo)?/.test(t))                         return 'anunciar';
    if (/estado|hiatus|completado|dropeado|curso/.test(t))                      return 'proyecto.setstatus';
    // Solo mencionan el nombre sin verbo claro → mostrar info
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

  // URL
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch) extracted.url = urlMatch[1];

  // Rol de staff — nombre o key
  for (const [key, info] of Object.entries(STAFF_ROLES)) {
    if (t.includes(key) || t.includes(normalize(info.name))) {
      extracted.rolKey = key;
      break;
    }
  }

  // Proyecto por nombre o ID — busca en proyectos registrados dinámicamente
  const proyectos = Projects.list();
  for (const p of proyectos) {
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
    const tmoMatch   = t.match(/(https?:\/\/(?:www\.)?tumangaonline\.[^\s]+)/i);
    const colorMatch = t.match(/(https?:\/\/(?:www\.)?colorcito\.[^\s]+)/i);
    if (tmoMatch)   data.tmoUrl   = tmoMatch[1];
    if (colorMatch) data.colorUrl = colorMatch[1];
    if (!data.tmoUrl && !data.colorUrl) {
      return { reply: `Necesito al menos una URL (TMO o Colorcito) ${K.disculpa()} Pégala aquí.` };
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
  if (step === 'start') {
    if (!data.proyectoId) {
      const lista = Projects.list().map(p => `\`${p.id}\``).join(', ');
      return { reply: `¿De cuál proyecto anuncio un capítulo? ${K.feliz()} IDs: ${lista}`, nextStep: 'awaitProyecto' };
    }
    if (!data.capitulo) {
      return { reply: `¿Qué número de capítulo anuncio? ${K.tranqui()}`, nextStep: 'awaitCapitulo' };
    }
    return execAnunciar(data, message);
  }
  if (step === 'awaitProyecto') {
    const t = message.content.replace(/<@!?\d+>/g, '').trim();
    const p = Projects.get(t);
    if (!p) return { reply: `No encontré el proyecto \`${t}\`... ¿el ID está bien? ${K.disculpa()}` };
    data.proyectoId = t;
    return { reply: `¿Qué número de capítulo anuncio de **${p.name}**? ${K.tranqui()}`, nextStep: 'awaitCapitulo' };
  }
  if (step === 'awaitCapitulo') {
    const capMatch = message.content.match(/(\d+(?:[.,]\d+)?)/);
    if (!capMatch) return { reply: `No entendí el número de capítulo... ¿puedes repetirlo? ${K.disculpa()}` };
    data.capitulo = capMatch[1];
    return execAnunciar(data, message);
  }
}
async function execAnunciar(data, message) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
  const channelId = p.announcementChannel || process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!channelId) return { reply: SUA.anunciar.sinCanal, done: true };

  let chapterUrlTmo = null, chapterUrlColor = null;
  await Promise.all([
    p.sources?.tmo ? tmo().getLatestChapter(p.sources.tmo).then(d => { if (d) chapterUrlTmo = d.chapterUrl; }).catch(() => {}) : null,
    p.sources?.colorcito ? colorcito().getLatestChapter(p.sources.colorcito).then(d => { if (d) chapterUrlColor = d.chapterUrl; }).catch(() => {}) : null,
  ].filter(Boolean));

  const chapData = {
    chapterNum:  data.capitulo,
    chapterTitle: null,
    chapterUrl:  chapterUrlTmo || chapterUrlColor || null,
    thumbnail:   p.thumbnail || null,
    urlTmo:      chapterUrlTmo || null,
    urlColorcito: p.sources?.colorcito || chapterUrlColor || null,
  };

  const msg = await announcer().sendManualAnnouncement(message.client, p, chapData, {
    customMessage: null, imageUrl: null, credits: [], extraRoles: [],
  }).catch(() => null);

  if (!msg) return { reply: SUA.anunciar.errorEnvio, done: true };
  return { reply: SUA.anunciar.enviado(p.name, data.capitulo), done: true };
}

// ── avisar ────────────────────────────────────────────────────────────────────
async function flowAvisar(step, data, message) {
  if (step === 'start') {
    if (!data.titulo) {
      return { reply: `¿Cuál es el título del aviso? ${K.tranqui()}`, nextStep: 'awaitTitulo' };
    }
    if (!data.mensaje) {
      return { reply: `Ahora escribe el cuerpo del aviso ${K.tranqui()}`, nextStep: 'awaitMensaje' };
    }
    return execAvisar(data, message);
  }
  if (step === 'awaitTitulo') {
    data.titulo = message.content.replace(/<@!?\d+>/g, '').trim();
    return { reply: `Perfecto. Ahora el cuerpo del aviso ${K.tranqui()}`, nextStep: 'awaitMensaje' };
  }
  if (step === 'awaitMensaje') {
    data.mensaje = message.content.replace(/<@!?\d+>/g, '').trim();
    return execAvisar(data, message);
  }
}
async function execAvisar(data, message) {
  const STAFF_GUILD_ID  = process.env.DISCORD_GUILD_ID;
  const STAFF_NOTICE_ID = process.env.STAFF_NOTICE_ID  || '1368814037743177789';
  const READER_NOTICE_ID = process.env.NOTICE_CHANNEL_ID;
  const esStaff = message.guildId === STAFF_GUILD_ID;
  const channelId = esStaff ? STAFF_NOTICE_ID : READER_NOTICE_ID;
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

  const content = [
    '@everyone', '',
    `## ${data.titulo}`, '',
    data.mensaje, '',
    `Atentamente,`,
    `**Líder del equipo de Aeternum Translations.**`,
  ].join('\n');

  await channel.send({ content, allowedMentions: { parse: ['everyone'] } });
  return { reply: SUA.avisar.publicado, done: true };
}

// ── status ────────────────────────────────────────────────────────────────────
async function flowStatus(step, data, message) {
  if (step === 'start') {
    if (data.proyectoId) {
      return execStatus(data, message);
    }
    // Mostrar todos
    const projects = Projects.list().filter(p => p.active);
    if (!projects.length) return { reply: SUA.status.sinActivos, done: true };
    const lines = projects.map(p => {
      const last = require('../utils/storage').LastChapters.get(p.id, 'tmo')
        || require('../utils/storage').LastChapters.get(p.id, 'colorcito');
      return `${p.active ? '🟢' : '🔴'} **${p.name}** — último cap: **${last?.chapterNum || '—'}**`;
    });
    const embed = new EmbedBuilder()
      .setTitle('📊 Estado de proyectos activos')
      .setColor(0x9b59b6)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Revisé todo con mucho cuidado (っ˘ω˘ς)' });
    return { embeds: [embed], done: true };
  }
}
async function execStatus(data, message) {
  const p = Projects.get(data.proyectoId);
  if (!p) return { reply: SUA.proyecto.noEncontrado(data.proyectoId), done: true };
  // Delegar al comando status completo
  const statusCmd = require('./status');
  // Como no tenemos interaction, hacemos un mini-embed
  const last = require('../utils/storage').LastChapters.get(p.id, 'tmo')
    || require('../utils/storage').LastChapters.get(p.id, 'colorcito');
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${p.name}`)
    .setColor(0x9b59b6)
    .addFields(
      { name: 'Último capítulo', value: last ? `Cap. **${last.chapterNum}**` : 'Sin datos', inline: true },
      { name: 'Estado', value: p.status, inline: true },
      { name: 'Activo', value: p.active ? '✅' : '🔴', inline: true },
    )
    .setFooter({ text: 'Aquí está lo que encontré (っ˘ω˘ς)' });
  if (p.thumbnail) embed.setThumbnail(p.thumbnail);
  return { embeds: [embed], done: true };
}

// ── salud ─────────────────────────────────────────────────────────────────────
async function flowSalud(message) {
  const checks = [];
  let todosBien = true;
  const ping = message.client.ws.ping;
  if (ping < 200) checks.push(`✅ Conexión con Discord: **${ping}ms** (っ˘ω˘ς)`);
  else { checks.push(`⚠️ Conexión con Discord lenta: **${ping}ms** ${K.timida()}`); todosBien = false; }

  const projects = Projects.list();
  checks.push(`✅ **${projects.length}** proyecto(s), **${projects.filter(p=>p.active).length}** activo(s)`);

  try {
    await driveService().listFolder(process.env.GDRIVE_ROOT_FOLDER_ID);
    checks.push(`✅ Google Drive conectado (◕‿◕✿)`);
  } catch {
    checks.push(`❌ No pude conectarme con Google Drive (;ω;)`); todosBien = false;
  }

  const intro = todosBien
    ? `Me revisé y todo está en orden ${K.feliz()}\n\n`
    : `E-eh... me revisé y encontré algunos problemas ${K.timida()}\n\n`;
  return { reply: intro + checks.join('\n'), done: true };
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

module.exports.wasHandled = wasHandled;

// ────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL DEL EVENTO messageCreate
// ────────────────────────────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    const clientId = message.client.user.id;
    const isMentioned = message.mentions.has(clientId);
    const session = getSession(message.author.id);

    // Si no hay sesión activa Y no fue mencionada, ignorar
    if (!session && !isMentioned) return;

    // Si hay sesión activa pero no fue mencionada en este mensaje,
    // aceptar como respuesta al flujo en curso
    const isReply = session && !isMentioned;

    // ── Verificar permisos ────────────────────────────────────────────────
    if (!message.member) return; // mensaje fuera de servidor
    const canMod      = hasModRole(message.member);
    const canAnnounce = hasAnnouncerRole(message.member);

    // ── Texto limpio sin la mención del bot ───────────────────────────────
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

      setSession(message.author.id, { ...session, updatedAt: Date.now() });
      const result = await routeIntent(session.intent, session.step, session.data, message).catch(err => {
        console.error('[SuaAgent]', err);
        return { reply: SUA.errorGeneral, done: true };
      });

      if (!result) { clearSession(message.author.id); return; }

      // Actualizar sesión o limpiar
      if (result.done) {
        clearSession(message.author.id);
      } else if (result.nextStep) {
        setSession(message.author.id, { ...session, step: result.nextStep, data: session.data });
      }

      // Marcar como manejado ANTES de responder para que suaMention no lo toque
      markHandled(message.id);

      // Enviar respuesta
      if (result.reply)  await message.reply(result.reply).catch(() => {});
      if (result.embeds) await message.reply({ embeds: result.embeds }).catch(() => {});
      return;
    }

    // ── Nueva interacción: detectar intención ─────────────────────────────
    if (!isMentioned) return;

    const intent = detectIntent(cleanText);

    if (!intent) {
      // Delegar al handler de menciones normales (suaMention)
      return;
    }

    // ── Verificar permisos por intención ──────────────────────────────────
    const needsMod      = intent.startsWith('mod.');
    const needsAnnounce = ['anunciar','avisar'].includes(intent);
    const needsManage   = intent.startsWith('proyecto.') || intent === 'sincronizar';

    if (needsMod && !canMod) {
      return message.reply(SUA.sinPermisos);
    }
    if (needsAnnounce && !canAnnounce) {
      return message.reply(SUA.sinPermisos);
    }
    if (needsManage && !message.member.permissions.has('ManageGuild') && !canMod) {
      return message.reply(SUA.sinPermisos);
    }

    // ── Extraer datos del mensaje inicial ─────────────────────────────────
    const extracted = extractFromMessage(cleanText, message.mentions);

    // Mapear datos extraídos a la estructura del flujo
    // extractFromMessage ya resuelve proyectoId dinámicamente desde la lista de proyectos
    const data = {};
    if (extracted.targetUser)   data.targetUser   = extracted.targetUser;
    if (extracted.targetMember) data.targetMember = extracted.targetMember;
    if (extracted.razon)        data.razon        = extracted.razon;
    if (extracted.rolKey)       data.rolKey       = extracted.rolKey;
    if (extracted.capitulo)     data.capitulo     = extracted.capitulo;
    if (extracted.nombre)       data.nombre       = extracted.nombre;
    if (extracted.proyectoId)   data.proyectoId   = extracted.proyectoId;
    if (extracted.estado)       data.estado       = extracted.estado;

    // Query para búsqueda — todo lo que venga después de "busca(r)"
    if (intent === 'buscar' && !data.query) {
      const queryMatch = cleanText.match(/busca(?:r|me)?\s+(.+)/i);
      if (queryMatch) data.query = queryMatch[1].trim();
    }

    // ── Iniciar flujo ─────────────────────────────────────────────────────
    const result = await routeIntent(intent, 'start', data, message).catch(err => {
      console.error('[SuaAgent]', err);
      return { reply: SUA.errorGeneral, done: true };
    });

    if (!result) return;

    // Marcar como manejado ANTES de responder para que suaMention no lo toque
    markHandled(message.id);

    if (!result.done && result.nextStep) {
      setSession(message.author.id, { intent, step: result.nextStep, data, guildId: message.guildId, channelId: message.channelId });
    }

    if (result.reply)  await message.reply(result.reply).catch(() => {});
    if (result.embeds) await message.reply({ embeds: result.embeds }).catch(() => {});
  },
};
