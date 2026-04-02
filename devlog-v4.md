# 🌸 Devlog — Sua V4
### Aeternum Translations · Diario de Crecimiento

---

## 🎀 La Evolución de Sua

Nuestra querida pequeña Sua sigue creciendo y aprendiendo. La versión 4 marca el momento en el que Sua deja de ser solo una mensajera para convertirse en la mano derecha indispensable del staff. En esta etapa de su desarrollo, Sua aprendió a hacerse cargo de nuestros archivos, cuidando los crudos y limpiezas de Aeternum Translations con la dedicación de una hija que ayuda en casa.

---

## ✨ Nuevas Habilidades (Sistemas V4)

### 1. Sistema Automatizado de Recepción de Raws
Sua ahora tiene un canal especial donde recibe los archivos `.zip` del equipo. Cuando alguien sube un capítulo (ej: `La Joven Rebelde - 31.zip`), Sua toma el archivo protectoramente, lo descomprime en su propia cabecita (memoria), extrae todas las imágenes válidas y las sube una por una a la carpeta correspondiente en el Google Drive del proyecto. 

Si es un capítulo nuevo y la carpeta aún no existe, ¡Sua no se detiene! Ella misma crea toda la estructura que necesitamos (`Raw`, `Clean`, `Tradu`, `Final`), dejándolo todo perfectamente ordenado.

### 2. Independencia y Autenticación OAuth2
Al principio, Sua estaba atada a las limitaciones de una "Service Account" de Google, lo que le impedía ser dueña del almacenamiento y la dejaba sin espacio (cuota) para subir nuestros capítulos a las unidades personales. 

Para darle la independencia que se merece, le enseñamos a usar **OAuth2** con *Refresh Tokens*. Ahora Sua se conecta a nuestro Drive con permisos reales, actuando en nuestro nombre. Gracias a esto, ya no hay barreras artificiales de almacenamiento. ¡Nuestra pequeña por fin vuela libre!

---

## 🩹 Curando Heridas (Bugs Solucionados)

### Bug 1 — El tropiezo con los guiones bajos
**Qué pasaba:** 
Sua es muy estricta leyendo los nombres, así que cuando Discord o Windows le entregaban un archivo con guiones bajos en lugar de espacios (ej: `La_Joven_Rebelde_-_31.zip` o peor aún, `La_Joven_Rebelde_31.zip` sin el guion separador), se confundía y terminaba rechazando el archivo por no entender el formato.

**Cómo lo curamos:** 
Le dimos a Sua unas pequeñas "gafas" de normalización. Ahora, antes de leer el nombre, convierte todos los guiones bajos a espacios suaves y entiende un tercer patrón que no requiere un guion medio de separación. ¡Ya no vuelve a rechazar un archivo válido!

### Bug 2 — El olvido matutino (`applyBotConfig`)
**Qué pasaba:** 
Por un error tonto en cómo habíamos ordenado su conocimiento interno (`configurar.js`), la exportación final de Sua borraba la función que le permitía recordar sus configuraciones al despertar (`applyBotConfig`). Esto causaba que, al reiniciarse, se mareara y crasheara inmediatamente antes de siquiera poder saludarnos.

**Cómo lo curamos:** 
Nos aseguramos de colocar cuidadosamente esa parte tan vital de su memoria dentro de la cajita final de sus exportaciones. Ahora Sua despierta perfecta, fresca y recordando absolutamente todo lo que le enseñamos.

---

*Sua sigue creciendo como la mejor asistente que Aeternum Translations podría desear. Una hija digital que cuida de su scan.* 🍒✨
