# Plan: <título breve>

- **Tipo:** feature | fix | refactor
- **Fecha:** <AAAA-MM-DD>
- **Estimación total:** <suma de las tareas> min

## Objetivo

<Qué se quiere conseguir y por qué, en 2-4 frases. Para un fix, describe el fallo actual y el comportamiento esperado. Para un refactor, qué mejora y qué comportamiento se mantiene.>

## Alcance

- **Incluido:** <qué entra en este plan>
- **Fuera de alcance:** <qué no se va a hacer>

## Contexto técnico

<Clases, puertos, adaptadores y endpoints afectados, con rutas relativas al repo. Para un fix, la causa raíz identificada.>

## Tareas

> Cada tarea debe completarse en 5-10 minutos. Márcala con `[x]` al terminarla.

### T1 — <título> (~<5-10> min)

- [ ] **Qué:** <acción concreta>
- **Ficheros:** `<ruta/al/fichero>`
- **Hecho cuando:** <comprobación concreta de que la tarea está terminada>

### T2 — <título> (~<5-10> min)

- [ ] **Qué:** <acción concreta>
- **Ficheros:** `<ruta/al/fichero>`
- **Depende de:** T1
- **Hecho cuando:** <comprobación>

<!-- Añade tantas tareas como sean necesarias. La última debe ser la verificación con ./mvnw test. -->

## Criterios de aceptación

### Funcionales

- [ ] **CA1:** Dado <contexto>, cuando <acción>, entonces <resultado esperado>.
- [ ] **CA2:** Dado <contexto>, cuando <acción>, entonces <resultado esperado>.

### Técnicos

- [ ] Se respeta la regla de dependencias `infrastructure` → `application` → `domain`; `domain`/`application` no importan tipos de Spring web, validación ni persistencia.
- [ ] Los nuevos servicios y adaptadores se registran como beans en `infrastructure/config`.
- [ ] Hay tests que cubren los criterios funcionales y `./mvnw test` pasa en verde.
- [ ] No se añaden dependencias externas sin justificar.

## Riesgos y decisiones

- <Riesgo, alternativa descartada o decisión tomada, con su motivo>
