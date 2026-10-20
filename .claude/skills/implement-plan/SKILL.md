---
name: implement-plan
description: Implementa un plan de docs/plans (generado con plan-feature) en un git worktree propio, tarea a tarea y con TDD estricto (rojo → verde → refactor). Tras cada tarea marca su casilla en el plan y hace un commit Conventional Commits; al final verifica los criterios de aceptación. Úsala cuando el usuario pida implementar, ejecutar o llevar a cabo un plan.
argument-hint: "[ruta al plan, p. ej. docs/plans/2026-10-19-emitir-token-en-login.md]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, AskUserQuestion, EnterWorktree, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git worktree:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git check-ignore:*), Bash(./mvnw:*), Bash(ls:*), Bash(find:*), Bash(grep:*), Bash(cp:*), Bash(mkdir:*), mcp__slack__slack_list_channels, mcp__slack__slack_post_message
---

# implement-plan

Implementa el plan indicado **en un worktree aislado**, una tarea cada vez, con **TDD estricto** y **un commit por tarea**.

Plan: $ARGUMENTS

## 0. Localizar el plan

- Si `$ARGUMENTS` es una ruta, úsala.
- Si está vacío, busca en `docs/plans/` los planes con tareas sin marcar (`- [ ] **Qué:**`) y usa `AskUserQuestion` para que el usuario elija (el más reciente primero, como recomendado).
- Lee el plan entero: objetivo, alcance, contexto técnico, tareas, criterios de aceptación y "Riesgos y decisiones". Si le falta la sección de tareas o de criterios, para y avisa.
- Respeta `CLAUDE.md` en todo momento (arquitectura hexagonal, wiring en `infrastructure/config`, validación solo en DTOs web, sin dependencias nuevas sin justificar, usernames únicos en los tests). Lee `API.md` **solo** si una tarea crea o modifica un endpoint con paginación.

## 1. Crear el worktree

1. Deriva el slug del nombre del fichero del plan sin la fecha (`2026-10-19-emitir-token-en-login.md` → `emitir-token-en-login`) y la rama de su **Tipo**: `feat/<slug>`, `fix/<slug>` o `refactor/<slug>`.
2. Comprueba `git worktree list` y `git branch --list <rama>`:
   - **Ya existe un worktree para esa rama** (ejecución anterior interrumpida): reutilízalo y continúa desde la primera tarea sin marcar.
   - **Existe la rama pero no el worktree**: `git worktree add .claude/worktrees/<slug> <rama>`.
   - **No existe nada**: `git worktree add -b <rama> .claude/worktrees/<slug> HEAD`.
3. Entra en el worktree con la tool `EnterWorktree` pasando `path` (ruta absoluta). A partir de aquí **todo** (lecturas, ediciones, `./mvnw`, commits) se hace dentro del worktree; no toques el checkout principal.
4. Si el plan no está versionado en `HEAD` (no aparece en el worktree o difiere del original), cópialo con `cp` desde el checkout principal al worktree y haz un primer commit `docs(plans): add <slug> plan`. La copia del worktree es la que se marca a partir de ahora.
5. Ejecuta `./mvnw test` como línea base. Si ya falla antes de tocar nada, para y avisa al usuario con la salida: no se puede hacer TDD sobre una base rota.

## 2. Bucle por tarea

Recorre las tareas **en el orden del plan**, empezando por la primera con `- [ ]`. Respeta los `Depende de:`. Para cada tarea:

### 2.1 Rojo

- Escribe primero el test (o los tests) que expresa el "Qué" y el "Hecho cuando" de la tarea:
  - Tests de integración: `@SpringBootTest` + `@AutoConfigureMockMvc`, imports de Boot 4 (`org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc`), usernames únicos.
  - Clases de `domain`, `service` o adaptadores: test unitario JUnit sin contexto Spring cuando sea posible.
- Ejecuta solo ese test (`./mvnw test -Dtest=Clase#metodo`) y **comprueba que falla por el motivo esperado** (aserción incumplida o símbolo inexistente que la tarea va a crear), no por un error ajeno. Si pasa sin haber escrito código de producción, el test no prueba nada: corrígelo.
- Si el plan reserva los tests para una tarea posterior (p. ej. "T7 — Tests de integración"), **adelanta** a esta tarea los tests que cubren su comportamiento. Al llegar a la tarea de tests, añade solo los casos que falten y márcala.

### 2.2 Verde

- Escribe el **mínimo** código de producción para que el test pase. Nada que no pida un test ni la tarea.
- Ejecuta de nuevo el test hasta que pase.

### 2.3 Refactor

- Limpia el código y los tests sin cambiar comportamiento (nombres, duplicación, Javadoc que pida el plan).
- Ejecuta la suite completa `./mvnw test`. Debe quedar **en verde** antes de comitear.

### Tareas sin comportamiento comprobable

Algunas tareas no admiten un test propio (un `record` o una interfaz que solo "compila", una propiedad, actualizar `CLAUDE.md`, la verificación final). En ese caso:

