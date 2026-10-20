import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { loadOpenApiSpec } from '@docs/openapi.js'
import { generatedDocs } from '@docs/generated.js'

for (const { path, content } of generatedDocs(loadOpenApiSpec())) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
    console.log(`✓ ${relative(process.cwd(), path)}`)
}
