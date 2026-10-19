import { readFileSync } from 'node:fs'

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

export type HttpMethod = typeof HTTP_METHODS[number]

export interface OpenApiSpec {
    openapi: string
    info: { title: string; version: string; description?: string }
    paths: Record<string, PathItem>
    components?: Record<string, Record<string, any>>
    [key: string]: unknown
}

export type PathItem = Partial<Record<HttpMethod, Operation>> & { parameters?: any[] }

export interface Operation {
    operationId?: string
    tags?: string[]
    parameters?: any[]
    responses?: Record<string, any>
    [key: string]: unknown
}

export interface ListedOperation {
    method: HttpMethod
    path: string
    operation: Operation
    pathItem: PathItem
}

export function loadOpenApiSpec(): OpenApiSpec {
    return JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf-8'))
}

export function listOperations(spec: OpenApiSpec): ListedOperation[] {
    return Object.entries(spec.paths).flatMap(([path, pathItem]) =>
        HTTP_METHODS
            .filter(method => pathItem[method])
            .map(method => ({ method, path, operation: pathItem[method] as Operation, pathItem }))
    )
}

export function resolveRef(spec: OpenApiSpec, ref: string): any {
    return ref
        .replace(/^#\//, '')
        .split('/')
        .reduce<any>((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec)
}