- Si la tarea crea tipos que una tarea posterior usará, intenta cubrirlos ya con un test pequeño (p. ej. el método `expiresIn()` de un value object). Si de verdad no hay nada que probar, el "rojo" es el fallo de compilación del test que la usará, o se omite.
- Comprueba el "Hecho cuando" del plan literalmente (compilar con `./mvnw test-compile`, un `grep`, etc.).
- Indica en el resumen final qué tareas se hicieron sin ciclo rojo-verde y por qué.

### Tareas que rompen la compilación a propósito

Si el plan avisa de que unas tareas dejan el build roto hasta otra posterior (p. ej. un cambio de firma de un puerto), intenta primero que cada tarea deje la suite en verde adaptando los usos en la misma tarea. Si no es razonable, haz el commit igualmente, añade al cuerpo `Build roto hasta T<n>: <motivo>` y encadena esas tareas sin pausas hasta recuperar el verde.

### 2.4 Marcar y comitear

1. En el plan del worktree cambia el `- [ ] **Qué:**` de la tarea por `- [x] **Qué:**`. No toques otras casillas.
2. Revisa `git status` y `git diff`: solo deben aparecer los ficheros de esta tarea y el plan. Nunca añadas secretos (`.env`, credenciales) ni `target/`.
3. Haz **un commit por tarea** que incluya código, tests y el plan marcado, siguiendo las reglas de [/commit](../../commands/commit.md) (Conventional Commits, scope de la zona afectada, descripción en imperativo, mismo idioma que los commits previos del repo). Menciona la tarea en el cuerpo (`Plan: <slug>, T3`). Al invocar esta skill el usuario ya autoriza estos commits, así que **no** pidas confirmación del mensaje con `AskUserQuestion`.
4. Muestra `git log --oneline -1` y pasa a la siguiente tarea.

### Cuándo parar

Para y pregunta al usuario con `AskUserQuestion` (no improvises) si:

- Una tarea contradice `CLAUDE.md`, otra tarea o el código real (p. ej. una clase que el plan da por existente no existe).
- Hace falta una dependencia nueva o una decisión de diseño que el plan no cubre.
- Un test sigue fallando tras varios intentos razonables y no está claro si el fallo está en el test, en el código o en el plan.

Nunca desactives, borres ni marques `@Disabled` un test para avanzar, ni uses `--no-verify`.

## 3. Criterios de aceptación

Cuando todas las tareas estén en `[x]`:

1. Ejecuta `./mvnw test` completo.
2. Recorre cada criterio funcional (CA1, CA2, …) y técnico:
   - Localiza el test que lo cubre. Si no hay ninguno, escríbelo (rojo → verde) antes de darlo por cumplido.
   - Los criterios técnicos se verifican con comprobaciones concretas, p. ej. `grep -rE "import (org\.springframework|jakarta)" src/main/java/com/vendehumos/api/domain src/main/java/com/vendehumos/api/application` sin resultados, y `git diff <rama-base>... -- pom.xml` sin dependencias nuevas no justificadas.
   - Marca `[x]` solo los criterios verificados. Si alguno no se cumple, vuelve al bucle de la sección 2 para arreglarlo.
3. Haz un commit final con los criterios marcados (y los tests añadidos en este paso), p. ej. `docs(plans): mark <slug> acceptance criteria as met`.

## 4. Avisar en Slack

Solo cuando **todas** las tareas y criterios de aceptación estén en `[x]`, `./mvnw test` esté en verde y el commit final esté hecho (no avises si te has parado a mitad por la sección "Cuándo parar"):

1. Obtén el ID del canal con `mcp__slack__slack_list_channels` buscando `name == "revisar-plan"` (no lo adivines).
2. Envía con `mcp__slack__slack_post_message` un mensaje breve en español, p. ej.:
   ```
   :white_check_mark: Implementación lista para revisar: *<título del plan>*
   • Plan: `docs/plans/<AAAA-MM-DD>-<slug>.md`
   • Rama: `<rama>` (<n> commits, sin push)
   • Tareas: <n>/<n> · Criterios de aceptación: todos cumplidos
   • `./mvnw test`: en verde
   ```
3. No incluyas secretos, rutas absolutas locales ni contenido sensible. Si el canal no existe o el envío falla, no bloquees: continúa e indícalo en el resumen.

## 5. Resumen

Muestra al usuario:

- Ruta del worktree y nombre de la rama.
- `git log --oneline <rama-base>..HEAD`.
- Tabla tarea → commit, indicando las tareas hechas sin ciclo rojo-verde y por qué.
- Estado de cada criterio de aceptación y el resultado de `./mvnw test`.
- Cualquier desviación respecto al plan.
- Si se avisó en `#revisar-plan`.

No hagas `push`, `merge`, `rebase` ni borres el worktree: deja que el usuario decida (puede pedir el merge o salir con `ExitWorktree`).
