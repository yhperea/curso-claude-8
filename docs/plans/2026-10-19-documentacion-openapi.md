# Plan: Documentación OpenAPI 3 de la API

- **Tipo:** feature
- **Fecha:** 2026-10-19
- **Estimación total:** 120 min

## Objetivo

Publicar un documento OpenAPI 3.1 que describa los 29 endpoints de la API: rutas, parámetros, cuerpos, respuestas, códigos de estado, roles y autenticación Bearer. La API lo servirá en `GET /api/v1/docs/openapi.json`, con una Swagger UI navegable en `/api/v1/docs`. El spec se escribe a mano, y unos tests de contrato con supertest garantizan que no se desincroniza del código: todas las rutas de Express están documentadas, y los códigos y campos reales coinciden con los documentados.

## Alcance

- **Incluido:**
  - El fichero `packages/api/src/docs/openapi.json`, que documenta todas las rutas de `app.ts`, incluido `/health`, con esquemas reutilizables en `components`.
  - El esquema de seguridad `bearerAuth` (JWT) y una descripción de los roles de cada operación.
  - La documentación del comportamiento **real** del código, con sus particularidades: dos formatos de error y los códigos de `OrderController`.
  - Un router de docs con el JSON y la Swagger UI, montado sin autenticación.
  - Tests de validez estructural del spec, tests de contrato por grupo de endpoints y un test de cobertura que compara las rutas de Express con el spec.
  - Actualizar `docs/arquitectura/arquitectura-api.md` y `CLAUDE.md`.
- **Fuera de alcance:**
  - Cambiar el comportamiento de los endpoints, incluido corregir incoherencias como `OrderNotFoundError` → 400 en `PATCH .../status` o los dos formatos de error. Se documentan tal cual y se anotan como posibles fixes.
  - Generar el spec desde el código (zod, decoradores…).
  - Validar peticiones en runtime contra el spec.
  - Publicarlo fuera de la API (GitHub Pages, Redocly…) y documentarlo en los frontends.
  - Paginación nueva: `GET /employees` ya acepta `limit`/`offset`/`role` y solo se documenta.

## Contexto técnico

- **Montaje de rutas:** `packages/api/src/app.ts`. Los routers están en `packages/api/src/routes/*.routes.ts` (restaurant, restaurant.public, dish, dish.public, ingredient, order) y en `packages/api/src/contexts/employee/infrastructure/http/{auth,employee,restaurant-employee}.routes.ts`.
- **Inventario de endpoints (29):**
  - Público: `GET /health`, `POST /api/v1/auth/{login,register}`, `GET /api/v1/public/restaurants`, `GET /api/v1/public/restaurants/{id}` y `GET /api/v1/public/restaurants/{restaurantId}/dishes`.
  - Restaurantes (4), empleados (3, más `GET /restaurants/{restaurantId}/employees`), ingredientes (5), platos (5) y pedidos (5).
  - Los roles salen de `authorize([...])` en cada fichero de rutas. `orders` solo exige estar autenticado.
- **Forma de las respuestas:** la definen los `toJSON()` privados de los controladores (`controllers/*.controller.ts`), `EmployeeController` y `LoginResponse` (`contexts/employee/application/LoginUseCase.ts`). Los enums están en `models/*.model.ts`:
  - `unit`: `kg|g|l|ml|unidad`.
  - `category`: `entrante|principal|postre|bebida`.
  - `status`: `pendiente|preparando|listo|entregado`.
- **Formatos de error (los dos se documentan):**
  - `errorHandler` (`contexts/shared/infrastructure/http/errorHandler.ts`) devuelve `{ error, message }`: 404 para los `*NotFoundError` listados, 401 para `InvalidCredentialsError`, 400 para el resto de `AppError` y 500 para lo demás.
  - `authenticate`/`authorize` (`middlewares.ts`) y `OrderController` devuelven `{ error }`: 401, 403, 400 y 500.
- **Particularidades de pedidos:**
  - `POST /orders` expande `quantity: N` en N ítems.
  - `GET /orders/active` exige `?restaurantId` (400 si falta).
  - `GET /orders/{id}` responde 404 si no existe.
  - `PATCH /orders/{orderId}/items/{itemId}/status` responde 204, y 400 tanto si el pedido no existe como si el estado no es válido.
