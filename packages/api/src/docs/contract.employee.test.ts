import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { expectMatchesSpec, tokenFor } from '@docs/openapi.test-utils.js'

describe('Contrato OpenAPI: Empleados', () => {
    const admin = tokenFor('admin')
    let restaurantId: string
    let employeeId: string

    const employeeInput = () => ({
        firstName: 'Mario',
        lastName: 'Contrato',
        email: `contract-employee-${randomUUID()}@resttek.test`,
        password: 'secreta-123',
        role: 'camarero',
        restaurantId
    })

    beforeAll(async () => {
        await dbConfig.initialize()
        const res = await request(app).post('/api/v1/restaurants').set('Authorization', admin).send({
            name: 'Contrato Empleados',
            address: 'Calle Falsa 1',
            email: `contract-employee-restaurant-${randomUUID()}@resttek.test`,
            phone: '600000000',
            ownerFirstName: 'Eva',
            ownerLastName: 'Gil'
        })
        restaurantId = res.body.id
    })

    it('POST /api/v1/employees crea un empleado', async () => {
        const res = await request(app).post('/api/v1/employees').set('Authorization', admin).send(employeeInput())
        expectMatchesSpec('post', '/api/v1/employees', res, 201)
        employeeId = res.body.id
    })

    it('POST /api/v1/employees con rol inválido', async () => {
        const res = await request(app)
            .post('/api/v1/employees')
            .set('Authorization', admin)
            .send({ ...employeeInput(), role: 'pinche' })
        expectMatchesSpec('post', '/api/v1/employees', res, 400)
    })

    it('POST /api/v1/employees con un rol no permitido', async () => {
        const res = await request(app)
            .post('/api/v1/employees')
            .set('Authorization', tokenFor('manager', restaurantId))
            .send(employeeInput())
        expectMatchesSpec('post', '/api/v1/employees', res, 403)
    })

    it('GET /api/v1/employees', async () => {
        const res = await request(app).get('/api/v1/employees').set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/employees', res, 200)
        expect(res.body.length).toBeGreaterThan(0)
    })

    it('GET /api/v1/employees con filtros', async () => {
        const res = await request(app)
            .get('/api/v1/employees')
            .query({ role: 'camarero', limit: 5, offset: 0 })
            .set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/employees', res, 200)
        expect(res.body.every((e: { role: string }) => e.role === 'camarero')).toBe(true)
    })

    it('GET /api/v1/employees sin token', async () => {
        const res = await request(app).get('/api/v1/employees')
        expectMatchesSpec('get', '/api/v1/employees', res, 401)
    })

    it('GET /api/v1/employees/{id}', async () => {
        const res = await request(app).get(`/api/v1/employees/${employeeId}`).set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/employees/{id}', res, 200)
    })

    it('GET /api/v1/employees/{id} inexistente', async () => {
        const res = await request(app).get(`/api/v1/employees/${randomUUID()}`).set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/employees/{id}', res, 404)
    })

    it('GET /api/v1/restaurants/{restaurantId}/employees', async () => {
        const res = await request(app).get(`/api/v1/restaurants/${restaurantId}/employees`).set('Authorization', admin)
        expectMatchesSpec('get', '/api/v1/restaurants/{restaurantId}/employees', res, 200)
        expect(res.body.map((e: { id: string }) => e.id)).toContain(employeeId)
    })

    it('GET /api/v1/restaurants/{restaurantId}/employees con un rol no permitido', async () => {
        const res = await request(app)
            .get(`/api/v1/restaurants/${restaurantId}/employees`)
            .set('Authorization', tokenFor('manager', restaurantId))
        expectMatchesSpec('get', '/api/v1/restaurants/{restaurantId}/employees', res, 403)
    })
})
