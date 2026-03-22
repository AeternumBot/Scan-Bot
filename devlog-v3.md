# 🛠️ Devlog — Sua V3
### Aeternum Translations · Proceso de desarrollo

---

## ¿Qué es la V3?

La V3 es la expansión más grande del bot hasta ahora. Mientras la V2 se enfocaba en anuncios, proyectos y el agente conversacional básico, la V3 añade toda la infraestructura interna del scan: tareas, ausencias, tickets de error, reclutamiento, alertas automáticas y notificaciones de deploy.

---

## 📦 Qué se añadió en la V3

### Nuevos sistemas

**Sistema de tareas**
Los moderadores pueden asignar labores específicas a miembros del staff (traducción, clean, typeo, etc.) por proyecto y capítulo. Sua envía recordatorios automáticos cada 2 días al canal de tareas hasta que la tarea sea completada. Cualquier miembro puede completar sus propias tareas; los mods pueden completar las de cualquiera.

**Sistema de ausencias**
El staff puede registrar ausencias temporales con motivo y fecha de retorno. Sua publica en el canal de ausencias y notifica en registros cuando una ausencia vence sin haber sido cancelada. Los mods pueden registrar ausencias de otros miembros.

**Sistema de tickets de error**
Los lectores pueden reportar errores en capítulos directamente desde el servidor de lectores. Sua crea un canal temporal en el servidor de staff visible solo para moderadores, notifica con un embed detallado y al cerrar el ticket envía un DM al lector con la resolución. El canal se elimina automáticamente.

**Sistema de reclutamiento**
Los candidatos se postulan mencionando a Sua en el canal de reclutamiento. Sua los guía conversacionalmente recopilando rol de interés, experiencia, disponibilidad y motivación. Al terminar, crea un canal privado en el servidor de lectores para el candidato y envía el resumen al canal de avisos de reclutamiento del staff con dos botones interactivos: uno para confirmar que alguien ya lo leyó y otro para cancelar la postulación.

**Scheduler automático**
Cron jobs que corren en segundo plano:
- Cada 6 horas: revisa tareas activas y envía recordatorios a quien lleve más de 2 días sin completarlas
- Cada hora: revisa ausencias vencidas y notifica al staff
- Cada día a las 9am: alerta de capítulos estancados por proyecto (configurable en días)

**Webhook de deploy**
Un servidor HTTP mínimo que recibe notificaciones de GitHub Actions cada vez que hay un push a la rama `main`. Sua publica en el canal de registros con un mensaje de personalidad dependiendo de si el deploy fue exitoso o falló.

### Nuevos archivos

| Archivo | Ruta |
|---|---|
| `storage.js` | `src/utils/storage.js` (expandido) |
| `config.js` | `config/config.js` (expandido) |
| `scheduler.js` | `src/services/scheduler.js` |
| `webhookServer.js` | `src/services/webhookServer.js` |
| `tarea.js` | `src/commands/tarea.js` |
| `ausencia.js` | `src/commands/ausencia.js` |
| `ticket.js` | `src/commands/ticket.js` |
| `reclutar.js` | `src/commands/reclutar.js` |
| `configurar.js` | `src/commands/configurar.js` (actualizado) |
| `ready.js` | `src/events/ready.js` (actualizado) |
| `interactionCreate.js` | `src/events/interactionCreate.js` (actualizado) |
| `deploy-commands.js` | `src/deploy-commands.js` (actualizado) |
| `suaAgent.js` | `src/events/suaAgent.js` (expandido) |

### Nuevas variables de entorno

```
TASKS_CHANNEL_ID=          # Canal de tareas y alertas (staff)
RECORDS_CHANNEL_ID=        # Canal de registros generales (staff)
ABSENCES_CHANNEL_ID=       # Canal de ausencias (staff)
RECRUIT_ALERTS_CHANNEL_ID= # Canal de avisos de reclutamiento (staff)
RECRUIT_CHANNEL_READER_ID= # Canal donde los lectores se postulan
TICKET_CHANNEL_READER_ID=  # Canal donde los lectores reportan errores
MOD_ROLE_ID=               # ID del rol de moderador
WEBHOOK_PORT=3000
WEBHOOK_SECRET=            # Contraseña para el webhook de GitHub
```

### Nuevas intenciones en el agente

