import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { SqliteOrderRepository } from '@repositories/order.repository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize } from '@shared/infrastructure/http/middlewares.js'

const tableService = new TableService(new SqliteTableRepository(dbConfig), new SqliteOrderRepository(dbConfig))
const tableController = new TableController(tableService)

const MANAGERS = ['admin', 'manager']
const STAFF = ['admin', 'manager', 'camarero', 'cocinero']

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorize(MANAGERS), tableController.create)
router.get('/', authenticate, authorize(STAFF), tableController.getAll)
router.get('/:id', authenticate, authorize(STAFF), tableController.getById)
router.put('/:id', authenticate, authorize(MANAGERS), tableController.update)
router.delete('/:id', authenticate, authorize(MANAGERS), tableController.delete)
router.patch('/:id/status', authenticate, authorize(STAFF), tableController.updateStatus)
router.post('/:id/occupy', authenticate, authorize(['cliente']), tableController.occupy)
router.get('/:id/orders', authenticate, authorize(STAFF), tableController.getOrders)

export default router
