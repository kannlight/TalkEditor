export async function postChat(payload) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
    return response.json()
}