Se añadieron 13 nuevas intenciones al agente conversacional:
`tarea.asignar`, `tarea.completar`, `tarea.lista`, `ausencia.pedir`, `ausencia.registrar`, `ausencia.cancelar`, `ausencia.lista`, `ticket.abrir`, `ticket.cerrar`, `ticket.lista`, `reclutar.postular`, `reclutar.cerrar`, `reclutar.lista`

---

## 🤖 Expansión del agente conversacional (sesión de refactoring)

Esta sección documenta el trabajo de refactoring profundo hecho sobre `suaAgent.js` y `suaMention.js` en una sesión separada al desarrollo V3 principal, enfocada exclusivamente en el agente.

### Qué se construyó

El agente pasó de ser un sistema de intenciones básico a un **agente conversacional autónomo completo**. Los cambios principales:

**Arquitectura de sesiones**
Cada usuario tiene su propio estado de conversación en memoria (`Map<userId, session>`) con TTL de 5 minutos. Si dos personas le hablan a Sua al mismo tiempo, sus sesiones son completamente independientes y no se mezclan.

**`detectIntent` con lenguaje natural**
La función de detección de intenciones se reescribió para aceptar frases conversacionales reales en vez de comandos exactos. Se añadió una función `normalize()` que quita tildes, signos de puntuación y menciones antes de evaluar los regex, lo que elimina falsos negativos por acentos o puntuación.

**Detección dinámica por nombre de proyecto**
Se añadió un bloque al final de `detectIntent` que recorre los proyectos registrados en tiempo real. Si el mensaje menciona el nombre de un proyecto conocido (`La Joven Rebelde`, `Solo Leveling`, etc.) combinado con un verbo de acción, infiere la intención sin que el usuario diga la palabra "proyecto". Funciona para status, info, toggle, remove, anunciar y setstatus.

**`extractFromMessage` mejorado**
La función de extracción de datos del mensaje inicial ahora también busca proyectos por nombre/ID en la lista registrada, extrae estados de proyecto del texto (`hiatus`, `completado`, etc.) y acepta formatos más amplios de razón (`por`, `porque`, `ya que`, `motivo`).

**Flujos completos de anunciar y avisar**
Los flujos `flowAnunciar` y `flowAvisar` se reescribieron para cubrir exactamente los mismos campos que los slash commands originales, con una función `continueAnunciar`/`continueAvisar` que avanza al siguiente campo faltante sin repetir los que ya se obtuvieron. Anunciar tiene 10 pasos (proyecto, capítulo, mensaje, portada, fuente, link TMO, 4 campos de créditos); avisar tiene 5 (título, cuerpo, ping, firma, imagen). En ambos, el usuario puede escribir `no` o `saltar` en cualquier campo opcional.

**Flujo completo de configurar**
Se añadió `flowConfigurar` que cubre los 6 subcomandos de `/configurar`: canal, reacciones, rol, avisos, verificar e info. Si el usuario dice `@Sua configura` sin más contexto, Sua muestra el menú. Si ya dice qué configurar en el mismo mensaje (`@Sua configura el canal`), salta directamente a ese sub-flujo.

**`/salud` con diagnóstico completo en embed**
El diagnóstico pasó de 3 checks en texto plano a un embed con 7 secciones, color dinámico (🟢/🟡/🔴 según severidad) y conteo de errores vs warnings. Revisa: latencia Discord con 3 niveles, RAM usada/total, uptime, versión de Node, variables de entorno obligatorias vs opcionales por nombre, conexión con Drive y conteo de carpetas visibles, proyectos con problemas de configuración (sin canal, sin fuentes, sin carpeta Drive, sin portada), scrapers de TMO y Colorcito probados en vivo mostrando el último capítulo detectado, y canales de anuncios/avisos configurados.

**Personalidad especial para Valk**
Se añadió detección del ID de Valk (`VALK_USER_ID` en `.env`). Cuando Valk da un comando, Sua lo saluda antes de ejecutar con 8 frases rotativas. Si alguien intenta banear, expulsar o quitarle roles a Valk, Sua se niega con respuestas propias y rotativas en cada caso.

