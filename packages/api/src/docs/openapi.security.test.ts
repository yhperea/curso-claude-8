import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { loadOpenApiSpec, listOperations } from '@docs/openapi.js'
import { tokenFor } from '@docs/openapi.test-utils.js'

const ALL_ROLES = ['admin', 'manager', 'camarero', 'cocinero', 'cliente']

const operations = listOperations(loadOpenApiSpec()).map(op => {
    const description = String(op.operation.description ?? '')
    const rolesLine = description.match(/^Roles: ([^.\n]+)/)?.[1] ?? ''
    const roles = [...rolesLine.matchAll(/`(\w+)`/g)].map(m => m[1] as string)
    return {
        ...op,
        label: `${op.method.toUpperCase()} ${op.path}`,
        url: op.path.replace(/\{\w+\}/g, () => randomUUID()),
        isProtected: (op.operation.security as unknown[] | undefined)?.length === 1,
        anyAuthenticated: rolesLine.includes('**autenticado**'),
        roles
    }
})

const send = (method: string, url: string, token?: string) => {
    const req = request(app)[method as 'get'](url)
    return token ? req.set('Authorization', token) : req
}

describe('Seguridad documentada en OpenAPI', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
    })

    it.each(operations.filter(op => op.isProtected))('$label declara roles, 401 y 403 si filtra por rol', async op => {
        expect(op.operation.security).toEqual([{ bearerAuth: [] }])
        expect(op.anyAuthenticated || op.roles.length > 0, 'la descripción debe empezar por "Roles: ..."').toBe(true)
        expect(op.operation.responses?.['401']).toBeDefined()
        expect(op.operation.responses?.['403'] !== undefined).toBe(!op.anyAuthenticated)

        const anonymous = await send(op.method, op.url)
        expect(anonymous.status).toBe(401)

        for (const role of ALL_ROLES) {
            const res = await send(op.method, op.url, tokenFor(role))
            const allowed = op.anyAuthenticated || op.roles.includes(role)
            expect(res.status === 403, `${role}: ${res.status}`).toBe(!allowed)
        }
    })

    it.each(operations.filter(op => !op.isProtected))('$label es pública', async op => {
        expect(String(op.operation.description)).toMatch(/^Público/)
        const res = await send(op.method, op.url)
        expect([401, 403]).not.toContain(res.status)
    })
})
