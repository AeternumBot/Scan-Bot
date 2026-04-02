# 📖 Manual de uso — Sua
### Bot de Aeternum Translations

---

## ¿Qué es Sua?

Sua es la asistente del scan. Tiene dos formas de recibir órdenes:

- **Comandos slash** — escribes `/comando` y Discord te muestra las opciones. Más preciso y recomendado para cosas complejas.
- **Agente conversacional** — mencionas a Sua (`@Sua`) y le dices qué quieres en lenguaje natural. Más cómodo para cosas rápidas.

> ⚠️ **Importante:** Para cancelar cualquier conversación con el agente en medio de un flujo, escribe simplemente `cancelar` o `stop`.

---

## 🗺️ ¿En qué servidor funciona cada cosa?

| Comando | Staff | Lectores |
|---|:---:|:---:|
| `/proyecto` | ✅ | ❌ |
| `/status` | ✅ | ❌ |
| `/moderar` | ✅ | ❌ |
| `/tarea` | ✅ | ❌ |
| `/ausencia` | ✅ | ❌ |
| `/raws` | ✅ | ❌ |
| `/setupsistemas` | ✅ | ✅ |
| `/configurar` | ✅ | ✅ |
| `/buscar` | ✅ | ❌ |
| `/salud` | ✅ | ❌ |
| `/debug` | ✅ | ❌ |
| `/anunciar` | ✅ | ✅ |
| `/avisar` | ✅ | ✅ |
| `/rol` | ✅ | ✅ |
| `/ticket` | ✅ | ✅ |
| `/reclutar` | ✅ | ✅ |
| Agente (`@Sua`) | ✅ | ✅ |

---

## 📋 COMANDOS DEL SERVIDOR DE STAFF

---

### `/proyecto` — Gestión de proyectos
Solo admins (permiso Gestionar Servidor).

| Subcomando | Qué hace |
|---|---|
| `add` | Registra un nuevo manga/manhwa en el bot |
| `remove` | Elimina un proyecto |
| `list` | Lista todos los proyectos registrados |
| `info` | Muestra los detalles y estado de Drive de un proyecto |
| `toggle` | Activa o pausa el monitoreo de un proyecto |
| `setstatus` | Cambia el estado: en curso / completado / hiatus / dropeado |

**Uso con slash:**
```
/proyecto add nombre: Solo Leveling drive_folder: Solo Leveling categoria: manhwas tmo_url: https://...
/proyecto list
/proyecto info id: solo-leveling
/proyecto toggle id: solo-leveling
/proyecto setstatus id: solo-leveling estado: hiatus
/proyecto remove id: solo-leveling
```

**Uso con el agente:**
```
@Sua agrega el proyecto Solo Leveling
@Sua elimina el proyecto solo-leveling
@Sua muéstrame los proyectos registrados
@Sua info del proyecto solo-leveling
@Sua pausa el proyecto solo-leveling
@Sua pon solo-leveling en hiatus
```
> ⚠️ El agente irá preguntando los datos que falten uno por uno. Para `/proyecto add` necesita: nombre, carpeta de Drive, categoría y al menos una URL (TMO o Colorcito).

---

### `/raws` — Subida Automática de Raws a Drive
Solo staff autorizado (requiere permisos de Administrador o Moderador).

Recibe los archivos `.zip` de los capítulos sin limpiar y los sube automáticamente a Google Drive en las carpetas correspondientes. Si la carpeta del capítulo no existe, la crea con las 4 carpetas base (`Clean`, `Final`, `Raw`, `Tradu`). Sua extraerá las imágenes del zip y las subirá ordenadamente a la carpeta `Raw`.

**Uso con slash:**
```
/raws                  → (Envías el comando y obligatoriamente adjuntas el archivo .zip en Discord)
```
> ⚠️ Esta función está diseñada principalmente en forma de comando slash directo por eficiencia al adjuntar archivos pesados.

---