**Caché de proyectos**
`detectIntent` y `extractFromMessage` llamaban `Projects.list()` (lectura de JSON en disco) en cada mensaje. Se añadió una caché en memoria con TTL de 30 segundos que se invalida automáticamente cuando se agrega o elimina un proyecto, garantizando consistencia sin hits de disco innecesarios.

---

## 🐛 Bugs encontrados y solucionados

### Bug 1 — Los intents V3 del agente quedaron dentro de `detectIntent` en vez del router

**Qué pasó:** Al integrar los nuevos flujos en `suaAgent.js` mediante un script de Python, los `if (intent === ...)` que pertenecían al router principal (`routeIntent`) quedaron pegados dentro de la función `detectIntent`. El resultado era que el agente detectaba correctamente la intención pero nunca ejecutaba el flujo correspondiente — simplemente no respondía.

**Cómo se detectó:** Prueba directa. Al decirle a Sua "quiero unirme al equipo", simplemente no hacía nada.

**Solución:** Reescritura limpia del archivo usando `str_replace` directamente sobre el JS en vez de procesamiento con Python. Los intents quedaron en `detectIntent` como `return 'reclutar.postular'` y los flujos en `routeIntent` como `if (intent === 'reclutar.postular') return flowReclutarPostular(...)`.

**Moraleja:** Los scripts de transformación de texto son una mala idea para código. Una edición quirúrgica directa es más segura.

---

### Bug 2 — El reclutamiento respondía desde cualquier canal

**Qué pasó:** La verificación de canal `if (message.channelId !== canalRecluId)` estaba dentro del bloque `if (step === 'start')`. Esto significa que solo se chequeaba en el primer mensaje — si el candidato empezaba en el canal correcto pero luego respondía las preguntas del agente desde otro canal (o si la sesión se mezclaba), el flujo continuaba sin restricción.

**Solución:** Mover el check al inicio de la función `flowReclutarPostular`, antes de cualquier `if (step === ...)`. Así aplica en absolutamente todos los pasos, incluyendo sesiones activas. Si el canal no coincide, la sesión se cancela limpiamente.

---

### Bug 3 — El canal de reclutamiento temporal se creaba en el servidor de staff en vez del de lectores

**Qué pasó:** Error de lógica en el diseño original. `execReclutarPostular` usaba `DISCORD_GUILD_ID` (servidor de staff) para crear el canal temporal del candidato. Lo correcto es crearlo en `DISCORD_READER_GUILD_ID` (servidor de lectores) para que el candidato pueda verlo.

**Solución:** Cambiar la variable a `DISCORD_READER_GUILD_ID` en la creación del canal, y ajustar los permisos para que el candidato (por ID de usuario) pueda ver y escribir en su propio canal, en vez de los moderadores del staff.

---

### Bug 4 — El resumen de postulación nunca llegaba al canal de staff (Unknown Channel)

**Qué pasó:** Este fue el bug más persistente. Después de crear el canal del candidato, el código hacía `message.client.channels.fetch(tasksChannelId)` para enviar el resumen al staff. El problema es que cuando el mensaje viene del servidor de **lectores**, el bot no tiene cacheados los canales del servidor de **staff** en ese contexto. Discord devolvía "Unknown Channel" y el `catch { /* no crítico */ }` lo tragaba silenciosamente sin dejar rastro visible.

**Cómo se detectó:** Solo gracias a los logs de Railway. El error `[Reclutamiento] Error enviando resumen al canal de tareas: Unknown Channel` apareció una vez que se reemplazó el `catch` silencioso por un `console.error`.

**Solución:** Nunca usar `client.channels.fetch(id)` para canales de otro servidor. Siempre buscar primero el guild y luego el canal dentro de él:
```js
const staffGuild = await message.client.guilds.fetch(staffGuildId);
const canal = await staffGuild.channels.fetch(canalId);
```
Esto funciona independientemente de desde qué servidor llegue el mensaje.

**Moraleja:** Los `catch` silenciosos (`catch { /* no crítico */ }`) son una trampa. Ocultan errores reales que parecen "no críticos" hasta que resultan ser el problema principal. Siempre loguear al menos con `console.error`.

---

### Bug 5 — El resumen de postulaciones se mandaba al canal de tareas generales

