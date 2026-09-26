import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ActivityTemplate, UUID } from "../../types";
import { AddActivityDialog } from "../features/activity/AddActivityDialog";
import { TemplateSheet } from "../features/library/TemplateSheet";
import { CommandPalette } from "./CommandPalette";

interface TemplateEditorRequest {
  templateId?: UUID;
  initialTitle?: string;
  onSaved?: (template: ActivityTemplate) => void;
}

interface ShellContextValue {
  openAddActivity: (options?: { blockId?: UUID; templateId?: UUID }) => void;
  openTemplateEditor: (request?: TemplateEditorRequest) => void;
  openPalette: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

/** Diálogos que se pueden abrir desde cualquier pantalla (y desde la paleta ⌘K). */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [addState, setAddState] = useState<{ open: boolean; blockId?: UUID; templateId?: UUID }>({
    open: false,
  });
  const [editor, setEditor] = useState<TemplateEditorRequest | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openAddActivity = useCallback((options: { blockId?: UUID; templateId?: UUID } = {}) => {
    setAddState({ open: true, blockId: options.blockId, templateId: options.templateId });
  }, []);
  const openTemplateEditor = useCallback(
    (request: TemplateEditorRequest = {}) => setEditor(request),
    []
  );
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  const value = useMemo(
    () => ({ openAddActivity, openTemplateEditor, openPalette }),
    [openAddActivity, openTemplateEditor, openPalette]
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <AddActivityDialog
        open={addState.open}
        initialBlockId={addState.blockId}
        initialTemplateId={addState.templateId}
        onOpenChange={(open) => setAddState((current) => ({ ...current, open }))}
      />
      <TemplateSheet
        open={editor !== null}
        templateId={editor?.templateId}
        initialTitle={editor?.initialTitle}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={(template) => {
          editor?.onSaved?.(template);
          setEditor(null);
        }}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell debe usarse dentro de <ShellProvider>");
  return context;
}
