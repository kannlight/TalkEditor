import { fetchSSE } from '../utils/sse'

export function postEdit(payload, onMessage, onDone, onError) {
    return fetchSSE(
        '/api/edit',
        { method: 'POST', body: JSON.stringify(payload) },
        onMessage,
        onDone,
        onError,
    )
}