**Qué pasó:** El `.env` tenía `TASKS_CHANNEL_ID=1484029444757651458` pero el canal de avisos de reclutamiento creado después era `1484054787396993060`. El resumen de postulaciones se mandaba al canal de tareas generales en vez del canal específico de reclutamiento. Como el canal de tareas tampoco tenía permisos correctos para el bot en ese momento, doblemente fallaba.

**Solución:** Crear variable separada `RECRUIT_ALERTS_CHANNEL_ID` para el canal específico de avisos de reclutamiento. El código usa esa variable primero y cae al `TASKS_CHANNEL_ID` solo si no está configurada.

---

### Bug 6 — `tickets` y `reclutamiento` compartían la misma variable de entorno

**Qué pasó:** En `configurar.js`, tanto el subcomando `tickets` como `reclutamiento` apuntaban a `RECRUIT_CHANNEL_READER_ID`. Configurar uno pisaba al otro.

**Solución:** `tickets` ahora usa `TICKET_CHANNEL_READER_ID` y `reclutamiento` mantiene `RECRUIT_CHANNEL_READER_ID`. Son canales distintos para funciones distintas.

---

### Bug 7 — Los cambios de canal en `/configurar` no persistían

**Qué pasó:** Todos los handlers de `configurar.js` hacían `process.env.X = valor` que solo vive en memoria mientras el proceso está corriendo. Al reiniciar el bot (por un deploy o un crash), todos los cambios de canal se perdían.

**Solución:** Agregar lógica que intenta escribir directamente en el archivo `.env` usando `fs.readFileSync`/`writeFileSync`. Si el archivo existe y es escribible (local), el cambio persiste. Si no (Railway sin acceso al archivo), le avisa al usuario el valor exacto para que lo copie en las variables de entorno manualmente.

---

### Bug 8 — Las fechas de ausencia se calculaban mal

**Qué pasó:** `parseDateV3` asumía siempre formato `DD/MM/AAAA`. Al escribir `04/18/2026` (formato americano `MM/DD/AAAA`), interpretaba el 04 como día y el 18 como mes — lo cual es inválido, así que buscaba la "fecha más cercana" de forma inesperada y devolvía junio de 2027.

**Solución:** Reescribir `parseDateV3` para detectar automáticamente el formato:
- Si el primer número es mayor que 12, definitivamente es el día (`DD/MM`)
- Si el segundo número es mayor que 12, definitivamente es el día (`MM/DD`)
- Si ambos podrían ser válidos, elige la fecha futura más cercana al presente

---

### Bug 9 — Respuestas de tareas sin contexto de quién habla

**Qué pasó:** Cuando un mod completaba la tarea de otro, Sua respondía "¡Bien hecho! Ya no recibirás recordatorios" — como si el mod fuera quien la hizo. Y cuando el asignado la completaba, la respuesta era igualmente genérica.

**Solución:** Agregar `const esAsignado = tarea.asignadoId === message.author.id` y `const esMod = hasModRole(message.member)` y diferenciar las respuestas:
- El asignado recibe: *"¡Anotado! La traducción queda registrada como terminada"*
- El mod recibe: *"Listo, la tarea de [nombre] queda como lista"*

---

### Bug 10 — Los IDs de tareas aparecían en las respuestas con formato feo

**Qué pasó:** Las respuestas del agente y del comando `/tarea` incluían el ID interno (`task_1773895054795`) visible para el usuario. Además el prefijo "task_" en vez de "tarea_" rompía la personalidad en español del bot.

**Solución:** Eliminar los IDs de todas las respuestas visibles. Los IDs siguen existiendo internamente en el JSON para que el sistema funcione, pero el usuario nunca los ve en respuestas normales. Solo aparecen en el `/tarea lista` para que los mods puedan referenciarlos si es necesario.

---

### Bug 11 — MOD_ROLE_ID faltaba en el `.env`

**Qué pasó:** El rol de moderador estaba hardcodeado en el código como valor por defecto (`process.env.MOD_ROLE_ID || '1368818622750789633'`). El `.env` no tenía la variable explícita, lo que podía causar comportamientos inesperados si el ID cambiaba o si el fallback no cargaba correctamente en Railway.

**Solución:** Agregar `MOD_ROLE_ID=1368818622750789633` explícitamente en las variables de entorno de Railway.

---

### Bug 12 — Los tickets respondían desde cualquier canal

