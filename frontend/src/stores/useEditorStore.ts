import { create } from "zustand"
import type { EditorFile } from "@/lib/types"
import { api } from "@/lib/api"

interface EditorState {
  files: Map<string, EditorFile>
  activeFile: EditorFile | null

  openFile: (filePath: string) => Promise<EditorFile | null>
  saveFile: (filePath: string) => Promise<boolean>
  updateContent: (filePath: string, content: string) => void
  closeFile: (filePath: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  files: new Map(),
  activeFile: null,

  openFile: async (filePath: string) => {
    const existing = get().files.get(filePath)
    if (existing) {
      set({ activeFile: existing })
      return existing
    }

    const a = await api()
    const result = await a.editor.read_file(filePath)
    if (result.error) return null

    const file: EditorFile = {
      path: result.path as string,
      name: result.name as string,
      content: result.content as string,
      language: result.language as string,
      encoding: result.encoding as string,
      size: result.size as number,
      modified: result.modified as number,
      isDirty: false,
    }

    set((state) => {
      const files = new Map(state.files)
      files.set(filePath, file)
      return { files, activeFile: file }
    })

    return file
  },

  saveFile: async (filePath: string) => {
    const file = get().files.get(filePath)
    if (!file) return false

    const a = await api()
    const result = await a.editor.write_file(filePath, file.content)
    if (result.error) return false

    const updated = { ...file, isDirty: false, modified: result.modified as number }
    set((state) => {
      const files = new Map(state.files)
      files.set(filePath, updated)
      return { files, activeFile: state.activeFile?.path === filePath ? updated : state.activeFile }
    })
    return true
  },

  updateContent: (filePath: string, content: string) => {
    set((state) => {
      const file = state.files.get(filePath)
      if (!file) return state
      const updated = { ...file, content, isDirty: true }
      const files = new Map(state.files)
      files.set(filePath, updated)
      return {
        files,
        activeFile: state.activeFile?.path === filePath ? updated : state.activeFile,
      }
    })
  },

  closeFile: (filePath: string) => {
    set((state) => {
      const files = new Map(state.files)
      files.delete(filePath)
      return {
        files,
        activeFile: state.activeFile?.path === filePath ? null : state.activeFile,
      }
    })
  },
}))
