export async function postEdit(payload) {
    const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail || `HTTP error: ${response.status}`)
    }
    return response.json()
}

export async function postGenerate(payload) {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail || `HTTP error: ${response.status}`)
    }
    return response.json()
}
