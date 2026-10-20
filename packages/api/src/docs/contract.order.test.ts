import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec, tokenFor } from '@docs/openapi.test-utils.js'

const STATUS = '/api/v1/orders/{orderId}/items/{itemId}/status'

describe('Contrato OpenAPI: Pedidos', () => {
    const admin = tokenFor('admin')
    const clientId = randomUUID()
    const client = tokenFor('cliente', null, clientId)
    let restaurantId: string
    let dishId: string
    let tableId: string
    let orderId: string
    let itemId: string

    beforeAll(async () => {
        await dbConfig.initialize()
        const restaurant = await request(app).post('/api/v1/restaurants').set('Authorization', admin).send({
            name: 'Contrato Pedidos',
            address: 'Calle Falsa 4',
            email: `contract-order-restaurant-${randomUUID()}@resttek.test`,
            phone: '600000000',
            ownerFirstName: 'Eva',
            ownerLastName: 'Gil'
        })
        restaurantId = restaurant.body.id

        const dish = await request(app)
            .post(`/api/v1/restaurants/${restaurantId}/dishes`)
            .set('Authorization', admin)
            .send({ name: 'Croquetas', price: 8, category: 'entrante' })
        dishId = dish.body.id

        const table = await request(app)
            .post(`/api/v1/restaurants/${restaurantId}/tables`)
            .set('Authorization', admin)
            .send({ number: 4, capacity: 4 })
        tableId = table.body.id
        await request(app)
            .post(`/api/v1/restaurants/${restaurantId}/tables/${tableId}/occupy`)
            .set('Authorization', client)
            .send({ people: 2 })
    })

    it('POST /api/v1/orders expande cada unidad en un ítem', async () => {
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', client)
            .send({ restaurantId, tableId, items: [{ dishId, quantity: 2, notes: 'sin gluten' }] })
        expectMatchesSpec('post', '/api/v1/orders', res, 201)
        expect(res.body.items).toHaveLength(2)
        expect(res.body.tableNumber).toBe(4)
        expect(res.body.clientId).toBe(clientId)
        orderId = res.body.id
        itemId = res.body.items[0].id
    })

    it('POST /api/v1/orders sin restaurantId', async () => {
        const res = await request(app).post('/api/v1/orders').set('Authorization', client).send({ items: [] })
        expectMatchesSpec('post', '/api/v1/orders', res, 400)
    })

    it('POST /api/v1/orders con una mesa inexistente', async () => {
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', client)
            .send({ restaurantId, tableId: 'mesa-4', items: [{ dishId, quantity: 1 }] })
        expectMatchesSpec('post', '/api/v1/orders', res, 400)
        expect(res.body.error).toBe('Table not found')
    })

    it('POST /api/v1/orders sin token', async () => {
        const res = await request(app).post('/api/v1/orders').send({ restaurantId, items: [] })
        expectMatchesSpec('post', '/api/v1/orders', res, 401)
    })

    it('GET /api/v1/orders/active', async () => {
        const res = await request(app)
            .get('/api/v1/orders/active')
            .query({ restaurantId })
            .set('Authorization', tokenFor('cocinero', restaurantId))
        expectMatchesSpec('get', '/api/v1/orders/active', res, 200)
        expect(res.body.map((o: { id: string }) => o.id)).toContain(orderId)
        expect(res.body.find((o: { id: string }) => o.id === orderId).tableNumber).toBe(4)
    })

    it('GET /api/v1/orders/active sin restaurantId', async () => {
        const res = await request(app).get('/api/v1/orders/active').set('Authorization', tokenFor('cocinero', restaurantId))
        expectMatchesSpec('get', '/api/v1/orders/active', res, 400)
    })

    it('GET /api/v1/orders/mine', async () => {
        const res = await request(app).get('/api/v1/orders/mine').set('Authorization', client)
        expectMatchesSpec('get', '/api/v1/orders/mine', res, 200)
        expect(res.body.map((o: { id: string }) => o.id)).toEqual([orderId])
    })

    it('GET /api/v1/orders/{id}', async () => {
        const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', client)
        expectMatchesSpec('get', '/api/v1/orders/{id}', res, 200)
    })

    it('GET /api/v1/orders/{id} inexistente', async () => {
        const res = await request(app).get(`/api/v1/orders/${randomUUID()}`).set('Authorization', client)
        expectMatchesSpec('get', '/api/v1/orders/{id}', res, 404)
    })

    it('PATCH estado de un ítem', async () => {
        const res = await request(app)
            .patch(`/api/v1/orders/${orderId}/items/${itemId}/status`)
            .set('Authorization', tokenFor('cocinero', restaurantId))
            .send({ status: 'preparando' })
        expectMatchesSpec('patch', STATUS, res, 204)
    })

    it('PATCH con estado inválido', async () => {
        const res = await request(app)
            .patch(`/api/v1/orders/${orderId}/items/${itemId}/status`)
            .set('Authorization', tokenFor('cocinero', restaurantId))
            .send({ status: 'quemado' })
        expectMatchesSpec('patch', STATUS, res, 400)
    })

    it('PATCH sobre un pedido inexistente responde 400', async () => {
        const res = await request(app)
            .patch(`/api/v1/orders/${randomUUID()}/items/${itemId}/status`)
            .set('Authorization', tokenFor('cocinero', restaurantId))
            .send({ status: 'listo' })
        expectMatchesSpec('patch', STATUS, res, 400)
    })
})
