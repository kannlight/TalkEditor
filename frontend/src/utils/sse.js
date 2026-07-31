export async function fetchSSE(url, options, onMessage, onDone, onError) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Accept': 'text/event-stream',
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop()

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') {
                        onDone && onDone()
                        return
                    }
                    try {
                        const parsed = JSON.parse(data)
                        if (parsed.error) {
                            throw new Error(parsed.error)
                        }
                        onMessage && onMessage(parsed)
                    } catch (e) {
                        if (e instanceof SyntaxError) {
                            console.error('Failed to parse SSE data', data)
                        } else {
                            throw e
                        }
                    }
                }
            }
        }
        onDone && onDone()
    } catch (err) {
        onError && onError(err)
    }
}
