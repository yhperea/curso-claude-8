import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec, tokenFor } from '@docs/openapi.test-utils.js'

const COLLECTION = '/api/v1/restaurants/{restaurantId}/tables'
const ITEM = '/api/v1/restaurants/{restaurantId}/tables/{id}'
const STATUS = '/api/v1/restaurants/{restaurantId}/tables/{id}/status'
const OCCUPY = '/api/v1/restaurants/{restaurantId}/tables/{id}/occupy'
const ORDERS = '/api/v1/restaurants/{restaurantId}/tables/{id}/orders'
const PUBLIC = '/api/v1/public/restaurants/{restaurantId}/tables'

describe('Contrato OpenAPI: Mesas', () => {
    const admin = tokenFor('admin')
    const client = tokenFor('cliente')
    let restaurantId: string
    let camarero: string
    let base: string
    let dishId: string
    let smallTableId: string
    let bigTableId: string

    beforeAll(async () => {
        await dbConfig.initialize()
        const restaurant = await request(app).post('/api/v1/restaurants').set('Authorization', admin).send({
            name: 'Contrato Mesas',
            address: 'Calle Falsa 5',
            email: `contract-table-restaurant-${randomUUID()}@resttek.test`,
            phone: '600000000',
            ownerFirstName: 'Eva',
            ownerLastName: 'Gil'
        })
        restaurantId = restaurant.body.id
        camarero = tokenFor('camarero', restaurantId)
        base = `/api/v1/restaurants/${restaurantId}/tables`

        const dish = await request(app)
            .post(`/api/v1/restaurants/${restaurantId}/dishes`)
            .set('Authorization', admin)
            .send({ name: 'Croquetas', price: 8, category: 'entrante' })
        dishId = dish.body.id
    })

    it('POST crea una mesa libre', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send({ number: 1, description: 'Ventana', capacity: 2 })
        expectMatchesSpec('post', COLLECTION, res, 201)
        expect(res.body).toMatchObject({ status: 'libre', occupiedAt: null })
        smallTableId = res.body.id
    })

    it('POST como manager', async () => {
        const res = await request(app)
            .post(base)
            .set('Authorization', tokenFor('manager', restaurantId))
            .send({ number: 2, capacity: 6 })
        expectMatchesSpec('post', COLLECTION, res, 201)
        expect(res.body.description).toBeNull()
        bigTableId = res.body.id
    })

    it('POST con capacidad inválida', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send({ number: 3, capacity: 0 })
        expectMatchesSpec('post', COLLECTION, res, 400)
        expect(res.body.error).toBe('InvalidTableCapacityError')
    })

    it('POST con número repetido', async () => {
        const res = await request(app).post(base).set('Authorization', admin).send({ number: 1, capacity: 4 })
        expectMatchesSpec('post', COLLECTION, res, 409)
        expect(res.body.error).toBe('TableNumberAlreadyExistsError')
    })

    it('POST con un rol no permitido', async () => {
        const res = await request(app).post(base).set('Authorization', camarero).send({ number: 9, capacity: 4 })
        expectMatchesSpec('post', COLLECTION, res, 403)
    })

    it('GET lista las mesas ordenadas por número', async () => {
        const res = await request(app).get(base).set('Authorization', camarero)
        expectMatchesSpec('get', COLLECTION, res, 200)
        expect(res.body.map((t: { number: number }) => t.number)).toEqual([1, 2])
    })

    it('GET con filtro de estado inválido', async () => {
        const res = await request(app).get(base).query({ status: 'sucia' }).set('Authorization', camarero)
        expectMatchesSpec('get', COLLECTION, res, 400)
    })

    it('GET sin token', async () => {
        const res = await request(app).get(base)
        expectMatchesSpec('get', COLLECTION, res, 401)
    })

    it('GET {id}', async () => {
        const res = await request(app).get(`${base}/${smallTableId}`).set('Authorization', tokenFor('cocinero', restaurantId))
        expectMatchesSpec('get', ITEM, res, 200)
    })

    it('GET {id} de otro restaurante', async () => {
        const res = await request(app).get(`/api/v1/restaurants/${randomUUID()}/tables/${smallTableId}`).set('Authorization', admin)
        expectMatchesSpec('get', ITEM, res, 404)
        expect(res.body.error).toBe('TableNotFoundError')
    })

    it('PUT {id} actualiza la mesa', async () => {
        const res = await request(app)
            .put(`${base}/${smallTableId}`)
            .set('Authorization', admin)
            .send({ number: 1, description: 'Ventana', capacity: 4 })
        expectMatchesSpec('put', ITEM, res, 200)
        expect(res.body).toMatchObject({ capacity: 4, status: 'libre' })
    })

    it('PUT {id} con número inválido', async () => {
        const res = await request(app).put(`${base}/${smallTableId}`).set('Authorization', admin).send({ number: 0, capacity: 4 })
        expectMatchesSpec('put', ITEM, res, 400)
    })

    it('PUT {id} con el número de otra mesa', async () => {
        const res = await request(app).put(`${base}/${smallTableId}`).set('Authorization', admin).send({ number: 2, capacity: 4 })
        expectMatchesSpec('put', ITEM, res, 409)
    })

    it('PUT {id} inexistente', async () => {
        const res = await request(app).put(`${base}/${randomUUID()}`).set('Authorization', admin).send({ number: 5, capacity: 4 })
        expectMatchesSpec('put', ITEM, res, 404)
    })

    it('GET público devuelve las libres donde caben, la más ajustada primero', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${restaurantId}/tables`).query({ people: 3 })
        expectMatchesSpec('get', PUBLIC, res, 200)
        expect(res.body.map((t: { id: string }) => t.id)).toEqual([smallTableId, bigTableId])
    })

    it('GET público sin people', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${restaurantId}/tables`)
        expectMatchesSpec('get', PUBLIC, res, 400)
        expect(res.body.error).toBe('InvalidPeopleCountError')
    })

    it('POST occupy con más personas que la capacidad', async () => {
        const res = await request(app).post(`${base}/${smallTableId}/occupy`).set('Authorization', client).send({ people: 5 })
        expectMatchesSpec('post', OCCUPY, res, 400)
        expect(res.body.error).toBe('TableCapacityExceededError')
    })

    it('POST occupy ocupa la mesa', async () => {
        const res = await request(app).post(`${base}/${smallTableId}/occupy`).set('Authorization', client).send({ people: 3 })
        expectMatchesSpec('post', OCCUPY, res, 200)
        expect(res.body.status).toBe('ocupada')
        expect(res.body.occupiedAt).not.toBeNull()
    })

    it('POST occupy sobre una mesa ya ocupada', async () => {
        const res = await request(app).post(`${base}/${smallTableId}/occupy`).set('Authorization', client).send({ people: 2 })
        expectMatchesSpec('post', OCCUPY, res, 409)
        expect(res.body.error).toBe('TableNotAvailableError')
    })

    it('POST occupy con un rol no permitido', async () => {
        const res = await request(app).post(`${base}/${bigTableId}/occupy`).set('Authorization', camarero).send({ people: 2 })
        expectMatchesSpec('post', OCCUPY, res, 403)
    })

    it('GET público ya no incluye la mesa ocupada', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${restaurantId}/tables`).query({ people: 1 })
        expectMatchesSpec('get', PUBLIC, res, 200)
        expect(res.body.map((t: { id: string }) => t.id)).toEqual([bigTableId])
    })

    it('POST /api/v1/orders en la mesa ocupada devuelve tableNumber', async () => {
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', client)
            .send({ restaurantId, tableId: smallTableId, items: [{ dishId, quantity: 1 }] })
        expectMatchesSpec('post', '/api/v1/orders', res, 201)
        expect(res.body.tableNumber).toBe(1)
    })

    it('POST /api/v1/orders en una mesa no ocupada', async () => {
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', client)
            .send({ restaurantId, tableId: bigTableId, items: [{ dishId, quantity: 1 }] })
        expectMatchesSpec('post', '/api/v1/orders', res, 400)
        expect(res.body.error).toBe('Table is not occupied')
    })

    it('GET {id}/orders devuelve los pedidos de la ocupación actual', async () => {
        const res = await request(app).get(`${base}/${smallTableId}/orders`).set('Authorization', camarero)
        expectMatchesSpec('get', ORDERS, res, 200)
        expect(res.body).toHaveLength(1)
        expect(res.body[0]).toMatchObject({ tableId: smallTableId, tableNumber: 1 })
        expect(res.body[0].items[0].dishName).toBe('Croquetas')
    })

    it('GET {id}/orders de una mesa libre devuelve []', async () => {
        const res = await request(app).get(`${base}/${bigTableId}/orders`).set('Authorization', camarero)
        expectMatchesSpec('get', ORDERS, res, 200)
        expect(res.body).toEqual([])
    })

    it('DELETE {id} de una mesa ocupada', async () => {
        const res = await request(app).delete(`${base}/${smallTableId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 409)
        expect(res.body.error).toBe('TableOccupiedError')
    })

    it('PATCH status libera la mesa', async () => {
        const res = await request(app).patch(`${base}/${smallTableId}/status`).set('Authorization', camarero).send({ status: 'libre' })
        expectMatchesSpec('patch', STATUS, res, 200)
        expect(res.body).toMatchObject({ status: 'libre', occupiedAt: null })
    })

    it('PATCH status con estado inválido', async () => {
        const res = await request(app).patch(`${base}/${smallTableId}/status`).set('Authorization', camarero).send({ status: 'sucia' })
        expectMatchesSpec('patch', STATUS, res, 400)
        expect(res.body.error).toBe('InvalidTableStatusError')
    })

    it('PATCH status inexistente', async () => {
        const res = await request(app).patch(`${base}/${randomUUID()}/status`).set('Authorization', camarero).send({ status: 'libre' })
        expectMatchesSpec('patch', STATUS, res, 404)
    })

    it('GET {id}/orders inexistente', async () => {
        const res = await request(app).get(`${base}/${randomUUID()}/orders`).set('Authorization', camarero)
        expectMatchesSpec('get', ORDERS, res, 404)
    })

    it('DELETE {id} borra la mesa', async () => {
        const res = await request(app).delete(`${base}/${smallTableId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 204)
    })

    it('DELETE {id} inexistente', async () => {
        const res = await request(app).delete(`${base}/${smallTableId}`).set('Authorization', admin)
        expectMatchesSpec('delete', ITEM, res, 404)
    })

    it('Los pedidos de una mesa borrada devuelven tableNumber null', async () => {
        const res = await request(app).get('/api/v1/orders/mine').set('Authorization', client)
        expectMatchesSpec('get', '/api/v1/orders/mine', res, 200)
        expect(res.body[0]).toMatchObject({ tableId: smallTableId, tableNumber: null })
    })
})
