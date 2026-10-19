import { randomUUID } from 'node:crypto'
import { describe, it, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec } from '@docs/openapi.test-utils.js'

describe('Contrato OpenAPI: Auth', () => {
    const email = `contract-auth-${randomUUID()}@resttek.test`
    const password = 'secreta-123'

    beforeAll(async () => {
        await dbConfig.initialize()
    })

    it('POST /api/v1/auth/register registra un cliente', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ firstName: 'Ana', lastName: 'Contrato', email, password })
        expectMatchesSpec('post', '/api/v1/auth/register', res, 201)
    })

    it('POST /api/v1/auth/register con email duplicado', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ firstName: 'Ana', lastName: 'Contrato', email, password })
        expectMatchesSpec('post', '/api/v1/auth/register', res, 400)
    })

    it('POST /api/v1/auth/register con email inválido', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ firstName: 'Ana', lastName: 'Contrato', email: 'no-es-un-email', password })
        expectMatchesSpec('post', '/api/v1/auth/register', res, 400)
    })

    it('POST /api/v1/auth/login con credenciales válidas', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({ email, password })
        expectMatchesSpec('post', '/api/v1/auth/login', res, 200)
    })

    it('POST /api/v1/auth/login con contraseña errónea', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'otra' })
        expectMatchesSpec('post', '/api/v1/auth/login', res, 401)
    })
})
