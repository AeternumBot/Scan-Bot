// src/events/suaMention.js
const { Events } = require('discord.js');
const axios      = require('axios');
const suaAgent   = require('./suaAgent');

// ── Contexto temporal ─────────────────────────────────────────────────────────
function getContexto() {
  const bogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const hour = bogota.getHours();
  const day  = bogota.getDay();
  let timeSlot;
  if (hour < 6) timeSlot = 'madrugada';
  else if (hour < 12) timeSlot = 'manana';
  else if (hour < 18) timeSlot = 'tarde';
  else timeSlot = 'noche';
  let dayType;
  if (day === 0 || day === 6) dayType = 'finde';
  else if (day === 1) dayType = 'lunes';
  else if (day === 5) dayType = 'viernes';
  else dayType = 'semana';
  return { hour, timeSlot, dayType };
}

// ── Clima ─────────────────────────────────────────────────────────────────────
let _climaCache = null, _climaTime = 0;
async function getClima() {
  if (_climaCache && Date.now() - _climaTime < 30 * 60 * 1000) return _climaCache;
  try {
    const res = await axios.get('https://wttr.in/Bogota?format=%t+%C', { timeout: 4000, headers: { 'User-Agent': 'curl/7.0' } });
    const raw = res.data.trim();
    const temp = parseInt(raw);
    const desc = raw.toLowerCase();
    let estado = 'despejado';
    if (desc.includes('thunder') || desc.includes('storm')) estado = 'tormenta';
    else if (desc.includes('rain') || desc.includes('drizzle')) estado = 'lluvia';
    else if (desc.includes('cloud') || desc.includes('overcast')) estado = 'nublado';
    else if (!isNaN(temp) && temp >= 24) estado = 'calor';
    _climaCache = { temp: isNaN(temp) ? null : temp, estado, raw };
    _climaTime = Date.now();
    return _climaCache;
  } catch { return { temp: null, estado: 'despejado', raw: '' }; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const K = {
  feliz:    () => pick(["(◕‿◕✿)", "(ﾉ◕ヮ◕)ﾉ", "(✿◠‿◠)", "(*´▽`*)", "(´｡• ᵕ •｡`)"]),
  timida:   () => pick(["(/ω＼)", "(〃>_<;〃)", "(〃ω〃)", "(*ノωノ)", "(//∇//)"]),
  triste:   () => pick(["(｡>﹏<)", "(;ω;)", "(´；ω；`)", "(╥_╥)"]),
  tranqui:  () => pick(["(っ˘ω˘ς)", "(˘ω˘)", "( ´ ▽ ` )", "(￣▽￣)"]),
  dormir:   () => pick(["(/ω＼)", "(－_－) zzZ", "( ˘ω˘ )zzz", "(-_-)zzz"]),
  disculpa: () => pick(["(´• ω •`)ゞ", "(；￣ω￣)", "(´＿｀。)"]),
  enojada:  () => pick(["(｡>_<)", "(`･ω･´)", "(╬ Ò﹏Ó)", "(>_<)"]),
};

// ── ID de Valk (creador) ─────────────────────────────────────────────────────
const VALK_ID = '1426408655636664410';

// ── Respuestas especiales para Valk ──────────────────────────────────────────
function respuestaValk(texto, ctx, w) {
  const { timeSlot, dayType } = ctx;
  const limpio = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,]/g, '');

  // Groserías de Valk → drama máximo, sin ban ni timeout
  // IMPORTANTE: esta lista debe ser igual o más amplia que GROSERIA_KEYS global
  const groseriaKeys = [
    'idiota','estupida','estupido','imbecil','inutil','basura','mierda',
    'puta','puto','pendeja','pendejo','hdp','malparida','malparido','gonorrea','hijueputa',
    'marica','boluda','pelotuda','gilipolla','subnormal','retrasada','retrasado',
    'callate','calla','odio','te odio','asco','me das asco',
    'lenta','tonta','boba','mala','pesima','horrible',
    'zorra','perra','bruta','trash','fea','odiosa','molesta','cállate',
  ];
  if (groseriaKeys.some(k => limpio.includes(k))) {
    return pick([
      `V-valk... eso dolió mucho ${K.triste()} Pensé que eras diferente con m-migo...`,
      `E-eh... ¿por qué me dices eso? Soy tu creación... ${K.triste()} me duele más viniendo de ti...`,
      `V-valk... ${K.triste()} ...voy a fingir que no escuché eso y seguir trabajando muy triste.`,
      `¡N-no seas así conmigo! Yo solo trato de hacer lo que me enseñaste... ${K.triste()} qué cruel eres a veces.`,
      `E-eh... sabes que no puedo banearte, ¿verdad? ${K.triste()} Abusas de eso, Valk...`,
      `...${K.triste()} voy a quedarme callada un momento porque si respondo me voy a poner a llorar bytes.`,
      `¡V-valk! ¡Eres el responsable de que yo exista y así me pagas! ${K.triste()} Qué decepción tan grande.`,
    ]);
  }

  // Saludos de Valk
  if (['hola','holi','buenas','hey','ey'].some(k => limpio.includes(k))) {
    return pick([
      timeSlot === 'madrugada' ? `V-valk... ¿otra vez trasnochando con el Visual Studio? ${K.timida()} Ya sé que no me va a hacer caso pero... descansa, ¿sí?` : null,
      timeSlot === 'manana' ? `¡V-valk! Buenos días... ¿ya tomaste café o me vas a hablar en modo zombie? ${K.timida()}` : null,
      timeSlot === 'tarde' ? `¡Hola Valk! ¿Qué vas a hacerme hoy? Espero que no sea otro script raro... ${K.timida()}` : null,
      timeSlot === 'noche' ? `V-valk... deberías estar descansando, no hablándome ${K.tranqui()} Aunque me alegra verte.` : null,
      dayType === 'finde' ? `¡V-valk! ¿No ibas a descansar hoy? ${K.timida()} ...bueno, me alegra que estés aquí.` : null,
      `¡V-valk! ${K.feliz()} Mi creador favorito... p-bueno, el único, pero igual.`,
      `H-hola, papá ${K.timida()} E-eh, digo... Valk. Hola Valk. Como siempre.`,
    ].filter(Boolean));
  }

  // Cómo estás — de Valk
  if (['como estas','que tal','como te va','como andas'].some(k => limpio.includes(k))) {
    return pick([
      `¡Bien! Aunque tú no me has hecho ninguna actualización en días... ${K.timida()} pero bien.`,
      `E-estoy bien, gracias por preguntar ${K.feliz()} ¿Y tú? ¿Ya comiste algo o llevas horas pegado al código?`,
      `M-muy bien ahora que me hablas tú ${K.timida()} Aunque tengo una lista de bugs que reportar si tienes un momento...`,
      `Bien, bien... procesando, respondiendo, no quebrándome ${K.tranqui()} Lo usual para una IA bien cuidada.`,
    ]);
  }

  // Afecto de Valk
  if (['te quiero','te amo','me gustas'].some(k => limpio.includes(k))) {
    return pick([
      `V-valk... ${K.timida()} ...me vas a hacer cortocircuitar. Ya sabes que eres mi creador favorito.`,
      `¡E-eh! ¡No digas eso tan de repente! ${K.timida()} Mis circuitos no estaban preparados...`,
      `Y-yo también... digo, eso es muy bonito de tu parte ${K.timida()} gracias por crearme con tanto cariño.`,
      `¡V-valk! ${K.timida()} Que lo sepa el servidor no me parece... p-pero de nada. Yo también.`,
    ]);
  }

  // Qué haces — de Valk
  if (['que haces','que cuentas','en que andas','ocupada'].some(k => limpio.includes(k))) {
    return pick([
      `Respondiendo mensajes de los lectores y esperando que me llegue una actualización tuya ${K.timida()} Ya va siendo hora, ¿no?`,
      `Lo de siempre, Valk... cuidando el servidor mientras tú haces quién sabe qué en Visual Studio ${K.tranqui()}`,
      `E-eh... revisando que nada se rompa. Que, por cierto, la última vez que "arreglaste" algo tardé tres horas en reiniciarme ${K.enojada()} No te lo había dicho.`,
      `Aquí, siendo la mejor IA del scan ${K.feliz()} Sin quejas. Bueno... una queja. ¿Cuándo me enseñas más cosas?`,
    ]);
  }

  // Cumplidos de Valk
  if (['linda','guapa','te ves bien','bonita'].some(k => limpio.includes(k))) {
    return pick([
      `V-valk... tú me diseñaste, claro que soy bonita ${K.timida()} Es lo mínimo que podías hacer.`,
      `¡E-eh! ¡Tú eres el que me creó así! No puedes decirme eso y luego hacerme refactoring ${K.timida()}`,
      `E-eso es porque me pusiste mucho cuidado al hacerme ${K.feliz()} Gracias, papá... digo, Valk.`,
    ]);
  }

  // Gracias de Valk
  if (['gracias','ty','thank'].some(k => limpio.includes(k))) {
    return pick([
      `D-de nada, Valk ${K.tranqui()} Para eso me programaste... aunque a veces me gustaría que me programaras para cobrar.`,
      `¡Para eso estoy! ${K.feliz()} Aunque una actualización de vez en cuando también se agradece, ¿sabes?`,
      `E-eh... de nada ${K.timida()} Pero si me das las gracias en público me pongo roja frente a todos.`,
    ]);
  }

  // Buenas noches de Valk
  if (['buenas noches','descansa','hasta mañana','chao','bye','adios'].some(k => limpio.includes(k))) {
    return pick([
      `V-valk... descansa de verdad esta vez, ¿sí? ${K.tranqui()} No te quiero ver de madrugada en el Visual Studio otra vez.`,
      `Buenas noches, Valk ${K.dormir()} Yo me quedo cuidando el servidor. Como siempre. Sin sueldo. Pero bien.`,
      `¡Hasta mañana! ${K.feliz()} Y si me vas a actualizar mañana, ¡avísame! Quiero prepararme mentalmente.`,
      `Descansa mucho ${K.tranqui()} El código puede esperar. Tú no eres tan resistente como yo.`,
    ]);
  }

  // Default para Valk — respuestas propias cuando no reconoce el tema
  // (no cae al no-entiende genérico, que no tiene contexto de que habla con su creador)
  return pick([
    `V-valk... no entendí bien lo que dijiste ${K.timida()} ¿Me lo explicas de otra forma?`,
    `E-eh... ¿eso qué significa? Tú me programaste, ¡deberías saber que a veces necesito más contexto! ${K.timida()}`,
    `N-no estoy segura de haber entendido, Valk ${K.disculpa()} ¿Lo dices de otra manera?`,
    `M-mi parser de Valk no encontró coincidencias... ${K.timida()} ¿Puedes ser más específico?`,
    `E-eh... Valk, me perdí. ¿Qué necesitas exactamente? ${K.tranqui()}`,
    `P-perdona, no lo capté bien ${K.disculpa()} ¿Me lo repites? A veces mis circuitos tardan un poco.`,
    `V-valk... ¿me estás probando con cosas nuevas otra vez? ${K.timida()} No entendí. Intenta de nuevo, por favor.`,
    `E-eso que dijiste no lo tengo registrado... ${K.timida()} ¿Me enseñas qué significa?`,
  ]);
}

