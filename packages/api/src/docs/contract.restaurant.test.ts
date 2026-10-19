import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec, tokenFor } from '@docs/openapi.test-utils.js'

const restaurantInput = () => ({
    name: 'Contrato Bistró',
    address: 'Calle Falsa 123',
    email: `contract-restaurant-${randomUUID()}@resttek.test`,
    phone: '+34 600 000 000',
    ownerFirstName: 'Lucía',
    ownerLastName: 'Pérez',
    logoUrl: null
})

describe('Contrato OpenAPI: Restaurantes', () => {
    const admin = tokenFor('admin')
    let restaurantId: string

    beforeAll(async () => {
        await dbConfig.initialize()
    })

    it('POST /api/v1/restaurants crea un restaurante', async () => {
        const res = await request(app).post('/api/v1/restaurants').set('Authorization', admin).send(restaurantInput())
        expectMatchesSpec('post', '/api/v1/restaurants', res, 201)
        restaurantId = res.body.id
    })

    it('POST /api/v1/restaurants con datos inválidos', async () => {
        const res = await request(app)
            .post('/api/v1/restaurants')
            .set('Authorization', admin)
            .send({ ...restaurantInput(), phone: 'abc' })
        expectMatchesSpec('post', '/api/v1/restaurants', res, 400)
    })

    it('POST /api/v1/restaurants sin token', async () => {
        const res = await request(app).post('/api/v1/restaurants').send(restaurantInput())
        expectMatchesSpec('post', '/api/v1/restaurants', res, 401)
    })

    it('POST /api/v1/restaurants con un rol no permitido', async () => {
        const res = await request(app)
            .post('/api/v1/restaurants')
            .set('Authorization', tokenFor('camarero', restaurantId))
            .send(restaurantInput())
        expectMatchesSpec('post', '/api/v1/restaurants', res, 403)
    })

    it('GET /api/v1/restaurants como admin devuelve todos', async () => {
        const res = await request(app).get('/api/v1/restaurants').set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/restaurants', res, 200)
        expect(res.body.length).toBeGreaterThan(0)
    })

    it('GET /api/v1/restaurants como manager devuelve solo el suyo', async () => {
        const res = await request(app).get('/api/v1/restaurants').set('Authorization', tokenFor('manager', restaurantId))
        expectMatchesSpec('get', '/api/v1/restaurants', res, 200)
        expect(res.body.map((r: { id: string }) => r.id)).toEqual([restaurantId])
    })

    it('GET /api/v1/restaurants sin restaurante asignado devuelve []', async () => {
        const res = await request(app).get('/api/v1/restaurants').set('Authorization', tokenFor('cliente'))
        expectMatchesSpec('get', '/api/v1/restaurants', res, 200)
        expect(res.body).toEqual([])
    })

    it('GET /api/v1/restaurants/{id}', async () => {
        const res = await request(app).get(`/api/v1/restaurants/${restaurantId}`).set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/restaurants/{id}', res, 200)
    })

    it('GET /api/v1/restaurants/{id} inexistente', async () => {
        const res = await request(app).get(`/api/v1/restaurants/${randomUUID()}`).set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/restaurants/{id}', res, 404)
    })

    it('PUT /api/v1/restaurants/{id}', async () => {
        const res = await request(app)
            .put(`/api/v1/restaurants/${restaurantId}`)
            .set('Authorization', admin)
            .send({ ...restaurantInput(), name: 'Contrato Bistró Renovado' })
        expectMatchesSpec('put', '/api/v1/restaurants/{id}', res, 200)
    })

    it('PUT /api/v1/restaurants/{id} inexistente', async () => {
        const res = await request(app)
            .put(`/api/v1/restaurants/${randomUUID()}`)
            .set('Authorization', admin)
            .send(restaurantInput())
        expectMatchesSpec('put', '/api/v1/restaurants/{id}', res, 404)
    })

    it('GET /api/v1/public/restaurants', async () => {
        const res = await request(app).get('/api/v1/public/restaurants')
        expectMatchesSpec('get', '/api/v1/public/restaurants', res, 200)
    })

    it('GET /api/v1/public/restaurants/{id}', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${restaurantId}`)
        expectMatchesSpec('get', '/api/v1/public/restaurants/{id}', res, 200)
    })

    it('GET /api/v1/public/restaurants/{id} inexistente', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${randomUUID()}`)
        expectMatchesSpec('get', '/api/v1/public/restaurants/{id}', res, 404)
    })
})