### `/setupsistemas` — Paneles Interactivos para Sistemas
Solo Admins (permiso Gestionar Servidor).

Genera los embeds permanentes con botones interactivos para los sistemas de Reclutamiento y Tickets, permitiendo a los lectores iniciar la interacción sin usar comandos ni arrobas directamente.

| Subcomando | Qué hace |
|---|---|
| `tickets` | Envía el panel amarillo con el botón "🎫 Pedir Ticket" |
| `reclutamiento` | Envía el panel azul con el botón "✨ Postularme" |

**Uso con slash:**
```
/setupsistemas tickets        → Usar en el canal destinado a avisos/tickets
/setupsistemas reclutamiento  → Usar en el canal de reclutamiento
```
> ⚠️ Una vez ejecutado, el usuario ya no necesitará interactuar con el comando, podrá tocar los botones que crea este comando.

---

### `/status` — Estado de proyectos en Drive
Visible para todos en staff.

Muestra el progreso de los capítulos en Google Drive: cuántos tienen Clean, Traducción y Final/Typeo. También muestra el último capítulo subido a TMO y Colorcito.

**Uso con slash:**
```
/status                          → estado de todos los proyectos activos
/status proyecto: solo-leveling  → estado detallado de uno
```

**Uso con el agente:**
```
@Sua cómo van los proyectos
@Sua status de solo-leveling
@Sua revisa el estatus de Solo Leveling
@Sua qué tienen en Drive
@Sua en qué van con La Joven Rebelde
```
> 💡 Puedes decir el nombre completo del proyecto directamente — Sua lo reconoce aunque no digas la palabra "proyecto".

---

### `/moderar` — Moderación
Solo moderadores (rol Mod).

| Subcomando | Qué hace |
|---|---|
| `expulsar` | Expulsa a un miembro del servidor |
| `banear` | Banea a un miembro |
| `dar-rol` | Asigna un rol de staff (Traductor, Cleaner, etc.) |
| `quitar-rol` | Quita un rol de staff |

**Uso con slash:**
```
/moderar expulsar usuario: @Juan razon: Inactividad
/moderar banear usuario: @Juan razon: Spam
/moderar dar-rol usuario: @Juan rol: Traductor
/moderar quitar-rol usuario: @Juan rol: Traductor
```

**Uso con el agente:**
```
@Sua banea a @Juan por spam
@Sua expulsa a @Juan
@Sua dale el rol de Traductor a @Juan
@Sua quítale el rol de Cleaner a @Juan
@Sua saca a @Juan del servidor
@Sua borra los últimos 10 mensajes
@Sua vacía el canal
```
> ⚠️ **Sobre el borrado de mensajes (Purga):** Sua puede borrar mensajes por ti si eres moderador. Tiene un límite de **100 mensajes** por comando, y por limitaciones de Discord, **no puede borrar mensajes de más de 14 días** de antigüedad. Si le dices "vacía el chat", te pedirá confirmación explícita para evitar sustos de borrado y luego limpiará el canal de confirmaciones.
> ⚠️ Si intentas moderar a Valk, Sua se negará sin importar quién lo pida.
> ⚠️ Para acciones destructivas (ban/expulsión), Sua siempre pedirá confirmación con **sí** o **no** antes de ejecutar.

---

### `/tarea` — Sistema de tareas
Asignar requiere ser mod. Completar puede hacerlo el asignado o un mod.

| Subcomando | Qué hace |
|---|---|
| `asignar` | Asigna una labor a un miembro del staff |
| `completar` | Marca una tarea como terminada |
| `lista` | Muestra las tareas activas (opcionalmente de un usuario) |
| `eliminar` | Elimina una tarea (solo mods) |

**Uso con slash:**
```
/tarea asignar usuario: @Juan proyecto: solo-leveling capitulo: 45 labor: traducción
/tarea completar id: task_1234567890
/tarea lista
/tarea lista usuario: @Juan
/tarea eliminar id: task_1234567890
```

