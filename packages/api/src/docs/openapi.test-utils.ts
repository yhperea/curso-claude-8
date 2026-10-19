import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'
import jwt from 'jsonwebtoken'
import type { Response } from 'supertest'
import { loadOpenApiSpec, resolveRef } from '@docs/openapi.js'
import type { HttpMethod } from '@docs/openapi.js'

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-resttek-key'

const spec = loadOpenApiSpec()

export function tokenFor(role: string, restaurantId: string | null = null, id: string = randomUUID()): string {
    return `Bearer ${jwt.sign({ id, role, restaurantId }, JWT_SECRET)}`
}

const deref = (node: any): any => (node?.$ref ? deref(resolveRef(spec, node.$ref)) : node)

const allowsType = (schema: any, type: string): boolean =>
    Array.isArray(schema.type) ? schema.type.includes(type) : schema.type === type

function expectValueMatchesSchema(value: unknown, rawSchema: any, where: string): void {
    const schema = deref(rawSchema)
    if (!schema || value === undefined) return

    if (value === null) {
        expect(allowsType(schema, 'null'), `${where} no admite null en el spec`).toBe(true)
        return
    }

    if (Array.isArray(value)) {
        expect(allowsType(schema, 'array'), `${where} es un array y el spec no lo dice`).toBe(true)
        value.forEach((item, i) => expectValueMatchesSchema(item, schema.items, `${where}[${i}]`))
        return
    }

    if (typeof value === 'object' && schema.properties) {
        const keys = Object.keys(value)
        const documented = Object.keys(schema.properties)
        const required: string[] = schema.required ?? []

        expect(documented, `${where}: claves no documentadas`).toEqual(expect.arrayContaining(keys))
        expect(keys, `${where}: faltan claves requeridas`).toEqual(expect.arrayContaining(required))

        for (const key of keys) {
            expectValueMatchesSchema((value as Record<string, unknown>)[key], schema.properties[key], `${where}.${key}`)
        }
    }
}

/**
 * Comprueba que una respuesta real de supertest encaja con la operación del spec:
 * el código está documentado y las claves del cuerpo JSON coinciden con el esquema
 * (todas las devueltas están en `properties` y están todas las `required`).
 */
export function expectMatchesSpec(method: HttpMethod, specPath: string, res: Response, expectedStatus?: number): void {
    const where = `${method.toUpperCase()} ${specPath} → ${res.status}`

    if (expectedStatus !== undefined) {
        expect(res.status, `${where}: ${JSON.stringify(res.body)}`).toBe(expectedStatus)
    }

    const operation = spec.paths[specPath]?.[method]
    expect(operation, `${method.toUpperCase()} ${specPath} no está en el spec`).toBeDefined()

    const response = deref(operation?.responses?.[String(res.status)])
    expect(response, `${where}: código no documentado`).toBeDefined()

    const schema = response.content?.['application/json']?.schema
    if (!schema) {
        expect(res.text ?? '', `${where}: el spec no documenta cuerpo`).toBe('')
        return
    }

    expect(res.headers['content-type'], where).toMatch(/application\/json/)
    expectValueMatchesSchema(res.body, schema, where)
}
