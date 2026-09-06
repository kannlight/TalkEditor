import { fetchSSE } from '../utils/sse'

export function postChat(payload, onMessage, onDone, onError, signal) {
    return fetchSSE(
        '/api/chat',
        { method: 'POST', body: JSON.stringify(payload), signal },
        onMessage,
        onDone,
        onError,
    )
}
