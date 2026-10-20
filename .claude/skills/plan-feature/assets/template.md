# Plan: <título breve>

- **Tipo:** feature | fix | refactor
- **Issue:** #<número> — <URL de la issue>
- **Fecha:** <AAAA-MM-DD>
- **Estimación total:** <suma de las tareas> min

## Objetivo

<Qué se quiere conseguir y por qué, en 2-4 frases. Para un fix, describe el fallo actual y el comportamiento esperado. Para un refactor, qué mejora y qué comportamiento se mantiene.>

## Alcance

- **Incluido:** <qué entra en este plan>
- **Fuera de alcance:** <qué no se va a hacer>

## Contexto técnico

<Paquetes afectados, estilo de arquitectura (hexagonal en `contexts/employee/` o por capas), ficheros, endpoints y pantallas afectados, con rutas relativas al repo. Para un fix, la causa raíz identificada.>

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

<!-- Añade tantas tareas como sean necesarias. La última debe ser la verificación con npm test (y el build de cada frontend tocado). -->

## Criterios de aceptación

### Funcionales

- [ ] **CA1:** Dado <contexto>, cuando <acción>, entonces <resultado esperado>.
- [ ] **CA2:** Dado <contexto>, cuando <acción>, entonces <resultado esperado>.

### Técnicos

- [ ] Se respeta el estilo de arquitectura del módulo (hexagonal: `infrastructure` → `application` → `domain`; por capas: `routes` → `controllers` → `services` → `repositories` → `models`).
- [ ] Si cambian endpoints: `src/docs/openapi.json` y su `contract.<grupo>.test.ts` actualizados, router registrado en `routeMounts` y `npm run docs:build` ejecutado.
- [ ] Hay tests que cubren los criterios funcionales de la API y `npm test` pasa en verde.
- [ ] `npm run build -w <paquete>` pasa para cada frontend modificado.
- [ ] `CLAUDE.md` y `docs/` actualizados si cambia lo que describen.
- [ ] No se añaden dependencias externas sin justificar.

## Riesgos y decisiones

- <Riesgo, alternativa descartada o decisión tomada, con su motivo>