**Uso con el agente:**
```
@Sua asígnale una tarea a @Juan               → Sua irá preguntando proyecto, capítulo y labor
@Sua dale la traducción del cap 45 a @Juan
@Sua ya terminé la tarea                      → si solo tienes una activa, la completa directo
@Sua ya terminé la traducción del cap 45      → la busca por proyecto/capítulo
@Sua ver tareas activas
@Sua tareas de @Juan
```
> ⚠️ Sua envía recordatorios automáticos cada 2 días al asignado en el canal de tareas hasta que la tarea sea completada.
> ⚠️ Si eres mod y tú la completas, Sua lo distingue y no te dice "¡bien hecho!" como si fueras el que la hizo.

---

### `/ausencia` — Registro de ausencias
Cualquier miembro del staff puede registrar la suya. Los mods pueden registrar la de otros.

| Subcomando | Qué hace |
|---|---|
| `pedir` | Registra tu propia ausencia |
| `registrar` | Registra la ausencia de otro miembro (solo mods) |
| `cancelar` | Cancela una ausencia activa tuya |
| `lista` | Muestra las ausencias activas (solo mods) |

**Uso con slash:**
```
/ausencia pedir razon: Exámenes hasta: 25/04/2026
/ausencia registrar usuario: @Juan razon: Viaje hasta: 01/05/2026
/ausencia cancelar
/ausencia lista
```

**Uso con el agente:**
```
@Sua voy a estar ausente hasta el 25/04/2026 por exámenes
@Sua me voy de viaje, vuelvo el 01/05/2026
@Sua registra la ausencia de @Juan por viaje hasta el 01/05/2026
@Sua ya volví
@Sua estoy de vuelta
@Sua quiénes están ausentes
```
> ⚠️ **Formato de fecha:** Puedes usar `DD/MM/AAAA` (25/04/2026) o `MM/DD/AAAA` (04/25/2026). Sua detecta cuál es cuál automáticamente. La fecha siempre debe ser futura.
> ⚠️ Sua notifica en el canal de registros cuando una ausencia vence y no ha sido cancelada.

---

### `/buscar` — Buscar en TMO y Colorcito

Busca un manga por nombre en las plataformas para obtener la URL antes de agregarlo al bot.

**Uso con slash:**
```
/buscar nombre: Solo Leveling fuente: tmo
/buscar nombre: Tower of God fuente: ambas
```

**Uso con el agente:**
```
@Sua busca Solo Leveling en TMO
@Sua existe Tower of God en Colorcito
@Sua busca Tower of God
```

---

### `/salud` — Diagnóstico del bot

Sua se autodiagnostica y te da un reporte completo en embed con color dinámico (🟢 todo bien / 🟡 advertencias / 🔴 errores).

Revisa: conexión Discord (latencia), uso de RAM, uptime, versión de Node, variables de entorno obligatorias y opcionales, conexión con Google Drive, scrapers de TMO y Colorcito probados en vivo, canales configurados, y estado de cada proyecto (sin canal, sin fuentes, sin Drive, sin portada).

**Uso con slash:**
```
/salud
```

**Uso con el agente:**
```
@Sua cómo estás tú
@Sua diagnóstico
@Sua todo bien contigo
@Sua estás bien
```
> 💡 Sua manda un aviso previo antes de responder porque los scrapers pueden tardar hasta 8 segundos.

---

### `/configurar` — Panel de configuración
Solo admins (permiso Gestionar Servidor).

| Subcomando | Qué hace |
|---|---|
| `canal` | Canal de anuncios (global o por proyecto) |
| `reacciones` | Emojis de reacción de un proyecto |
| `rol` | Rol de ping de un proyecto en el servidor de lectores |
| `avisos` | Canal donde `/avisar` publica los avisos oficiales |
| `verificar` | Fuerza una revisión de capítulos ahora mismo |
| `info` | Muestra toda la configuración actual del bot |

