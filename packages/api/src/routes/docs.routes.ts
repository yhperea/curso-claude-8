import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { loadOpenApiSpec } from '@docs/openapi.js'

const spec = loadOpenApiSpec()

const router = Router()

router.get('/openapi.json', (_req, res) => {
    res.status(200).json(spec)
})
router.use('/', swaggerUi.serve, swaggerUi.setup(spec))

export default router