- **Tests:** vitest con `globals: true` y `vite-tsconfig-paths`. Con `NODE_ENV=test`, que vitest fija por defecto, `dbConfig` usa `:memory:` y hay que llamar a `dbConfig.initialize()` en `beforeAll`. `supertest` y `@types/supertest` ya están instalados y sin usar. Los tokens para los tests se firman con `jsonwebtoken` y el `JWT_SECRET` por defecto (`{ id, role, restaurantId }`), sin pasar por el login.
- **Spec:** se lee en runtime con `readFileSync(new URL('./openapi.json', import.meta.url))`, lo que funciona igual con `tsx` y con vitest y evita `resolveJsonModule`. Se añade el alias `@docs/*` → `docs/*` a `packages/api/tsconfig.json`.
- **Línea base de tipos:** `npx tsc --noEmit -p packages/api` ya falla, pero solo por errores previos en `src/scripts/seed.ts`. El criterio es no introducir errores nuevos fuera de ese fichero.

## Tareas

> Cada tarea debe completarse en 5-10 minutos. Márcala con `[x]` al terminarla.

### T1 — Añadir la dependencia de Swagger UI (~5 min)

- [x] **Qué:** Instalar `swagger-ui-express` como dependencia y `@types/swagger-ui-express` como devDependency del workspace de la API (`npm install swagger-ui-express -w @resttek/api` y `npm install -D @types/swagger-ui-express -w @resttek/api`).
- **Ficheros:** `packages/api/package.json`, `package-lock.json`
- **Hecho cuando:** ambas aparecen en `packages/api/package.json` y `npm test` sigue en verde (66 tests).

### T2 — Esqueleto del spec, cargador y test estructural (~10 min)

- [x] **Qué:**
  - Crear `openapi.json` con:
    - `openapi: "3.1.0"`, `info` (título, versión `1.0.0`, descripción con roles y credenciales de ejemplo del seed) y `servers` (`http://localhost:3000`).
    - Los `tags` (Health, Auth, Restaurantes, Empleados, Ingredientes, Platos, Pedidos).
    - `components.securitySchemes.bearerAuth` (http/bearer/JWT).
    - Los esquemas `ErrorResponse` (`{ error, message }`) y `SimpleError` (`{ error }`).
    - La operación `GET /health` (200 `{ status: "ok" }`).
  - Crear `openapi.ts`, que exporta `loadOpenApiSpec()` (lectura con `readFileSync` + `JSON.parse`), y añadir el alias `@docs/*`.
  - Test estructural (`openapi.test.ts`):
    - La versión empieza por `3.`.
    - Cada operación tiene `operationId` único, al menos un `tag` y `responses`.
    - Todos los `$ref` internos resuelven a un nodo existente.
    - Cada parámetro `{x}` de una ruta está declarado como parámetro `in: path`.
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/openapi.ts`, `packages/api/src/docs/openapi.test.ts`, `packages/api/tsconfig.json`
- **Hecho cuando:** `npx vitest run src/docs/openapi.test.ts` pasa, y falla si se rompe a propósito un `$ref` o se duplica un `operationId`.

### T3 — Utilidades de test de contrato y contrato de `/health` (~10 min)

- [x] **Qué:**
  - Crear `openapi.test-utils.ts` con:
    - `tokenFor(role, restaurantId?)`: firma un JWT con el secreto por defecto.
    - `expectMatchesSpec(method, specPath, res)`: comprueba que `res.status` está documentado en esa operación. Si la respuesta documentada tiene esquema JSON, también que las claves del body (o del primer elemento, si es array) coinciden con las `properties` del esquema, resolviendo `$ref`.
  - Crear `contract.health.test.ts`, que llama a `GET /health` con supertest sobre `app` y aplica `expectMatchesSpec`.
- **Ficheros:** `packages/api/src/docs/openapi.test-utils.ts`, `packages/api/src/docs/contract.health.test.ts`
- **Depende de:** T2
- **Hecho cuando:** el test pasa y falla si en el spec se cambia el código 200 de `/health` o el nombre de la propiedad `status`.

### T4 — Documentar Auth (~10 min)

- [x] **Qué:**
  - Documentar `POST /api/v1/auth/login` (200, 401 `ErrorResponse`) y `POST /api/v1/auth/register` (201, 400 `ErrorResponse` por email duplicado, email inválido o campos vacíos).
  - Añadir los esquemas `LoginRequest`, `RegisterRequest`, `AuthResponse` (`{ token, employee }`) y `Employee` (`id`, `firstName`, `lastName`, `email`, `role` enum, `restaurantId` nullable).
  - Escribir `contract.auth.test.ts`: registrar un cliente con un email único, hacer login con él y probar un login con contraseña errónea, aplicando `expectMatchesSpec` en cada caso.
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/contract.auth.test.ts`
- **Depende de:** T3
- **Hecho cuando:** `contract.auth.test.ts` pasa, y antes de documentar las rutas fallaba porque no estaban en el spec.

