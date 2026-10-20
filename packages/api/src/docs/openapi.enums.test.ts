import { describe, it, expect } from 'vitest'
import { loadOpenApiSpec } from '@docs/openapi.js'
import { normalizeIngredientUnit } from '@models/ingredient.model.js'
import { normalizeDishCategory } from '@models/dish.model.js'
import { normalizeOrderStatus } from '@models/order.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import { Role } from '@employee/domain/value-objects/Role.js'

// Los modelos no exportan sus listas de valores, pero las enumeran en el
// mensaje de error ("... Must be one of: a, b, c" / "Debe ser uno de: a, b, c").
const domainValues = (normalize: (value: string) => unknown): string[] => {
    try {
        normalize('__valor_invalido__')
    } catch (error) {
        const list = (error as Error).message.split(/: /).pop() ?? ''
        return list.split(', ').sort()
    }
    throw new Error('normalize() aceptó un valor inválido')
}

describe('Enums del spec OpenAPI', () => {
    const schemas = loadOpenApiSpec().components?.schemas ?? {}

    it.each([
        ['IngredientUnit', normalizeIngredientUnit],
        ['DishCategory', normalizeDishCategory],
        ['OrderStatus', normalizeOrderStatus],
        ['TableStatus', normalizeTableStatus],
        ['Role', (value: string) => new Role(value)]
    ] as const)('%s coincide con el dominio', (schemaName, normalize) => {
        expect([...schemas[schemaName].enum].sort()).toEqual(domainValues(normalize))
    })
})
