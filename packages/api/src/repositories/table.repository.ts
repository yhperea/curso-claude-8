import { Database } from '@config/database.js'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'

interface TableRow {
    id: string
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status: string
    occupiedAt: string | null
    createdAt: string
    updatedAt: string
}

const SELECT_TABLE = `SELECT id, restaurant_id as restaurantId, number, description, capacity, status,
    occupied_at as occupiedAt, created_at as createdAt, updated_at as updatedAt
    FROM restaurant_tables`

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string, status?: TableStatusType): Promise<Table[]>
    findByNumber(restaurantId: string, number: number): Promise<Table | null>
    save(table: Table): Promise<void>
    occupyIfFree(id: string, occupiedAt: string): Promise<boolean>
    delete(id: string): Promise<void>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE id = ?`, [id])
        return row ? this.mapToTable(row) : null
    }

    async findByRestaurantId(restaurantId: string, status?: TableStatusType): Promise<Table[]> {
        const rows = status
            ? await this.db.all<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? AND status = ? ORDER BY number ASC`, [restaurantId, status])
            : await this.db.all<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? ORDER BY number ASC`, [restaurantId])
        return rows.map(row => this.mapToTable(row))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? AND number = ?`, [restaurantId, number])
        return row ? this.mapToTable(row) : null
    }

    async save(table: Table): Promise<void> {
        const existing = await this.db.get<{ id: string }>('SELECT id FROM restaurant_tables WHERE id = ?', [table.id])

        if (existing) {
            await this.db.run(
                'UPDATE restaurant_tables SET number = ?, description = ?, capacity = ?, status = ?, occupied_at = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.status, table.occupiedAt, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO restaurant_tables (id, restaurant_id, number, description, capacity, status, occupied_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [table.id, table.restaurantId, table.number, table.description, table.capacity, table.status, table.occupiedAt, table.createdAt, table.updatedAt]
            )
        }
    }

    // Atómico: si otra petición ocupó la mesa antes, no cambia ninguna fila.
    async occupyIfFree(id: string, occupiedAt: string): Promise<boolean> {
        const result = await this.db.run(
            "UPDATE restaurant_tables SET status = 'ocupada', occupied_at = ?, updated_at = ? WHERE id = ? AND status = 'libre'",
            [occupiedAt, occupiedAt, id]
        )
        return result.changes === 1
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM restaurant_tables WHERE id = ?', [id])
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            restaurantId: row.restaurantId,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            occupiedAt: row.occupiedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}