### T5 — Documentar Restaurantes (privados y públicos) (~10 min)

- [x] **Qué:**
  - Documentar `POST/GET /api/v1/restaurants`, `GET/PUT /api/v1/restaurants/{id}`, `GET /api/v1/public/restaurants` y `GET /api/v1/public/restaurants/{id}`. Las protegidas van con `security: bearerAuth`, roles en la `description` y respuestas 401/403 `SimpleError`, 400/404 `ErrorResponse`.
  - Explicar en la descripción que `GET /restaurants` filtra por rol.
  - Añadir los esquemas `Restaurant` y `RestaurantInput`.
  - Escribir `contract.restaurant.test.ts`:
    - Crear un restaurante con un token admin y leerlo por las vías privada y pública.
    - Comprobar el 401 sin token, el 403 con rol `camarero` en `POST` y el 404 con un id inexistente.
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/contract.restaurant.test.ts`
- **Depende de:** T3
- **Hecho cuando:** `contract.restaurant.test.ts` pasa.

### T6 — Documentar Empleados (~10 min)

- [x] **Qué:**
  - Documentar:
    - `POST /api/v1/employees` (201; body `EmployeeInput` con `password`, `role` enum y `restaurantId` opcional).
    - `GET /api/v1/employees` (query `limit` por defecto 10, `offset` por defecto 0, `role`).
    - `GET /api/v1/employees/{id}` (404).
    - `GET /api/v1/restaurants/{restaurantId}/employees`.
  - Todas son solo para admin.
  - Escribir `contract.employee.test.ts`: crear un empleado con un email único, listarlo con y sin filtros, obtenerlo por id, probar el 404 con un id inexistente y el 403 con rol `manager`.
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/contract.employee.test.ts`
- **Depende de:** T4
- **Hecho cuando:** `contract.employee.test.ts` pasa.

### T7 — Documentar Ingredientes (~10 min)

- [x] **Qué:**
  - Documentar las 5 operaciones de `/api/v1/restaurants/{restaurantId}/ingredients[/{id}]`. Crear, editar y borrar son solo para admin; leer, para admin, manager y cocinero.
  - Respuestas: `DELETE` → 204 sin cuerpo; 400 por unidad inválida o stock negativo; 404.
  - Añadir los esquemas `Ingredient` (`unit` enum) e `IngredientInput`.
  - Escribir `contract.ingredient.test.ts`: crear un restaurante y un ingrediente, listar, obtener, editar y borrar; probar el 400 con `unit: "litros"` y el 403 con `cocinero` en `POST`.
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/contract.ingredient.test.ts`
- **Depende de:** T5
- **Hecho cuando:** `contract.ingredient.test.ts` pasa.

### T8 — Documentar Platos (privados y carta pública) (~10 min)

- [ ] **Qué:**
  - Documentar las 5 operaciones de `/api/v1/restaurants/{restaurantId}/dishes[/{id}]` y `GET /api/v1/public/restaurants/{restaurantId}/dishes`. La carta pública solo devuelve los platos con `available: true`.
  - Añadir los esquemas `Dish` (`category` enum, `ingredients[]` con `ingredientId` y `quantity`) y `DishInput`.
  - Escribir `contract.dish.test.ts`:
    - Crear un restaurante, un plato disponible y otro no disponible.
    - Comprobar que la carta pública solo contiene el disponible y que la categoría inválida da 400.
    - Recorrer el CRUD con `expectMatchesSpec`.
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/contract.dish.test.ts`
- **Depende de:** T5
- **Hecho cuando:** `contract.dish.test.ts` pasa.

### T9 — Documentar Pedidos (~10 min)

- [ ] **Qué:**
  - Documentar:
    - `POST /api/v1/orders` (201; body `OrderInput` con `restaurantId`, `tableId` opcional e `items[]` con `dishId`, `quantity` y `notes`; la descripción explica que se expande a N ítems).
    - `GET /api/v1/orders/active` (query `restaurantId` obligatoria, 400 `SimpleError` si falta).
    - `GET /api/v1/orders/mine`.
    - `GET /api/v1/orders/{id}` (404 `SimpleError`).
    - `PATCH /api/v1/orders/{orderId}/items/{itemId}/status` (body `{ status }` enum, 204; 400 si el pedido no existe o el estado no es válido, documentado como comportamiento actual).
  - Añadir los esquemas `Order` y `OrderItem`, con los campos opcionales `dishName`, `dishPrice`, `dishCategory`, `restaurantName` y `restaurantLogoUrl` sin marcar como `required`.
  - Escribir `contract.order.test.ts`: crear un pedido con `quantity: 2` y comprobar que tiene 2 ítems; consultar los activos sin `restaurantId` (400), los propios con token de cliente y uno inexistente (404); cambiar el estado de un ítem (204) y probar uno inválido (400).