**Uso con slash:**
```
/configurar info
/configurar canal canal: #anuncios
/configurar canal canal: #solo-leveling proyecto: solo-leveling
/configurar reacciones proyecto: solo-leveling emojis: ⚔️ 💀 🔥
/configurar rol proyecto: solo-leveling rol_id: 1234567890
/configurar avisos canal: #noticias
/configurar verificar
```

**Uso con el agente:**
```
@Sua configura                          → Sua muestra el menú con las 6 opciones
@Sua configura el canal de anuncios
@Sua cambia las reacciones de Solo Leveling
@Sua configura el rol de ping de solo-leveling
@Sua configura los avisos
@Sua verifica los capítulos ahora
@Sua muéstrame la configuración actual
```
> ⚠️ Los cambios de canal se guardan en memoria. En Railway, siempre actualiza las variables directamente en el panel para que persistan al reiniciar.

---

## 📢 COMANDOS DE AMBOS SERVIDORES

---

### `/anunciar` — Publicar capítulo manualmente
Requiere rol Anunciador o Mod.

Publica el anuncio de un nuevo capítulo en el canal configurado. Incluye título, número de capítulo, links a TMO/Colorcito, créditos del equipo, portada y reacciones automáticas.

**Uso con slash:**
```
/anunciar proyecto: solo-leveling capitulo: 180
/anunciar proyecto: solo-leveling capitulo: 180 fuente: tmo traductores: 123456,789012 cleaners: 345678
```

**Uso con el agente:**
```
@Sua anuncia el cap 180 de solo-leveling
@Sua publica el capítulo 45 de Solo Leveling
@Sua anuncia
```
> ⚠️ El agente pide todos los datos paso a paso: proyecto, número de cap, mensaje personalizado, portada, fuente, link de TMO, traductores, cleaners, typeos y otros. Di **no** en cualquier campo opcional para saltarlo.

---

### `/avisar` — Comunicado oficial

Publica un aviso formal en el canal de noticias. Desde el servidor de staff va al canal de avisos del staff; desde el servidor de lectores va al canal de avisos de lectores.

**Uso con slash:**
```
/avisar titulo: 📢 Comunicado importante mensaje: Estaremos en hiatus durante 2 semanas... ping: everyone firma: El equipo de Aeternum
/avisar titulo: 🎉 Nuevo proyecto mensaje: ¡Anunciamos nuestro nuevo proyecto! ping: everyone imagen: https://...
```

**Uso con el agente:**
```
@Sua publica un aviso
@Sua manda un comunicado oficial
@Sua haz un anuncio
@Sua avisa
```
> ⚠️ El agente pide todos los datos: título, cuerpo del mensaje, a quién mencionar (everyone/here/no), firma y si quieres imagen. Di **no** para saltarte cualquier campo opcional.

---

### `/rol` — Panel de roles por reacción
Requiere rol Anunciador o Mod.

Gestiona los roles de series en el servidor de lectores. Los lectores reaccionan a un mensaje para recibir notificaciones de sus series favoritas.

| Subcomando | Qué hace |
|---|---|
| `crear` | Crea un rol para una serie y lo vincula al proyecto |
| `mensaje` | Publica o actualiza el panel de roles con reacciones |
| `quitar` | Quita una serie del panel de roles |

**Uso con slash:**
```
/rol crear proyecto: solo-leveling emoji: ⚔️
/rol mensaje
/rol mensaje emoji_todas: 🔔
/rol quitar proyecto: solo-leveling
```

---

### `/ticket` — Reporte de errores en capítulos

Los **lectores** abren tickets interactuando con los botones creados por `/setupsistemas`. Esto inicializa **instantáneamente** un canal privado e invoca al agente Sua directamente. Los comandos slash de esta sección están vivos y pueden ser usados si así se prefiere como un atajo. Al cerrarlo, el lector recibe un DM y el canal se elimina.

