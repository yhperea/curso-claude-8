---
name: plan-feature
description: Planifica un nuevo desarrollo, una corrección de código (bugfix) o un refactor en este proyecto, generando un plan en Markdown con objetivo, tareas pequeñas (5-10 min cada una) y criterios de aceptación según la plantilla template.md. Úsala cuando el usuario pida planificar, diseñar, desglosar o preparar una feature, fix o refactor antes de implementarlo.
argument-hint: "[descripción de la feature, fix o refactor]"
allowed-tools: Read, Glob, Grep, Write, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(ls:*), Bash(find:*), AskUserQuestion, mcp__slack__slack_list_channels, mcp__slack__slack_post_message
---

# plan-feature

Genera un plan de trabajo **sin implementar nada**. El resultado es un único fichero Markdown que sigue exactamente la estructura de [template.md](template.md).

Petición del usuario: $ARGUMENTS

## Pasos

1. **Entender la petición.**
   - Clasifícala como `feature`, `fix` o `refactor`.
   - Si `$ARGUMENTS` está vacío o es ambiguo (no queda claro el comportamiento esperado, el alcance o el endpoint afectado), usa `AskUserQuestion` para aclararlo antes de seguir. No preguntes lo que puedas averiguar leyendo el código.

2. **Explorar el código afectado.**
   - Respeta `CLAUDE.md`: arquitectura hexagonal (`domain` → `application` (`port/in`, `port/out`, `service`) → `infrastructure` (`in/web`, `out/persistence`, `out/security`, `config`)), servicios sin anotaciones Spring registrados en `infrastructure/config`, validación solo en DTOs web.
   - Localiza las clases, puertos, adaptadores y tests que habrá que tocar o crear.
   - Lee `API.md` **solo** si el cambio crea o modifica un endpoint con paginación.
   - Si el plan requiere una dependencia nueva, comprueba antes que el JDK o los starters actuales no lo resuelven; si de verdad hace falta, justifícalo en "Riesgos y decisiones".
   - Para un `fix`: identifica la causa raíz y planifica primero un test que reproduzca el fallo.
   - Para un `refactor`: el comportamiento observable no cambia; los tests existentes deben seguir pasando sin modificarse (salvo que se justifique).

3. **Desglosar en tareas.**
   - Cada tarea debe poder completarse en **5-10 minutos**. Si una tarea supera eso, divídela.
   - Cada tarea tiene un único propósito verificable y nombra los ficheros concretos (rutas relativas al repo) que crea o modifica.
   - Ordénalas respetando las dependencias, normalmente de dentro hacia fuera: `domain` → `port` → `service` → adaptadores `out` → `config` → controlador/DTO `in/web` → tests de integración.
   - Incluye las tareas de test (`@SpringBootTest` + `@AutoConfigureMockMvc`, usernames únicos) y una tarea final de verificación con `./mvnw test`.
   - Si alguna tarea cambia el comportamiento descrito en `CLAUDE.md` (sección "Current behaviour"), añade una tarea para actualizarlo.

4. **Definir criterios de aceptación.**
   - Concretos y comprobables (códigos HTTP, cuerpos de respuesta, casos límite, tests que deben pasar).
   - Usa el formato *Dado / Cuando / Entonces* para los criterios funcionales.
   - Incluye siempre los criterios técnicos: regla de dependencias de la arquitectura respetada, `./mvnw test` en verde y sin dependencias nuevas no justificadas.

5. **Escribir el plan.**
   - Rellena [template.md](template.md) sin eliminar secciones; si alguna no aplica, escribe "N/A" y el motivo.
   - Guárdalo en `docs/plans/<AAAA-MM-DD>-<slug>.md` (slug en kebab-case derivado del título).
   - Escribe en español.

6. **Avisar en Slack.** Publica en el canal `#revisar-plan` que el plan está listo para revisarse:
   - Obtén el ID del canal con `mcp__slack__slack_list_channels` buscando `name == "revisar-plan"` (no lo adivines).
   - Envía con `mcp__slack__slack_post_message` un mensaje breve en español, p. ej.:
     ```
     :memo: Plan listo para revisar: *<título del plan>*
     • Tipo: <feature|fix|refactor>
     • Fichero: `docs/plans/<AAAA-MM-DD>-<slug>.md`
     • Tareas: <n> (~<tiempo estimado total>)
     ```
   - No incluyas secretos ni contenido sensible. Si el canal no existe o el envío falla, no bloquees: continúa e indícalo al usuario en el paso siguiente.

7. **Presentarlo.** Muestra al usuario la ruta del fichero, el objetivo, el número de tareas y el tiempo estimado total, y si se avisó en `#revisar-plan`. No empieces a implementar hasta que el usuario lo pida.
