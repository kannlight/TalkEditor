import useEditorStore from '../stores/editorStore'
import useContextStore from '../stores/contextStore'
import useSettingsStore from '../stores/settingsStore'
import { postGenerate } from '../api/edit'

export function useGenerate() {
    const { isGenerating, setGenerating, setDraft } = useEditorStore()
    const { style: styleCtx, content: contentCtx } = useContextStore()
    const { activeServiceId } = useSettingsStore()

    const handleGenerate = async () => {
        setGenerating(true)
        let fullContent = ''

        await postGenerate(
            {
                style_context: styleCtx,
                content_context: contentCtx,
                service_id: activeServiceId,
            },
            (data) => { fullContent += data.content },
            () => {
                setDraft(fullContent)
                setGenerating(false)
            },
            (err) => {
                console.error('Generate failed:', err)
                setGenerating(false)
            },
        )
    }

    return { isGenerating, handleGenerate }
}
