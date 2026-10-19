import { describe, it, expect } from 'vitest'
import { routeMounts } from '../app.js'
import { loadOpenApiSpec, listOperations } from '@docs/openapi.js'

interface RouteLayer {
    route?: { path: string; methods: Record<string, boolean> }
}

const toOpenApiPath = (path: string): string =>
    path.replace(/:(\w+)/g, '{$1}').replace(/(.)\/$/, '$1')

const expressOperations = (): string[] => {
    const operations = routeMounts.flatMap(({ path: prefix, router }) =>
        (router.stack as RouteLayer[])
            .filter(layer => layer.route)
            .flatMap(({ route }) =>
                Object.keys(route!.methods)
                    .filter(method => route!.methods[method])
                    .map(method => `${method.toUpperCase()} ${toOpenApiPath(prefix + route!.path)}`)
            )
    )
    return [...operations, 'GET /health'].sort()
}

describe('Cobertura OpenAPI', () => {
    it('documenta exactamente las rutas montadas en Express', () => {
        const documented = listOperations(loadOpenApiSpec())
            .filter(({ path }) => !path.startsWith('/api/v1/docs'))
            .map(({ method, path }) => `${method.toUpperCase()} ${path}`)
            .sort()

        expect(documented).toEqual(expressOperations())
    })
})
