import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { Order } from '@models/order.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import {
    RestaurantIdRequiredError,
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidPeopleCountError,
    TableNumberAlreadyExistsError,
    TableNotAvailableError,
    TableCapacityExceededError,
    TableOccupiedError
} from '@errors/DomainErrors.js'

interface TableInput {
    number: number
    description: string | null
    capacity: number
    status?: string | undefined
}

const normalizeDescription = (value: string | null | undefined): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1

export class TableService {
    constructor(
        private readonly tableRepository: TableRepository,
        private readonly orderRepository: OrderRepository
    ) {}

    async create(restaurantId: string, input: TableInput): Promise<Table> {
        if (!restaurantId || restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }
        this.validate(input)
        await this.ensureNumberIsFree(restaurantId, input.number, null)

        const now = new Date().toISOString()
        const table: Table = {
            id: randomUUID(),
            restaurantId,
            number: input.number,
            description: normalizeDescription(input.description),
            capacity: input.capacity,
            status: 'libre',
            occupiedAt: null,
            createdAt: now,
            updatedAt: now
        }
        this.applyStatus(table, input.status === undefined ? 'libre' : normalizeTableStatus(input.status), now)

        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, input: TableInput): Promise<Table> {
        const table = await this.getById(restaurantId, id)
        this.validate(input)
        await this.ensureNumberIsFree(restaurantId, input.number, id)

        const now = new Date().toISOString()
        table.number = input.number
        table.description = normalizeDescription(input.description)
        table.capacity = input.capacity
        if (input.status !== undefined) {
            this.applyStatus(table, normalizeTableStatus(input.status), now)
        }
        table.updatedAt = now

        await this.tableRepository.save(table)
        return table
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const table = await this.getById(restaurantId, id)
        if (table.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    async getById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    async findByRestaurantId(restaurantId: string, status?: string): Promise<Table[]> {
        if (status === undefined) {
            return this.tableRepository.findByRestaurantId(restaurantId)
        }
        return this.tableRepository.findByRestaurantId(restaurantId, normalizeTableStatus(status))
    }

    // Mesas libres donde caben `people` comensales, la más ajustada primero.
    async findAvailable(restaurantId: string, people: unknown): Promise<Table[]> {
        if (!isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
        const tables = await this.tableRepository.findByRestaurantId(restaurantId, 'libre')
        return tables
            .filter(t => t.capacity >= people)
            .sort((a, b) => a.capacity - b.capacity || a.number - b.number)
    }

    async updateStatus(restaurantId: string, id: string, status: string): Promise<Table> {
        const table = await this.getById(restaurantId, id)
        const now = new Date().toISOString()
        this.applyStatus(table, normalizeTableStatus(status), now)
        table.updatedAt = now

        await this.tableRepository.save(table)
        return table
    }

    async occupy(restaurantId: string, id: string, people: unknown): Promise<Table> {
        if (!isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
        const table = await this.getById(restaurantId, id)
        if (table.status !== 'libre') {
            throw new TableNotAvailableError()
        }
        if (table.capacity < people) {
            throw new TableCapacityExceededError()
        }

        const now = new Date().toISOString()
        if (!await this.tableRepository.occupyIfFree(table.id, now)) {
            throw new TableNotAvailableError()
        }
        return { ...table, status: 'ocupada', occupiedAt: now, updatedAt: now }
    }

    // Pedidos de la ocupación actual: los creados desde que la mesa se ocupó.
    async findCurrentOrders(restaurantId: string, id: string): Promise<Order[]> {
        const table = await this.getById(restaurantId, id)
        if (table.status !== 'ocupada' || !table.occupiedAt) {
            return []
        }
        return this.orderRepository.findByTableSince(table.id, table.occupiedAt)
    }

    private applyStatus(table: Table, status: TableStatusType, now: string): void {
        if (status === 'ocupada') {
            table.occupiedAt = table.status === 'ocupada' && table.occupiedAt ? table.occupiedAt : now
        } else {
            table.occupiedAt = null
        }
        table.status = status
    }

    private validate(input: TableInput): void {
        if (!isPositiveInteger(input.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(input.capacity)) {
            throw new InvalidTableCapacityError()
        }
    }

    private async ensureNumberIsFree(restaurantId: string, number: number, ownId: string | null): Promise<void> {
        const existing = await this.tableRepository.findByNumber(restaurantId, number)
        if (existing && existing.id !== ownId) {
            throw new TableNumberAlreadyExistsError()
        }
    }
}
