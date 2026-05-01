// src/utils/lumi.js
// Mensajes con la personalidad de Lumi — delicada, tímida, cariñosa

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

const LUMI = {

  // ── Generales ──────────────────────────────────────────────────────────────
  sinPermisos:  `...eh, lo siento mucho, pero no creo que puedas hacer eso ${K.timida()}`,
  errorGeneral: `A-ay... algo salió mal de mi lado. ¿Podrías intentarlo de nuevo? ${K.triste()}`,
  exito:        `¡Listo! Lo hice lo mejor que pude ${K.feliz()}`,

  // ── Proyecto ───────────────────────────────────────────────────────────────
  proyecto: {
    agregado:     (name)         => `¡Ya registré **${name}**! Voy a estar muy pendiente de él ${K.feliz()}`,
    noEncontrado: (id)           => `Mmm... no encuentro ningún proyecto con el ID \`${id}\`. ¿Está bien escrito? ${K.disculpa()}`,
    yaExiste:     (id)           => `Ya hay un proyecto con el ID \`${id}\`... ¿quizás querías usar otro nombre? ${K.timida()}`,
    eliminado:    (name)         => `Entendido... eliminé **${name}**. Espero que haya sido la decisión correcta ${K.tranqui()}`,
    sinProyectos:                   `...todavía no hay proyectos registrados. ¿Agregamos el primero? ${K.feliz()}`,
    toggleActivo: (name, active) => active
      ? `¡**${name}** está activo de nuevo! Me alegra mucho ${K.feliz()}`
      : `**${name}** fue desactivado... lo recordaré con cariño ${K.tranqui()}`,
    estadoCambiado: (name, estado) => `Actualicé el estado de **${name}** a **${estado}** ${K.feliz()}`,
    sinUrl:         `Necesito la URL de Colorcito para poder ayudarte ${K.disculpa()}`,
  },

  // ── Status ─────────────────────────────────────────────────────────────────
  status: {
    sinActivos:       `...no hay proyectos activos en este momento. Quizás pronto ${K.tranqui()}`,
    consultando: (n)  => `Revisando **${n}** proyecto(s) con mucho cuidado... ${K.tranqui()}`,
    driveNoEncontrado: (folder) => `No encontré la carpeta \`${folder}\` en Drive... ¿el nombre está bien? ${K.disculpa()}`,
  },

  // ── Anunciar ───────────────────────────────────────────────────────────────
  anunciar: {
    sinCanal:    `No hay un canal de anuncios configurado... usa \`/configurar canal\` primero ${K.triste()}`,
    enviado: (name, cap) => `¡Publiqué el anuncio de **${name}** cap. ${cap}! Espero que les guste ${K.feliz()}`,
    errorEnvio:  `A-ay... no pude enviar el anuncio. ¿El canal está bien configurado? ${K.triste()}`,
  },

  // ── Avisar ─────────────────────────────────────────────────────────────────
  avisar: {
    sinCanal:  `No hay un canal de avisos configurado... usa \`/configurar avisos\` primero ${K.triste()}`,
    publicado: `¡Publiqué el aviso! Espero que llegue bien a todos ${K.feliz()}`,
  },

  // ── Moderación ─────────────────────────────────────────────────────────────
  mod: {
    sinPermiso:          `...lo siento mucho, pero no tienes los permisos para hacer eso ${K.timida()}`,
    usuarioNoEncontrado: `No encontré a ese usuario en el servidor... ¿seguro que está aquí? ${K.disculpa()}`,
    noPuedo:             `N-no puedo hacer eso... tiene más permisos que yo ${K.triste()}`,
    expulsado:    (user, razon) => `Entendido... **${user}** fue expulsado. Razón: *${razon}* ${K.tranqui()}`,
    baneado:      (user, razon) => `Hecho. **${user}** fue baneado. Razón: *${razon}* ${K.tranqui()}`,
    rolDado:      (user, rol)   => `¡Ya le di el rol de **${rol}** a **${user}**! ${K.feliz()}`,
    rolQuitado:   (user, rol)   => `Le quité el rol de **${rol}** a **${user}** ${K.tranqui()}`,
    errorAccion:  (accion)      => `A-ay... no pude ${accion}. ¿Tengo los permisos correctos? ${K.triste()}`,
  },



};

module.exports = LUMI;