**Qué pasó:** `flowTicketAbrir` no tenía ningún check de canal. A diferencia del reclutamiento que sí lo tenía, los tickets se podían abrir mencionando a Sua desde cualquier canal del servidor de lectores, lo cual podía llenar de canales temporales el servidor de staff por accidente.

**Solución:** Agregar el mismo check al inicio de `flowTicketAbrir` usando `TICKET_CHANNEL_READER_ID`, igual que se hizo para reclutamiento — antes de cualquier `if (step === ...)` para que aplique en todos los pasos incluyendo sesiones activas.

---

### Bug 13 — `TICKET_CHANNEL_READER_ID` apuntaba al canal de pruebas

**Qué pasó:** Error de distracción. Durante las pruebas se había creado un canal temporal y su ID (`1484013542033199196`) quedó guardado en el `.env` como el canal oficial de tickets. El canal real donde los lectores deben reportar errores es `1328530679021178940`. Como el check del bug anterior usaba esta variable, el bot rechazaba reportes del canal correcto y los aceptaba del equivocado.

**Solución:** Actualizar `TICKET_CHANNEL_READER_ID=1328530679021178940` en el `.env` y en las variables de Railway.

---

### Bug 14 — Confusión con el ID de `RECRUIT_CHANNEL_READER_ID`

**Qué pasó:** Error de distracción similar al anterior. Durante las pruebas del sistema de reclutamiento se usó un canal temporal distinto al oficial, y en algún momento no quedó claro cuál de los dos IDs era el correcto. El canal oficial de postulaciones en el servidor de lectores es `1328526998603304960`.

**Solución:** Confirmar y fijar el ID correcto en el `.env` y en Railway. Se documentó además que **los cambios hechos con `/configurar reclutamiento` en Discord solo viven en memoria** — Railway no tiene un archivo `.env` en disco, así que cualquier cambio de canal hecho por comando se pierde al próximo reinicio. Los IDs definitivos siempre deben estar en el panel de variables de Railway directamente.

---

### Bugs del refactoring del agente

---

### Bug A — `suaAgent` y `suaMention` respondían al mismo mensaje (doble respuesta)

**Qué pasó:** Ambos archivos escuchan el evento `messageCreate`. Cuando el agente procesaba una mención con intención reconocida, `suaMention` también la procesaba en paralelo y respondía con sus frases de personalidad. El resultado era dos respuestas al mismo mensaje: una del agente ejecutando la acción y otra de suaMention respondiendo como si fuera conversación.

**Cómo se detectó:** En prueba directa. Al decir `@Sua banea a @Juan`, Sua pedía confirmación del baneo y al mismo tiempo respondía "H-huy... no sé qué responderte".

**Solución:** Sistema `markHandled(messageId)` — un `Set` con TTL de 10 segundos. Cuando el agente va a responder, marca el ID del mensaje. `suaMention` chequea esa marca al inicio de su `execute` y sale inmediatamente si el agente ya lo tomó. La marca se hace **antes de cualquier `await`** para que el bloqueo sea efectivo incluso si el agente tarda varios segundos procesando.

---

### Bug B — `wasHandled` se perdía por sobreescritura de `module.exports`

**Qué pasó:** En `suaAgent.js`, `wasHandled` se exportaba con `module.exports.wasHandled = wasHandled` en la línea ~1194. Pero 50 líneas más abajo, `module.exports = { name: Events.MessageCreate, execute }` **sobreescribía el objeto completo**, borrando `wasHandled`. Resultado: `suaMention` llamaba `suaAgent.wasHandled()` y obtenía `undefined` — lo que causaba un crash silencioso en cada mención.

**Solución:** Mover `wasHandled` directamente al `module.exports` final:
```js
module.exports = {
  wasHandled,
  name: Events.MessageCreate,
  async execute(message) { ... }
};
```

---

### Bug C — `suaMention` usaba `suaAgent` sin importarlo

**Qué pasó:** `suaMention.js` tenía la línea `if (suaAgent.wasHandled(message.id)) return;` en la línea 779, pero nunca había un `require('./suaAgent')` al inicio del archivo. `suaAgent` era `undefined`, así que la línea crasheaba con `TypeError: Cannot read properties of undefined` en cada mención, haciendo que `suaMention` no respondiera a nada.