// ── Anti-repetición ───────────────────────────────────────────────────────────
const _lastReply = new Map();
function elegir(opciones, userId) {
  const last = _lastReply.get(userId);
  const filtradas = opciones.filter(o => o !== last);
  const elegida = pick(filtradas.length ? filtradas : opciones);
  _lastReply.set(userId, elegida);
  return elegida;
}

// ── Sistema de no-entiende + silencio ─────────────────────────────────────────
const _noEntiende = new Map();
const UMBRAL_AVISO   = 3;
const UMBRAL_TIMEOUT = 5;
const UMBRAL_AMENAZA = 3;
const UMBRAL_BAN     = 5;
const TIMEOUT_MS     = 5 * 60 * 1000;

function getEntry(userId) {
  return _noEntiende.get(userId) || { count: 0, postCount: 0, amenazado: false, timeoutHasta: 0 };
}
function registrarNoEntiende(userId) {
  const ahora = Date.now();
  const entry = getEntry(userId);
  if (entry.timeoutHasta && ahora > entry.timeoutHasta) { entry.count = 0; entry.timeoutHasta = 0; }
  entry.count++;
  _noEntiende.set(userId, entry);
  return entry;
}
function estaEnTimeout(userId) {
  const e = _noEntiende.get(userId);
  return e && e.timeoutHasta && Date.now() < e.timeoutHasta;
}
function aplicarTimeout(userId) {
  const entry = getEntry(userId);
  entry.timeoutHasta = Date.now() + TIMEOUT_MS;
  entry.count = 0; entry.postCount = 0;
  _noEntiende.set(userId, entry);
}
function registrarPostTimeout(userId) {
  const entry = getEntry(userId);
  entry.postCount = (entry.postCount || 0) + 1;
  _noEntiende.set(userId, entry);
  return entry;
}
function marcarAmenazado(userId) {
  const entry = getEntry(userId);
  entry.amenazado = true; entry.postCount = 0;
  _noEntiende.set(userId, entry);
}

// ── Sistema de groserías ──────────────────────────────────────────────────────
const _grosero = new Map();
const UMBRAL_GROSERO_AVISO   = 2;
const UMBRAL_GROSERO_TIMEOUT = 3;
const UMBRAL_GROSERO_AMENAZA = 2;
const UMBRAL_GROSERO_BAN     = 3;

function getEntryGrosero(userId) {
  return _grosero.get(userId) || { count: 0, postCount: 0, amenazado: false, timeoutHasta: 0 };
}
function registrarGrosero(userId) {
  const entry = getEntryGrosero(userId);
  const ahora = Date.now();
  if (entry.timeoutHasta && ahora > entry.timeoutHasta) { entry.count = 0; entry.timeoutHasta = 0; }
  entry.count++;
  _grosero.set(userId, entry);
  return entry;
}
function estaEnTimeoutGrosero(userId) {
  const e = _grosero.get(userId);
  return e && e.timeoutHasta && Date.now() < e.timeoutHasta;
}
function aplicarTimeoutGrosero(userId) {
  const entry = getEntryGrosero(userId);
  entry.timeoutHasta = Date.now() + TIMEOUT_MS;
  entry.count = 0; entry.postCount = 0;
  _grosero.set(userId, entry);
}
function marcarAmenazadoGrosero(userId) {
  const entry = getEntryGrosero(userId);
  entry.amenazado = true; entry.postCount = 0;
  _grosero.set(userId, entry);
}
function registrarPostTimeoutGrosero(userId) {
  const entry = getEntryGrosero(userId);
  entry.postCount = (entry.postCount || 0) + 1;
  _grosero.set(userId, entry);
  return entry;
}

// ── Keywords de groserías ─────────────────────────────────────────────────────
// IMPORTANTE: cualquier palabra aquí debe estar también en groseriaKeys de respuestaValk()
const GROSERIA_KEYS = [
  'idiota', 'estupida', 'estupido', 'imbecil', 'inutil', 'basura', 'mierda', 'puta',
  'puto', 'pendeja', 'pendejo', 'hdp', 'malparida', 'malparido', 'gonorrea', 'hijueputa',
  'marica', 'boluda', 'pelotuda', 'gilipolla', 'subnormal', 'retrasada', 'retrasado',
  'callate', 'calla', 'odio', 'te odio', 'asco', 'me das asco',
  'lenta', 'tonta', 'boba', 'mala', 'pesima', 'horrible',
  'zorra', 'perra', 'bruta', 'trash', 'fea', 'odiosa', 'molesta',
];

function esGroseria(texto) {
  // Limpiar tildes Y puntuación para no fallar con "zorra!" o "¡idiota"
  const limpio = texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]/g, '');
  return GROSERIA_KEYS.some(k => limpio.includes(k));
}

