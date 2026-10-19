import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec, tokenFor } from '@docs/openapi.test-utils.js'

const COLLECTION = '/api/v1/restaurants/{restaurantId}/ingredients'
const ITEM = '/api/v1/restaurants/{restaurantId}/ingredients/{id}'

describe('Contrato OpenAPI: Ingredientes', () => {
    const admin = tokenFor('admin')
    let restaurantId: string
    let ingredientId: string
    let base: string

    beforeAll(async () => {
        await dbConfig.initialize()
        const res = await request(app).post('/api/v1/restaurants').set('Authorization', admin).send({
            name: 'Contrato Ingredientes',
            address: 'Calle Falsa 2',
            email: `contract-ingredient-restaurant-${randomUUID()}@resttek.test`,
            phone: '600000000',
            ownerFirstName: 'Eva',
            ownerLastName: 'Gil'
        })
        restaurantId = res.body.id
        base = `/api/v1/restaurants/${restaurantId}/ingredients`
    })

    it('POST crea un ingrediente', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send({ name: 'Tomate', unit: 'kg', currentStock: 5 })
        expectMatchesSpec('post', COLLECTION, res, 201)
        ingredientId = res.body.id
    })

    it('POST con unidad inválida', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send({ name: 'Leche', unit: 'litros' })
        expectMatchesSpec('post', COLLECTION, res, 400)
    })

    it('POST con stock negativo', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send({ name: 'Sal', unit: 'g', currentStock: -1 })
        expectMatchesSpec('post', COLLECTION, res, 400)
    })

    it('POST con un rol no permitido', async () => {
        const res = await request(app)
            .post(base)
            .set('Authorization', tokenFor('cocinero', restaurantId))
            .send({ name: 'Ajo', unit: 'unidad' })
        expectMatchesSpec('post', COLLECTION, res, 403)
    })

    it('GET lista los ingredientes', async () => {
        const res = await request(app).get(base).set('Authorization', tokenFor('cocinero', restaurantId))
        expectMatchesSpec('get', COLLECTION, res, 200)
        expect(res.body.map((i: { id: string }) => i.id)).toContain(ingredientId)
    })

    it('GET sin token', async () => {
        const res = await request(app).get(base)
        expectMatchesSpec('get', COLLECTION, res, 401)
    })

    it('GET {id}', async () => {
        const res = await request(app).get(`${base}/${ingredientId}`).set('Authorization', admin)
        expectMatchesSpec('get', ITEM, res, 200)
    })

    it('GET {id} inexistente', async () => {
        const res = await request(app).get(`${base}/${randomUUID()}`).set('Authorization', admin)
        expectMatchesSpec('get', ITEM, res, 404)
    })

    it('PUT {id} actualiza el ingrediente', async () => {
        const res = await request(app)
            .put(`${base}/${ingredientId}`)
            .set('Authorization', admin)
            .send({ name: 'Tomate pera', unit: 'kg', currentStock: 3 })
        expectMatchesSpec('put', ITEM, res, 200)
    })

    it('PUT {id} inexistente', async () => {
        const res = await request(app)
            .put(`${base}/${randomUUID()}`)
            .set('Authorization', admin)
            .send({ name: 'Nada', unit: 'kg', currentStock: 0 })
        expectMatchesSpec('put', ITEM, res, 404)
    })

    it('DELETE {id} borra el ingrediente', async () => {
        const res = await request(app).delete(`${base}/${ingredientId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 204)
    })

    it('DELETE {id} inexistente', async () => {
        const res = await request(app).delete(`${base}/${ingredientId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 404)
    })
})
