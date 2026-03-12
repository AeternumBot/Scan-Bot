// src/utils/sua.js
// Mensajes con la personalidad de Sua — delicada, tímida, cariñosa

// Selecciona un kaomoji aleatorio de una lista
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const K = {
  feliz:    () => pick(['(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ', '(✿◠‿◠)', '(*´▽`*)', '(ﾉ´ヮ`)ﾉ*: ･ﾟ']),
  timida:   () => pick(['(〃>_<;〃)', '(//>/<//)', '(〃ω〃)', '(*ノωノ)', '(//∇//)']),
  triste:   () => pick(['(;ω;)', '(´；ω；`)', '( ´•̥̥̥ω•̥̥̥` )', '(╥_╥)']),
  tranqui:  () => pick(['(˘ω˘)', '(っ˘ω˘ς)', '( ´ ▽ ` )', '(。◕‿◕。)', '(￣▽￣)']),
  disculpa: () => pick(['(´• ω •`)ゞ', '(⁄ ⁄•⁄ω⁄•⁄ ⁄)', '(´＿｀。)', '(；￣ω￣)']),
  dormir:   () => pick(['(；￣ω￣)', '(￣o￣) zzZ', '( ˘ω˘ )zzz', '(-_-)zzz']),
};

const SUA = {

  // ── Generales ──────────────────────────────────────────────────────────────
  sinPermisos: `...eh, lo siento mucho, pero no creo que puedas hacer eso ${K.timida()}`,
  errorGeneral: `A-ay... algo salió mal de mi lado. ¿Podrías intentarlo de nuevo? ${K.triste()}`,
  exito: `¡Listo! Lo hice lo mejor que pude ${K.feliz()}`,

  // ── Proyecto ───────────────────────────────────────────────────────────────
  proyecto: {
    agregado: (name) => `¡Ya registré **${name}**! Voy a estar muy pendiente de él ${K.feliz()}`,
    noEncontrado: (id) => `Mmm... no encuentro ningún proyecto con el ID \`${id}\`. ¿Está bien escrito? ${K.disculpa()}`,
    yaExiste: (id) => `Ya hay un proyecto con el ID \`${id}\`... ¿quizás querías usar otro nombre? ${K.timida()}`,
    eliminado: (name) => `Entendido... eliminé **${name}**. Espero que haya sido la decisión correcta ${K.tranqui()}`,
    sinProyectos: `...todavía no hay proyectos registrados. ¿Agregamos el primero? ${K.feliz()}`,
    toggleActivo: (name, active) => active
      ? `¡**${name}** está activo de nuevo! Me alegra mucho ${K.feliz()}`
      : `**${name}** fue desactivado... lo recordaré con cariño ${K.tranqui()}`,
    estadoCambiado: (name, estado) => `Actualicé el estado de **${name}** a **${estado}** ${K.feliz()}`,
    sinUrl: `Necesito al menos una URL (TMO o Colorcito) para poder ayudarte ${K.disculpa()}`,
  },

  // ── Status ─────────────────────────────────────────────────────────────────
  status: {
    sinActivos: `...no hay proyectos activos en este momento. Quizás pronto ${K.tranqui()}`,
    consultando: (n) => `Revisando **${n}** proyecto(s) con mucho cuidado... ${K.tranqui()}`,
    driveNoEncontrado: (folder) => `No encontré la carpeta \`${folder}\` en Drive... ¿el nombre está bien? ${K.disculpa()}`,
  },

  // ── Anunciar ───────────────────────────────────────────────────────────────
  anunciar: {
    sinCanal: `No hay un canal de anuncios configurado... usa \`/configurar canal\` primero ${K.triste()}`,
    enviado: (name, cap) => `¡Publiqué el anuncio de **${name}** cap. ${cap}! Espero que les guste ${K.feliz()}`,
    errorEnvio: `A-ay... no pude enviar el anuncio. ¿El canal está bien configurado? ${K.triste()}`,
    sinImagen: `⚠️ No encontré una imagen en esa URL, pero continuaré sin portada ${K.disculpa()}`,
  },

  // ── Avisar ─────────────────────────────────────────────────────────────────
  avisar: {
    publicado: `¡El aviso fue publicado! ${K.feliz()}`,
    sinCanal: `No encontré el canal de avisos... revisa el NOTICE_CHANNEL_ID en la configuración ${K.triste()}`,
  },

  // ── Roles ──────────────────────────────────────────────────────────────────
  rol: {
    creado: (name) => `¡Creé el rol **${name}** con mucho cuidado! ${K.feliz()} Usa \`/rol mensaje\` para actualizar el panel.`,
    yaExiste: (name) => `**${name}** ya tiene un rol vinculado ${K.timida()} Usa \`/rol quitar\` primero si quieres rehacerlo.`,
    sinRoles: `Todavía no hay roles configurados... usa \`/rol crear\` primero ${K.disculpa()}`,
    mensajeActualizado: `¡El panel de roles fue actualizado! ${K.feliz()}`,
    quitado: (id) => `Listo, quité el rol de \`${id}\` del panel. Usa \`/rol mensaje\` para reflejarlo ${K.tranqui()}`,
    noVinculado: (id) => `No encontré un rol vinculado para \`${id}\` ${K.disculpa()}`,
    errorEmoji: (emoji) => `⚠️ No pude reaccionar con ${emoji}... pero el resto quedó bien ${K.timida()}`,
  },

  // ── Configurar ─────────────────────────────────────────────────────────────
  configurar: {
    canalActualizado: (id) => `¡Guardé el canal <#${id}> para los anuncios! ${K.feliz()}`,
    verificando: `Revisando la conexión con las fuentes... un momentito ${K.tranqui()}`,
    conexionOk: `¡Todo está conectado bien! Me alegra mucho ${K.feliz()}`,
    conexionError: (fuente) => `Mmm... no pude conectarme con **${fuente}**. ¿La URL está bien? ${K.triste()}`,
  },

  // ── Buscar ─────────────────────────────────────────────────────────────────
  buscar: {
    sinResultados: (q) => `No encontré nada para **"${q}"**... ¿quizás con otro nombre? ${K.disculpa()}`,
    resultados: (n, q) => `Encontré **${n}** resultado(s) para **"${q}"** ${K.feliz()}`,
  },

  // ── Drive ──────────────────────────────────────────────────────────────────
  drive: {
    noEncontrado: (name) => `No encontré la carpeta **"${name}"** en Drive ${K.disculpa()} ¿El nombre es exactamente igual?`,
    errorConexion: `Tuve un problema conectándome con Google Drive... ¿las credenciales están bien? ${K.triste()}`,
  },

  // ── Monitor ────────────────────────────────────────────────────────────────
  monitor: {
    capNuevo: (name, cap) => `¡Encontré el capítulo **${cap}** de **${name}**! Voy a anunciarlo ${K.feliz()}`,
    errorScraper: (name, fuente) => `No pude revisar **${name}** en ${fuente} esta vez ${K.triste()}`,
  },

  // ── Moderación ─────────────────────────────────────────────────────────────
  mod: {
    sinPermiso: `...lo siento, pero no creo que tengas permiso para hacer eso ${K.timida()}`,
    usuarioNoEncontrado: `No encontré a ese usuario en el servidor ${K.disculpa()}`,
    noPuedo: `A-ay... no puedo hacer eso con ese usuario, tiene más permisos que yo ${K.triste()}`,
    expulsado: (user, razon) => `Entendido... expulsé a **${user}** ${K.tranqui()}\n*Razón: ${razon}*`,
    baneado: (user, razon) => `Ya está hecho... baneé a **${user}** ${K.tranqui()}\n*Razón: ${razon}*`,
    rolDado: (user, rol) => `¡Le asigné el rol **${rol}** a **${user}**! ${K.feliz()}`,
    rolQuitado: (user, rol) => `Listo, le quité el rol **${rol}** a **${user}** ${K.tranqui()}`,
    errorAccion: (accion) => `A-ay... no pude ${accion}. ¿Tengo los permisos necesarios? ${K.triste()}`,
  },

};

module.exports = { ...SUA, K };
