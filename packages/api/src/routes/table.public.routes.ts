import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { SqliteOrderRepository } from '@repositories/order.repository.js'
import { TableService } from '@services/table.service.js'

const tableService = new TableService(new SqliteTableRepository(dbConfig), new SqliteOrderRepository(dbConfig))
const tableController = new TableController(tableService)

const router = Router({ mergeParams: true })

router.get('/', tableController.getAvailable)

export default router