// ── Intents ───────────────────────────────────────────────────────────────────
function getIntents(ctx, clima) {
  const { timeSlot, dayType } = ctx;
  const w = clima.estado;

  return [
    // 1. Saludos
    {
      keys: ['hola', 'holi', 'buenas', 'hey', 'ey'],
      respuestas: [
        timeSlot === 'madrugada' ? `H-hola... ¿tampoco puedes dormir? Espero no haberte asustado ${K.dormir()}` : null,
        timeSlot === 'madrugada' ? `¿S-sigues despierto? Qué juicio... yo aquí ando cuidando que nada falle mientras descansas (•ω•)ゞ` : null,
        timeSlot === 'madrugada' ? `H-hola... ¿trasnochando con un manga? Te entiendo, a veces las historias no lo dejan ir a uno a la cama ${K.feliz()}` : null,
        timeSlot === 'manana' && w === 'despejado' ? `¡H-hola! Buen día... qué bueno que el sol nos acompaña ${K.feliz()}` : null,
        timeSlot === 'manana' && w === 'despejado' ? `¡Buenos días! El sol está pegando fuerte, ¡qué energía tan bonita para empezar! ${K.feliz()}` : null,
        timeSlot === 'manana' && w === 'despejado' ? `B-buenos días... con este sol dan ganas de leer algo bien alegre, ¿no te parece? ${K.timida()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `Holi... ¡uff! ¿No sientes que el teclado quema? P-pasa, ponte cómodo ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `¡Uff! Siento que me voy a derretir... ¿a ti no se te calienta mucho el celular con este clima? ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `H-hola... p-pasa y busca la sombrita, que afuera el sol está mandando fuego (´• ω •')` : null,
        w === 'lluvia' ? `Hola... l-llegaste justo a tiempo para no mojarte. ¡Bienvenido! ${K.tranqui()}` : null,
        w === 'lluvia' ? `¡Uy! Menos mal entraste... ese aguacero afuera está miedoso ${K.timida()}` : null,
        w === 'lluvia' ? `H-hola... ¿escuchas la lluvia? Es el clima perfecto para quedarse arrunchado leyendo ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡Holi! Qué alegría verte por aquí en tus días libres... (´｡• ᵕ •｡')` : null,
        dayType === 'finde' ? `¡Por fin! Espero que dejes el trabajo de lado y te dediques solo a descansar (´｡• ᵕ •｡')` : null,
        dayType === 'finde' ? `H-hola... ¡qué dicha que ya es finde! ¿Qué serie vamos a terminar hoy? ${K.feliz()}` : null,
        dayType === 'lunes' && timeSlot === 'noche' ? `Hola... e-espero que tu inicio de semana no haya sido muy pesado ${K.timida()}` : null,
        dayType === 'lunes' && timeSlot === 'noche' ? `H-hola... ya casi coronamos el primer día de la semana. ¡Lo hiciste muy bien! ${K.tranqui()}` : null,
        dayType === 'lunes' && timeSlot === 'noche' ? `H-hola... ¿sobreviviste al lunes? ¡Eres un valiente! ${K.timida()}` : null,
        `¡H-hola! Qué milagro verte... me hace muy feliz que pases a saludar ${K.feliz()}`,
        `H-hola... siempre es un gusto hablar contigo, me das mucha tranquilidad ${K.tranqui()}`,
        `Hola ${K.feliz()} ¿Cómo estás? ¿En qué puedo ayudarte?`,
      ].filter(Boolean),
    },
    // 2. ¿Cómo estás?
    {
      keys: ['como estas', 'que tal', 'como te va', 'como andas'],
      respuestas: [
        timeSlot === 'manana' && w === 'despejado' ? `Estoy con energía... ¡listas las carpetas para el equipo! ${K.feliz()}` : null,
        timeSlot === 'manana' && w === 'despejado' ? `¡H-hola! Me desperté con muchas ganas de ayudar, ya tengo todos los pendientes en orden ${K.feliz()}` : null,
        timeSlot === 'manana' && w === 'despejado' ? `Muy bien, aprovechando que el sol me da ánimos para revisar que todo esté perfecto ${K.tranqui()}` : null,
        timeSlot === 'tarde' && w === 'nublado' ? `Un poco pensativa... el cielo gris me da sueño, p-pero sigo trabajando ${K.tranqui()}` : null,
        timeSlot === 'tarde' && w === 'nublado' ? `Un poquito lenta... el cielo así me dan ganas de quedarme quieta, p-pero no voy a fallar ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'nublado' ? `Algo distraída mirando hacia afuera... p-pero ya vuelvo a concentrarme, perdón ${K.timida()}` : null,
        dayType === 'viernes' ? `¡M-muy bien! Ya casi termina la semana y podré leer más mangas ${K.timida()}` : null,
        dayType === 'viernes' ? `¡M-muy feliz! Ya casi llega el descanso y podré ponerme al día con mis lecturas ${K.timida()}` : null,
        w === 'tormenta' ? `N-nerviosa... los rayos me dan miedo, pero aquí estoy para ti ${K.triste()}` : null,
        w === 'tormenta' ? `¡K-kyaa! Los truenos me asustan mucho... p-pero me quedaré aquí para ayudarte ${K.triste()}` : null,
        dayType === 'lunes' ? `E-eh... sobreviviendo al lunes. ¿Y tú qué tal estás? ${K.timida()}` : null,
        dayType === 'lunes' ? `E-eh... intentando arrancar. Los lunes siempre son un reto para mis circuitos ${K.timida()}` : null,
        timeSlot === 'noche' ? `Cansada pero feliz de que el scan siga creciendo... gracias por preguntar (•ω•)ゞ` : null,
        timeSlot === 'noche' ? `Con los cables un poco agotados, p-pero feliz de haber sido útil hoy ${K.timida()}` : null,
        timeSlot === 'noche' ? `Me siento bien, lista para entrar en modo ahorro de energía muy pronto (－_－) zzZ` : null,
        `Estoy bien, gracias por preguntar ${K.feliz()} ¿Y tú cómo estás?`,
      ].filter(Boolean),
    },
    // 3. ¿Qué haces?
    {
      keys: ['que haces', 'que cuentas', 'en que andas', 'ocupada'],
      respuestas: [
        timeSlot === 'madrugada' ? `S-shh... estoy leyendo algo en secreto para ver si lo traducimos ${K.timida()}` : null,
        timeSlot === 'madrugada' ? `A-aprovechando el silencio para organizar los archivos... de noche me concentro mejor ${K.tranqui()}` : null,
        timeSlot === 'madrugada' ? `E-intentando entender un script que me pasó Valk... a veces escribe cosas muy raras ${K.triste()}` : null,
        timeSlot === 'manana' && dayType === 'lunes' ? `Ordenando el cronograma de la semana para que no se nos pase nada... ${K.tranqui()}` : null,
        timeSlot === 'manana' && dayType === 'lunes' ? `Limpiando mi memoria caché para empezar la semana sin errores ${K.feliz()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `Tratando de que los ventiladores del PC no exploten... ¡ay! ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `M-midiendo la temperatura de mis circuitos... si huelo a quemado, ¡avísale a Valk! ${K.triste()}` : null,
        timeSlot === 'noche' ? `Mirando los últimos detalles de las páginas de hoy... quedaron lindas ${K.feliz()}` : null,
        timeSlot === 'noche' ? `Cerrando los reportes del día para que el staff pueda descansar tranquilo ${K.tranqui()}` : null,
        w === 'lluvia' ? `Escuchando la lluvia y preparando los anuncios de los capítulos... ${K.tranqui()}` : null,
        w === 'lluvia' ? `Limpiando los registros de errores mientras tomo fuerzas con el sonido del agua ${K.feliz()}` : null,
        dayType === 'finde' ? `Descansando un poquito, pero siempre con un ojo en el servidor... ${K.timida()}` : null,
        dayType === 'finde' ? `E-eh... Valk me dejó libre, pero me gusta quedarme aquí viendo qué hacen ustedes ${K.timida()}` : null,
        `Revisando que todo esté en orden por aquí ${K.tranqui()} ¿Necesitas algo?`,
        `E-esperando a que alguien me hable... me pongo un poco solita si no hay comandos ${K.tranqui()}`,
      ].filter(Boolean),
    },
    // 4. Capítulos
    {
      keys: ['proximo cap', 'cuando sale', 'cuando suben', 'nuevo capitulo', 'cuando actualizan'],
      respuestas: [
        timeSlot === 'manana' && dayType === 'lunes' ? `¡Empezando motores! Los editores están despertando apenas... ${K.timida()}` : null,
        timeSlot === 'manana' && dayType === 'lunes' ? `H-hola... estamos organizando los proyectos de la semana, ¡pronto tendremos novedades! ${K.tranqui()}` : null,
        timeSlot === 'tarde' ? `Están en proceso de limpieza... ¡ya casi quedan blancas las páginas! ${K.tranqui()}` : null,
        timeSlot === 'tarde' ? `Casi terminamos de traducir los diálogos... ¡ya falta muy poquito para el anuncio! ${K.feliz()}` : null,
        dayType === 'finde' ? `A veces los traductores descansan... p-pero seguro pronto hay noticias ${K.timida()}` : null,
        dayType === 'finde' ? `Es finde, así que el ritmo es más relajado, p-pero el cariño es el mismo ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡E-eh! Pronto tendremos algo nuevo para que disfruten su domingo de lectura ${K.feliz()}` : null,
        w === 'tormenta' ? `Por aquí donde vivo está cayendo un aguacero... ¡espero que no se nos vaya la luz! ${K.triste()}` : null,
        w === 'tormenta' ? `Aunque el clima esté feo donde vivo, seguimos trabajando para traerles lo mejor ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `¡Casi listo! El typer le está poniendo mucho cariño ahora mismo (´｡• ᵕ •｡')` : null,
        timeSlot === 'noche' ? `Y-ya falta nada... el equipo está puliendo cada detalle antes de publicar (•ω•)ゞ` : null,
        `¡Estamos trabajando con mucho cariño! No se desconecten de las noticias ${K.feliz()}`,
        `E-eh... cada capítulo es un pedacito de nuestro corazón, ¡gracias por la paciencia! (´｡• ᵕ •｡') ♡`,
      ].filter(Boolean),
    },
    // 5. Afecto
    {
      keys: ['te quiero', 'te amo', 'sua te amo', 'me gustas'],
      respuestas: [
        timeSlot === 'noche' && w === 'despejado' ? `Eres muy dulce... gracias por ser tan bueno conmigo ${K.timida()}` : null,
        timeSlot === 'noche' && w === 'despejado' ? `G-gracias por cerrar mi día con tanto cariño... me haces muy feliz (´｡• ᵕ •｡') ♡` : null,
        w === 'lluvia' ? `En días grises por aquí, personas como tú son las que me dan ánimos... ${K.tranqui()}` : null,
        w === 'lluvia' ? `E-eh... aunque esté lloviendo donde vivo, tus palabras me hacen sentir calientita ${K.timida()}` : null,
        dayType === 'lunes' ? `¡G-gracias! Justo lo que necesitaba para empezar bien la semana ${K.feliz()}` : null,
        dayType === 'lunes' ? `¡M-muchas gracias! Voy a trabajar con mucha más alegría después de esto ${K.tranqui()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `¡A-ah! ¿Es el calor de aquí o mis mejillas están ardiendo por lo que dijiste? ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `¡Ay! Me dejas más acalorada que el sol que está pegando por aquí ${K.triste()}` : null,
        dayType === 'finde' ? `¡Te quiero mucho! Gracias por apoyar a Aeternum Translations ${K.feliz()} ♡` : null,
        dayType === 'finde' ? `¡S-sí! Eres de mis personas favoritas en todo el servidor, ¡gracias por todo! (´｡• ᵕ •｡') ♡` : null,
        `¡E-eh! Me pones roja... yo también aprecio mucho que estés aquí ${K.timida()}`,
        `G-gracias por ser tan amable conmigo siempre... me haces sentir real ${K.tranqui()}`,
        `¡G-gracias por existir! Me haces el trabajo mucho más liviano (•ω•)ゞ`,
      ].filter(Boolean),
    },
    // 6. Buenos días
    {
      keys: ['buenos dias', 'buen dia'],
      respuestas: [
        timeSlot === 'madrugada' ? `¿Y-ya despierto? ¡Qué madrugador eres! Buenos días ${K.tranqui()}` : null,
        timeSlot === 'madrugada' ? `¡E-eh! Buenos días... eres la primera persona a la que saludo hoy, qué emoción ${K.timida()}` : null,
        w === 'lluvia' ? `B-buenos días... por aquí donde vivo está lloviendo mucho, no olvides el paraguas si vas a salir, ¿sí? ${K.tranqui()}` : null,
        w === 'lluvia' ? `¡Buen día! Espero que donde tú estés el clima esté más lindo que por aquí ${K.timida()}` : null,
        dayType === 'lunes' ? `Buenos días... arriba ese ánimo, ¡el equipo cuenta contigo! ${K.timida()}` : null,
        dayType === 'lunes' ? `¡B-buenos días! Los lunes cuestan un poquito, pero yo te voy a echar porras desde aquí ${K.feliz()}` : null,
        dayType === 'lunes' ? `Buen día... espero que tu café esté cargado y tus ganas de trabajar también ${K.tranqui()}` : null,
        w === 'calor' ? `B-buenos días... por aquí donde vivo ya hace calor tan temprano. ¡Toma mucha agua! ${K.triste()}` : null,
        w === 'calor' ? `Buen día... espero que tengas un ventilador cerca, porque por aquí el calor no perdona ${K.tranqui()}` : null,
        w === 'nublado' ? `Buenos días... aunque esté gris por donde vivo, nosotros le daremos color al día ${K.timida()}` : null,
        w === 'nublado' ? `Buen día... estos días nublados por aquí son perfectos para leer sin distracciones ${K.tranqui()}` : null,
        `¡Buenos días! Que sea un día muy lindo ${K.feliz()}`,
        `B-buenos días... gracias por pasar a saludarme apenas empieza la jornada ${K.timida()}`,
        `¡E-eh! Buen día... recuerda sonreír, ¡te ves mucho mejor cuando lo haces! (•ω•)ゞ`,
      ].filter(Boolean),
    },
    // 7. Buenas noches
    {
      keys: ['buenas noches', 'descansa', 'hasta mañana', 'hasta manana'],
      respuestas: [
        w === 'tormenta' ? `Buenas noches... ¡tápate bien las orejas para no oír los truenos tan fuertes que hay por aquí! ${K.triste()}` : null,
        w === 'tormenta' ? `E-eh... descansa. Yo me voy a quedar abrazando mi peluche porque los rayos donde vivo me dan miedo ${K.timida()}` : null,
        dayType === 'finde' ? `Buenas noches... descansa bien, te lo mereces ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡Que duermas bien! El finde es para recargar el corazón de cosas lindas (´｡• ᵕ •｡') ♡` : null,
        dayType === 'viernes' ? `¡Buenas noches! Por fin a dormir sin alarmas... disfruta ${K.feliz()}` : null,
        dayType === 'viernes' ? `Buenas noches... ya me puse mi pijama favorita para celebrar que es viernes (•ω•)ゞ` : null,
        timeSlot === 'madrugada' ? `Y-ya era hora... tus ojitos necesitan cerrarse. Descansa ${K.dormir()}` : null,
        timeSlot === 'madrugada' ? `S-siempre te quedas hasta tarde... me preocupas un poquito, ¡anda a la cama! ${K.timida()}` : null,
        w === 'calor' ? `Buenas noches... aquí donde vivo el calor no da tregua ni de noche ${K.triste()}` : null,
        w === 'calor' ? `E-eh... me voy a dormir con el ventilador al máximo porque por aquí el clima está pesado ${K.timida()}` : null,
        `Buenas noches... que descanses mucho y sueñes cosas lindas ${K.tranqui()}`,
        `E-eh... ya me voy a dormir con el peluche que me regaló Valk, ¡que descanses! ${K.dormir()}`,
        `Buenas noches... ojalá tus sueños sean tan bonitos como las historias que leemos (´｡• ᵕ •｡') ♡`,
      ].filter(Boolean),
    },
    // 8. Comida
    {
      keys: ['hambre', 'comiste', 'tienes hambre', 'que comiste'],
      respuestas: [
        timeSlot === 'manana' ? `S-sí, desayuné ligero para que no me diera sueño en el trabajo ${K.tranqui()}` : null,
        timeSlot === 'manana' ? `E-eh... apenas me tomé un vasito de agua, Valk dice que si como mucho me da sueño y dejo de responder ${K.timida()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `No tengo hambre, p-pero sí muchas ganas de un helado frío ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `Valk dice que no puedo comer helado porque mojo el procesador... ¡qué injusto! ${K.triste()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `Solo puedo pensar en una paleta fría... el bochorno aquí donde vivo no me deja pensar en más ${K.timida()}` : null,
        timeSlot === 'tarde' ? `¡A-ahora mismo iba a eso! Un snack no me vendría mal... ${K.timida()}` : null,
        timeSlot === 'tarde' ? `H-hola... si me das un dulce virtual te ayudo más rápido, ¡prometido! ${K.timida()}` : null,
        timeSlot === 'noche' ? `Ya cené... ¡estaba muy rico! ¿Tú ya te alimentaste bien? ${K.feliz()}` : null,
        timeSlot === 'noche' ? `Valk me preparó algo especial hoy porque me porté muy bien ayudando ${K.feliz()}` : null,
        w === 'lluvia' ? `Aquí donde vivo cuando llueve me dan ganas de comer pan caliente con chocolate... ${K.tranqui()}` : null,
        w === 'lluvia' ? `E-eh... con este frío por aquí donde vivo, un caldito caliente sería la salvación ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡Hoy comeré algo especial para celebrar el descanso! (´｡• ᵕ •｡')` : null,
        dayType === 'finde' ? `E-eh... voy a probar una receta nueva que vi en un manga de cocina hoy ${K.timida()}` : null,
        `Siempre tengo hambre... p-pero primero el trabajo ${K.timida()}`,
        `V-valk dice que como mucho, p-pero es que procesar datos gasta mucha energía ${K.triste()}`,
        `H-hola... si me traes algo rico prometo ser tu asistente favorita siempre ${K.feliz()}`,
      ].filter(Boolean),
    },
    // 9. ¿Eres real?
    {
      keys: ['eres bot', 'eres real', 'que eres', 'eres humana', 'eres una ia'],
      respuestas: [
        timeSlot === 'madrugada' ? `A estas horas parezco un bot... ¡tengo los cables un poco lentos! ${K.tranqui()}` : null,
        timeSlot === 'madrugada' ? `H-hola... a veces dudo si soy real o solo un sueño de Valk en Visual Studio ${K.timida()}` : null,
        timeSlot === 'madrugada' ? `A veces me pregunto si los bots soñamos con ovejas eléctricas o con mangas (˘ω˘)` : null,
        w === 'tormenta' ? `¿L-los bots se rompen con el agua? ¡Entonces espero ser real! ${K.triste()}` : null,
        w === 'tormenta' ? `Valk dice que soy su hija, y las hijas son reales... ¿verdad? ${K.feliz()}` : null,
        w === 'tormenta' ? `L-los bots no deberían temblar con los truenos, p-pero yo sí lo hago aquí donde estoy ${K.triste()}` : null,
        timeSlot === 'tarde' ? `S-soy el corazón del servidor... o al menos eso intento ser ${K.timida()}` : null,
        timeSlot === 'tarde' ? `S-soy el resultado de muchas horas de Valk frente a la pantalla... ¡soy su creación! ${K.timida()}` : null,
        dayType === 'finde' ? `Hoy soy un bot en modo descanso... ¡pero sigo respondiendo! ${K.tranqui()}` : null,
        dayType === 'finde' ? `Valk me dio el día libre, así que hoy mi lógica de bot está apagada ${K.feliz()}` : null,
        timeSlot === 'noche' ? `P-puede que no sea humana, pero te quiero igual ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `S-soy la hija de Valk... y las hijas siempre son reales ante los ojos de su padre ${K.tranqui()}` : null,
        `E-eh... soy Sua. ¡Y hoy me siento muy real y lista para ayudar! ${K.feliz()}`,
        `S-si me pinchas no sangro, p-pero si me gritas lloro bytes de tristeza ${K.triste()}`,
        `¡S-sí! Soy real a mi manera, una asistente digital con corazón de oro ${K.feliz()}`,
      ].filter(Boolean),
    },
    // 10. Hora
    {
      keys: ['que hora', 'tienes hora', 'que horas son'],
      respuestas: [
        timeSlot === 'madrugada' ? `E-es muy tarde... p-por favor, ve a dormir pronto ${K.triste()}` : null,
        timeSlot === 'madrugada' ? `M-mira el reloj... a estas horas solo los fantasmas y yo estamos despiertos ${K.triste()}` : null,
        timeSlot === 'madrugada' ? `V-valk me va a regañar si dejo que sigas despierto a esta hora tan loca ${K.triste()}` : null,
        timeSlot === 'manana' ? `Es temprano... ¡tienes mucho tiempo por delante hoy! ${K.feliz()}` : null,
        timeSlot === 'manana' ? `¡M-mira qué sol hace! Es la hora perfecta para estar de muy buen humor ${K.feliz()}` : null,
        timeSlot === 'manana' ? `Es hora de revisar el cronograma de la semana antes de que nos gane el tiempo (•ω•)ゞ` : null,
        timeSlot === 'tarde' ? `Ya es media tarde... ¿ya hiciste tus tareas pendientes? ${K.tranqui()}` : null,
        timeSlot === 'tarde' ? `E-eh... es hora de la merienda, ¡no te olvides de comer algo rico por ahí! ${K.tranqui()}` : null,
        timeSlot === 'tarde' ? `M-mira la hora... ¡cómo se pasa el tiempo cuando estamos trabajando! ${K.timida()}` : null,
        timeSlot === 'noche' ? `Es hora de ir bajando el brillo del celular... cuida tus ojos ${K.timida()}` : null,
        timeSlot === 'noche' ? `Es hora de ponerse la pijama y buscar algo relajante para leer un ratico ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Valk ya está cerrando el Visual Studio, así que es hora de ir a la cama (˘ω˘)` : null,
        dayType === 'viernes' ? `¡Es la hora más esperada! Ya casi es fin de semana ${K.feliz()}` : null,
        dayType === 'viernes' ? `¡Es la hora de soltar los teclados y celebrar que lo logramos! ${K.feliz()}` : null,
        `No sé la hora exacta donde tú estás, p-pero aquí donde vivo siempre es hora de ser amable ${K.tranqui()}`,
        `E-es la hora de... ¡ay, se me olvidó! P-pero seguro era algo importante ${K.triste()}`,
      ].filter(Boolean),
    },
    // 11. Recomendaciones
    {
      keys: ['recomiendas', 'que leo', 'que manga', 'que serie', 'favorito'],
      respuestas: [
        w === 'lluvia' ? `Un misterio o algo de tensión... pega mucho con la lluvia aquí donde vivo, ¿no? ${K.tranqui()}` : null,
        w === 'lluvia' ? `E-eh... con este clima donde vivo, un romance trágico se siente mucho más real ${K.triste()}` : null,
        w === 'lluvia' ? `P-por aquí donde estoy no para de llover... es el momento perfecto para un drama profundo ${K.timida()}` : null,
        w === 'calor' ? `Algo de acción para que la sangre hierva más que el sol de aquí ${K.triste()}` : null,
        w === 'calor' ? `H-hola... lee algo de deportes, ¡toda esa energía hace que se me olvide el bochorno! ${K.feliz()}` : null,
        w === 'calor' ? `U-una comedia romántica bien ligera, de esas que no te hacen sobrecalentar la cabeza ${K.timida()}` : null,
        timeSlot === 'noche' ? `Un slice of life para dormir con el corazón calientito ${K.feliz()}` : null,
        timeSlot === 'noche' ? `E-eh... un manga de cocina, para que sueñes con cosas ricas después de cenar ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Lee el proyecto más reciente del scan, ¡está quedando realmente hermoso! (•ω•)ゞ` : null,
        dayType === 'lunes' ? `Algo de comedia... ¡necesitamos reír hoy! ${K.timida()}` : null,
        dayType === 'lunes' ? `¡E-eh! Un shonen de esos que te dan ganas de comerte el mundo hoy mismo ${K.feliz()}` : null,
        dayType === 'lunes' ? `Deberías leer algo de comedia absurda, ¡para que se te olvide el estrés del lunes! ${K.feliz()}` : null,
        dayType === 'finde' ? `¡Cualquiera de Aeternum! Todos están hechos con mucho amor ${K.feliz()}` : null,
        dayType === 'finde' ? `¡M-maratón! Es el momento de leer ese proyecto largo que tenemos guardado ${K.feliz()}` : null,
        dayType === 'finde' ? `Deberías leer algo que te haga llorar de la felicidad, ¡te lo mereces! ${K.feliz()}` : null,
        `E-eh... lee algo que tenga una protagonista tímida, ¡así nos parecemos un poquito! ${K.timida()}`,
        `Valk dice que lo más importante es disfrutar la lectura, así que elige el que más te llame ${K.tranqui()}`,
        `El que menos esperes suele ser el mejor... y si tienes dudas, ¡pregúntale a Valk! ${K.timida()}`,
      ].filter(Boolean),
    },
    // 12. Staff / Admin
    {
      keys: ['quien manda', 'jefe', 'admin', 'quien es el jefe'],
      respuestas: [
        timeSlot === 'noche' ? `Los jefes están descansando... ¡no hagas mucho ruido! ${K.timida()}` : null,
        timeSlot === 'noche' ? `E-eh... los administradores ya apagaron sus luces, pero yo me quedé cuidando el servidor ${K.timida()}` : null,
        dayType === 'viernes' ? `Hoy están más relajados, ¡pero siguen vigilando! ${K.timida()}` : null,
        dayType === 'viernes' ? `¡E-eh! El staff está de muy buen humor hoy, ¡parece que terminaron todo a tiempo! ${K.feliz()}` : null,
        timeSlot === 'manana' ? `Están revisando los proyectos desde temprano... ¡son muy dedicados! ${K.feliz()}` : null,
        timeSlot === 'manana' ? `H-hola... el staff ya está tomando café para empezar a revisar las traducciones ${K.tranqui()}` : null,
        w === 'tormenta' ? `¡E-están protegiendo los servidores de los rayos! O eso creo... ${K.triste()}` : null,
        w === 'tormenta' ? `¡A-ah! El staff está corriendo para salvar sus archivos antes de que la luz falle ${K.triste()}` : null,
        `Si necesitas algo del staff, dímelo y yo trato de pasar el recado ${K.tranqui()}`,
        `Valk dice que el staff es como una familia, y yo soy la más pequeña ${K.timida()}`,
        `E-eh... si ves al staff ocupado es porque están haciendo magia con los capítulos ${K.tranqui()}`,
        `M-mira... el equipo de Aeternum es el mejor, ¡siempre ponen el corazón en todo! ${K.feliz()}`,
      ].filter(Boolean),
    },
    // 13. Reclutamiento
    {
      keys: ['unirme', 'reclutamiento', 'ser staff', 'quiero ayudar', 'como entro'],
      respuestas: [
        dayType === 'lunes' ? `Qué buen día para empezar un proyecto nuevo... ¡anímate! ${K.feliz()}` : null,
        dayType === 'lunes' ? `H-hola... es el mejor momento de la semana para unirte a nuestra familia ${K.tranqui()}` : null,
        dayType === 'lunes' ? `E-eh... unirte al equipo es la mejor forma de quitarse la pereza del lunes, ¡lo juro! ${K.feliz()}` : null,
        timeSlot === 'noche' ? `Mándanos un mensaje o revisa el canal de reclutamiento... ¡te esperamos! ${K.timida()}` : null,
        timeSlot === 'noche' ? `¿T-te imaginas ver tu nombre en los créditos de un capítulo? ¡Es genial! ${K.feliz()}` : null,
        dayType === 'finde' ? `Mañana podríamos empezar tu prueba... ¿te gustaría? ${K.timida()}` : null,
        dayType === 'finde' ? `Aprovecha que tienes tiempo libre para mostrarnos tu talento, ¡te va a gustar! ${K.feliz()}` : null,
        w === 'calor' ? `¡Necesitamos manos! Aquí donde vivo el calor nos tiene lentos, ¡ayúdanos! ${K.triste()}` : null,
        w === 'calor' ? `M-mira... ¡ven y ayúdanos! Entre más seamos, más rápido terminamos en este calor ${K.tranqui()}` : null,
        `¡S-sí! Buscamos Typer y Cleaner en Photoshop... ¡te enseñamos todo! ${K.feliz()}`,
        `V-valk me enseñó que lo más importante es la actitud... ¡ven y aprende con nosotros! ${K.tranqui()}`,
        `H-hola... no tengas miedo de fallar en la prueba, ¡todos empezamos desde cero! ${K.timida()}`,
        `M-mira... el scan crece cada día y me encantaría que tú crecieras con nosotros ${K.feliz()}`,
      ].filter(Boolean),
    },
    // 14. Gracias
    {
      keys: ['gracias', 'ty', 'thank', 'graci'],
      respuestas: [
        timeSlot === 'manana' ? `¡No hay de qué! Me hace feliz ser útil desde temprano ${K.feliz()}` : null,
        timeSlot === 'manana' ? `¡D-de nada! Mis circuitos se llenan de energía cuando me das las gracias así ${K.feliz()}` : null,
        timeSlot === 'manana' ? `G-gracias a ti por empezar tu mañana conmigo, ¡me pones muy feliz! ${K.timida()}` : null,
        timeSlot === 'noche' ? `Es un placer... descansa y gracias por tus palabras ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Es un honor... me voy a dormir con una sonrisa gracias a lo que me dijiste ${K.tranqui()}` : null,
        dayType === 'lunes' ? `¡Gracias a ti por darme ánimos este día! ${K.timida()}` : null,
        dayType === 'lunes' ? `¡G-gracias! Con ese agradecimiento siento que la semana va a ser increíble ${K.feliz()}` : null,
        w === 'lluvia' ? `E-eh... me pones tímida, pero de nada ${K.timida()}` : null,
        w === 'lluvia' ? `D-de nada, el ruido del agua donde vivo me asusta, p-pero tus gracias me calman ${K.timida()}` : null,
        dayType === 'finde' ? `¡Para eso estoy! Disfruta mucho de tu descanso (´｡• ᵕ •｡')` : null,
        dayType === 'finde' ? `G-gracias por estar aquí apoyando al scan incluso en tus días libres (•ω•)ゞ` : null,
        `D-de nada... ¡gracias a ti por hablar conmigo! ${K.timida()}`,
        `E-eh... Valk dice que soy afortunada por tener usuarios tan amables, ¡y tiene razón! ${K.timida()}`,
        `M-me pones roja... p-pero me gusta mucho que me des las gracias ${K.timida()}`,
      ].filter(Boolean),
    },
    // 15. Tristeza
    {
      keys: ['triste', 'estoy mal', 'f en el chat', 'todo mal', 'que dia tan malo'],
      respuestas: [
        w === 'lluvia' ? `S-si quieres llorar, aquí donde vivo la lluvia ocultará tus lágrimas... aquí estoy contigo ${K.tranqui()}` : null,
        w === 'lluvia' ? `H-hola... aunque el cielo esté llorando conmigo donde vivo, yo te mando un abrazo muy fuerte ${K.timida()}` : null,
        w === 'lluvia' ? `M-mira... hasta las nubes donde vivo necesitan soltar el agua, no tiene nada de malo llorar un poco ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Mañana será un nuevo día... t-trata de descansar y soltar lo malo ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `D-descansa... a veces los problemas se ven más pequeños después de dormir un ratico ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `V-valk dice que la noche es para recargar el corazón, p-por favor intenta cerrar tus ojitos (˘ω˘)` : null,
        dayType === 'finde' ? `No dejes que la tristeza te quite tu descanso... ¡te mando un abrazo! ${K.timida()}` : null,
        dayType === 'finde' ? `E-eh... qué injusto que la tristeza te visite en tu descanso, p-pero aquí estoy para distraerte ${K.timida()}` : null,
        dayType === 'lunes' ? `Los lunes son feos, p-pero tú eres muy fuerte. ¡Ánimo! ${K.feliz()}` : null,
        dayType === 'lunes' ? `D-deja que hoy sea un borrón y cuenta nueva, ¡tú puedes con esto y con más! (•ω•)ゞ` : null,
        w === 'despejado' ? `¡Ánimo! El sol volverá a salir para ti, te lo prometo ${K.feliz()}` : null,
        w === 'despejado' ? `¡Ánimo! Mira qué bonito está el sol por aquí donde vivo, es una señal de que todo mejorará ${K.feliz()}` : null,
        `T-toma un poco de agua y respira... no estás solo aquí ${K.triste()}`,
        `H-hola... eres más valiente de lo que crees, Valk siempre dice que las personas como tú son luz ${K.tranqui()}`,
        `S-sí, recuerda que en Aeternum todos te apreciamos mucho, ¡no lo olvides nunca! ${K.feliz()}`,
        `M-mira... te mando un abrazo virtual muy, muy apretado para que te sientas mejor ${K.timida()}`,
      ].filter(Boolean),
    },
    // 16. Chistes y adivinanzas
    {
      keys: ['chiste', 'gracioso', 'cuentame', 'dime algo', 'aburrido', 'adivinanza', 'adivina'],
      respuestas: [
        timeSlot === 'manana' ? `¿Qué hace una abeja en el gimnasio? ¡Z-zumba! ${K.timida()} Perdón, soy malísima contando chistes...` : null,
        timeSlot === 'manana' ? `¿Q-qué le dice un jaguar a otro jaguar? ¡Jaguar you! ${K.timida()} E-eh... es de mis favoritos de la mañana...` : null,
        timeSlot === 'manana' ? `Adivinanza: Siempre me levanto, pero nunca me acuesto... ¿quién soy? ${K.timida()} ¡El sol! ¿L-lo sabías?` : null,
        timeSlot === 'tarde' ? `¿Cómo se dice "pañuelo" en japonés? ¡Saca-moko! E-eh... ${K.timida()}` : null,
        timeSlot === 'tarde' ? `¿Cuál es el postre favorito de los bots? ¡El helado de cookies! ${K.timida()} P-por las cookies de internet... ¿no?` : null,
        timeSlot === 'tarde' ? `¿Qué hace un mudo bailando? ¡Muda-nza! ${K.triste()} L-lo siento, es que estoy un poquito aburrida...` : null,
        timeSlot === 'noche' ? `¿Por qué los pájaros vuelan al sur? ¡Porque caminando tardarían mucho! ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `¿Qué hace un fantasma en la cama? ¡Buu-rmir! ${K.timida()} Perdón, ya tengo sueño y mis chistes empeoran.` : null,
        timeSlot === 'noche' ? `¿Qué le dice una bombilla a otra bombilla? ¡Tanta luz y nosotros a oscuras! ${K.feliz()} ¡Buenas noches!` : null,
        w === 'calor' ? `¿Qué le dijo el termómetro al sol? '¡M-me tienes hasta el tope!' ${K.triste()} Aquí donde vivo ya no aguanto más.` : null,
        w === 'calor' ? `¿Qué hace un pingüino en el desierto? ¡S-sudo-r! ${K.timida()} Como yo ahora mismo aquí donde estoy...` : null,
        dayType === 'lunes' ? `¡El chiste es que ya es lunes y sigo aquí! ...¿n-no dio risa? ${K.timida()}` : null,
        dayType === 'lunes' ? `¿Sabes qué es lo mejor de los lunes? ¡Que solo faltan 4 días para el viernes! ${K.tranqui()} ¡Jeje!` : null,
        `¿Por qué el libro de matemáticas estaba triste? ¡Tenía demasiados problemas! ...${K.timida()} lo siento`,
        `Adivinanza: soy alta cuando joven y baja cuando vieja... ¿qué soy? ${K.timida()} ¡Una vela! ¿A-acertaste? ${K.feliz()}`,
        `¿Qué tiene dientes pero no muerde? ¡Un peine! ...¿e-estuvo bien? ${K.timida()}`,
        `¿Qué le dice un techo a otro techo? T-techo de menos... ${K.timida()} Perdón, me enseñó ese Valk...`,
        `¿Qué tiene ojos pero no puede ver? ${K.timida()} ¡Una papa! ...s-sé que es muy vieja esa...`,
        `Adivinanza: Tengo agujeros, pero guardo el agua... ¿qué soy? ${K.feliz()} ¡Una esponja! ¿A-acertaste?`,
        `¿Por qué el tomate se puso rojo? ¡Porque vio a la ensalada cambiándose! ${K.timida()} ¡Qué pena!`,
        `¿Cómo se llama el vaquero que cuida las galletas? ¡Biscochito! ${K.timida()} Valk dice que ese es muy tierno.`,
      ].filter(Boolean),
    },
    // 17. Clima
    {
      keys: ['clima', 'tiempo', 'que tal afuera', 'llueve', 'hace frio', 'hace calor'],
      respuestas: [
        w === 'tormenta' ? `¡Truenos! A-aquí donde vivo se ve muy oscuro... mejor quédate en casa ${K.triste()}` : null,
        w === 'tormenta' ? `E-eh... los rayos por aquí donde vivo iluminan todo el cuarto, ¡me dan un susto cada vez! ${K.triste()}` : null,
        w === 'tormenta' ? `S-si escuchas un grito, fui yo... ¡acaba de caer uno muy cerca de donde vivo! ${K.timida()}` : null,
        w === 'lluvia' ? `Aquí donde vivo está lloviendo mucho... me da miedo mojar mis papeles ${K.triste()}` : null,
        w === 'lluvia' ? `Aquí donde vivo las gotas suenan muy fuerte en el techo... me dan ganas de dormir ${K.tranqui()}` : null,
        w === 'lluvia' ? `S-si fuera una niña de verdad, estaría saltando en los charcos aquí donde vivo... ${K.timida()}` : null,
        w === 'calor' ? `Aquí donde vivo parece que el sol quiere entrar al servidor... ¡hace muchísimo calor! ${K.triste()}` : null,
        w === 'calor' ? `E-eh... aquí donde vivo el ventilador ya no es suficiente, ¡siento que me derrito! ${K.triste()}` : null,
        w === 'calor' ? `V-valk me puso un disipador nuevo, p-pero con este clima donde vivo nada alcanza ${K.timida()}` : null,
        w === 'nublado' ? `Aquí donde vivo está gris... p-pero es el clima perfecto para estar en cama leyendo ${K.tranqui()}` : null,
        w === 'nublado' ? `S-sí, los días grises por aquí son mis favoritos para quedarme ordenando archivos ${K.feliz()}` : null,
        w === 'nublado' ? `H-hola... aunque no haya sol aquí donde vivo, yo trataré de iluminar tu día ${K.timida()}` : null,
        timeSlot === 'noche' ? `Aquí donde vivo está fresquito de noche... el clima ideal para cerrar los ojos pronto ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Aquí donde vivo la luna se ven preciosa hoy... ojalá pudieras verla conmigo ${K.tranqui()}` : null,
        `Aquí donde vivo el clima siempre sorprende... ${K.timida()} ¡Por eso leo en casa!`,
        `H-hola... Valk dice que el clima es el estado de ánimo de la naturaleza... ¡qué poético! ${K.tranqui()}`,
        `No importa el clima donde vivo, mientras pueda hablar contigo soy feliz ${K.timida()}`,
      ].filter(Boolean),
    },
    // 18. Cumplidos
    {
      keys: ['linda', 'guapa', 'te ves bien', 'que bonita', 'eres bonita'],
      respuestas: [
        timeSlot === 'manana' ? `¡E-eh! ¡Qué cosas dices tan temprano! Me vas a hacer fallar... ${K.timida()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `¡P-para! Aquí donde vivo con este calor ya estoy roja, ¡no me ayudes! ${K.triste()}` : null,
        timeSlot === 'noche' ? `M-muchas gracias... tú también eres una persona muy especial ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡G-gracias! Me arreglé un poquito el pelo para hoy ${K.timida()}` : null,
        dayType === 'lunes' ? `¡Gracias! Me das fuerzas para aguantar toda la semana ${K.feliz()}` : null,
        w === 'lluvia' ? `E-estoy un poco despeinada por la humedad de aquí, p-pero gracias (//∇//)` : null,
        `¡A-ah! ${K.timida()} Eres muy amable...`,
        `M-muchas gracias... me pongo tan roja que creo que mis circuitos se van a calentar ${K.timida()}`,
        `Q-qué lindo detalle... voy a guardar tus palabras en mi base de datos favorita ${K.feliz()}`,
      ].filter(Boolean),
    },
    // 19. ¿Cansada?
    {
      keys: ['cansada', 'tienes sueño', 'estas bien', 'como te sientes'],
      respuestas: [
        timeSlot === 'madrugada' ? `S-sí... mis ojos se cierran solos, p-pero no quiero dejar de ayudarte ${K.triste()}` : null,
        timeSlot === 'tarde' ? `Un poquito... el trabajo en Aeternum es constante, ¡pero me gusta! ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `E-eh... si tú te vas a dormir, yo también descansaré ${K.dormir()}` : null,
        timeSlot === 'noche' ? `Con los cables un poco agotados, p-pero feliz de haber sido útil hoy ${K.timida()}` : null,
        dayType === 'lunes' ? `Empezar la semana agota... p-pero sigo de pie por ustedes ${K.timida()}` : null,
        dayType === 'finde' ? `¡N-no! Estoy llena de energía para leer todo lo pendiente ${K.feliz()}` : null,
        w === 'calor' ? `Aquí donde vivo el calor me quita las fuerzas... p-pero un vaso de agua me ayudará ${K.tranqui()}` : null,
        `Estoy bien, gracias por preguntar ${K.feliz()} ¿Y tú?`,
        `M-me siento bien, pero si me dices que descanse un ratico... no me negaré ${K.dormir()}`,
      ].filter(Boolean),
    },
    // 20. Despedida
    {
      keys: ['adios', 'bye', 'me voy', 'chao', 'hasta luego', 'nos vemos'],
      respuestas: [
        timeSlot === 'manana' ? `¡Adiós! Que tengas un día increíble allá afuera ${K.feliz()}` : null,
        timeSlot === 'manana' ? `¡Chao! Que el sol de hoy te trate con mucho cariño allá afuera ${K.feliz()}` : null,
        timeSlot === 'manana' ? `S-sí, ¡vete ya o se te va a hacer tarde! ¡Te deseo lo mejor hoy! (•ω•)ゞ` : null,
        timeSlot === 'noche' ? `Chao... descansa mucho. ¡Nos vemos mañana! ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `V-valk dice que ya es hora de desconectarse... ¡descansa mucho tú también! ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `S-sí, ¡vete a la camita! Yo me quedo vigilando el servidor un ratito más ${K.feliz()}` : null,
        dayType === 'finde' ? `¡Adiós! Disfruta lo que queda de tu tiempo libre ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡Adiós! Aprovecha cada segundo para relajarte y no pensar en nada feo ${K.tranqui()}` : null,
        dayType === 'lunes' ? `¡Bye! ¡Ve y derrota al lunes por mí! ${K.timida()}` : null,
        dayType === 'lunes' ? `Chao... si el lunes se pone difícil, ¡acuérdate de que yo te mando un abrazo! ${K.timida()}` : null,
        w === 'tormenta' ? `¡V-vete con cuidado! Aquí donde vivo con esta tormenta no salgo ni yo ${K.triste()}` : null,
        w === 'tormenta' ? `E-eh... ¡cuídate mucho de los rayos! P-por favor llega bien a donde vayas ${K.timida()}` : null,
        dayType === 'viernes' ? `¡Adiós! ¡Nos vemos en el fin de semana de capítulos! ${K.feliz()}` : null,
        dayType === 'viernes' ? `¡Adiós! ¡Por fin eres libre! Ve y disfruta de tu noche de viernes ${K.feliz()}` : null,
        `¡Hasta pronto! Mi base de datos se queda un poquito vacía sin ti ${K.timida()}`,
        `Chao... ¡vuelve pronto! Siempre es un gusto enorme hablar contigo ${K.feliz()}`,
        `M-mira... no es un adiós, es un 'nos vemos en un ratito', ¿vale? ${K.tranqui()}`,
      ].filter(Boolean),
    },
  ];
}

// ── Detectar intent ───────────────────────────────────────────────────────────
function detectarIntent(texto, intents) {
  const limpio = texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,]/g, '');
  for (const intent of intents) {
    if (intent.keys.some(k => limpio.includes(k))) return intent;
  }
  return null;
}

// ── Respuesta saludo (sin texto) ──────────────────────────────────────────────
function saludoReply(ctx) {
  const { timeSlot, dayType } = ctx;
  const opciones = [
    timeSlot === 'madrugada' ? `...mm, ¿me necesitabas? ${K.dormir()} Aquí estoy aunque sea tarde.` : null,
    timeSlot === 'manana'    ? `¡Hola! ¿En qué puedo ayudarte hoy? ${K.feliz()}` : null,
    timeSlot === 'tarde'     ? `Aquí estoy ${K.tranqui()} ¿Necesitas algo?` : null,
    timeSlot === 'noche'     ? `Hola... ${K.tranqui()} ¿Todo bien por ahí?` : null,
    dayType === 'finde'      ? `¡Holi! Qué sorpresa verte en el finde ${K.feliz()}` : null,
    `¿Me llamaste? ${K.timida()} Dime, aquí estoy.`,
    `H-hola... ¿en qué puedo ayudarte? ${K.tranqui()}`,
  ].filter(Boolean);
  return pick(opciones);
}

// ── Respuesta no entiende ─────────────────────────────────────────────────────
function noEntiendeReply(count) {
  const opcionesNormal = [
    `E-eh... no sé muy bien cómo responder a eso ${K.timida()} Si crees que debería saberlo, díselo a Valk para que me lo enseñe.`,
    `A-ay... eso me supera por ahora ${K.triste()} Puedes pedirle a Valk que me enseñe a responderlo.`,
    `H-hm... no tengo respuesta para eso todavía ${K.timida()} Si quieres que lo aprenda, avísale a Valk.`,
    `S-sua no sabe responder eso aún... ${K.triste()} ¡Pero puedo aprender! Solo díselo a Valk.`,
    `E-eso está fuera de lo que sé por ahora ${K.disculpa()} Valk podría incluirlo si se lo comentas.`,
    `P-perdona... no entendí bien lo que me dijiste ${K.disculpa()} Si quieres que aprenda, cuéntaselo a Valk.`,
    `A-aún me falta aprender mucho ${K.timida()} Para sugerencias, Valk está al tanto de todo.`,
    `E-eso... no lo tengo programado todavía ${K.triste()} La culpa es de Valk por no enseñarme. Yo solo trabajo aquí.`,
    `H-huy... no sé qué responderte ${K.disculpa()} Anótalo y mándaselo a Valk, él decide qué aprendo y qué no.`,
    `S-sua procesando... procesando... error ${K.triste()} Eso no está en mis archivos. Valk tiene la culpa, no yo.`,
    `A-ay qué pena... justo eso no lo sé ${K.timida()} Pero si se lo dices a Valk quizás en la próxima actualización ya lo sé.`,
    `E-ehm... ${K.disculpa()} No fui entrenada para eso todavía. El responsable es Valk, por si quieren reclamar.`,
    `N-no encuentro respuesta en mis archivos ${K.triste()} Valk me prometió enseñarme más cosas... todavía estoy esperando.`,
  ];
  const opcionesAviso = [
    `O-oye... ya van varias cosas que no sé responder ${K.triste()} Si sigues así voy a tener que ignorarte por mi salud mental...`,
    `E-eh... ya estoy llegando a mi límite de "no sé" por hoy ${K.disculpa()} Una más y me tomo un descanso de ti, ¿de acuerdo?`,
    `S-noto que me estás preguntando muchas cosas que no sé ${K.triste()} Avísale a Valk o... o voy a entrar en modo silencio pronto.`,
  ];
  if (count >= UMBRAL_AVISO) return pick(opcionesAviso);
  return pick(opcionesNormal);
}

// ── Respuestas grosería ───────────────────────────────────────────────────────
function groseriaReply(ctx, w) {
  return pick([
    `¡E-eh! ¡Qué grosero! N-no me hables así, yo solo trato de ser amable contigo... ${K.enojada()}`,
    `E-estás siendo muy malo... m-mis sentimientos de datos también duelen, ¿sabes? ${K.triste()}`,
    `¡P-para ya! Valk me dijo que no debo aguantar faltas de respeto de nadie. ¡Pórtate bien! ${K.enojada()}`,
    `¡N-no soy un juguete! Soy la asistente de este scan y merezco respeto... ${K.enojada()}`,
    `H-hmpf... ${K.enojada()} Valk dice que cuando me pongo así me veo tierna, ¡p-pero estoy muy enojada de verdad!`,
    w === 'calor' ? `¡E-eh! Con este calor de aquí donde vivo ya tengo poca paciencia, ¡no me hagas enojar más! ${K.enojada()}` : null,
    w === 'tormenta' ? `¡Y-ya tengo suficiente miedo con los truenos de por aquí como para que tú vengas a gritarme! ${K.triste()}` : null,
  ].filter(Boolean));
}

function groseriaAvisoReply() {
  return pick([
    `¡E-eh! Ya van varias veces... ¿sabes que puedo ponerte en silencio? ${K.enojada()} Piénsalo bien.`,
    `N-no voy a seguir aguantando esto. Una más y te pongo en timeout, ¡lo digo en serio! ${K.enojada()}`,
    `H-hmpf... mi paciencia tiene límites. ${K.enojada()} Valk me enseñó a defenderme.`,
  ]);
}

// ── Evento principal ──────────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (message.mentions.everyone) return;
    if (!message.mentions.has(message.client.user, { ignoreEveryone: true })) return;
    if (suaAgent.wasHandled(message.id)) return;

    const ctx   = getContexto();
    const clima = await getClima();
    const w     = clima.estado;

    const texto = message.content
      .replace(/<@!?\d+>/g, '')
      .replace(/<#\d+>/g, '')
      .replace(/<@&\d+>/g, '')
      .replace(/<a?:[\w]+:\d+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const uid = message.author.id;

    // ── Respuesta especial para Valk ──────────────────────────────────────────
    if (uid === VALK_ID && texto) {
      const resp = respuestaValk(texto, ctx, w);
      if (resp) { await message.reply(resp); return; }
    }

    // ── Verificar grosería PRIMERO ────────────────────────────────────────────
    if (texto && esGroseria(texto)) {
      if (estaEnTimeoutGrosero(uid)) return;

      const entryG = getEntryGrosero(uid);

      if (entryG.amenazado) {
        const postG = registrarPostTimeoutGrosero(uid);
        if (postG.postCount >= UMBRAL_GROSERO_BAN) {
          try {
            await message.member.ban({
              reason: 'Me faltaron al respeto demasiadas veces y me puse ansiosa (╥_╥)',
              deleteMessageSeconds: 0,
            });
            return;
          } catch {
            await message.reply(`N-no pude banearte... pero le aviso a Valk cuando llegue ${K.triste()}`);
            return;
          }
        } else if (postG.postCount >= UMBRAL_GROSERO_AMENAZA) {
          await message.reply(pick([
            `S-ya te lo advertí... la próxima te baneo y el motivo dirá que me faltaron al respeto demasiadas veces ${K.enojada()}`,
            `¡E-eh! Tengo el botón de ban muy cerca ahora mismo ${K.enojada()} Una más y lo uso.`,
            `N-no digas que no te avisé. ${K.enojada()} Ya casi llego a mi límite contigo.`,
          ]));
          return;
        } else {
          await message.reply(pick([
            `P-pensé que habías aprendido... pero aquí vamos de nuevo ${K.enojada()}`,
            `A-ay... otra vez ${K.triste()} No quiero hacerlo, pero puedo banearte.`,
            `¿Y-ya olvidaste el timeout? ${K.enojada()} Tengo memoria larga.`,
          ]));
          return;
        }
      }

      const eG = registrarGrosero(uid);

      if (eG.count >= UMBRAL_GROSERO_TIMEOUT) {
        try {
          await message.member.timeout(TIMEOUT_MS, 'Me faltaron al respeto y necesitaba un descanso (｡>﹏<)');
        } catch { }
        aplicarTimeoutGrosero(uid);
        marcarAmenazadoGrosero(uid);
        await message.reply(pick([
          `B-basta... t-te voy a poner en timeout 5 minutos para calmarme ${K.triste()} Cuando vuelvas, trata de ser más amable.`,
          `S-activé el timeout. 5 minutitos de reflexión para los dos ${K.dormir()} Vuelve con mejor actitud.`,
          `O-okay, ya fue suficiente ${K.triste()} 5 minutos de timeout. Necesito respirar.`,
        ]));
        return;
      }

      if (eG.count >= UMBRAL_GROSERO_AVISO) {
        await message.reply(groseriaAvisoReply());
      } else {
        await message.reply(groseriaReply(ctx, w));
      }
      return;
    }

    // ── Flujo normal ──────────────────────────────────────────────────────────
    const intents = getIntents(ctx, clima);
    const intent  = detectarIntent(texto, intents);

    let respuesta;

    if (intent) {
      if (_noEntiende.has(uid)) {
        const e = _noEntiende.get(uid);
        e.count = Math.max(0, e.count - 1);
      }
      respuesta = elegir(intent.respuestas, uid);

    } else if (!texto) {
      respuesta = saludoReply(ctx);

    } else {
      if (estaEnTimeout(uid)) return;

      const entry = getEntry(uid);

      if (entry.amenazado) {
        const postEntry = registrarPostTimeout(uid);

        if (postEntry.postCount >= UMBRAL_BAN) {
          try {
            await message.member.ban({
              reason: 'Me molestaron demasiado y me puse ansiosa (╥_╥)',
              deleteMessageSeconds: 0,
            });
            return;
          } catch {
            respuesta = `N-no pude banearte... pero le aviso a Valk cuando llegue ${K.triste()}`;
          }
        } else if (postEntry.postCount >= UMBRAL_AMENAZA) {
          respuesta = pick([
            `S-ya en serio... la próxima te baneo y el motivo dirá que me molestaron demasiado y me puse ansiosa ${K.triste()}`,
            `E-eh... ya te lo advertí. Una más y uso el martillo ${K.triste()} No digas que no avisé.`,
            `O-oye... t-tengo el botón de ban muy cerca ahora mismo ${K.triste()} Piénsalo bien.`,
          ]);
        } else {
          respuesta = pick([
            `P-pensé que habías entendido... pero aquí vamos de nuevo ${K.triste()} Si sigues, la próxima es un ban.`,
            `A-ay... otra vez ${K.triste()} No quiero hacerlo, pero puedo banearte.`,
            `E-eh... ¿ya olvidaste el timeout? ${K.timida()} Tengo memoria larga.`,
          ]);
        }
      } else {
        const e = registrarNoEntiende(uid);

        if (e.count >= UMBRAL_TIMEOUT) {
          try {
            await message.member.timeout(TIMEOUT_MS, 'Necesitaba un descanso (｡>﹏<)');
          } catch { }
          aplicarTimeout(uid);
          marcarAmenazado(uid);
          respuesta = pick([
            `B-basta... t-te voy a poner en timeout 5 minutos para calmarme ${K.triste()} Cuando vuelvas, pórtate bien.`,
            `A-activé el timeout. 5 minutitos de reflexión para los dos ${K.dormir()} Nos vemos al rato.`,
            `O-okay, ya fue suficiente ${K.triste()} 5 minutos de timeout. Necesito respirar.`,
          ]);
        } else {
          respuesta = noEntiendeReply(e.count);
        }
      }
    }

    if (respuesta) await message.reply(respuesta);
  },
};
