// src/utils/sua.js
// Mensajes con la personalidad de Sua — delicada, tímida, cariñosa

const SUA = {

  // ── Generales ──────────────────────────────────────────────────────────────
  sinPermisos: '...eh, lo siento mucho, pero no creo que puedas hacer eso (〃>_<;〃)',
  errorGeneral: 'A-ay... algo salió mal de mi lado. ¿Podrías intentarlo de nuevo? (;ω;)',
  exito: '¡Listo! Lo hice lo mejor que pude (◕‿◕✿)',

  // ── Proyecto ───────────────────────────────────────────────────────────────
  proyecto: {
    agregado: (name) => `¡Ya registré **${name}**! Voy a estar muy pendiente de él (ﾉ◕ヮ◕)ﾉ`,
    noEncontrado: (id) => `Mmm... no encuentro ningún proyecto con el ID \`${id}\`. ¿Está bien escrito? (´• ω •\`)ゞ`,
    yaExiste: (id) => `Ya hay un proyecto con el ID \`${id}\`... ¿quizás querías usar otro nombre? (〃>_<;〃)`,
    eliminado: (name) => `Entendido... eliminé **${name}**. Espero que haya sido la decisión correcta (˘ω˘)`,
    sinProyectos: '...todavía no hay proyectos registrados. ¿Agregamos el primero? (◕‿◕✿)',
    toggleActivo: (name, active) => active
      ? `¡**${name}** está activo de nuevo! Me alegra mucho (ﾉ◕ヮ◕)ﾉ`
      : `**${name}** fue desactivado... lo recordaré con cariño (˘ω˘)`,
    estadoCambiado: (name, estado) => `Actualicé el estado de **${name}** a **${estado}** (◕‿◕✿)`,
    sinUrl: 'Necesito al menos una URL (TMO o Colorcito) para poder ayudarte (´• ω •\`)ゞ',
  },

  // ── Status ─────────────────────────────────────────────────────────────────
  status: {
    sinActivos: '...no hay proyectos activos en este momento. Quizás pronto (˘ω˘)',
    consultando: (n) => `Revisando **${n}** proyecto(s) con mucho cuidado... (っ˘ω˘ς)`,
    driveNoEncontrado: (folder) => `No encontré la carpeta \`${folder}\` en Drive... ¿el nombre está bien? (´• ω •\`)ゞ`,
  },

  // ── Anunciar ───────────────────────────────────────────────────────────────
  anunciar: {
    sinCanal: 'No hay un canal de anuncios configurado... usa `/configurar canal` primero (;ω;)',
    enviado: (name, cap) => `¡Publiqué el anuncio de **${name}** cap. ${cap}! Espero que les guste (ﾉ◕ヮ◕)ﾉ`,
    errorEnvio: 'A-ay... no pude enviar el anuncio. ¿El canal está bien configurado? (;ω;)',
    sinImagen: '⚠️ No encontré una imagen en esa URL, pero continuaré sin portada (´• ω •\`)ゞ',
  },

  // ── Avisar ─────────────────────────────────────────────────────────────────
  avisar: {
    publicado: '¡El aviso fue publicado! (ﾉ◕ヮ◕)ﾉ',
    sinCanal: 'No encontré el canal de avisos... revisa el NOTICE_CHANNEL_ID en la configuración (;ω;)',
  },

  // ── Roles ──────────────────────────────────────────────────────────────────
  rol: {
    creado: (name) => `¡Creé el rol **${name}** con mucho cuidado! (◕‿◕✿) Usa \`/rol mensaje\` para actualizar el panel.`,
    yaExiste: (name) => `**${name}** ya tiene un rol vinculado (〃>_<;〃) Usa \`/rol quitar\` primero si quieres rehacerlo.`,
    sinRoles: 'Todavía no hay roles configurados... usa \`/rol crear\` primero (´• ω •\`)ゞ',
    mensajeActualizado: '¡El panel de roles fue actualizado! (◕‿◕✿)',
    quitado: (id) => `Listo, quité el rol de \`${id}\` del panel. Usa \`/rol mensaje\` para reflejarlo (˘ω˘)`,
    noVinculado: (id) => `No encontré un rol vinculado para \`${id}\` (´• ω •\`)ゞ`,
    errorEmoji: (emoji) => `⚠️ No pude reaccionar con ${emoji}... pero el resto quedó bien (〃>_<;〃)`,
  },

  // ── Configurar ─────────────────────────────────────────────────────────────
  configurar: {
    canalActualizado: (id) => `¡Guardé el canal <#${id}> para los anuncios! (ﾉ◕ヮ◕)ﾉ`,
    verificando: 'Revisando la conexión con las fuentes... un momentito (っ˘ω˘ς)',
    conexionOk: '¡Todo está conectado bien! Me alegra mucho (◕‿◕✿)',
    conexionError: (fuente) => `Mmm... no pude conectarme con **${fuente}**. ¿La URL está bien? (;ω;)`,
  },

  // ── Buscar ─────────────────────────────────────────────────────────────────
  buscar: {
    sinResultados: (q) => `No encontré nada para **"${q}"**... ¿quizás con otro nombre? (´• ω •\`)ゞ`,
    resultados: (n, q) => `Encontré **${n}** resultado(s) para **"${q}"** (◕‿◕✿)`,
  },

  // ── Drive ──────────────────────────────────────────────────────────────────
  drive: {
    noEncontrado: (name) => `No encontré la carpeta **"${name}"** en Drive (´• ω •\`)ゞ ¿El nombre es exactamente igual?`,
    errorConexion: 'Tuve un problema conectándome con Google Drive... ¿las credenciales están bien? (;ω;)',
  },

  // ── Monitor ────────────────────────────────────────────────────────────────
  monitor: {
    capNuevo: (name, cap) => `¡Encontré el capítulo **${cap}** de **${name}**! Voy a anunciarlo (ﾉ◕ヮ◕)ﾉ`,
    errorScraper: (name, fuente) => `No pude revisar **${name}** en ${fuente} esta vez (;ω;)`,
  },

};

module.exports = SUA;
// updated