| Subcomando | Disponible en | Quién |
|---|---|---|
| `abrir` | Ambos | Cualquiera |
| `cerrar` | Ambos | Solo mods |
| `lista` | Ambos | Solo mods |

**Uso con slash (lectores):**
```
/ticket abrir proyecto: Solo Leveling capitulo: 45 error: mal_subido plataforma: tmo descripcion: Falta la página 12
```

**Uso con slash (mods):**
```
/ticket lista
/ticket cerrar id: ticket_001
```

**Uso con el agente:**
```
@Sua hay un error en el cap 45 de Solo Leveling    → Sua irá preguntando el tipo y plataforma
@Sua el cap 45 no carga en TMO
@Sua las páginas del cap 45 están desordenadas
@Sua cierra el ticket_001
@Sua ver tickets abiertos
```

---

### `/reclutar` — Sistema de postulaciones

Los **lectores** se postulan interactuando con el botón generado por `/setupsistemas` desde su canal. El sistema crea la sesión privada instantáneamente y Sua recopila los datos uno a uno, para después notificar al equipo vía botones. Los comandos manuales Slash están como _fallback_.

| Subcomando | Disponible en | Quién |
|---|---|---|
| `postular` | Lectores (canal específico) | Cualquiera |
| `cerrar` | Ambos | Solo mods |
| `lista` | Ambos | Solo mods |

**Uso con slash (lectores):**
```
/reclutar postular rol: Traductor experiencia: no disponibilidad: 5a10 motivacion: Me encanta Solo Leveling
```

**Uso con slash (mods):**
```
/reclutar lista
/reclutar cerrar id: recruit_1234567890 resultado: aceptado
```

**Uso con el agente (lectores — solo en el canal de reclutamiento):**
```
@Sua quiero unirme al equipo
@Sua me quiero postular
@Sua quiero ser traductor
```
> ⚠️ **Esto solo funciona en el canal de reclutamiento configurado.** Si se hace desde otro canal, Sua lo rechaza y dice cuál es el canal correcto.

**Flujo completo del agente:**
1. Sua pregunta el rol de interés
2. Sua pregunta experiencia previa
3. Sua pregunta disponibilidad semanal
4. Sua pregunta qué motivó al candidato a postularse
5. Sua crea un canal privado en el servidor de lectores para el candidato
6. Sua manda el resumen al canal de avisos de reclutamiento del staff con dos botones:
   - **✅ Leído — me encargo:** marca el resumen como revisado y avisa al candidato en su canal que alguien ya lo vio
   - **❌ Cancelar postulación:** pide confirmación. Si se confirma, DM al candidato y el canal se cierra en 15 segundos

---

## 🤖 CÓMO FUNCIONA EL AGENTE

El agente es el sistema que le permite a Sua entender lenguaje natural y ejecutar acciones reales sin necesidad de comandos slash. Funciona detectando la intención del mensaje, extrayendo los datos que ya se dieron y preguntando paso a paso solo lo que falta.

### Reglas básicas

- Siempre hay que **mencionar a Sua** (`@Sua`) para activar el agente
- Si Sua ya te está haciendo preguntas dentro de un flujo, **no necesitas mencionarla de nuevo** — simplemente responde
- Para cancelar en cualquier momento, escribe `cancelar` o `stop`
- Las sesiones tienen un tiempo límite de **5 minutos** de inactividad. Si no respondes en ese tiempo, la sesión se cierra sola y hay que empezar de nuevo
- Si Sua no entiende una instrucción como comando, la trata como conversación normal (respuestas de personalidad). Si eso pasa, intenta reformular o usa el slash directamente

### Cómo funciona por dentro

Cuando mencionas a Sua, el agente hace tres cosas en orden:

1. **Detecta la intención** — analiza el texto buscando palabras clave y patrones de frases naturales
2. **Extrae los datos del mensaje** — si ya dijiste el proyecto, el usuario mencionado, el número de capítulo, etc., los toma directamente del mensaje sin preguntar de nuevo
3. **Completa lo que falta** — pregunta uno por uno los datos obligatorios que no se pudieron extraer

