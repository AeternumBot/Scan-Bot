// src/commands/moderar.js
// /moderar — expulsar, banear y gestionar roles de staff

const { SlashCommandBuilder } = require('discord.js');
const SUA = require('../utils/sua');

const MOD_ROLE_ID = '1368818622750789633';

const STAFF_ROLES = {
  profesor:    { id: '1450701377587122312', name: 'Profesor',    extra: [] },
  typesetter:  { id: '1368818361915408485', name: 'Typesetter',  extra: [] },
  cleaner:     { id: '1368818132948488294', name: 'Cleaner',     extra: [] },
  traductor:   { id: '1368817756870545510', name: 'Traductor',   extra: [] },
  editor:      { id: '1368817956657561650', name: 'Editor',      extra: ['1368818361915408485', '1368818280717877359', '1368818132948488294'] },
  qc:          { id: '1368818036437680128', name: 'QC',          extra: [] },
  redibujador: { id: '1368818280717877359', name: 'Redibujador', extra: ['1368818132948488294'] },
  staff:       { id: '1368818898677272597', name: 'Staff',       extra: [] },
  nuevo:       { id: '1368819324608974950', name: 'Nuevo',       extra: [] },
};

const data = new SlashCommandBuilder()
  .setName('moderar')
  .setDescription('Herramientas de moderación y gestión de roles')
  .addSubcommand(sub =>
    sub.setName('expulsar')
      .setDescription('Expulsa a un miembro del servidor')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón de la expulsión'))
  )
  .addSubcommand(sub =>
    sub.setName('banear')
      .setDescription('Banea a un miembro del servidor')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario a banear').setRequired(true))
      .addStringOption(o => o.setName('razon').setDescription('Razón del ban'))
  )
  .addSubcommand(sub =>
    sub.setName('dar-rol')
      .setDescription('Asigna un rol de staff a un miembro')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .addStringOption(o =>
        o.setName('rol').setDescription('Rol a asignar').setRequired(true)
          .addChoices(
            { name: 'Profesor',    value: 'profesor' },
            { name: 'Typesetter',  value: 'typesetter' },
            { name: 'Cleaner',     value: 'cleaner' },
            { name: 'Traductor',   value: 'traductor' },
            { name: 'Editor',      value: 'editor' },
            { name: 'QC',          value: 'qc' },
            { name: 'Redibujador', value: 'redibujador' },
            { name: 'Staff',       value: 'staff' },
            { name: 'Nuevo',       value: 'nuevo' },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('quitar-rol')
      .setDescription('Quita un rol de staff a un miembro')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
      .addStringOption(o =>
        o.setName('rol').setDescription('Rol a quitar').setRequired(true)
          .addChoices(
            { name: 'Profesor',    value: 'profesor' },
            { name: 'Typesetter',  value: 'typesetter' },
            { name: 'Cleaner',     value: 'cleaner' },
            { name: 'Traductor',   value: 'traductor' },
            { name: 'Editor',      value: 'editor' },
            { name: 'QC',          value: 'qc' },
            { name: 'Redibujador', value: 'redibujador' },
            { name: 'Staff',       value: 'staff' },
            { name: 'Nuevo',       value: 'nuevo' },
          )
      )
  );

function hasModeRole(member) {
  return member.roles.cache.has(MOD_ROLE_ID);
}

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!hasModeRole(interaction.member)) {
    return interaction.editReply(SUA.mod.sinPermiso);
  }
  const sub = interaction.options.getSubcommand();
  if (sub === 'expulsar')   return handleKick(interaction);
  if (sub === 'banear')     return handleBan(interaction);
  if (sub === 'dar-rol')    return handleDarRol(interaction);
  if (sub === 'quitar-rol') return handleQuitarRol(interaction);
}

async function handleKick(interaction) {
  const usuario = interaction.options.getMember('usuario');
  const razon   = interaction.options.getString('razon') || 'Sin razón especificada';
  if (!usuario) return interaction.editReply(SUA.mod.usuarioNoEncontrado);
  if (!usuario.kickable) return interaction.editReply(SUA.mod.noPuedo);
  try {
    await usuario.kick(razon);
    await interaction.editReply(SUA.mod.expulsado(usuario.user.username, razon));
  } catch { await interaction.editReply(SUA.mod.errorAccion('expulsar')); }
}

async function handleBan(interaction) {
  const usuario = interaction.options.getMember('usuario');
  const razon   = interaction.options.getString('razon') || 'Sin razón especificada';
  if (!usuario) return interaction.editReply(SUA.mod.usuarioNoEncontrado);
  if (!usuario.bannable) return interaction.editReply(SUA.mod.noPuedo);
  try {
    await usuario.ban({ reason: razon });
    await interaction.editReply(SUA.mod.baneado(usuario.user.username, razon));
  } catch { await interaction.editReply(SUA.mod.errorAccion('banear')); }
}

async function handleDarRol(interaction) {
  const usuario = interaction.options.getMember('usuario');
  const rolKey  = interaction.options.getString('rol');
  const rolInfo = STAFF_ROLES[rolKey];
  if (!usuario) return interaction.editReply(SUA.mod.usuarioNoEncontrado);
  try {
    const rolesToAdd = [rolInfo.id, ...rolInfo.extra];
    if (rolKey === 'staff') await usuario.roles.remove(STAFF_ROLES.nuevo.id).catch(() => {});
    for (const rId of rolesToAdd) {
      const role = interaction.guild.roles.cache.get(rId);
      if (role) await usuario.roles.add(role).catch(() => {});
    }
    const extrasMsg = rolInfo.extra.length
      ? ` (+ ${rolInfo.extra.map(id => interaction.guild.roles.cache.get(id)?.name || id).join(', ')})`
      : '';
    await interaction.editReply(SUA.mod.rolDado(usuario.user.username, rolInfo.name + extrasMsg));
  } catch { await interaction.editReply(SUA.mod.errorAccion('asignar el rol')); }
}

async function handleQuitarRol(interaction) {
  const usuario = interaction.options.getMember('usuario');
  const rolKey  = interaction.options.getString('rol');
  const rolInfo = STAFF_ROLES[rolKey];
  if (!usuario) return interaction.editReply(SUA.mod.usuarioNoEncontrado);
  try {
    const role = interaction.guild.roles.cache.get(rolInfo.id);
    if (role) await usuario.roles.remove(role);
    await interaction.editReply(SUA.mod.rolQuitado(usuario.user.username, rolInfo.name));
  } catch { await interaction.editReply(SUA.mod.errorAccion('quitar el rol')); }
}

module.exports = { data, execute };
