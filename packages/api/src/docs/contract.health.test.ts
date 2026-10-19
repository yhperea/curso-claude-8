import { describe, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { expectMatchesSpec } from '@docs/openapi.test-utils.js'

describe('Contrato OpenAPI: Health', () => {
    it('GET /health', async () => {
        const res = await request(app).get('/health')
        expectMatchesSpec('get', '/health', res, 200)
    })
})
