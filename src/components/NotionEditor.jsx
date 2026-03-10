import React, { useEffect, useMemo } from "react";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";

// Função para converter HTML -> Blocos
async function tryParseHTML(editor, html) {
  if (!html) return undefined;
  if (Array.isArray(html)) return html;
  const blocks = await editor.tryParseHTMLToBlocks(html);
  return blocks;
}

const NotionEditor = ({ value, onChange, team = [], onMention }) => {
  // Configuração do Editor
  const editor = useCreateBlockNote({
    initialContent: undefined,
    uploadFile: async (file) => URL.createObjectURL(file),
  });

  // Carrega conteúdo inicial
  useEffect(() => {
    if (editor && value) {
      tryParseHTML(editor, value).then((blocks) => {
        if (blocks && blocks.length > 0) editor.replaceBlocks(editor.document, blocks);
      });
    }
  }, [editor]);

  // Observa mudanças
  const handleChange = async () => {
    const html = await editor.blocksToHTMLLossy(editor.document);
    onChange(html);
  };

  // --- LÓGICA DA MENÇÃO (@) ---
  // Cria a lista de sugestões baseada na equipe que recebemos
  const getMentionMenuItems = (editor) => {
    if (!team || team.length === 0) return [];

    return team.map(user => ({
      title: user.name,
      subtext: user.role || "Membro",
      onItemClick: () => {
        // 1. Insere o nome no texto (Visual)
        editor.insertInlineContent([
          {
            type: "text",
            text: "@" + user.name,
            styles: { bold: true, textColor: "blue" } // Destaca em azul
          },
          { type: "text", text: " ", styles: {} } // Espaço depois
        ]);

        // 2. DISPARA A NOTIFICAÇÃO (Lógica Externa)
        if (onMention) onMention(user);
      },
    }));
  };

  return (
    <div className="notion-editor-container relative">
      <div className="bn-ebony-dark bg-[#252525] border border-[#323238] rounded-xl px-3 py-2">
        <BlockNoteView editor={editor} onChange={handleChange} theme={"dark"}>
          {/* Adiciona o controlador do Menu de Sugestão (O Gatilho do @) */}
          <SuggestionMenuController
            triggerCharacter={"@"}
            getItems={async (query) => {
              // Filtra a equipe baseado no que foi digitado
              const items = getMentionMenuItems(editor);
              return items.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()));
            }}
          />
        </BlockNoteView>
      </div>

      <style>{`
  /* ===== Base do editor (Titanium Dark) ===== */
  .bn-ebony-dark .bn-container,
  .bn-ebony-dark .bn-editor,
  .bn-ebony-dark .bn-root {
    background: transparent !important;
  }

  .bn-ebony-dark .bn-editor {
    padding-inline: 0 !important;
    color: #e5e7eb !important; /* text-gray-200 */
  }

  .bn-ebony-dark .bn-editor:focus-within { outline: none !important; }

  /* Área de escrita (ProseMirror) — remove branco e melhora contraste */
  .bn-ebony-dark .ProseMirror {
    background: transparent !important;
    color: #e5e7eb !important;
    min-height: 140px;
  }

  /* Placeholder “Enter text or type '/'...” */
  .bn-ebony-dark .ProseMirror p.is-empty:first-child::before,
  .bn-ebony-dark .ProseMirror .is-empty::before,
  .bn-ebony-dark [data-placeholder]::before {
    color: #6b7280 !important; /* text-gray-500 */
    opacity: 0.9 !important;
  }

  /* Links / menções em azul Ebony (igual teu #2eaadc) */
  .bn-ebony-dark a,
  .bn-ebony-dark .bn-text-color-blue,
  .bn-ebony-dark [data-text-color="blue"] {
    color: #2eaadc !important;
  }

  /* Side menu do BlockNote */
  .bn-ebony-dark .bn-side-menu { margin-left: -20px; z-index: 60; }

  /* ===== Menus do BlockNote/Mantine (/, @, dropdowns) ===== */
  .bn-ebony-dark .mantine-Popover-dropdown,
  .bn-ebony-dark .mantine-Menu-dropdown,
  .bn-ebony-dark .mantine-Combobox-dropdown {
    background: #1e1e24 !important;
    border: 1px solid #323238 !important;
    color: #e5e7eb !important;
    box-shadow: 0 20px 50px rgba(0,0,0,0.55) !important;
  }

  .bn-ebony-dark .mantine-Menu-item,
  .bn-ebony-dark .mantine-Combobox-option {
    color: #e5e7eb !important;
  }

  .bn-ebony-dark .mantine-Menu-item:hover,
  .bn-ebony-dark .mantine-Combobox-option:hover {
    background: #252525 !important;
  }

  /* Títulos/descrições pequenas nos itens */
  .bn-ebony-dark .mantine-Text-root {
    color: #e5e7eb !important;
  }
`}</style>
    </div>
  );
};

export default NotionEditor;