"use client";

import * as React from "react";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BracesIcon,
  HighlighterIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRACT_CSS, EDITOR_ONLY_CSS } from "@/lib/lease-document-style";
import { VARIABLE_ATTR, variableChipHtml } from "@/lib/lease-placeholders";

export type RichTextEditorHandle = {
  /** Drops a variable chip in at the caret. Called by the panel and the toolbar. */
  insertVariable: (key: string) => void;
};

/**
 * A small WYSIWYG surface for writing a contract.
 *
 * Built on `contenteditable` + `document.execCommand` rather than a rich-text
 * library: nothing in this project has one, and the editor a lease template
 * needs is a page of formatted prose, a table and some variables — not
 * collaborative editing. `execCommand` is deprecated and every browser still
 * implements it; if this surface ever needs comments, revision marks or
 * collaborative cursors, that is the point to bring in ProseMirror rather than
 * to grow this.
 *
 * **Uncontrolled on purpose.** Writing `innerHTML` on every render puts the
 * caret back at the start of the document on every keystroke, so the DOM is
 * seeded once and changes flow one way, outwards. `documentKey` is the escape
 * hatch for the one case that must reseed — swapping the starter when the
 * language changes.
 */
export const RichTextEditor = React.forwardRef<
  RichTextEditorHandle,
  {
    /** Editor HTML (tokens already converted to chips). Read on mount only. */
    initialHtml: string;
    onChange: (html: string) => void;
    /** Change it to force a reseed from `initialHtml`. */
    documentKey?: string;
    /** Opens the variable picker — the toolbar's `{ } Variable` button. */
    onRequestVariable?: () => void;
    ariaLabel?: string;
  }
