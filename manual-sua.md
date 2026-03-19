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
@Sua revisa el progreso de Solo Leveling
@Sua qué tienen en Drive
```

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
```
> ⚠️ Si intentas moderar a Valk, Sua se negará sin importar quién lo pida.

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
```

---

### `/salud` — Diagnóstico del bot

Sua se autodiagnostica: conexión con Discord, variables configuradas, conexión con Google Drive, scrapers de TMO y Colorcito.

**Uso con slash:**
```
/salud
```

**Uso con el agente:**
```
@Sua cómo estás tú
@Sua diagnóstico
@Sua todo bien contigo
```

---

### `/configurar` — Panel de configuración
Solo admins (permiso Gestionar Servidor).

| Subcomando | Qué hace |
|---|---|
| `canal` | Canal de anuncios global o por proyecto |
| `reacciones` | Reacciones de un proyecto específico |
| `rol` | Rol de ping de un proyecto para el servidor de lectores |
| `avisos` | Canal donde `/avisar` publica |
| `tareas` | Canal de recordatorios de tareas |
| `registros` | Canal de logs generales de Sua |
| `ausencias` | Canal donde se publican las ausencias activas |
| `tickets` | Canal donde los lectores reportan errores |
| `reclutamiento` | Canal donde los lectores se postulan |
| `estancado` | Días de inactividad antes de alertar por capítulo estancado |
| `verificar` | Fuerza una verificación de capítulos ahora mismo |
| `info` | Muestra toda la configuración actual del bot |

**Uso con slash:**
```
/configurar info
/configurar canal canal: #anuncios
/configurar canal canal: #solo-leveling proyecto: solo-leveling
/configurar reacciones proyecto: solo-leveling emojis: ⚔️ 💀 🔥
/configurar rol proyecto: solo-leveling rol_id: 1234567890
/configurar tareas canal: #tareas-y-alertas
/configurar estancado proyecto: solo-leveling dias: 7
/configurar verificar
```

> ⚠️ Los cambios de canal intentan guardarse automáticamente en el `.env`. Si no pueden (en Railway sin acceso al archivo), te dice el valor para que lo copies manualmente en las variables de entorno.

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
```
> ⚠️ El agente irá pidiendo los datos que falten (créditos, portada, etc.).

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
```

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

Los **lectores** abren tickets desde su servidor. Se crea un canal temporal en el servidor de staff visible solo para moderadores. Al cerrarlo, el lector recibe un DM y el canal se elimina.

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

Los **lectores** se postulan desde el canal de reclutamiento. Sua recopila sus datos conversacionalmente, crea un canal privado para el candidato en el servidor de lectores y notifica al staff con botones de acción.

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

### Reglas básicas

- Siempre hay que **mencionar a Sua** (`@Sua`) para que responda
- Si Sua te está haciendo preguntas y quieres cancelar, escribe `cancelar` o `stop`
- Las sesiones tienen un tiempo límite de **5 minutos** de inactividad. Si no respondes, la sesión se cierra sola
- Si no reconoce lo que le dices, lo delega a su modo conversacional (respuestas de personalidad) — eso significa que no entendió la intención como un comando

### Lo que SÍ entiende bien

El agente detecta intenciones por palabras clave. Estas frases funcionan de forma garantizada:

| Intención | Frases que funcionan |
|---|---|
| Agregar proyecto | `agrega el proyecto`, `registra el proyecto`, `nuevo proyecto` |
| Ver proyectos | `lista los proyectos`, `qué proyectos tienes`, `todos los proyectos` |
| Ver estado | `status`, `cómo van`, `progreso de`, `qué tienen en Drive` |
| Anunciar | `anuncia`, `publica el cap`, `saca el capítulo` |
| Avisar | `publica un aviso`, `comunicado oficial`, `manda un aviso` |
| Banear | `banea a`, `ban a` |
| Expulsar | `expulsa a`, `kick a`, `saca del servidor a` |
| Dar rol | `dale el rol de`, `asígnale el rol de` |
| Quitar rol | `quítale el rol de` |
| Asignar tarea | `asígnale una tarea a`, `dale la traducción del cap X a` |
| Completar tarea | `ya terminé la tarea`, `marcar tarea como lista` |
| Ver tareas | `ver tareas activas`, `tareas pendientes` |
| Pedir ausencia | `voy a estar ausente`, `me voy de viaje`, `ausencia` |
| Cancelar ausencia | `ya volví`, `estoy de vuelta`, `regresé` |
| Ver ausencias | `quiénes están ausentes`, `ausencias activas` |
| Reportar error | `hay un error en el cap`, `el cap no carga`, `páginas desordenadas` |
| Postularse | `quiero unirme`, `quiero postularme`, `quiero ser traductor` |
| Diagnóstico | `cómo estás tú`, `diagnóstico`, `todo bien contigo` |
| Buscar | `busca X en TMO`, `existe X en Colorcito` |
| Sincronizar | `sincroniza`, `actualiza caché` |

### Lo que NO entiende bien (usa el slash en cambio)

- Configuraciones complejas con múltiples parámetros → usa `/configurar`
- Reacciones personalizadas por proyecto → usa `/configurar reacciones`
- Panel de roles con emojis → usa `/rol`
- Agregar proyectos con muchos campos opcionales (portada, tags, créditos) → usa `/proyecto add`

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
Si el agente está en medio de una conversación contigo y de repente parece no responder bien, es posible que la sesión se haya cortado por inactividad. Simplemente menciona a Sua de nuevo con la instrucción completa.
