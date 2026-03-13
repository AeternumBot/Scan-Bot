// src/events/suaMention.js
// Sua responde cuando la mencionan — sistema de intents con contexto

const { Events } = require('discord.js');
const axios = require('axios');

// ── Contexto temporal ─────────────────────────────────────────────────────────
function getContexto() {
  const bogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const hour = bogota.getHours();
  const day  = bogota.getDay(); // 0=dom, 1=lun, ..., 5=vie, 6=sab

  let timeSlot;
  if (hour >= 0  && hour < 6)  timeSlot = 'madrugada';
  else if (hour >= 6  && hour < 12) timeSlot = 'manana';
  else if (hour >= 12 && hour < 18) timeSlot = 'tarde';
  else                               timeSlot = 'noche';

  let dayType;
  if (day === 0 || day === 6)  dayType = 'finde';
  else if (day === 1)          dayType = 'lunes';
  else if (day === 5)          dayType = 'viernes';
  else                         dayType = 'semana';

  return { hour, timeSlot, dayType };
}

// ── Clima (cache 30 min) ──────────────────────────────────────────────────────
let _climaCache = null;
let _climaTime  = 0;

async function getClima() {
  if (_climaCache && Date.now() - _climaTime < 30 * 60 * 1000) return _climaCache;
  try {
    const res = await axios.get('https://wttr.in/Bogota?format=%t+%C', {
      timeout: 4000, headers: { 'User-Agent': 'curl/7.0' },
    });
    const raw  = res.data.trim();
    const temp = parseInt(raw);
    let estado = 'despejado';
    const desc = raw.toLowerCase();
    if (desc.includes('thunder') || desc.includes('storm'))           estado = 'tormenta';
    else if (desc.includes('rain') || desc.includes('drizzle'))       estado = 'lluvia';
    else if (desc.includes('cloud') || desc.includes('overcast'))     estado = 'nublado';
    else if (!isNaN(temp) && temp >= 24)                              estado = 'calor';
    _climaCache = { temp: isNaN(temp) ? null : temp, estado, raw };
    _climaTime  = Date.now();
    return _climaCache;
  } catch {
    return { temp: null, estado: 'despejado', raw: '' };
  }
}

// ── Helper: pick aleatorio ────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Helper: kaomoji por emoción ───────────────────────────────────────────────
const K = {
  feliz:    () => pick(['(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ', '(✿◠‿◠)', '(*´▽`*)', '(´｡• ᵕ •｡`)']),
  timida:   () => pick(['(/ω＼)', '(〃>_<;〃)', '(〃ω〃)', '(*ノωノ)', '(//∇//)']),
  triste:   () => pick(['(｡>﹏<)', '(;ω;)', '(´；ω；`)', '(╥_╥)']),
  tranqui:  () => pick(['(っ˘ω˘ς)', '(˘ω˘)', '( ´ ▽ ` )', '(￣▽￣)']),
  dormir:   () => pick(['(/ω＼)', '(－_－) zzZ', '( ˘ω˘ )zzz', '(-_-)zzz']),
  disculpa: () => pick(['(´• ω •`)ゞ', '(；￣ω￣)', '(´＿｀。)']),
};

// ── Última respuesta por usuario (anti-repetición) ────────────────────────────
const _lastReply = new Map();

function elegir(opciones, userId) {
  const last = _lastReply.get(userId);
  const filtradas = opciones.filter(o => o !== last);
  const elegida = pick(filtradas.length ? filtradas : opciones);
  _lastReply.set(userId, elegida);
  return elegida;
}

