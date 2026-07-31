export async function postChat(payload) {
    const response = await fetch('/api/chat', {
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
