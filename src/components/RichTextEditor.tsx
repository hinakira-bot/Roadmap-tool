'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showTableMenu, setShowTableMenu] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rich-editor-image' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'rich-editor-link' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || 'タスクの詳細を入力...' }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange(editor.getHTML())
      }, 500)
    },
    onSelectionUpdate: ({ editor }) => {
      setShowTableMenu(editor.isActive('table'))
    },
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
      },
    },
  })

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // 画像アップロード
  const handleImageUpload = useCallback(async () => {
    if (!editor) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const ext = file.name.split('.').pop()
      const filePath = `task-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('stage-images')
        .upload(filePath, file, { upsert: true })

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('stage-images')
          .getPublicUrl(filePath)
        editor.chain().focus().setImage({ src: publicUrl }).run()
      } else {
        alert('画像のアップロードに失敗しました: ' + error.message)
      }
    }
    input.click()
  }, [editor])

  // リンク挿入
  const handleLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URLを入力', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  // 表の挿入
  const handleTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="rich-editor-wrapper">
      {/* メインツールバー */}
      <div className="rich-editor-toolbar">
        {/* テキストスタイル */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            title="見出し2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
            title="見出し3"
          >
            H3
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* 文字装飾 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
            title="太字"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
            title="斜体"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
            title="下線"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
            title="打ち消し線"
          >
            <s>S</s>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* テキスト配置 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            title="左揃え"
          >
            ≡
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            title="中央揃え"
          >
            ≡
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* リスト */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
            title="箇条書き"
          >
            •≡
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
            title="番号リスト"
          >
            1.
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* 挿入 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={handleImageUpload}
            className="toolbar-btn"
            title="画像挿入"
          >
            🖼️
          </button>
          <button
            type="button"
            onClick={handleTable}
            className="toolbar-btn"
            title="表を挿入"
          >
            📊
          </button>
          <button
            type="button"
            onClick={handleLink}
            className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`}
            title="リンク"
          >
            🔗
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ブロック */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
            title="引用"
          >
            &ldquo;
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
            title="コードブロック"
          >
            {'</>'}
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="toolbar-btn"
            title="水平線"
          >
            ―
          </button>
        </div>
      </div>

      {/* 表操作ツールバー（表が選択されている時のみ表示） */}
      {showTableMenu && (
        <div className="rich-editor-table-toolbar">
          <span className="table-toolbar-label">📊 表の操作:</span>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="table-toolbar-btn"
            title="左に列追加"
          >
            ← 列追加
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="table-toolbar-btn"
            title="右に列追加"
          >
            列追加 →
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="table-toolbar-btn table-toolbar-btn-danger"
            title="列を削除"
          >
            列削除
          </button>
          <div className="toolbar-divider" />
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="table-toolbar-btn"
            title="上に行追加"
          >
            ↑ 行追加
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="table-toolbar-btn"
            title="下に行追加"
          >
            行追加 ↓
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="table-toolbar-btn table-toolbar-btn-danger"
            title="行を削除"
          >
            行削除
          </button>
          <div className="toolbar-divider" />
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="table-toolbar-btn table-toolbar-btn-danger"
            title="表を削除"
          >
            🗑️ 表を削除
          </button>
        </div>
      )}

      {/* エディタ本体 */}
      <EditorContent editor={editor} />
    </div>
  )
}
