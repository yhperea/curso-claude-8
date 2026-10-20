import type { TableRepository } from '@repositories/table.repository.js'
import type { Table, TableStatusType } from '@models/table.model.js'

export class MockTableRepository implements TableRepository {
    private tables: Map<string, Table> = new Map()

    async findById(id: string): Promise<Table | null> {
        const table = this.tables.get(id)
        return table ? { ...table } : null
    }

    async findByRestaurantId(restaurantId: string, status?: TableStatusType): Promise<Table[]> {
        return Array.from(this.tables.values())
            .filter(t => t.restaurantId === restaurantId && (status === undefined || t.status === status))
            .sort((a, b) => a.number - b.number)
            .map(t => ({ ...t }))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const table = Array.from(this.tables.values()).find(t => t.restaurantId === restaurantId && t.number === number)
        return table ? { ...table } : null
    }

    async save(table: Table): Promise<void> {
        this.tables.set(table.id, { ...table })
    }

    async occupyIfFree(id: string, occupiedAt: string): Promise<boolean> {
        const table = this.tables.get(id)
        if (!table || table.status !== 'libre') return false
        this.tables.set(id, { ...table, status: 'ocupada', occupiedAt, updatedAt: occupiedAt })
        return true
    }

    async delete(id: string): Promise<void> {
        this.tables.delete(id)
    }
}
