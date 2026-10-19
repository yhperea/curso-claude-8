import { describe, it, expect } from 'vitest'
import { loadOpenApiSpec, listOperations, resolveRef } from '@docs/openapi.js'

const collectRefs = (node: unknown, refs: string[] = []): string[] => {
    if (Array.isArray(node)) {
        node.forEach(child => collectRefs(child, refs))
    } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            if (key === '$ref' && typeof value === 'string') {
                refs.push(value)
            } else {
                collectRefs(value, refs)
            }
        }
    }
    return refs
}

describe('OpenAPI spec', () => {
    const spec = loadOpenApiSpec()
    const operations = listOperations(spec)

    it('declares an OpenAPI 3.x version with info and paths', () => {
        expect(spec.openapi).toMatch(/^3\./)
        expect(spec.info.title).toBeTruthy()
        expect(spec.info.version).toBeTruthy()
        expect(operations.length).toBeGreaterThan(0)
    })

    it('gives every operation a unique operationId, a tag and responses', () => {
        const ids = operations.map(op => op.operation.operationId)
        expect(ids.every(Boolean)).toBe(true)
        expect(new Set(ids).size).toBe(ids.length)

        for (const { method, path, operation } of operations) {
            expect(operation.tags?.length, `${method} ${path} tags`).toBeGreaterThan(0)
            expect(Object.keys(operation.responses ?? {}).length, `${method} ${path} responses`).toBeGreaterThan(0)
        }
    })

    it('resolves every internal $ref', () => {
        for (const ref of collectRefs(spec)) {
            expect(ref, ref).toMatch(/^#\//)
            expect(resolveRef(spec, ref), ref).toBeDefined()
        }
    })

    it('declares every path template variable as a path parameter', () => {
        for (const { method, path, operation, pathItem } of operations) {
            const declared = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
                .map(p => (p.$ref ? resolveRef(spec, p.$ref) : p))
                .filter(p => p.in === 'path')
                .map(p => p.name)
            const variables = [...path.matchAll(/\{(\w+)\}/g)].map(m => m[1])

            expect(declared.sort(), `${method} ${path}`).toEqual(variables.sort())
        }
    })
})
