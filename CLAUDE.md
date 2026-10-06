# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Resttek: plataforma de gestión de restaurantes. Monorepo con **npm workspaces** (`packages/*`):

| Paquete | Qué es | Puerto |
| --- | --- | --- |
| `api` | Express 5 + TypeScript (ESM) + SQLite | 3000 |
| `web-admin` | Angular 21 — panel de administración | 4200 |
| `web-empleados` | Angular 21 — cocina / barra / salón | 4201 |
| `web-clientes` | Angular 21 — pedidos de clientes | 4202 |
| `web-shared` | Librería Angular compartida (auth, interceptors, login/registro) | — |

La documentación detallada (en español) está en `docs/`: `arquitectura/` (general, api, frontend), `dominio/` (glosario, modelo de datos) y `revisiones/` (inconsistencias doc↔código ya detectadas). Consúltala antes de cambios estructurales y mantenla al día si cambias lo que describe.

## Comandos

Todo desde la raíz (`npm install` una vez; enlaza los workspaces):

```bash
npm run dev:api          # API con tsx watch (http://localhost:3000/health)
npm run dev:admin        # / dev:empleados / dev:clientes — ng serve con proxy /api → :3000
npm run seed             # datos de prueba (idempotente, INSERT OR IGNORE)
npm test                 # vitest run en packages/api
```

Tests de la API (solo existen ahí; los frontends no tienen tests):

```bash
cd packages/api
npx vitest run src/services/order.service.test.ts   # un fichero
npx vitest run -t "nombre del test"                 # por nombre
npm run test:watch
```

Build de un frontend: `npm run build -w @resttek/web-admin`. No hay linter configurado; `web-clientes` tiene `.prettierrc` (printWidth 100, comillas simples).

Credenciales del seed: la contraseña es el propio email (`admin@resttek.com`, `gerente1@resttek.com`, `cocinero1@resttek.com`, `camarero1@resttek.com`, `cliente1@resttek.com`, …). El rol de gerente es `manager`; los demás roles: `admin`, `camarero`, `cocinero`, `cliente`.

## Arquitectura de la API (`packages/api/src`)

Conviven **dos estilos**; identifica cuál aplica antes de tocar código:

- **Hexagonal + DDD solo en `contexts/employee/`** (empleados, auth, roles): `domain/` → `application/` (casos de uso con un único `execute()`) → `infrastructure/` (repositorio SQLite, bcrypt/JWT, controladores y rutas HTTP). `Employee` es la única entidad (constructor privado + `Employee.create()` con validaciones; value objects `Email` y `Role`). Las interfaces llevan prefijo `I` y el cableado de dependencias está en `infrastructure/http/dependencies.ts`. `contexts/shared/` contiene el VO `Email`, los middlewares `authenticate`/`authorize(roles)` y el `errorHandler`.
- **Por capas en `restaurant`, `dish`, `ingredient`, `order`**: `models/` (interfaces planas + funciones `normalizeX()` que validan enums), `repositories/` (interfaz sin prefijo `I` + `Sqlite*Repository` en el mismo fichero), `services/` (lógica y validación; un servicio con varios métodos), `controllers/`, `routes/`. La composición de dependencias se hace **en el propio fichero de rutas**. Los routers montados bajo `/restaurants/:restaurantId/...` necesitan `Router({ mergeParams: true })`.

Convenciones transversales:

- ESM con `module: nodenext`: los imports llevan extensión **`.js`** y se usan path aliases (`@config/*`, `@errors/*`, `@shared/*`, `@employee/*`, `@models/*`, `@repositories/*`, `@services/*`, `@controllers/*`, `@routes/*`). tsconfig es estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` → usa `import type`).
- Repositorios: `save()` decide UPDATE vs INSERT; el paso `snake_case`→`camelCase` se hace con alias en el SQL.
- Errores: `AppError` (abstracta) → `errors/DomainErrors.ts`. El `errorHandler` mapea el código HTTP **por nombre de clase**: los `*NotFoundError` listados → 404, `InvalidCredentialsError` → 401, cualquier otro `AppError` → 400. Al añadir un error 404 nuevo hay que registrarlo ahí (`OrderNotFoundError` no lo está). `OrderController` es la excepción: hace su propio try/catch en vez de `next(error)`.
- BD: `config/database.ts` exporta la instancia `dbConfig`; las tablas se crean en `runInitialMigrations()` al arrancar (no hay herramienta de migraciones). Fichero `packages/api/resttek.db`; con `NODE_ENV=test` usa `:memory:`.
- Endpoints bajo `/api/v1` (salvo `/health`). Rutas públicas sin auth en `/api/v1/public/...`. Al crear un pedido, cada ítem con `quantity: N` se expande a N filas de `order_items` para seguir el estado de cada unidad.
- Env: `PORT`, `NODE_ENV`, `JWT_SECRET` (tiene valor por defecto).
- Tests unitarios junto al código (`*.test.ts`), con dobles en `contexts/employee/application/mocks/` y `repositories/mocks/`. No hay tests HTTP (supertest instalado pero sin usar).

## Arquitectura de los frontends

- Angular 21: standalone components, signals, zoneless (sin `zone.js`), guards/interceptors funcionales, lazy loading con `loadComponent`/`loadChildren`, iconos con `lucide-angular` (cada `app.config.ts` registra solo los iconos que usa con `LucideAngularModule.pick()` — añade allí los nuevos).
- `web-admin` y `web-empleados`: `src/app/features/<feature>/{models,pages,services,store}`. Patrón **Store**: servicio `providedIn: 'root'` con signals privadas expuestas con `asReadonly()`, trío `loading`/`error`/datos, convierte el `Observable` del service con `firstValueFrom` y actualiza la lista en memoria tras crear/editar. Los componentes solo hablan con el store. `OrderStore` de empleados hace polling cada 30 s. Sus services usan `environment.apiUrl` directamente.
- `web-clientes` es distinta: modelos/servicios/store en `core/`, componente raíz `App` (no `AppComponent`), los componentes llaman a los services con `.subscribe()` directamente; el único store es `CartStore` (local, sin HTTP). Sus services inyectan el token `API_URL`.
- `@resttek/web-shared` se consume desde el fuente (`main: src/index.ts`, sin build): exporta `AuthStore` (token/usuario en localStorage), `AuthService`, `authGuard`, `authInterceptor` (Bearer), `errorInterceptor` (401 → logout + `/login`), `API_URL`, `LoginComponent`, `RegisterComponent`. Lo nuevo debe añadirse al barrel `index.ts`. **Tras cambiar `web-shared` hay que reiniciar el `ng serve`.**
- El filtrado por rol en `web-empleados` es solo de navegación (`computed()` en `ShellComponent`); la autorización real está en la API.
- Design system dark mode **duplicado**: cada app carga su propio `src/styles.css` (`web-shared/src/lib/styles/base.css` no se importa en ningún sitio). Un cambio de estilo común debe replicarse en las tres apps (`web-empleados` tiene además reglas propias).
