import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActivityTemplate, UUID } from "../../types";
import { AddActivityDialog } from "../features/activity/AddActivityDialog";
import { TemplateSheet } from "../features/library/TemplateSheet";
import { CommandPalette } from "./CommandPalette";

interface TemplateEditorRequest {
  templateId?: UUID;
  initialTitle?: string;
  onSaved?: (template: ActivityTemplate) => void;
}

/** The chat's composer, as the rest of the shell reaches it. */
export interface Composer {
  /** Puts the text in the composer and focuses it, for the person to finish and send. */
  fill: (text: string) => void;
  /** Sends the text as the person's message. */
  send: (text: string) => void;
}

interface ShellContextValue {
  openAddActivity: (options?: { blockId?: UUID; templateId?: UUID }) => void;
  openTemplateEditor: (request?: TemplateEditorRequest) => void;
  openPalette: () => void;
  /**
   * Everything is said in the chat (ADR-002): a button outside it writes there
   * for the person ("I'm starting X") rather than acting on its own.
   */
  compose: (text: string, how?: "fill" | "send") => void;
  /** The chat registers its composer here; null when it goes away. */
  registerComposer: (composer: Composer | null) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

/** Dialogs that can be opened from any screen (and from the ⌘K palette). */
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
  const composer = useRef<Composer | null>(null);
  const registerComposer = useCallback((next: Composer | null) => {
    composer.current = next;
  }, []);
  const compose = useCallback((text: string, how: "fill" | "send" = "fill") => {
    if (how === "send") composer.current?.send(text);
    else composer.current?.fill(text);
  }, []);

  const value = useMemo(
    () => ({ openAddActivity, openTemplateEditor, openPalette, compose, registerComposer }),
    [openAddActivity, openTemplateEditor, openPalette, compose, registerComposer]
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
  if (!context) throw new Error("useShell must be used inside <ShellProvider>");
  return context;
}
