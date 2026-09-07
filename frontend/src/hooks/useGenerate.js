import { useState, useEffect, useRef } from 'react'
import useEditorStore from '../stores/editorStore'
import useContextStore from '../stores/contextStore'
import useSettingsStore from '../stores/settingsStore'
import useAbortStore from '../stores/abortStore'
import { postGenerate } from '../api/edit'

export function useGenerate() {
    const { isGenerating, setGenerating, setDraft } = useEditorStore()
    const { context } = useContextStore()
    const { activeServiceId } = useSettingsStore()
    const { start: abortStart, finish: abortFinish } = useAbortStore()
    const [additionalInstruction, setAdditionalInstruction] = useState('')
    const wasGenerating = useRef(false)

    useEffect(() => {
        if (wasGenerating.current && !isGenerating) {
            setAdditionalInstruction('')
        }
        wasGenerating.current = isGenerating
    }, [isGenerating])

    const handleGenerate = async () => {
        const signal = abortStart()
        setGenerating(true)
        try {
            const data = await postGenerate({
                context,
                service_id: activeServiceId,
                additional_instruction: additionalInstruction.trim() || null,
            }, signal)
            setDraft(data.content)
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Generate failed:', err)
            }
        } finally {
            setGenerating(false)
            abortFinish()
        }
    }

    return { isGenerating, handleGenerate, additionalInstruction, setAdditionalInstruction }
}
