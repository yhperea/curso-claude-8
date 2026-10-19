import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app.js'

describe('Docs routes', () => {
    it('GET /api/v1/docs/openapi.json devuelve el spec sin autenticación', async () => {
        const res = await request(app).get('/api/v1/docs/openapi.json')

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toMatch(/application\/json/)
        expect(res.body.openapi).toMatch(/^3\./)
        expect(res.body.paths['/health']).toBeDefined()
    })

    it('GET /api/v1/docs/ sirve la Swagger UI', async () => {
        const res = await request(app).get('/api/v1/docs/')

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toMatch(/text\/html/)
        expect(res.text).toContain('swagger-ui')
    })
})
