import { create } from 'zustand'

const useAbortStore = create((set, get) => ({
    isProcessing: false,
    _controller: null,

    start() {
        const controller = new AbortController()
        set({ isProcessing: true, _controller: controller })
        return controller.signal
    },

    finish() {
        set({ isProcessing: false, _controller: null })
    },

    abort() {
        const { _controller } = get()
        if (_controller) _controller.abort()
        set({ isProcessing: false, _controller: null })
    },
}))

export default useAbortStore
