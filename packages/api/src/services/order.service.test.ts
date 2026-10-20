import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import type { Order } from '@models/order.model.js'
import type { Table } from '@models/table.model.js'
import { OrderNotFoundError, InvalidOrderStatusError, TableNotFoundError, TableNotOccupiedError } from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockTableRepository())

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            tableNumber: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.create con mesa', () => {
    let tableRepo: MockTableRepository
    let service: OrderService

    const table = (overrides: Partial<Table> = {}): Table => ({
        id: 'table-1',
        restaurantId: 'rest-1',
        number: 4,
        description: null,
        capacity: 4,
        status: 'ocupada',
        occupiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    })

    const request = (tableId: string | null) => ({
        restaurantId: 'rest-1',
        tableId,
        clientId: 'client-1',
        items: [{ dishId: 'dish-1', quantity: 2, notes: null }]
    })

    beforeEach(() => {
        tableRepo = new MockTableRepository()
        service = new OrderService(new MockOrderRepository(), tableRepo)
    })

    it('asocia el pedido a una mesa ocupada y devuelve su número', async () => {
        await tableRepo.save(table())
        const order = await service.create(request('table-1'))
        expect(order.tableId).toBe('table-1')
        expect(order.tableNumber).toBe(4)
        expect(order.items).toHaveLength(2)
    })

    it('permite pedidos sin mesa', async () => {
        const order = await service.create(request(null))
        expect(order.tableNumber).toBeNull()
    })

    it('rechaza una mesa inexistente', async () => {
        await expect(service.create(request('table-x'))).rejects.toThrow(TableNotFoundError)
    })

    it('rechaza una mesa de otro restaurante', async () => {
        await tableRepo.save(table({ restaurantId: 'rest-2' }))
        await expect(service.create(request('table-1'))).rejects.toThrow(TableNotFoundError)
    })

    it('rechaza una mesa que no está ocupada', async () => {
        await tableRepo.save(table({ status: 'libre', occupiedAt: null }))
        await expect(service.create(request('table-1'))).rejects.toThrow(TableNotOccupiedError)
    })
})
