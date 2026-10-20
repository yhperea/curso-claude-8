// Genera una página HTML estática y autocontenida (sin JS ni CDN) con la
// referencia de la API a partir del spec OpenAPI.
import { listOperations, resolveRef, type ListedOperation, type OpenApiSpec } from '@docs/openapi.js'

type Schema = Record<string, any>

const escapeHtml = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (text: string): string =>
    escapeHtml(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

// Markdown mínimo: párrafos, `## títulos`, listas `- ` y el inline de arriba.
const markdown = (text = ''): string =>
    text
        .split(/\n{2,}/)
        .map(chunk => {
            if (chunk.startsWith('## ')) return `<h3>${inline(chunk.slice(3))}</h3>`
            const lines = chunk.split('\n')
            if (lines.every(line => line.startsWith('- '))) {
                return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`
            }
            return `<p>${inline(chunk)}</p>`
        })
        .join('\n')

const slug = (text: string): string =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

const refName = (ref: string): string => ref.split('/').pop() ?? ref

const deref = (spec: OpenApiSpec, node: any): any => (node?.$ref ? resolveRef(spec, node.$ref) : node)

const typeLabel = (schema: Schema | undefined): string => {
    if (!schema) return '—'
    if (schema.$ref) {
        const name = refName(schema.$ref)
        return `<a href="#schema-${slug(name)}">${escapeHtml(name)}</a>`
    }
    if (schema.const !== undefined) return `<code>${escapeHtml(JSON.stringify(schema.const))}</code>`
    const types: string[] = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []
    const label = types
        .map(type => (type === 'array' ? `${typeLabel(schema.items)}[]` : escapeHtml(type)))
        .join(' | ')
    return schema.format ? `${label} <span class="muted">(${escapeHtml(schema.format)})</span>` : label
}

const CONSTRAINTS = ['minLength', 'minimum', 'exclusiveMinimum', 'pattern', 'default'] as const

const constraints = (schema: Schema): string => {
    const parts: string[] = []
    if (schema.enum) parts.push(`uno de: ${schema.enum.map((v: unknown) => `<code>${escapeHtml(String(v))}</code>`).join(', ')}`)
    for (const key of CONSTRAINTS) {
        if (schema[key] !== undefined) parts.push(`${key}: <code>${escapeHtml(JSON.stringify(schema[key]))}</code>`)
    }
    return parts.join('<br>')
}

const propertiesTable = (schema: Schema): string => {
    const required = new Set<string>(schema.required ?? [])
    const rows = Object.entries<Schema>(schema.properties ?? {})
        .map(([name, prop]) => `
            <tr>
              <td><code>${escapeHtml(name)}</code>${required.has(name) ? ' <span class="req">obligatorio</span>' : ''}</td>
              <td>${typeLabel(prop)}</td>
              <td>${[prop.description ? inline(prop.description) : '', constraints(prop)].filter(Boolean).join('<br>')}${nestedFields(prop)}</td>
            </tr>`)
        .join('')
    return `<div class="table-wrap"><table><thead><tr><th>Campo</th><th>Tipo</th><th>Detalles</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

// Objetos definidos en línea (sin $ref): sus campos se muestran anidados.
const nestedFields = (prop: Schema): string => {
    const inner = prop.items?.properties ? prop.items : prop.properties ? prop : undefined
    return inner ? `<div class="nested">${propertiesTable(inner)}</div>` : ''
}

// Cuerpo de petición o respuesta: el tipo enlazado y, si es un objeto, sus campos.
const bodySchema = (spec: OpenApiSpec, schema: Schema | undefined): string => {
    if (!schema) return ''
    const resolved = deref(spec, schema)
    const fields = resolved?.properties ? propertiesTable(resolved) : ''
    return `<p class="schema-type">${typeLabel(schema)}</p>${fields}`
}

const parametersTable = (spec: OpenApiSpec, { operation, pathItem }: ListedOperation): string => {
    const params = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map(p => deref(spec, p))
    if (params.length === 0) return ''
    const rows = params
        .map(p => `
            <tr>
              <td><code>${escapeHtml(p.name)}</code>${p.required ? ' <span class="req">obligatorio</span>' : ''}</td>
              <td>${escapeHtml(p.in)}</td>
              <td>${typeLabel(p.schema)}</td>
              <td>${[p.description ? inline(p.description) : '', constraints(deref(spec, p.schema) ?? {})].filter(Boolean).join('<br>')}</td>
            </tr>`)
        .join('')
    return `<h4>Parámetros</h4><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>En</th><th>Tipo</th><th>Detalles</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

const requestBody = (spec: OpenApiSpec, operation: ListedOperation['operation']): string => {
    const body = deref(spec, operation.requestBody)
    if (!body) return ''
    const schema = body.content?.['application/json']?.schema
    return `<h4>Cuerpo de la petición${body.required ? ' <span class="req">obligatorio</span>' : ''}</h4>${bodySchema(spec, schema)}`
}

const responses = (spec: OpenApiSpec, operation: ListedOperation['operation']): string => {
    const rows = Object.entries(operation.responses ?? {})
        .map(([code, response]) => {
            const resolved = deref(spec, response)
            const schema = resolved.content?.['application/json']?.schema
            return `
            <tr>
              <td><span class="status s${code[0]}">${escapeHtml(code)}</span></td>
              <td>${inline(resolved.description ?? '')}</td>
              <td>${schema ? typeLabel(schema) : '<span class="muted">sin cuerpo</span>'}</td>
            </tr>`
        })
        .join('')
    return `<h4>Respuestas</h4><div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th>Cuerpo</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

const operationCard = (spec: OpenApiSpec, op: ListedOperation): string => {
    const { method, path, operation } = op
    const isProtected = Array.isArray(operation.security) && operation.security.length > 0
    return `
      <article class="op" id="op-${escapeHtml(String(operation.operationId))}">
        <header>
          <span class="method m-${method}">${method.toUpperCase()}</span>
          <code class="path">${escapeHtml(path)}</code>
          <span class="auth ${isProtected ? 'locked' : 'public'}">${isProtected ? 'Bearer JWT' : 'Público'}</span>
        </header>
        <p class="summary">${inline(String(operation.summary ?? ''))}</p>
        <div class="desc">${markdown(String(operation.description ?? ''))}</div>
        ${parametersTable(spec, op)}
        ${requestBody(spec, operation)}
        ${responses(spec, operation)}
      </article>`
}

const schemaSection = (name: string, schema: Schema): string => `
      <article class="schema" id="schema-${slug(name)}">
        <h3>${escapeHtml(name)}</h3>
        ${schema.description ? `<p>${inline(schema.description)}</p>` : ''}
        ${schema.enum ? `<p>Enum (<code>${escapeHtml(String(schema.type))}</code>): ${schema.enum.map((v: unknown) => `<code>${escapeHtml(String(v))}</code>`).join(', ')}</p>` : ''}
        ${schema.properties ? propertiesTable(schema) : ''}
        ${schema.examples ? `<h4>Ejemplo</h4><pre>${escapeHtml(JSON.stringify(schema.examples[0], null, 2))}</pre>` : ''}
      </article>`

const STYLES = `
:root {
  --bg: #f7f7f8; --surface: #ffffff; --text: #1d1d21; --muted: #6b6b76; --border: #e2e2e7;
  --code-bg: #f0f0f3; --accent: #3a5bd9;
  --get: #1f7a4d; --post: #2a5bd7; --put: #a15c00; --patch: #7a3fc4; --delete: #c0362c;
  --s2: #1f7a4d; --s4: #a15c00; --s5: #c0362c;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #111114; --surface: #1a1a1f; --text: #e8e8ec; --muted: #9a9aa6; --border: #2c2c34;
    --code-bg: #24242b; --accent: #8aa4ff;
    --get: #4fc58b; --post: #7ea2ff; --put: #f0a849; --patch: #b98cf5; --delete: #f2786c;
    --s2: #4fc58b; --s4: #f0a849; --s5: #f2786c;
  }
}
:root[data-theme="dark"] {
  --bg: #111114; --surface: #1a1a1f; --text: #e8e8ec; --muted: #9a9aa6; --border: #2c2c34;
  --code-bg: #24242b; --accent: #8aa4ff;
  --get: #4fc58b; --post: #7ea2ff; --put: #f0a849; --patch: #b98cf5; --delete: #f2786c;
  --s2: #4fc58b; --s4: #f0a849; --s5: #f2786c;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code, pre { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 0.88em; }
code { background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 4px; }
pre { background: var(--code-bg); padding: 12px; border-radius: 6px; overflow-x: auto; }
.layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); max-width: 1280px; margin: 0 auto; }
nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 24px 16px; border-right: 1px solid var(--border); }
nav h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 20px 0 6px; }
nav ul { list-style: none; margin: 0; padding: 0; }
nav li a { display: flex; gap: 8px; align-items: baseline; padding: 3px 0; color: var(--text); font-size: 0.85rem; min-width: 0; }
nav li a span:last-child { overflow-wrap: anywhere; }
nav li a .method { font-size: 0.62rem; min-width: 52px; }
main { padding: 32px 40px 80px; min-width: 0; }
h1 { margin: 0 0 4px; font-size: 1.9rem; }
.version { color: var(--muted); margin: 0 0 24px; }
section > h2 { margin: 48px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.op, .schema { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 18px 20px; margin: 16px 0; }
.op header { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.path { background: none; padding: 0; font-size: 0.98rem; font-weight: 600; word-break: break-all; }
.method { display: inline-block; font: 700 0.72rem/1 ui-monospace, Menlo, monospace; padding: 5px 7px; border-radius: 4px; color: #fff; text-align: center; }
.m-get { background: var(--get); } .m-post { background: var(--post); } .m-put { background: var(--put); }
.m-patch { background: var(--patch); } .m-delete { background: var(--delete); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .method { color: #111114; } }
:root[data-theme="dark"] .method { color: #111114; }
.auth { margin-left: auto; font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.auth.locked { color: var(--put); border-color: currentColor; }
.summary { font-weight: 600; margin: 12px 0 4px; }
.desc p { margin: 4px 0; color: var(--muted); }
h4 { margin: 18px 0 6px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 0.78rem; }
.req { font-size: 0.7rem; color: var(--delete); margin-left: 4px; }
.muted { color: var(--muted); }
.status { font: 700 0.8rem ui-monospace, Menlo, monospace; }
.s2 { color: var(--s2); } .s4 { color: var(--s4); } .s5 { color: var(--s5); }
.schema-type { margin: 4px 0; }
.nested { margin-top: 6px; padding-left: 8px; border-left: 2px solid var(--border); }
.intro h3 { margin: 24px 0 6px; }
@media (max-width: 860px) {
  .layout { grid-template-columns: 1fr; }
  nav { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
  main { padding: 24px 16px 60px; }
}
`

export function renderHtml(spec: OpenApiSpec): string {
    const operations = listOperations(spec)
    const tags: { name: string; description?: string }[] = (spec.tags as any[]) ?? []
    const byTag = tags.map(tag => ({
        ...tag,
        operations: operations.filter(op => op.operation.tags?.[0] === tag.name)
    }))
    const schemas = Object.entries<Schema>(spec.components?.schemas ?? {})
    const servers = ((spec.servers as { url: string }[] | undefined) ?? []).map(s => `<code>${escapeHtml(s.url)}</code>`).join(', ')

    const nav = byTag
        .map(tag => `
        <h2><a href="#tag-${slug(tag.name)}">${escapeHtml(tag.name)}</a></h2>
        <ul>${tag.operations
            .map(({ method, path, operation }) => `<li><a href="#op-${escapeHtml(String(operation.operationId))}" title="${method.toUpperCase()} ${escapeHtml(path)}"><span class="method m-${method}">${method.toUpperCase()}</span><span>${escapeHtml(String(operation.summary ?? path))}</span></a></li>`)
            .join('')}</ul>`)
        .join('')

    const sections = byTag
        .map(tag => `
      <section id="tag-${slug(tag.name)}">
        <h2>${escapeHtml(tag.name)}</h2>
        ${tag.description ? `<p class="muted">${inline(tag.description)}</p>` : ''}
        ${tag.operations.map(op => operationCard(spec, op)).join('')}
      </section>`)
        .join('')

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(spec.info.title)}</title>
<!-- Generado desde packages/api/src/docs/openapi.json con \`npm run docs:build\`. No editar a mano. -->
<style>${STYLES}</style>
</head>
<body>
<div class="layout">
  <nav>
    <strong>${escapeHtml(spec.info.title)}</strong>
    ${nav}
    <h2><a href="#schemas">Esquemas</a></h2>
  </nav>
  <main>
    <h1>${escapeHtml(spec.info.title)}</h1>
    <p class="version">Versión ${escapeHtml(spec.info.version)} · OpenAPI ${escapeHtml(spec.openapi)}${servers ? ` · Servidor: ${servers}` : ''}</p>
    <div class="intro">${markdown(spec.info.description)}</div>
    ${sections}
    <section id="schemas">
      <h2>Esquemas</h2>
      ${schemas.map(([name, schema]) => schemaSection(name, schema)).join('')}
    </section>
  </main>
</div>
</body>
</html>
`
}