- **Ficheros:** `packages/api/src/docs/openapi.json`, `packages/api/src/docs/contract.order.test.ts`
- **Depende de:** T8
- **Hecho cuando:** `contract.order.test.ts` pasa. Para las claves de los ítems, el helper solo exige las `required` y admite las opcionales.

### T10 — Servir el spec y la Swagger UI (~10 min)

- [ ] **Qué:**
  - Crear `routes/docs.routes.ts`:
    - `GET /openapi.json` devuelve `loadOpenApiSpec()`.
    - `/` sirve `swaggerUi.serve` + `swaggerUi.setup(spec)`.
  - Montarlo en `app.ts` como `app.use('/api/v1/docs', docsRoutes)`, sin `authenticate`.
  - Escribir `routes/docs.routes.test.ts` con supertest: `GET /api/v1/docs/openapi.json` → 200, `application/json` y `openapi` empieza por `3.`; `GET /api/v1/docs/` → 200 `text/html` y contiene `swagger-ui`.
- **Ficheros:** `packages/api/src/routes/docs.routes.ts`, `packages/api/src/routes/docs.routes.test.ts`, `packages/api/src/app.ts`
- **Depende de:** T1, T2
- **Hecho cuando:** `docs.routes.test.ts` pasa, y antes de crear el router fallaba con 404.

### T11 — Exponer los montajes de rutas de `app.ts` (refactor) (~5 min)

- [ ] **Qué:** Extraer los `app.use('/api/v1/...', router)` de negocio a un array exportado `routeMounts: { path: string; router: Router }[]`, recorrido con un bucle en el mismo orden actual. `/health` y `/api/v1/docs` quedan fuera del array. No cambia ningún comportamiento.
- **Ficheros:** `packages/api/src/app.ts`
- **Depende de:** T10
- **Hecho cuando:** `npm test` sigue en verde sin modificar ningún test existente.

### T12 — Test de cobertura rutas de Express ↔ spec (~10 min)

- [ ] **Qué:**
  - Crear `openapi.coverage.test.ts`:
    - Recorrer `routeMounts` y los `router.stack[].route` (`path` + `methods`) para construir la lista real de operaciones. Convertir `:param` en `{param}` y quitar la barra final; añadir `GET /health`.
    - Comprobar que coincide **exactamente**, en ambos sentidos, con las operaciones de `spec.paths`, excluyendo el prefijo `/api/v1/docs`.
  - Al ser un test de regresión que nace en verde, comprobar el rojo quitando temporalmente una operación del spec y añadiendo una ruta falsa a un router.
- **Ficheros:** `packages/api/src/docs/openapi.coverage.test.ts`
- **Depende de:** T9, T11
- **Hecho cuando:** el test pasa con 29 operaciones y falla en los dos escenarios de la comprobación del rojo (que luego se revierten).

### T13 — Actualizar documentación del proyecto (~5 min)

- [ ] **Qué:**
  - En `docs/arquitectura/arquitectura-api.md`, sección "Endpoints": indicar que la referencia completa es `/api/v1/docs` (Swagger UI) y `/api/v1/docs/openapi.json`, que el fuente está en `packages/api/src/docs/openapi.json` y que los tests de contrato fallan si una ruta no está documentada.
  - En `CLAUDE.md`:
    - Añadir `@docs/*` a la lista de alias.
    - Añadir la convención "al añadir o cambiar un endpoint, actualiza `src/docs/openapi.json`; `openapi.coverage.test.ts` lo exige".
    - Corregir "No hay tests HTTP (supertest instalado pero sin usar)".
- **Ficheros:** `docs/arquitectura/arquitectura-api.md`, `CLAUDE.md`
- **Depende de:** T12
- **Hecho cuando:** `grep -n "openapi" CLAUDE.md docs/arquitectura/arquitectura-api.md` muestra las nuevas referencias y CLAUDE.md ya no dice que supertest está sin usar.

### T14 — Verificación final (~5 min)

- [ ] **Qué:**
  - Ejecutar `npm test` y `npx tsc --noEmit -p packages/api`; este último solo puede dar los errores previos de `src/scripts/seed.ts`.
  - Arrancar `npm run dev:api` y comprobar `curl -s localhost:3000/api/v1/docs/openapi.json | head -c 200` y que `http://localhost:3000/api/v1/docs` muestra la Swagger UI.
  - Desde la Swagger UI, autorizar con el token de `admin@resttek.com` y ejecutar `GET /api/v1/restaurants`.
