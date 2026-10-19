import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec, tokenFor } from '@docs/openapi.test-utils.js'

const COLLECTION = '/api/v1/restaurants/{restaurantId}/dishes'
const ITEM = '/api/v1/restaurants/{restaurantId}/dishes/{id}'
const PUBLIC = '/api/v1/public/restaurants/{restaurantId}/dishes'

describe('Contrato OpenAPI: Platos', () => {
    const admin = tokenFor('admin')
    let restaurantId: string
    let ingredientId: string
    let availableDishId: string
    let unavailableDishId: string
    let base: string

    const dishInput = (overrides: Record<string, unknown> = {}) => ({
        name: 'Gazpacho',
        description: 'Frío',
        price: 6.5,
        category: 'entrante',
        available: true,
        ingredients: [{ ingredientId, quantity: 0.3 }],
        ...overrides
    })

    beforeAll(async () => {
        await dbConfig.initialize()
        const restaurant = await request(app).post('/api/v1/restaurants').set('Authorization', admin).send({
            name: 'Contrato Platos',
            address: 'Calle Falsa 3',
            email: `contract-dish-restaurant-${randomUUID()}@resttek.test`,
            phone: '600000000',
            ownerFirstName: 'Eva',
            ownerLastName: 'Gil'
        })
        restaurantId = restaurant.body.id
        base = `/api/v1/restaurants/${restaurantId}/dishes`

        const ingredient = await request(app)
            .post(`/api/v1/restaurants/${restaurantId}/ingredients`)
            .set('Authorization', admin)
            .send({ name: 'Tomate', unit: 'kg', currentStock: 10 })
        ingredientId = ingredient.body.id
    })

    it('POST crea un plato disponible', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send(dishInput())
        expectMatchesSpec('post', COLLECTION, res, 201)
        availableDishId = res.body.id
    })

    it('POST crea un plato no disponible', async () => {
        const res = await request(app)
            .post(base)
            .set('Authorization', tokenFor('manager', restaurantId))
            .send(dishInput({ name: 'Flan', category: 'postre', available: false, ingredients: [] }))
        expectMatchesSpec('post', COLLECTION, res, 201)
        unavailableDishId = res.body.id
    })

    it('POST con categoría inválida', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send(dishInput({ category: 'tapa' }))
        expectMatchesSpec('post', COLLECTION, res, 400)
    })

    it('POST con un rol no permitido', async () => {
        const res = await request(app).post(base).set('Authorization', tokenFor('camarero', restaurantId)).send(dishInput())
        expectMatchesSpec('post', COLLECTION, res, 403)
    })

    it('GET lista todos los platos', async () => {
        const res = await request(app).get(base).set('Authorization', tokenFor('camarero', restaurantId))
        expectMatchesSpec('get', COLLECTION, res, 200)
        expect(res.body.map((d: { id: string }) => d.id)).toEqual(expect.arrayContaining([availableDishId, unavailableDishId]))
    })

    it('GET sin token', async () => {
        const res = await request(app).get(base)
        expectMatchesSpec('get', COLLECTION, res, 401)
    })

    it('GET {id}', async () => {
        const res = await request(app).get(`${base}/${availableDishId}`).set('Authorization', admin)
        expectMatchesSpec('get', ITEM, res, 200)
    })

    it('GET {id} inexistente', async () => {
        const res = await request(app).get(`${base}/${randomUUID()}`).set('Authorization', admin)
        expectMatchesSpec('get', ITEM, res, 404)
    })

    it('GET carta pública devuelve solo los disponibles', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${restaurantId}/dishes`)
        expectMatchesSpec('get', PUBLIC, res, 200)
        expect(res.body.map((d: { id: string }) => d.id)).toEqual([availableDishId])
    })

    it('PUT {id} actualiza el plato', async () => {
        const res = await request(app)
            .put(`${base}/${availableDishId}`)
            .set('Authorization', admin)
            .send(dishInput({ price: 7 }))
        expectMatchesSpec('put', ITEM, res, 200)
    })

    it('PUT {id} con precio inválido', async () => {
        const res = await request(app)
            .put(`${base}/${availableDishId}`)
            .set('Authorization', admin)
            .send(dishInput({ price: 0 }))
        expectMatchesSpec('put', ITEM, res, 400)
    })

    it('PUT {id} inexistente', async () => {
        const res = await request(app).put(`${base}/${randomUUID()}`).set('Authorization', admin).send(dishInput())
        expectMatchesSpec('put', ITEM, res, 404)
    })

    it('DELETE {id} borra el plato', async () => {
        const res = await request(app).delete(`${base}/${unavailableDishId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 204)
    })

    it('DELETE {id} inexistente', async () => {
        const res = await request(app).delete(`${base}/${unavailableDishId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 404)
    })
})
