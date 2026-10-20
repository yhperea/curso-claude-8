import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { loadOpenApiSpec, listOperations } from '@docs/openapi.js'
import { toYaml } from '@docs/openapi.yaml.js'
import { renderHtml } from '@docs/openapi.html.js'
import { generatedDocs } from '@docs/generated.js'

describe('toYaml', () => {
    it('serializa objetos, arrays y escalares', () => {
        expect(toYaml({ a: 1, b: true, c: null, d: [], e: {}, f: ['x', { g: 'z', h: [1] }] })).toBe(
            ['a: 1', 'b: true', 'c: null', 'd: []', 'e: {}', 'f:', '  - x', '  - g: z', '    h:', '      - 1', ''].join('\n')
        )
    })

    it('entrecomilla las cadenas que no son seguras como escalar plano', () => {
        expect(toYaml({
            '200': 'Roles: `admin`.',
            $ref: '#/components/schemas/Role',
            path: '/api/v1/orders/{id}',
            word: 'no',
            num: '1.0.0',
            text: 'Crear un plato'
        })).toBe([
            '"200": "Roles: `admin`."',
            '$ref: "#/components/schemas/Role"',
            'path: /api/v1/orders/{id}',
            'word: "no"',
            'num: "1.0.0"',
            'text: Crear un plato',
            ''
        ].join('\n'))
    })

    it('escribe las cadenas multilínea como bloque literal', () => {
        expect(toYaml({ d: 'uno\n\n- dos' })).toBe('d: |-\n  uno\n\n  - dos\n')
    })
})

describe('renderHtml', () => {
    const spec = loadOpenApiSpec()
    const html = renderHtml(spec)

    it('incluye todas las operaciones y todos los esquemas', () => {
        for (const { operation } of listOperations(spec)) {
            expect(html).toContain(`id="op-${operation.operationId}"`)
        }
        for (const name of Object.keys(spec.components?.schemas ?? {})) {
            expect(html).toContain(`id="schema-${name.toLowerCase()}"`)
        }
    })

    it('enlaza solo a anclas que existen', () => {
        const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]))
        const targets = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1])
        expect(targets.filter(target => !ids.has(target))).toEqual([])
    })
})

describe('docs/api generados', () => {
    it.each(generatedDocs(loadOpenApiSpec()))('$path está al día (npm run docs:build)', ({ path, content }) => {
        expect(readFileSync(path, 'utf-8')).toBe(content)
    })
})