**Solución:** Agregar `const suaAgent = require('./suaAgent');` al inicio de `suaMention.js` junto a los demás requires.

---

### Bug D — `flowStatus` crasheaba con require inválido

**Qué pasó:** `execStatus` en el agente tenía `const statusCmd = require('./status')` — un path que no existe desde `src/events/`. Además usaba `require('../utils/storage').LastChapters` dentro de la función en vez del `LastChapters` ya importado en el top-level del módulo. Cualquier llamada a status tiraba el error genérico.

**Solución:** Reescritura completa de `execStatus` eliminando los requires internos y usando los imports del scope del módulo. Se aprovechó para mejorar el embed de status incluyendo datos de Drive cuando están disponibles.

---

### Bug E — "estatus" no reconocido como intent de status

**Qué pasó:** El regex de detección de status solo tenía `\bstatus\b` (la palabra en inglés). Al decir `@Sua revisa el estatus del proyecto X` (con la variante en español), el regex no hacía match y el agente caía al flujo de "no entiendo".

**Solución:** Agregar `\bestatus\b` al regex y ampliar las variantes: `revisa(r)?.{0,8}(el )?(estado|estatus|progreso|avance)`. Verificado con pruebas unitarias inline de todos los casos de uso.

---

### Bug F — `respuestaValk` retornaba `null` en el default

**Qué pasó:** Cuando Valk decía algo que `respuestaValk()` no reconocía (saludos conocidos, afecto, groserías, etc.), la función retornaba `null`. El código del evento entonces caía al flujo normal de `suaMention`, que eventualmente llegaba al `noEntiendeReply` genérico — el que dice "S-noto que me estás preguntando muchas cosas que no sé... Avísale a Valk". El resultado era que el bot le decía a Valk que le avisara a Valk sobre algo que Valk no le había enseñado.

**Solución:** Reemplazar el `return null` default con 8 respuestas propias de Sua hacia Valk cuando no entiende, con el tono correcto de hablarle a su creador — reclamándole, pidiéndole más contexto, o diciéndole que lo programó incompleto.

---

### Bug G — Typing e `markHandled` llegaban tarde

**Qué pasó:** El indicador de escritura de Discord (`sendTyping`) y el `markHandled` se llamaban después de que `routeIntent` terminaba. Si el flujo tardaba varios segundos (por ejemplo, buscando URLs en scrapers), durante ese tiempo Discord no mostraba ningún indicador y `suaMention` podía dispararse igualmente porque el mark aún no estaba activo.

**Solución:** Mover ambas llamadas al inicio del handler, **antes de cualquier `await`**, inmediatamente después de detectar la intención. El typing aparece instantáneo y el message queda marcado antes de que empiece cualquier procesamiento asíncrono.

---

### Bug H — Regex de URLs en `proyecto add` no detectaba `lectortmo.com`

**Qué pasó:** El regex en `awaitUrls` buscaba `tumangaonline` como dominio de TMO, pero el dominio real que usa el bot es `lectortmo.com` (y `zonatmo.com` como alternativa). Al pegar un link de `https://lectortmo.com/...`, el regex no hacía match, y Sua respondía "Necesito al menos una URL" en bucle sin importar cuántas veces se pegara el link correcto.

**Solución:** Ampliar el regex para cubrir todos los dominios conocidos de TMO (`lectortmo`, `zonatmo`, `tumangaonline`) y de Colorcito (`colorcito`, `colorcitoscan`). Se añadió también limpieza de caracteres trailing que Discord a veces pega al final de URLs embebidas (`)`, `.`, `>`). El mismo fix se aplicó a `extractFromMessage` para que si el usuario pega la URL en el mismo mensaje donde pide agregar el proyecto, ya quede extraída sin necesitar el paso `awaitUrls`.

---

### Bug I — El agente respondía a mensajes con `@everyone`

**Qué pasó:** Cuando alguien publicaba un anuncio con `@everyone`, Discord marca internamente al bot como mencionado. `message.mentions.has(clientId)` devolvía `true`, el agente procesaba el mensaje como si fuera una mención directa a Sua y respondía. Esto hacía que Sua interrumpiera anuncios publicados manualmente.

