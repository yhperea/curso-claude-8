import { fileURLToPath } from 'node:url'
import type { OpenApiSpec } from '@docs/openapi.js'
import { toYaml } from '@docs/openapi.yaml.js'
import { renderHtml } from '@docs/openapi.html.js'

// Ficheros derivados de openapi.json que se versionan en docs/api/ del repo.
// Se regeneran con `npm run docs:build`; openapi.generated.test.ts falla si
// están desactualizados.
const OUTPUT_DIR = new URL('../../../../docs/api/', import.meta.url)

export interface GeneratedFile {
    path: string
    content: string
}

export function generatedDocs(spec: OpenApiSpec): GeneratedFile[] {
    const header = '# Generado desde packages/api/src/docs/openapi.json con `npm run docs:build`. No editar a mano.\n'
    return [
        { path: fileURLToPath(new URL('openapi.yaml', OUTPUT_DIR)), content: header + toYaml(spec) },
        { path: fileURLToPath(new URL('index.html', OUTPUT_DIR)), content: renderHtml(spec) }
    ]
}
