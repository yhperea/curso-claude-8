---
description: Crea un git commit siguiendo Conventional Commits
argument-hint: "[tipo(scope): descripción opcional | pista sobre el cambio]"
allowed-tools: Bash(git rev-parse:*), Bash(git init:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(echo:*)
---

## Contexto

<!-- Cada comando lleva un fallback con `||` para que el comando no falle si no hay repositorio o aún no hay commits. -->

- Repositorio git: !`git rev-parse --is-inside-work-tree 2>/dev/null || echo "NO es un repositorio git"`
- Estado: !`git status --short -uall 2>/dev/null || echo "(sin repositorio)"`
- Cambios en staging: !`git diff --cached 2>/dev/null || echo "(sin repositorio)"`
- Cambios sin staging: !`git diff 2>/dev/null || echo "(sin repositorio)"`
- Últimos commits: !`git log --oneline -10 2>/dev/null || echo "(sin commits todavía)"`

Argumentos del usuario: $ARGUMENTS

## Tarea

Crea un único commit con un mensaje que siga la especificación **Conventional Commits 1.0.0**.

0. Casos especiales:
   - **Sin repositorio** ("NO es un repositorio git"): ejecuta `git init`, avisa al usuario y continúa con un commit inicial.
   - **Sin commits previos** ("sin commits todavía"): es el commit inicial. `git diff` no muestra los ficheros nuevos, así que básate en `git status --short -uall`. Salvo que los argumentos indiquen otra cosa, usa `chore: commit inicial` y, si aporta, un cuerpo breve que resuma el contenido.
1. Si no hay nada en staging, añade los ficheros modificados relevantes con `git add` (nunca secretos como `.env` o credenciales). Si ya hay cambios en staging, comitea solo esos.
2. Si no hay ningún cambio, dilo y no hagas nada.
3. Si los argumentos ya contienen un mensaje completo con formato válido, úsalo tal cual. Si solo son una pista, úsala para redactar el mensaje.
4. Formato del mensaje:

   ```
   <tipo>[(scope)][!]: <descripción>

   [cuerpo opcional]

   [footer(s) opcional(es)]
   ```

   - **Tipos**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   - **Scope** (opcional): la zona afectada, p. ej. `auth`, `health`, `domain`, `persistence`, `config`.
   - **Descripción**: en imperativo, minúscula inicial, sin punto final, máximo ~72 caracteres.
   - **Cuerpo**: solo si aporta el *porqué* del cambio.
   - **Breaking change**: añade `!` tras el tipo/scope y un footer `BREAKING CHANGE: <explicación>`.
   - Sigue el idioma de los commits previos del repositorio; si no hay, usa español.
5. Si los cambios mezclan propósitos claramente distintos, avisa y sugiere dividirlos antes de comitear.
6. Usa la tool `AskUserQuestion` para mostrarle al usuario el mensaje del commit, y que decida si le parece bien. Si te da el ok, continua. Si te dice que no, proponle otro mensaje o permite que el usuario ponga un mensaje personalizado.
7. Ejecuta el commit pasando el mensaje con un heredoc, y muestra después `git log --oneline -1`.

No hagas `push`, `--amend` ni uses `--no-verify` salvo que el usuario lo pida explícitamente.