- **Ficheros:** —
- **Depende de:** T1–T13
- **Hecho cuando:** los tests están en verde, `tsc --noEmit -p packages/api | grep -v seed.ts` no da salida y la petición desde la Swagger UI devuelve 200.

## Criterios de aceptación

### Funcionales

- [ ] **CA1:** Dado el API arrancado, cuando se hace `GET /api/v1/docs/openapi.json` sin token, entonces responde 200 con un JSON OpenAPI 3.1 válido (`openapi`, `info`, `paths`, `components`).
- [ ] **CA2:** Dado el API arrancado, cuando se abre `/api/v1/docs` en el navegador, entonces se muestra la Swagger UI con los endpoints agrupados por tag. Tras pulsar "Authorize" con un JWT válido se pueden ejecutar los endpoints protegidos.
- [ ] **CA3:** Dada cualquier ruta montada en `app.ts`, cuando se ejecuta `openapi.coverage.test.ts`, entonces la ruta aparece en el spec con el mismo método. Recíprocamente, toda operación del spec existe en Express.
- [ ] **CA4:** Dado cada endpoint protegido, cuando se consulta su operación en el spec, entonces declara `security: bearerAuth`, enumera en su descripción los roles permitidos (tal como están en `authorize()`) y documenta 401, y también 403 si hay `authorize()`.
- [ ] **CA5:** Dado cada endpoint, cuando los tests de contrato lo llaman con supertest, entonces el código real está entre los documentados y las claves del cuerpo JSON coinciden con las del esquema de esa respuesta.
- [ ] **CA6:** Dados los enums del dominio (`unit`, `category`, `status`, `role`), cuando se consultan en el spec, entonces sus valores coinciden con los de `models/*.model.ts` y `Role`.
- [ ] **CA7:** Dado el spec, cuando se valida estructuralmente, entonces todos los `$ref` resuelven, los `operationId` son únicos y todos los parámetros de ruta están declarados.

### Técnicos

- [ ] Se respetan los dos estilos de arquitectura: el router de docs sigue el estilo por capas (`routes/`), `contexts/employee` no se modifica y no se toca ningún controlador, servicio ni repositorio.
- [ ] Los imports usan alias con extensión `.js` e `import type` donde corresponda. `npx tsc --noEmit -p packages/api` no introduce errores nuevos (solo los previos de `src/scripts/seed.ts`).
- [ ] Hay tests que cubren los criterios funcionales y `npm test` pasa en verde.
- [ ] La única dependencia nueva es `swagger-ui-express` (+ `@types/swagger-ui-express` en dev), justificada abajo.

## Riesgos y decisiones

- **Spec escrito a mano en lugar de generado:** se descartó zod + `@asteasolutions/zod-to-openapi` porque exigía varias dependencias y reescribir todos los ficheros de rutas y la validación. A cambio, el riesgo de desincronización se mitiga con el test de cobertura (T12) y los tests de contrato (T3–T9).
- **JSON en vez de YAML:** evita añadir un parser YAML; se lee con `JSON.parse`.
- **Dependencia `swagger-ui-express`:** la eligió el usuario para publicar una UI navegable. Es compatible con Express 5 (peer `>=4 || >=5.0.0-beta`). No se añade `ajv` ni ningún validador OpenAPI: la validación estructural (T2) y la de claves (T3) son propias y deliberadamente simples, no un validador JSON Schema completo.
- **Comportamiento actual documentado, no corregido:**
  - Hay dos formatos de error (`{error, message}` frente a `{error}`).
  - `PATCH .../status` devuelve 400 cuando el pedido no existe.
  - `OrderNotFoundError` no está en el `errorHandler`.
  - Las rutas de `orders` no tienen `authorize()`.
  
  Se propondrán como fixes en planes aparte; corregirlos aquí cambiaría el contrato.
- **Introspección de Express (T12):** depende de `router.stack[].route` de Express 5 / `router@2`. Si cambiara en una versión futura, el test fallaría de forma visible, no silenciosa. La refactorización `routeMounts` (T11) evita duplicar los prefijos de `app.ts` en el test.
- **Docs públicas:** `/api/v1/docs` no exige autenticación porque el objetivo es publicarlas. El spec no contiene secretos; las credenciales de ejemplo del seed son las ya documentadas en CLAUDE.md y README.
- **Adaptación de la plantilla:** la plantilla menciona `./mvnw test`, Spring y beans en `infrastructure/config`; este repo es Node/Express, así que se sustituyen por `npm test`, `tsc --noEmit` y las convenciones de CLAUDE.md.