>(function RichTextEditor(
  { initialHtml, onChange, documentKey = "", onRequestVariable, ariaLabel },
  ref
) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  /**
   * The caret, remembered. Clicking anything in the toolbar or the placeholder
   * panel moves focus out of the editor and collapses the selection, so the
   * last range inside the editor is captured while it is still live and
   * restored before a command runs.
   */
  const savedRange = React.useRef<Range | null>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initialHtml;
    // `documentKey` is the reseed trigger; `initialHtml` is read but
    // deliberately not depended on, or every keystroke would reseed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey]);

  React.useEffect(() => {
    function handleSelectionChange() {
      const editor = editorRef.current;
      const selection = document.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const range = savedRange.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      // Never focused, or the remembered range belongs to a document that has
      // since been reseeded — put the caret at the end rather than nowhere.
      const fallback = document.createRange();
      fallback.selectNodeContents(editor);
      fallback.collapse(false);
      applyRange(fallback);
      return;
    }
    applyRange(range);
  }

  function applyRange(range: Range) {
    const selection = document.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function emitChange() {
    const editor = editorRef.current;
    if (editor) onChange(editor.innerHTML);
  }

  function run(command: string, value?: string) {
    restoreSelection();
    // CSS rather than <font> tags for colour and size, so the output is markup
    // this decade's sanitizer and preview both understand.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    emitChange();
  }

  function insertHtml(html: string) {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    emitChange();
  }

  React.useImperativeHandle(ref, () => ({
    insertVariable(key: string) {
      // The trailing space is what lets you keep typing after a chip rather
      // than being stuck inside a `contenteditable="false"` island.
      insertHtml(`${variableChipHtml(key)}&nbsp;`);
    },
  }));

  return (
    <div className="overflow-hidden rounded-lg border border-input">
      <style>{`${CONTRACT_CSS}${EDITOR_ONLY_CSS}${CHIP_CSS}`}</style>

      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
        <Select
          value=""
          onValueChange={(next) => next && run("formatBlock", next)}
        >
          <SelectTrigger size="sm" className="w-[5.5rem] bg-background">
            <SelectValue placeholder="Normal">
              {() => "Paragraph"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BLOCK_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value="" onValueChange={(next) => next && run("fontSize", next)}>
          <SelectTrigger size="sm" className="w-[3.75rem] bg-background">
            <SelectValue placeholder="Size">{() => "Size"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Divider />

        <ToolButton label="Bold" onClick={() => run("bold")}>
          <BoldIcon />
        </ToolButton>
        <ToolButton label="Italic" onClick={() => run("italic")}>
          <ItalicIcon />
        </ToolButton>
        <ToolButton label="Underline" onClick={() => run("underline")}>
          <UnderlineIcon />
        </ToolButton>
        <ToolButton label="Strikethrough" onClick={() => run("strikeThrough")}>
          <StrikethroughIcon />
        </ToolButton>

        <Divider />

        <ToolButton
          label="Highlight"
          onClick={() => run("hiliteColor", "#fdf0c4")}
        >
          <HighlighterIcon />
        </ToolButton>

        <Divider />

        <ToolButton label="Align left" onClick={() => run("justifyLeft")}>
          <AlignLeftIcon />
        </ToolButton>
        <ToolButton label="Align centre" onClick={() => run("justifyCenter")}>
          <AlignCenterIcon />
        </ToolButton>
        <ToolButton label="Align right" onClick={() => run("justifyRight")}>
          <AlignRightIcon />
        </ToolButton>
        <ToolButton label="Justify" onClick={() => run("justifyFull")}>
          <AlignJustifyIcon />
        </ToolButton>

        <Divider />

        <ToolButton
          label="Bulleted list"
          onClick={() => run("insertUnorderedList")}
        >
          <ListIcon />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          onClick={() => run("insertOrderedList")}
        >
          <ListOrderedIcon />
        </ToolButton>
        <ToolButton label="Insert table" onClick={() => insertHtml(TABLE_HTML)}>
          <TableIcon />
        </ToolButton>

        {onRequestVariable && (
          <>
            <Divider />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 border-stat-accent/40 bg-stat-accent/10 text-stat-accent hover:bg-stat-accent/20"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onRequestVariable}
            >
              <BracesIcon />
              Variable
            </Button>
          </>
        )}
      </div>

      <div className="max-h-[62vh] overflow-y-auto bg-muted/50 p-4">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel ?? "Contract"}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={emitChange}
          onBlur={emitChange}
          className="jarvis-doc mx-auto min-h-[40vh] w-full max-w-3xl rounded-md shadow-sm ring-1 ring-foreground/10"
        />
      </div>
    </div>
  );
});

/** Chips are styled here rather than in the shared document CSS — they exist only while editing. */
const CHIP_CSS = `
  .jarvis-doc .jarvis-var {
    display: inline;
    background: #fdf0c4;
    box-shadow: inset 0 0 0 1px #e8cf8a;
    border-radius: 4px;
    padding: 0 5px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.86em;
    white-space: nowrap;
    user-select: all;
  }
`;

const BLOCK_FORMATS = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Title" },
  { value: "h2", label: "Centred heading" },
  { value: "h3", label: "Section heading" },
];

/** `fontSize` takes 1–7, so the labels are the nearest familiar point sizes. */
const FONT_SIZES = [
  { value: "1", label: "8" },
  { value: "2", label: "10" },
  { value: "3", label: "12" },
  { value: "4", label: "14" },
  { value: "5", label: "18" },
  { value: "6", label: "24" },
  { value: "7", label: "36" },
];

const TABLE_HTML = `<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>`;

function Divider() {
  return <span className="mx-px h-5 w-px bg-border" aria-hidden />;
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      // Keeps the caret where it is: the default mousedown would move focus out
      // of the editor and collapse the selection the command is about to act on.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="size-7"
    >
      {children}
    </Button>
  );
}

/**
 * Editor DOM → the body that gets stored: every chip goes back to `{{key}}`.
 *
 * Walks the DOM rather than running a regex over the HTML — the chip is one
 * element with one attribute, and `querySelectorAll` cannot be fooled by
 * attribute order, quoting or a nested span the way a pattern can.
 */
export function editorHtmlToBody(html: string) {
  const holder = document.createElement("div");
  holder.innerHTML = html;

  for (const chip of holder.querySelectorAll(`[${VARIABLE_ATTR}]`)) {
    const key = chip.getAttribute(VARIABLE_ATTR);
    chip.replaceWith(document.createTextNode(key ? `{{${key}}}` : ""));
  }

  return holder.innerHTML;
}