Esto significa que puedes dar varios datos en el mismo mensaje y Sua los aprovecha todos. Por ejemplo:

```
@Sua banea a @Juan por spam          → Sua ya tiene el target y la razón, solo pide confirmación
@Sua anuncia el cap 12 de Solo Leveling → Sua ya tiene proyecto y capítulo, pregunta lo demás
@Sua configura el canal de anuncios  → Sua ya sabe que es "canal", pregunta directamente cuál
```

### Detección por nombre de proyecto

Una función importante del agente: **reconoce los nombres de los proyectos registrados directamente en el mensaje**, sin que digas la palabra "proyecto". Si dices:

```
@Sua revisa el estatus de La Joven Rebelde
@Sua anuncia Solo Leveling
@Sua cómo va Tower of God
```

Sua busca en la lista de proyectos registrados, encuentra la coincidencia y ejecuta la acción correcta. Esto también funciona con los IDs (`solo-leveling`, `la-joven-rebelde`, etc.).

> 💡 Cuando agregas o eliminas un proyecto, Sua actualiza su lista interna automáticamente — no hace falta reiniciar el bot.

### Confirmaciones para acciones destructivas

Para **banear**, **expulsar** y **eliminar proyectos**, Sua siempre pide confirmación antes de ejecutar. La respuesta debe ser exactamente **sí** o **no**. Cualquier otra cosa se trata como un no y cancela la acción.

### Lo que SÍ entiende bien (frases garantizadas)

| Intención | Ejemplos que funcionan |
|---|---|
| **Agregar proyecto** | `agrega el proyecto`, `registra el proyecto`, `nuevo proyecto`, `añade el proyecto` |
| **Eliminar proyecto** | `elimina el proyecto X`, `borra el proyecto X` |
| **Toggle activo** | `activa el proyecto X`, `pausa el proyecto X`, `desactiva X` |
| **Cambiar estado** | `pon X en hiatus`, `cambia el estado de X`, `X está completado` |
| **Ver info proyecto** | `info del proyecto X`, `detalles de X`, `X` *(solo el nombre)* |
| **Ver todos los proyectos** | `lista los proyectos`, `qué proyectos tienes`, `todos los proyectos` |
| **Ver estado/Drive** | `status`, `estatus`, `cómo van`, `revisa el estatus de X`, `en qué van con X`, `qué tienen en Drive` |
| **Anunciar cap** | `anuncia`, `publica el cap`, `saca el capítulo`, `anuncia el cap X de Y` |
| **Publicar aviso** | `publica un aviso`, `comunicado oficial`, `manda un aviso`, `haz un anuncio`, `avisa` |
| **Banear** | `banea a @X`, `ban a @X`, `banea a @X por Y` |
| **Expulsar** | `expulsa a @X`, `kick a @X`, `echa a @X`, `saca a @X del servidor` |
| **Dar rol** | `dale el rol de X a @Y`, `asígnale el rol de X a @Y`, `ponle X a @Y` |
| **Quitar rol** | `quítale el rol de X a @Y`, `saca el rol de X a @Y` |
| **Purga/Vaciado (Mod)** | `borra 10 mensajes`, `borra los últimos 5`, `limpia el canal`, `vacía el chat` |
| **Asignar tarea** | `asígnale una tarea a @X`, `dale la traducción del cap X a @Y` |
| **Completar tarea** | `ya terminé la tarea`, `marcar tarea como lista` |
| **Ver tareas** | `ver tareas activas`, `tareas pendientes`, `tareas de @X` |
| **Pedir ausencia** | `voy a estar ausente hasta X`, `me voy de viaje`, `ausencia hasta X` |
| **Cancelar ausencia** | `ya volví`, `estoy de vuelta`, `regresé` |
| **Ver ausencias** | `quiénes están ausentes`, `ausencias activas` |
| **Reportar error** | `hay un error en el cap X`, `el cap X no carga`, `páginas desordenadas` |
| **Postularse** | `quiero unirme al equipo`, `me quiero postular`, `quiero ser traductor` |
| **Diagnóstico** | `cómo estás tú`, `diagnóstico`, `todo bien contigo`, `salud` |
| **Buscar** | `busca X en TMO`, `existe X en Colorcito`, `busca X` |
| **Sincronizar** | `sincroniza`, `actualiza caché`, `sync`, `ponme al día` |
| **Configurar** | `configura`, `configuración`, `ajustes`, `settings` |

