import { useState, useEffect, useRef } from 'react'
import useEditorStore from '../stores/editorStore'
import useContextStore from '../stores/contextStore'
import useSettingsStore from '../stores/settingsStore'
import { postGenerate } from '../api/edit'

export function useGenerate() {
    const { isGenerating, setGenerating, setDraft } = useEditorStore()
    const { style: styleCtx, content: contentCtx } = useContextStore()
    const { activeServiceId } = useSettingsStore()
    const [additionalInstruction, setAdditionalInstruction] = useState('')
    const wasGenerating = useRef(false)

    useEffect(() => {
        if (wasGenerating.current && !isGenerating) {
            setAdditionalInstruction('')
        }
        wasGenerating.current = isGenerating
    }, [isGenerating])

    const handleGenerate = async () => {
        setGenerating(true)
        try {
            const data = await postGenerate({
                style_context: styleCtx,
                content_context: contentCtx,
                service_id: activeServiceId,
                additional_instruction: additionalInstruction.trim() || null,
            })
            setDraft(data.content)
        } catch (err) {
            console.error('Generate failed:', err)
        } finally {
            setGenerating(false)
        }
    }

    return { isGenerating, handleGenerate, additionalInstruction, setAdditionalInstruction }
}
