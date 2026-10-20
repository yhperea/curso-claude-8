import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import {
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    InvalidPeopleCountError,
    TableNumberAlreadyExistsError,
    TableNotAvailableError,
    TableCapacityExceededError,
    TableOccupiedError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let orderRepo: MockOrderRepository
    let service: TableService

    const input = (overrides: Record<string, unknown> = {}) => ({
        number: 1,
        description: null,
        capacity: 4,
        ...overrides
    }) as { number: number; description: string | null; capacity: number; status?: string }

    beforeEach(() => {
        orderRepo = new MockOrderRepository()
        service = new TableService(new MockTableRepository(), orderRepo)
    })

    describe('create', () => {
        it('crea una mesa libre por defecto', async () => {
            const table = await service.create('rest-1', input({ description: 'Terraza' }))
            expect(table).toMatchObject({ restaurantId: 'rest-1', number: 1, description: 'Terraza', capacity: 4, status: 'libre', occupiedAt: null })
        })

        it('guarda una descripción vacía o con solo espacios como null', async () => {
            expect((await service.create('rest-1', input({ number: 1, description: '   ' }))).description).toBeNull()
            expect((await service.create('rest-1', input({ number: 2, description: '  Barra ' }))).description).toBe('Barra')
        })

        it('normaliza el estado y fija occupiedAt si se crea ocupada', async () => {
            const table = await service.create('rest-1', input({ status: ' OCUPADA ' }))
            expect(table.status).toBe('ocupada')
            expect(table.occupiedAt).not.toBeNull()
        })

        it.each([0, -1, 1.5, '2', undefined])('rechaza el número %s', async number => {
            await expect(service.create('rest-1', input({ number }))).rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, 2.5, '4', undefined])('rechaza la capacidad %s', async capacity => {
            await expect(service.create('rest-1', input({ capacity }))).rejects.toThrow(InvalidTableCapacityError)
        })

        it('rechaza un estado inválido', async () => {
            await expect(service.create('rest-1', input({ status: 'sucia' }))).rejects.toThrow(InvalidTableStatusError)
        })

        it('rechaza un número repetido en el mismo restaurante, pero no en otro', async () => {
            await service.create('rest-1', input())
            await expect(service.create('rest-1', input())).rejects.toThrow(TableNumberAlreadyExistsError)
            await expect(service.create('rest-2', input())).resolves.toMatchObject({ restaurantId: 'rest-2' })
        })
    })

    describe('update', () => {
        it('reemplaza los datos y conserva el estado si no se envía', async () => {
            const created = await service.create('rest-1', input({ status: 'reservada' }))
            const updated = await service.update('rest-1', created.id, input({ number: 2, capacity: 6, description: 'Salón' }))
            expect(updated).toMatchObject({ number: 2, capacity: 6, description: 'Salón', status: 'reservada' })
        })

        it('permite conservar su propio número pero no el de otra mesa', async () => {
            const a = await service.create('rest-1', input({ number: 1 }))
            await service.create('rest-1', input({ number: 2 }))
            await expect(service.update('rest-1', a.id, input({ number: 1 }))).resolves.toMatchObject({ number: 1 })
            await expect(service.update('rest-1', a.id, input({ number: 2 }))).rejects.toThrow(TableNumberAlreadyExistsError)
        })

        it('falla si la mesa es de otro restaurante', async () => {
            const created = await service.create('rest-1', input())
            await expect(service.update('rest-2', created.id, input())).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('borra una mesa libre', async () => {
            const created = await service.create('rest-1', input())
            await service.delete('rest-1', created.id)
            await expect(service.getById('rest-1', created.id)).rejects.toThrow(TableNotFoundError)
        })

        it('no borra una mesa ocupada', async () => {
            const created = await service.create('rest-1', input({ status: 'ocupada' }))
            await expect(service.delete('rest-1', created.id)).rejects.toThrow(TableOccupiedError)
        })
    })

    describe('findByRestaurantId', () => {
        it('filtra por estado', async () => {
            await service.create('rest-1', input({ number: 1 }))
            await service.create('rest-1', input({ number: 2, status: 'reservada' }))
            expect((await service.findByRestaurantId('rest-1')).map(t => t.number)).toEqual([1, 2])
            expect((await service.findByRestaurantId('rest-1', 'reservada')).map(t => t.number)).toEqual([2])
        })

        it('rechaza un filtro de estado inválido', async () => {
            await expect(service.findByRestaurantId('rest-1', 'sucia')).rejects.toThrow(InvalidTableStatusError)
        })
    })

    describe('findAvailable', () => {
        beforeEach(async () => {
            await service.create('rest-1', input({ number: 1, capacity: 2 }))
            await service.create('rest-1', input({ number: 2, capacity: 6 }))
            await service.create('rest-1', input({ number: 3, capacity: 4 }))
            await service.create('rest-1', input({ number: 4, capacity: 4 }))
            await service.create('rest-1', input({ number: 5, capacity: 8, status: 'ocupada' }))
            await service.create('rest-1', input({ number: 6, capacity: 8, status: 'reservada' }))
        })

        it('devuelve las libres con capacidad suficiente, la más ajustada primero', async () => {
            const tables = await service.findAvailable('rest-1', 3)
            expect(tables.map(t => t.number)).toEqual([3, 4, 2])
        })

        it.each([0, -2, 1.5, undefined, Number.NaN])('rechaza people = %s', async people => {
            await expect(service.findAvailable('rest-1', people)).rejects.toThrow(InvalidPeopleCountError)
        })
    })

    describe('updateStatus', () => {
        it('ocupar fija occupiedAt y liberar lo borra', async () => {
            const created = await service.create('rest-1', input())
            const occupied = await service.updateStatus('rest-1', created.id, 'ocupada')
            expect(occupied.occupiedAt).not.toBeNull()

            const again = await service.updateStatus('rest-1', created.id, 'ocupada')
            expect(again.occupiedAt).toBe(occupied.occupiedAt)

            const freed = await service.updateStatus('rest-1', created.id, 'libre')
            expect(freed).toMatchObject({ status: 'libre', occupiedAt: null })
        })

        it('rechaza un estado inválido o ausente', async () => {
            const created = await service.create('rest-1', input())
            await expect(service.updateStatus('rest-1', created.id, 'sucia')).rejects.toThrow(InvalidTableStatusError)
            await expect(service.updateStatus('rest-1', created.id, undefined as unknown as string)).rejects.toThrow(InvalidTableStatusError)
        })

        it('falla si la mesa no existe', async () => {
            await expect(service.updateStatus('rest-1', 'nope', 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('occupy', () => {
        it('ocupa una mesa libre con capacidad suficiente', async () => {
            const created = await service.create('rest-1', input({ capacity: 4 }))
            const table = await service.occupy('rest-1', created.id, 4)
            expect(table.status).toBe('ocupada')
            expect(table.occupiedAt).not.toBeNull()
        })

        it('no ocupa dos veces la misma mesa con peticiones simultáneas', async () => {
            const created = await service.create('rest-1', input())
            const results = await Promise.allSettled([
                service.occupy('rest-1', created.id, 2),
                service.occupy('rest-1', created.id, 2)
            ])
            expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
            expect(results.find(r => r.status === 'rejected')?.reason).toBeInstanceOf(TableNotAvailableError)
        })

        it('falla si la mesa no está libre', async () => {
            const created = await service.create('rest-1', input({ status: 'reservada' }))
            await expect(service.occupy('rest-1', created.id, 2)).rejects.toThrow(TableNotAvailableError)
        })

        it('falla si no caben', async () => {
            const created = await service.create('rest-1', input({ capacity: 2 }))
            await expect(service.occupy('rest-1', created.id, 3)).rejects.toThrow(TableCapacityExceededError)
        })

        it('falla si people no es un entero positivo', async () => {
            const created = await service.create('rest-1', input())
            await expect(service.occupy('rest-1', created.id, '2')).rejects.toThrow(InvalidPeopleCountError)
        })
    })

    describe('findCurrentOrders', () => {
        const order = (id: string, tableId: string, createdAt: Date) => ({
            id, restaurantId: 'rest-1', tableId, tableNumber: 1, clientId: null, createdAt, items: []
        })

        it('devuelve solo los pedidos de la ocupación actual', async () => {
            const created = await service.create('rest-1', input())
            const table = await service.occupy('rest-1', created.id, 2)
            const occupiedAt = new Date(table.occupiedAt!)

            await orderRepo.create(order('old', created.id, new Date(occupiedAt.getTime() - 60_000)))
            await orderRepo.create(order('current', created.id, new Date(occupiedAt.getTime() + 60_000)))
            await orderRepo.create(order('other-table', 'other', new Date(occupiedAt.getTime() + 60_000)))

            const orders = await service.findCurrentOrders('rest-1', created.id)
            expect(orders.map(o => o.id)).toEqual(['current'])
        })

        it('devuelve [] si la mesa no está ocupada', async () => {
            const created = await service.create('rest-1', input())
            await orderRepo.create(order('o1', created.id, new Date()))
            expect(await service.findCurrentOrders('rest-1', created.id)).toEqual([])
        })
    })
})
