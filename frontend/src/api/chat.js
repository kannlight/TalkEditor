import { fetchSSE } from '../utils/sse'

export function postChat(payload, onMessage, onDone, onError) {
    return fetchSSE(
        '/api/chat',
        { method: 'POST', body: JSON.stringify(payload) },
        onMessage,
        onDone,
        onError,
    )
}