### Lo que NO entiende bien (usa el slash en cambio)

- Reacciones personalizadas por proyecto → usa `/configurar reacciones`
- Panel de roles con emojis → usa `/rol`
- Agregar proyectos con muchos campos opcionales (portada, tags, créditos) → usa `/proyecto add`
- Cerrar tickets o postulaciones con ID específico → usa el slash directamente

### Personalidad especial de Sua con Valk

Sua tiene comportamientos específicos cuando es Valk quien le habla:

- Al recibir cualquier comando de Valk, Sua lo saluda antes de ejecutar con una frase especial
- Si alguien intenta banear o expulsar a Valk, Sua se niega rotundamente sin importar quién lo pida
- Si alguien intenta quitarle roles a Valk, Sua también lo bloquea
- Si Sua no entiende algo que Valk le dice, le responde en tono diferente — como hablarle a su creador — en vez del mensaje genérico de "no sé responder eso"

### Di "no" para saltarte campos opcionales

En todos los flujos largos (anunciar, avisar, proyecto add), cuando Sua pregunta por campos opcionales puedes responder con cualquiera de estas palabras para saltarlo:

```
no    saltar    skip    ninguno    -
```

---

## ⚠️ ADVERTENCIAS GENERALES

**Sobre los anuncios automáticos**
Los anuncios automáticos están **desactivados** por diseño. El monitor detecta capítulos nuevos pero no los publica solo. Hay que usar `/anunciar` o el agente manualmente para publicar.

**Sobre los cambios de configuración**
Los cambios hechos con `/configurar` se guardan en memoria y se intentan escribir en el `.env`. En Railway, si el `.env` no es accesible, el cambio se pierde al reiniciar el bot. Siempre actualiza las variables directamente en Railway cuando cambies un canal importante.

**Sobre los permisos**
- **Admins** (Gestionar Servidor): `/proyecto`, `/configurar`, pueden completar tareas de otros
- **Mods** (rol Mod): `/moderar`, `/tarea asignar/eliminar`, `/ausencia registrar/lista`, `/ticket cerrar/lista`, `/reclutar cerrar/lista`
- **Anunciador**: `/anunciar`, `/avisar`, `/rol`
- **Cualquier miembro del staff**: `/ausencia pedir`, `/tarea completar` (solo sus propias tareas)
- **Lectores**: `/ticket abrir`, `/reclutar postular` (solo en el canal configurado)

**Sobre los canales temporales**
Los canales de tickets y postulaciones se crean y eliminan automáticamente. No los borres manualmente antes de cerrarlo con el comando o el botón — si lo haces, el registro quedará en un estado inconsistente.

**Sobre Google Drive**
El estado de Drive tiene una caché de 10 minutos. Si acabas de subir algo y no aparece en `/status`, espera un momento o usa `/configurar verificar` para forzar la actualización.

**Sobre el agente y sesiones**
Si el agente está en medio de una conversación contigo y de repente parece no responder bien, es posible que la sesión se haya cortado por inactividad (5 minutos). Simplemente menciona a Sua de nuevo con la instrucción completa para empezar desde cero.

**Sobre la caché de proyectos del agente**
El agente mantiene una caché interna de proyectos que se actualiza cada 30 segundos. Si acabas de agregar o eliminar un proyecto y el agente parece no reconocerlo todavía, espera unos segundos e intenta de nuevo.
