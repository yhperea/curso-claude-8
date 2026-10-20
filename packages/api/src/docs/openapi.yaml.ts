// Serializador YAML mínimo para el spec (solo datos JSON), para no añadir un
// parser/emisor YAML como dependencia. Las cadenas que no son seguras como
// escalar plano se escriben entre comillas dobles con JSON.stringify, que es
// sintaxis YAML válida; las multilínea, como bloque literal `|-`.

const RESERVED = /^(true|false|null|yes|no|on|off|y|n|~)$/i
const PLAIN = /^[\p{L}_$/][\p{L}\p{N}_ .,/${}()'`*+-]*$/u
const NUMERIC = /^[-+]?(\d|\.\d)/

const isPlainSafe = (value: string): boolean =>
    PLAIN.test(value) && !value.endsWith(' ') && !RESERVED.test(value) && !NUMERIC.test(value)

const isBlockLiteral = (value: string): boolean =>
    value.includes('\n') && !/^\s|\s$|[ \t]\n|\t|\r/.test(value)

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isInline = (value: unknown): boolean =>
    !(Array.isArray(value) && value.length > 0) &&
    !(isObject(value) && Object.keys(value).length > 0) &&
    !(typeof value === 'string' && isBlockLiteral(value))

const scalar = (value: unknown): string => {
    if (Array.isArray(value)) return '[]'
    if (isObject(value)) return '{}'
    if (typeof value === 'string') return isPlainSafe(value) ? value : JSON.stringify(value)
    return JSON.stringify(value)
}

const pad = (level: number): string => '  '.repeat(level)

const literal = (value: string, level: number): string[] =>
    value.split('\n').map(line => (line === '' ? '' : pad(level) + line))

// Devuelve las líneas de un valor no inline (objeto/array no vacío o bloque literal).
const block = (value: unknown, level: number): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(item => {
            if (isInline(item)) return [`${pad(level)}- ${scalar(item)}`]
            if (typeof item === 'string') return [`${pad(level)}- |-`, ...literal(item, level + 1)]
            const [first = '', ...rest] = block(item, level + 1)
            return [`${pad(level)}- ${first.trimStart()}`, ...rest]
        })
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
        const prefix = `${pad(level)}${scalar(key)}:`
        if (isInline(item)) return [`${prefix} ${scalar(item)}`]
        if (typeof item === 'string') return [`${prefix} |-`, ...literal(item, level + 1)]
        return [prefix, ...block(item, level + 1)]
    })
}

export function toYaml(value: unknown): string {
    if (isInline(value)) return `${scalar(value)}\n`
    return `${block(value, 0).join('\n')}\n`
}