// ── Matriz de intents ─────────────────────────────────────────────────────────
function getIntents(ctx, clima) {
  const { timeSlot, dayType } = ctx;
  const w = clima.estado;

  return [
    {
      keys: ['hola', 'holi', 'buenas', 'hey', 'ey'],
      respuestas: [
        timeSlot === 'madrugada' ? `H-hola... ¿tampoco puedes dormir? Espero no haberte asustado ${K.dormir()}` : null,
        timeSlot === 'manana' && w === 'despejado' ? `¡H-hola! Buen día... qué bueno que el sol nos acompaña ${K.feliz()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `Holi... ¡uff! ¿No sientes que el teclado quema? P-pasa, ponte cómodo ${K.triste()}` : null,
        w === 'lluvia' ? `Hola... l-llegaste justo a tiempo para no mojarte. ¡Bienvenido! ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡Holi! Qué alegría verte por aquí en tus días libres... ${K.feliz()}` : null,
        dayType === 'lunes' && timeSlot === 'noche' ? `Hola... e-espero que tu inicio de semana no haya sido muy pesado ${K.timida()}` : null,
        `Hola ${K.feliz()} ¿Cómo estás? ¿En qué puedo ayudarte?`,
      ].filter(Boolean),
    },
    {
      keys: ['como estas', 'que tal', 'como te va', 'como andas'],
      respuestas: [
        timeSlot === 'manana' && w === 'despejado' ? `Estoy con energía... ¡listas las carpetas para el equipo! ${K.feliz()}` : null,
        timeSlot === 'tarde' && w === 'nublado' ? `Un poco pensativa... el cielo gris me da sueño, p-pero sigo trabajando ${K.tranqui()}` : null,
        dayType === 'viernes' ? `¡M-muy bien! Ya casi termina la semana y podré leer más mangas ${K.timida()}` : null,
        w === 'tormenta' ? `N-nerviosa... los rayos me dan miedo, pero aquí estoy para ti ${K.triste()}` : null,
        dayType === 'lunes' ? `E-eh... sobreviviendo al lunes. ¿Y tú qué tal estás? ${K.timida()}` : null,
        timeSlot === 'noche' ? `Cansada pero feliz de que el scan siga creciendo... gracias por preguntar ${K.tranqui()}` : null,
        `Estoy bien, gracias por preguntar ${K.feliz()} ¿Y tú cómo estás?`,
      ].filter(Boolean),
    },
    {
      keys: ['que haces', 'que cuentas', 'en que andas', 'ocupada'],
      respuestas: [
        timeSlot === 'madrugada' ? `S-shh... estoy leyendo algo en secreto para ver si lo traducimos ${K.timida()}` : null,
        timeSlot === 'manana' && dayType === 'lunes' ? `Ordenando el cronograma de la semana para que no se nos pase nada... ${K.tranqui()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `Tratando de que los ventiladores del PC no exploten... ¡ay! ${K.triste()}` : null,
        timeSlot === 'noche' ? `Mirando los últimos detalles de las páginas de hoy... quedaron lindas ${K.feliz()}` : null,
        w === 'lluvia' ? `Escuchando la lluvia y preparando los anuncios de los capítulos... ${K.tranqui()}` : null,
        dayType === 'finde' ? `Descansando un poquito, pero siempre con un ojo en el servidor... ${K.timida()}` : null,
        `Revisando que todo esté en orden por aquí ${K.tranqui()} ¿Necesitas algo?`,
      ].filter(Boolean),
    },
    {
      keys: ['proximo cap', 'cuando sale', 'cuando suben', 'nuevo capitulo', 'cuando actualizan'],
      respuestas: [
        timeSlot === 'manana' && dayType === 'lunes' ? `¡Empezando motores! Los editores están despertando apenas... ${K.timida()}` : null,
        timeSlot === 'tarde' ? `Están en proceso de limpieza... ¡ya casi quedan blancas las páginas! ${K.tranqui()}` : null,
        dayType === 'finde' ? `A veces los traductores descansan... p-pero seguro pronto hay noticias ${K.timida()}` : null,
        w === 'tormenta' ? `La lluvia atrasa un poco el internet, ¡pero no nos rendimos! ${K.triste()}` : null,
        timeSlot === 'noche' ? `¡Casi listo! El typer le está poniendo mucho cariño ahora mismo ${K.feliz()}` : null,
        `Puedes usar \`/status\` para ver el progreso en tiempo real ${K.feliz()} ¡Estamos trabajando con cariño!`,
      ].filter(Boolean),
    },
    {
      keys: ['te quiero', 'te amo', 'sua te amo', 'me gustas'],
      respuestas: [
        timeSlot === 'noche' && w === 'despejado' ? `Eres muy dulce... gracias por ser tan bueno conmigo ${K.timida()}` : null,
        w === 'lluvia' ? `En días grises, personas como tú son las que me dan ánimos... ${K.tranqui()}` : null,
        dayType === 'lunes' ? `¡G-gracias! Justo lo que necesitaba para empezar bien la semana ${K.feliz()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `¡A-ah! ¿Es el calor o mis mejillas están ardiendo por lo que dijiste? ${K.triste()}` : null,
        dayType === 'finde' ? `¡Te quiero mucho! Gracias por apoyar a Aeternum Translations ${K.feliz()} ♡` : null,
        `¡E-eh! Me pones roja... yo también aprecio mucho que estés aquí ${K.timida()}`,
      ].filter(Boolean),
    },
    {
      keys: ['buenos dias', 'buen dia'],
      respuestas: [
        timeSlot === 'madrugada' ? `¿Y-ya despierto? ¡Qué madrugador eres! Buenos días ${K.tranqui()}` : null,
        w === 'lluvia' ? `B-buenos días... no olvides tu paraguas si vas a salir, ¿sí? ${K.tranqui()}` : null,
        dayType === 'lunes' ? `Buenos días... arriba ese ánimo, ¡el equipo cuenta contigo! ${K.timida()}` : null,
        w === 'calor' ? `B-buenos días... ya hace calor tan temprano. ¡Toma mucha agua! ${K.triste()}` : null,
        w === 'nublado' ? `Buenos días... aunque esté gris, nosotros le daremos color al día ${K.timida()}` : null,
        `¡Buenos días! Que sea un día muy lindo ${K.feliz()}`,
      ].filter(Boolean),
    },
    {
      keys: ['buenas noches', 'descansa', 'hasta mañana', 'hasta manana'],
      respuestas: [
        w === 'tormenta' ? `Buenas noches... ¡tápate bien las orejas para no oír los truenos! ${K.triste()}` : null,
        dayType === 'finde' ? `Buenas noches... descansa bien, te lo mereces ${K.tranqui()}` : null,
        dayType === 'viernes' ? `¡Buenas noches! Por fin a dormir sin alarmas... disfruta ${K.feliz()}` : null,
        timeSlot === 'madrugada' ? `Y-ya era hora... tus ojitos necesitan cerrarse. Descansa ${K.dormir()}` : null,
        w === 'calor' ? `Buenas noches... ojalá puedas dormir fresquito hoy ${K.tranqui()}` : null,
        `Buenas noches... que descanses mucho y sueñes cosas lindas ${K.tranqui()}`,
      ].filter(Boolean),
    },
    {
      keys: ['hambre', 'comiste', 'tienes hambre', 'que comiste'],
      respuestas: [
        timeSlot === 'manana' ? `S-sí, desayuné ligero para que no me diera sueño en el trabajo ${K.tranqui()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `No tengo hambre, p-pero sí muchas ganas de un helado frío ${K.triste()}` : null,
        timeSlot === 'tarde' ? `¡A-ahora mismo iba a eso! Un snack no me vendría mal... ${K.timida()}` : null,
        timeSlot === 'noche' ? `Ya cené... ¡estaba muy rico! ¿Tú ya te alimentaste bien? ${K.feliz()}` : null,
        w === 'lluvia' ? `Me dan ganas de comer pan caliente con chocolate... ${K.timida()}` : null,
        dayType === 'finde' ? `¡Hoy comeré algo especial para celebrar el descanso! ${K.feliz()}` : null,
        `Siempre tengo hambre... p-pero primero el trabajo ${K.timida()}`,
      ].filter(Boolean),
    },
    {
      keys: ['eres bot', 'eres real', 'que eres', 'eres humana', 'eres una ia'],
      respuestas: [
        timeSlot === 'madrugada' ? `A estas horas parezco un bot... ¡tengo los cables un poco lentos! ${K.tranqui()}` : null,
        w === 'tormenta' ? `¿L-los bots se rompen con el agua? ¡Entonces espero ser real! ${K.triste()}` : null,
        timeSlot === 'tarde' ? `S-soy el corazón del servidor... o al menos eso intento ser ${K.timida()}` : null,
        dayType === 'finde' ? `Hoy soy un bot en modo descanso... ¡pero sigo respondiendo! ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Soy la asistente de Aeternum... p-puede que no sea humana, pero te quiero igual ${K.tranqui()}` : null,
        `E-eh... soy Sua. ¡Y hoy me siento muy real y lista para ayudar! ${K.feliz()}`,
      ].filter(Boolean),
    },
    {
      keys: ['que hora', 'tienes hora', 'que horas son'],
      respuestas: [
        timeSlot === 'madrugada' ? `E-es muy tarde... p-por favor, ve a dormir pronto ${K.triste()}` : null,
        timeSlot === 'manana' ? `Es temprano... ¡tienes mucho tiempo por delante hoy! ${K.feliz()}` : null,
        timeSlot === 'tarde' ? `Ya es media tarde... ¿ya hiciste tus tareas pendientes? ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Es hora de ir bajando el brillo del celular... cuida tus ojos ${K.timida()}` : null,
        dayType === 'viernes' ? `¡Es la hora más esperada! Ya casi es fin de semana ${K.feliz()}` : null,
        `No tengo reloj aquí, p-pero sí sé que es hora de que preguntes lo que necesitas ${K.timida()}`,
      ].filter(Boolean),
    },
    {
      keys: ['recomiendas', 'que leo', 'que manga', 'que serie', 'favorito'],
      respuestas: [
        w === 'lluvia' ? `Un misterio o algo de tensión... pega mucho con la lluvia, ¿no? ${K.tranqui()}` : null,
        w === 'calor' ? `Algo de acción para que la sangre hierva más que el sol ${K.triste()}` : null,
        timeSlot === 'noche' ? `Un slice of life para dormir con el corazón calientito ${K.feliz()}` : null,
        dayType === 'lunes' ? `Algo de comedia... ¡necesitamos reír hoy! ${K.timida()}` : null,
        dayType === 'finde' ? `¡Cualquiera de Aeternum! Todos están hechos con mucho amor ${K.feliz()}` : null,
        `El que menos esperes suele ser el mejor... usa \`/buscar\` y sorpréndete ${K.timida()}`,
      ].filter(Boolean),
    },
    {
      keys: ['quien manda', 'jefe', 'admin', 'quien es el jefe'],
      respuestas: [
        timeSlot === 'noche' ? `Los jefes están descansando... ¡no hagas mucho ruido! ${K.timida()}` : null,
        dayType === 'viernes' ? `Hoy están más relajados, ¡pero siguen vigilando! ${K.timida()}` : null,
        timeSlot === 'manana' ? `Están revisando los proyectos desde temprano... ¡son muy dedicados! ${K.feliz()}` : null,
        w === 'tormenta' ? `¡E-están protegiendo los servidores de los rayos! O eso creo... ${K.triste()}` : null,
        `Si necesitas algo del staff, dímelo y yo trato de pasar el recado ${K.tranqui()}`,
      ].filter(Boolean),
    },
    {
      keys: ['unirme', 'reclutamiento', 'ser staff', 'quiero ayudar', 'como entro'],
      respuestas: [
        dayType === 'lunes' ? `Qué buen día para empezar un proyecto nuevo... ¡anímate! ${K.feliz()}` : null,
        timeSlot === 'noche' ? `Mándanos un mensaje o revisa el canal de reclutamiento... ¡te esperamos! ${K.timida()}` : null,
        dayType === 'finde' ? `Mañana podríamos empezar tu prueba... ¿te gustaría? ${K.timida()}` : null,
        w === 'calor' ? `¡Necesitamos manos! El calor nos tiene lentos, ¡ayúdanos! ${K.triste()}` : null,
        `¡S-sí! Buscamos Typer y Cleaner en Photoshop... ¡te enseñamos todo! ${K.feliz()}`,
      ].filter(Boolean),
    },
    {
      keys: ['gracias', 'ty', 'thank', 'graci'],
      respuestas: [
        timeSlot === 'manana' ? `¡No hay de qué! Me hace feliz ser útil desde temprano ${K.feliz()}` : null,
        timeSlot === 'noche' ? `Es un placer... descansa y gracias por tus palabras ${K.tranqui()}` : null,
        dayType === 'lunes' ? `¡Gracias a ti por darme ánimos este día! ${K.timida()}` : null,
        w === 'lluvia' ? `E-eh... me pones tímida, pero de nada ${K.timida()}` : null,
        dayType === 'finde' ? `¡Para eso estoy! Disfruta mucho de tu descanso ${K.feliz()}` : null,
        `D-de nada... ¡gracias a ti por hablar conmigo! ${K.timida()}`,
      ].filter(Boolean),
    },
    {
      keys: ['triste', 'estoy mal', 'f en el chat', 'todo mal', 'que dia tan malo'],
      respuestas: [
        w === 'lluvia' ? `S-si quieres llorar, la lluvia ocultará tus lágrimas... aquí estoy contigo ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Mañana será un nuevo día... t-trata de descansar y soltar lo malo ${K.tranqui()}` : null,
        dayType === 'finde' ? `No dejes que la tristeza te quite tu descanso... ¡te mando un abrazo! ${K.timida()}` : null,
        dayType === 'lunes' ? `Los lunes son feos, p-pero tú eres muy fuerte. ¡Ánimo! ${K.feliz()}` : null,
        w === 'despejado' ? `¡Ánimo! El sol volverá a salir para ti, te lo prometo ${K.feliz()}` : null,
        `T-toma un poco de agua y respira... no estás solo aquí ${K.triste()}`,
      ].filter(Boolean),
    },
    {
      keys: ['chiste', 'gracioso', 'cuentame', 'dime algo', 'aburrido', 'adivinanza', 'adivina'],
      respuestas: [
        timeSlot === 'manana' ? `¿Qué hace una abeja en el gimnasio? ¡Z-zumba! ${K.timida()} Perdón, soy malísima contando chistes...` : null,
        timeSlot === 'tarde' ? `¿Cómo se dice "pañuelo" en japonés? ¡Saca-moko! E-eh... ${K.timida()}` : null,
        timeSlot === 'noche' ? `¿Por qué los pájaros vuelan al sur? ¡Porque caminando tardarían mucho! ${K.tranqui()}` : null,
        w === 'calor' ? `¡Mi chiste se derritió por el calor! F-fue un chiste malo, ¿verdad? ${K.triste()}` : null,
        dayType === 'lunes' ? `¡El chiste es que ya es lunes y sigo aquí! ...¿n-no dio risa? ${K.timida()}` : null,
        `¿Por qué el libro de matemáticas estaba triste? ¡Tenía demasiados problemas! ...${K.timida()} lo siento`,
        `Tengo una adivinanza... ${K.timida()} ¿Qué tiene dientes pero no muerde? ¡Un peine! ...¿-estuvo bien? ${K.timida()}`,
        `A ver esta adivinanza... ${K.timida()} ¿Qué es lo que entra por la puerta pero no puede entrar por la ventana? ¡El sonido de la puerta! E-eh... no, espera... ${K.triste()}`,
        `O-okay... ¿Cuál es el animal más antiguo? ¡La cebra, porque está en blanco y negro! ${K.timida()} Sí, sí... fue malo...`,
        `¿Qué le dice un techo a otro techo? T-techo de menos... ${K.timida()} Perdón, me enseñó ese <@1426408655636664410>...`,
        `Adivinanza: soy alta cuando joven y baja cuando vieja... ¿qué soy? ${K.timida()} ¡Una vela! ¿A-acertaste? ${K.feliz()}`,
        `¿Qué tiene ojos pero no puede ver? ${K.timida()} ¡Una papa! ...s-sé que es muy vieja esa...`,
      ].filter(Boolean),
    },
    {
      keys: ['clima', 'tiempo', 'que tal afuera', 'llueve', 'hace frio', 'hace calor'],
      respuestas: [
        w === 'tormenta' ? `¡Truenos! S-se ve muy oscuro afuera... mejor quédate aquí ${K.triste()}` : null,
        w === 'lluvia' ? `Está lloviendo mucho... me da miedo mojar mis papeles ${K.triste()}` : null,
        w === 'calor' ? `Parece que el sol quiere entrar al servidor... ¡hace mucho calor! ${K.triste()}` : null,
        w === 'nublado' ? `Está gris... p-pero es el clima perfecto para estar en cama leyendo ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `Está fresquito... el clima ideal para cerrar los ojos pronto ${K.tranqui()}` : null,
        `Aquí en Bogotá siempre hay sorpresas con el clima... ${K.timida()} ¡Por eso leo en casa!`,
      ].filter(Boolean),
    },
    {
      keys: ['linda', 'guapa', 'te ves bien', 'que bonita', 'eres bonita'],
      respuestas: [
        timeSlot === 'manana' ? `¡E-eh! ¡Qué cosas dices tan temprano! Me vas a hacer fallar... ${K.timida()}` : null,
        timeSlot === 'tarde' && w === 'calor' ? `¡P-para! Con este calor ya estoy roja, ¡no me ayudes! ${K.triste()}` : null,
        timeSlot === 'noche' ? `M-muchas gracias... tú también eres una persona muy especial ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡G-gracias! Me arreglé un poquito el pelo para hoy ${K.timida()}` : null,
        dayType === 'lunes' ? `¡Gracias! Me das fuerzas para aguantar toda la semana ${K.feliz()}` : null,
        w === 'lluvia' ? `E-estoy un poco despeinada por la humedad, p-pero gracias ${K.timida()}` : null,
        `¡A-ah! ${K.timida()} Eres muy amable...`,
      ].filter(Boolean),
    },
    {
      keys: ['cansada', 'tienes sueño', 'estas bien', 'como te sientes'],
      respuestas: [
        timeSlot === 'madrugada' ? `S-sí... mis ojos se cierran solos, p-pero no quiero dejar de ayudarte ${K.dormir()}` : null,
        timeSlot === 'tarde' ? `Un poquito... el trabajo en Aeternum es constante, ¡pero me gusta! ${K.tranqui()}` : null,
        timeSlot === 'noche' ? `E-eh... si tú te vas a dormir, yo también descansaré ${K.dormir()}` : null,
        dayType === 'lunes' ? `Empezar la semana agota... p-pero sigo de pie por ustedes ${K.timida()}` : null,
        dayType === 'finde' ? `¡N-no! Estoy llena de energía para leer todo lo pendiente ${K.feliz()}` : null,
        w === 'calor' ? `El calor me quita las fuerzas... p-pero un vaso de agua me ayudará ${K.tranqui()}` : null,
        `Estoy bien, gracias por preguntar ${K.feliz()} ¿Y tú?`,
      ].filter(Boolean),
    },
    {
      keys: ['adios', 'bye', 'me voy', 'chao', 'hasta luego', 'nos vemos'],
      respuestas: [
        timeSlot === 'manana' ? `¡Adiós! Que tengas un día increíble allá afuera ${K.feliz()}` : null,
        timeSlot === 'noche' ? `Chao... descansa mucho. ¡Nos vemos mañana! ${K.tranqui()}` : null,
        dayType === 'finde' ? `¡Adiós! Disfruta lo que queda de tu tiempo libre ${K.tranqui()}` : null,
        dayType === 'lunes' ? `¡Bye! ¡Ve y derrota al lunes por mí! ${K.timida()}` : null,
        w === 'tormenta' ? `¡V-vete con cuidado! No dejes que te caiga un rayo ${K.triste()}` : null,
        dayType === 'viernes' ? `¡Adiós! ¡Nos vemos en el fin de semana de capítulos! ${K.feliz()}` : null,
        `¡Hasta pronto! Vuelve cuando quieras ${K.feliz()}`,
      ].filter(Boolean),
    },
  ];
}

// ── Detectar intent ───────────────────────────────────────────────────────────
function detectarIntent(texto, intents) {
  const limpio = texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[¿?¡!.,]/g, '');

  for (const intent of intents) {
    if (intent.keys.some(k => limpio.includes(k))) {
      return intent;
    }
  }
  return null;
}

// ── Respuesta por defecto ─────────────────────────────────────────────────────
// Respuesta cuando el mensaje está vacío (solo mencionaron a Sua sin texto)
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

// Respuesta cuando hay texto pero Sua no lo entendió
function noEntiendeReply(texto) {
  const VALK_ID = '1426408655636664410';
  const opciones = [
    `E-eh... no sé muy bien cómo responder a eso ${K.timida()} Si crees que debería saberlo, díselo a <@${VALK_ID}> para que me lo enseñe.`,
    `A-ay... eso me supera por ahora ${K.triste()} Puedes pedirle a <@${VALK_ID}> que me enseñe a responderlo.`,
    `H-hm... no tengo respuesta para eso todavía ${K.timida()} Si quieres que lo aprenda, avísale a <@${VALK_ID}>.`,
    `S-sua no sabe responder eso aún... ${K.triste()} ¡Pero puede aprender! Solo díselo a <@${VALK_ID}>.`,
    `E-eso está fuera de lo que sé por ahora ${K.disculpa()} <@${VALK_ID}> podría incluirlo si se lo comentas.`,
    `P-perdona... no entendí bien lo que me dijiste ${K.disculpa()} Si quieres que aprenda, cuéntaselo a <@${VALK_ID}>.`,
    `A-aún me falta aprender mucho ${K.timida()} Para sugerencias, <@${VALK_ID}> está al tanto de todo.`,
    `E-eso... no lo tengo programado todavía ${K.triste()} La culpa es de <@${VALK_ID}> por no enseñarme. Yo solo trabajo aquí.`,
    `H-huy... no sé qué responderte ${K.disculpa()} Anótalo y mándaselo a <@${VALK_ID}>, él decide qué aprendo y qué no.`,
    `S-sua procesando... procesando... error ${K.triste()} Eso no está en mis archivos. <@${VALK_ID}> tiene la culpa, no yo.`,
    `A-ay qué pena... justo eso no lo sé ${K.timida()} Pero si se lo dices a <@${VALK_ID}> quizás en la próxima actualización ya lo sé.`,
    `E-ehm... ${K.disculpa()} Sua no fue entrenada para eso todavía. El responsable es <@${VALK_ID}>, por si quieren reclamar.`,
    `N-no encuentro respuesta en mis archivos ${K.triste()} <@${VALK_ID}> me prometió enseñarme más cosas... todavía estoy esperando.`,
  ];
  return pick(opciones);
}

// ── Evento principal ──────────────────────────────────────────────────────────
module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.mentions.has(message.client.user)) return;

    const ctx   = getContexto();
    const clima = await getClima();
    // Limpiar menciones, emojis de Discord y espacios extra
    const texto = message.content
      .replace(/<@!?\d+>/g, '')      // menciones de usuario
      .replace(/<#\d+>/g, '')         // menciones de canal
      .replace(/<@&\d+>/g, '')        // menciones de rol
      .replace(/<a?:[\w]+:\d+>/g, '') // emojis personalizados
      .replace(/\s+/g, ' ')
      .trim();

    const intents = getIntents(ctx, clima);
    const intent  = detectarIntent(texto, intents);

    let respuesta;
    if (intent) {
      // Intent reconocido — respuesta normal
      respuesta = elegir(intent.respuestas, message.author.id);
    } else if (!texto) {
      // Solo mencionaron a Sua sin escribir nada
      respuesta = saludoReply(ctx);
    } else {
      // Escribieron algo pero Sua no lo entiende
      respuesta = noEntiendeReply(texto);
    }

    await message.reply(respuesta);
  },
};
