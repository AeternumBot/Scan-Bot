// src/deploy-commands.js
require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const token         = process.env.DISCORD_TOKEN;
const clientId      = process.env.DISCORD_CLIENT_ID;
const staffGuildId  = process.env.DISCORD_GUILD_ID;
const readerGuildId = process.env.DISCORD_READER_GUILD_ID;

if (!token || !clientId || !staffGuildId) {
  console.error('❌ Faltan DISCORD_TOKEN, DISCORD_CLIENT_ID o DISCORD_GUILD_ID en .env');
  process.exit(1);
}

// Comandos que también van al servidor de lectores
const READER_COMMANDS = ['anunciar', 'avisar', 'rol', 'configurar', 'ticket', 'reclutar', 'moderar'];

const allCommands    = [];
const readerCommands = [];

const commandsPath = path.join(__dirname, 'commands');
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of files) {
  const cmd = require(path.join(commandsPath, file));
  if (!cmd.data) continue;
  allCommands.push(cmd.data.toJSON());
  if (READER_COMMANDS.includes(cmd.data.name)) {
    readerCommands.push(cmd.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`\n🔄 Registrando ${allCommands.length} comando(s) en servidor de STAFF (${staffGuildId})...`);
    await rest.put(Routes.applicationGuildCommands(clientId, staffGuildId), { body: allCommands });
    console.log('✅ Staff OK');
    allCommands.forEach(c => console.log(`   /${c.name}`));

    if (readerGuildId && readerCommands.length) {
      console.log(`\n🔄 Registrando ${readerCommands.length} comando(s) en servidor de LECTORES (${readerGuildId})...`);
      await rest.put(Routes.applicationGuildCommands(clientId, readerGuildId), { body: readerCommands });
      console.log('✅ Lectores OK');
      readerCommands.forEach(c => console.log(`   /${c.name}`));
    } else if (!readerGuildId) {
      console.log('\n⚠️  DISCORD_READER_GUILD_ID no configurado, saltando servidor de lectores.');
    }

    console.log('\n✅ Deploy completado.');
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