**Solución:** Dos cambios de una línea:
```js
if (message.mentions.everyone) return; // salir si es @everyone o @here
const isMentioned = message.mentions.has(clientId, { ignoreEveryone: true }); // no contar everyone como mención directa
```
El flag `ignoreEveryone: true` es el mismo que ya usaba `suaMention.js` — simplemente faltaba aplicarlo en el agente.

---

## 📝 Errores de distracción (sin comentarios)

- `TASKS_CHANNEL_ID` configurado con el ID incorrecto en el `.env` — el canal existía pero no era el que debía ser.
- El canal de avisos de reclutamiento se creó después de configurar la variable, por lo que apuntaba al anterior.
- Se intentó configurar el webhook de deploy por Railway cuando Railway no expone esa interfaz visualmente en todos los planes — se optó por GitHub Actions en su lugar.

---

## 🏗️ Decisiones de diseño

**¿Por qué el canal temporal de reclutamiento en el servidor de lectores y no en el de staff?**
El candidato necesita poder comunicarse con el staff directamente. Si el canal estuviera en el servidor de staff, el candidato no tendría acceso salvo que ya fuera miembro. En el servidor de lectores puede ver su propio canal desde el momento en que se crea.

**¿Por qué botones en vez de respuesta por texto para el reclutamiento?**
El flujo de confirmación con botones es más claro que pedirle al moderador que vuelva a mencionar a Sua para confirmar. Un clic es suficiente y el estado queda registrado visualmente en el mensaje.

**¿Por qué `RECRUIT_ALERTS_CHANNEL_ID` separado de `TASKS_CHANNEL_ID`?**
Las tareas del staff (traducción, clean, typeo) y las postulaciones de candidatos son audiencias distintas. Un moderador que gestiona tareas no necesariamente gestiona reclutamiento y viceversa. Separarlos permite que cada canal tenga el acceso correcto.

**¿Por qué el catch silencioso fue un problema tan grande?**
Porque creaba la ilusión de que el código llegaba al punto correcto sin errores. El flujo de reclutamiento completaba todas las etapas, creaba el canal del candidato y respondía al usuario — solo el envío al staff fallaba silenciosamente. Sin el log, parecía un bug de configuración cuando en realidad era un bug de acceso a canales entre servidores.

**¿Por qué caché de proyectos en el agente?**
`detectIntent` y `extractFromMessage` se ejecutan en cada mensaje que llega al bot, incluyendo mensajes donde Sua no responde. Leer el JSON de proyectos desde disco en cada evento era un hit de I/O innecesario. Con una caché de 30 segundos que se invalida al agregar o eliminar proyectos, el costo de lectura baja a prácticamente cero en uso normal.

**¿Por qué `markHandled` antes del `await` y no después?**
JavaScript es single-threaded pero los `await` ceden el control del event loop. Si `markHandled` se llamaba después del `await routeIntent(...)`, durante el tiempo que ese await tardaba (potencialmente 8-10 segundos en `/salud` con scrapers), el event loop podía procesar el evento `messageCreate` de `suaMention` y disparar la doble respuesta. Al marcar antes del primer `await`, el bloqueo es instantáneo.

---

## 📌 Estado final de la V3

| Sistema | Estado |
|---|---|
| Tareas | ✅ Funcionando |
| Ausencias | ✅ Funcionando |
| Tickets de error | ✅ Funcionando |
| Reclutamiento | ✅ Funcionando |
| Scheduler automático | ✅ Funcionando |
| Webhook de deploy | ✅ Funcionando (vía GitHub Actions) |
| Intents del agente V3 | ✅ Integrados |
| Canales separados por función | ✅ Configurado |
| Agente conversacional completo | ✅ Refactorizado |
| Detección de lenguaje natural | ✅ Regex conversacionales |
| Detección por nombre de proyecto | ✅ Dinámica con caché |
| Flujos anunciar/avisar completos | ✅ Todos los campos |
| Flujo configurar completo | ✅ 6 subcomandos |
| Diagnóstico `/salud` con embed | ✅ 7 secciones |
| Personalidad especial Valk | ✅ Ban/kick/rol protegidos |
| Doble respuesta agent+mention | ✅ Resuelto con markHandled |
| URLs de TMO en proyecto add   | ✅ Regex corregido (lectortmo/zonatmo) |
| Respuesta a @everyone         | ✅ Guard mentions.everyone |
