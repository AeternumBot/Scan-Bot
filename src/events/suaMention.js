// src/events/suaMention.js
// Sua responde cuando la mencionan directamente

const { Events } = require('discord.js');
const axios = require('axios');
const { K } = require('../utils/sua');

// Horario Colombia (UTC-5)
function getHourColombia() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).getHours();
}

function getDayColombia() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).getDay();
}

// Estado de ánimo: aleatorio por día + modificado por hora
let _lastMoodDay = -1;
let _dailyMood = 'normal';

function getDailyMood() {
  const day = getDayColombia();
  if (day !== _lastMoodDay) {
    _lastMoodDay = day;
    const moods = ['feliz', 'feliz', 'normal', 'normal', 'normal', 'triste', 'energica'];
    _dailyMood = moods[Math.floor(Math.random() * moods.length)];
  }
  return _dailyMood;
}

function getMood() {
  const hour = getHourColombia();
  const daily = getDailyMood();
  if (hour >= 0 && hour < 6)   return 'adormilada';
  if (hour >= 6 && hour < 9)   return 'recienDespertada';
  if (hour >= 22)              return 'cansada';
  return daily;
}

async function getClima() {
  try {
    const res = await axios.get(
      'https://wttr.in/Bogota?format=%t+%C',
      { timeout: 4000, headers: { 'User-Agent': 'curl/7.0' } }
    );
    return res.data.trim(); // ej: "+18°C Partly cloudy"
  } catch {
    return null;
  }
}

function climaMsg(climaStr) {
  if (!climaStr) return null;
  const temp = parseInt(climaStr);
  if (isNaN(temp)) return null;
  if (temp <= 14) return `Hace bastante frío hoy en Bogotá... ${temp}°C (っ˘ω˘ς) Me dan ganas de quedarme quieta.`;
  if (temp <= 18) return `Hoy está fresco en Bogotá, ${temp}°C ${K.tranqui()} No está mal.`;
  if (temp <= 22) return `El clima está agradable hoy, ${temp}°C ${K.feliz()}`;
  return `Hace calor hoy... ${temp}°C (〃>_<;〃) ¡Qué pesado!`;
}

const RESPUESTAS = {
  adormilada: [
    `...mm? ¿Me llamaron...? ${K.dormir()} Es muy de noche... ¿está pasando algo importante?`,
    `...a-ah... estaba durmiendo un poco ${K.dormir()} ¿Necesitan algo urgente?`,
    `Zzz... eh? ${K.dormir()} ...perdonennn, ¿qué pasó?`,
  ],
  recienDespertada: [
    `Buenos días... todavía estoy despertando ${K.tranqui()} ¿En qué puedo ayudar?`,
    `A-ah, ya llegaron ${K.tranqui()} Buenos días... ¿todo bien?`,
    `Buenos días... me alegra verlos por aquí ${K.tranqui()}`,
  ],
  feliz: [
    `¡Hola! Me alegra que me llamaran ${K.feliz()} ¿En qué puedo ayudar?`,
    `¡Aquí estoy! Hoy me siento con mucha energía ${K.feliz()} ¿Necesitan algo?`,
    `¡Oh! Me llamaron ${K.feliz()} ¿Cómo están? ¿Pasa algo?`,
  ],
  energica: [
    `¡Aquí estoy! ${K.feliz()} ¿Qué necesitan?`,
    `¡Sí! Me llamaron ${K.feliz()} ¡Estoy lista para lo que sea!`,
  ],
  normal: [
    `Hola ${K.feliz()} ¿En qué puedo ayudarles?`,
    `Aquí estoy (っ˘ω˘ς) ¿Necesitan algo?`,
    `¿Me llamaron? ${K.feliz()} ¿Qué necesitan?`,
  ],
  triste: [
    `...hola ${K.tranqui()} Hoy estoy un poco bajita de ánimo, pero aquí estoy. ¿En qué puedo ayudar?`,
    `Ah... me llamaron ${K.disculpa()} Estoy bien, no se preocupen. ¿Necesitan algo?`,
    `Hola... ${K.tranqui()} Hoy no estoy del todo bien, pero cuenten conmigo. ¿Pasa algo?`,
  ],
  cansada: [
    `Hola... ha sido un día largo ${K.tranqui()} Pero aquí estoy. ¿En qué puedo ayudar?`,
    `Estoy un poco cansada ya... ${K.tranqui()} ¿Qué necesitan?`,
  ],
};

function getRespuesta(mood) {
  const opciones = RESPUESTAS[mood] || RESPUESTAS.normal;
  return opciones[Math.floor(Math.random() * opciones.length)];
}

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.mentions.has(message.client.user)) return;

    const mood = getMood();
    let respuesta = getRespuesta(mood);

    // Agregar clima si no está adormilada/recién despertada
    if (!['adormilada', 'recienDespertada'].includes(mood)) {
      const clima = await getClima();
      const climaTxt = climaMsg(clima);
      if (climaTxt) respuesta += `\n\n*${climaTxt}*`;
    }

    await message.reply(respuesta);
  },
};
