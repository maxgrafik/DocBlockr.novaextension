const LanguageParser = require("languages/parser.js");
const CompletionProvider = require("completionProvider.js");

/**
 * Command Handler
 */

class CommandHandler {

    constructor(config) {
        this.config = config
    }

    insertDocBlock(editor) {

        // get current line
        const selectedRange = editor.selectedRange;
        const lineRange = editor.getLineRangeForRange(selectedRange);
        const currentLine = editor.getTextInRange(lineRange);

        const completionProvider = new CompletionProvider(this.config);
        const items = completionProvider.provideCompletionItems(editor,
            {
                line: currentLine + "/**",
                position: editor.selectedRange.start
            }
        );

        if (items.length === 0) {
            return;
        }
    
        // adjust indentation of consecutive lines
        let snippet = items[0].insertText;
        let indent = /^[\t ]*/.exec(currentLine)[0];
        
        snippet = snippet
            .split(editor.document.eol)
            .join(editor.document.eol + indent);

        editor.insert(snippet, InsertTextFormat.Snippet);
    }

    formatDocBlock(editor) {

        const docBlockRanges = this.getDocBlockRanges(editor);

        if (!docBlockRanges) {
            return;
        }

        let selectedRanges = editor.selectedRanges;
        let adjustedRanges = []

        // fix incomplete or zero-length selections so
        // adjustedRanges contains only complete docblocks
        selectedRanges.forEach(selectedRange => {
            const start = selectedRange.start;
            const end   = selectedRange.end;
            docBlockRanges.forEach(docBlockRange => {
                const docBlockStart = docBlockRange.start;
                const docBlockEnd   = docBlockRange.end;
                // check if overlap
                if (start <= docBlockEnd && docBlockStart <= end) {
                    adjustedRanges.push(
                        new Range(docBlockStart, docBlockEnd)
                    );
                } 
            });
        });

        // if no selection(s) and cursor is not within a docblock
        // get user confirmation to format all docblocks found
        if (adjustedRanges.length === 0) {
            this.confirmFormatAll().then(() => {
                this.formatRanges(editor, docBlockRanges);
            });
        } else {
            this.formatRanges(editor, adjustedRanges);
        }

    }

    /**
     * Get ranges of all docblocks in document
     */
    getDocBlockRanges(editor) {
        const regex = new RegExp(
            // added negative lookahead (?!/**)
            // to not match unfinished docblocks
            "^[\\t ]*\\/\\*\\*(?:(?!\\/\\*\\*).)+?\\*\\/[\\t ]*$"
        , "gms");

        const range = new Range(0, editor.document.length);
        const text = editor.getTextInRange(range);

        const matches = text.matchAll(regex);
        if (!matches) {
            return null;
        }

        let ranges = [];
        for (const match of matches) {
            ranges.push(
                new Range(match.index, match.index+match[0].length)
            );
        }

        return ranges;
    }

    /**
     * Format the given ranges
     * @param {TextEditor} editor         - Nova TextEditor
     * @param {Array}      selectedRanges - The docblock ranges to format
     */
    formatRanges(editor, selectedRanges) {

        const WrapGuideColumn = 80; // any way to read this from nova prefs?

        const parser = new LanguageParser({
            language: editor.document.syntax
        });

        // do everything in one edit so we can undo in one step
        editor.edit((edit) => {
            const ranges = selectedRanges.reverse(); // backwards
            ranges.forEach(range => {
                let docBlock = editor.getTextInRange(range);
                let indent = /^[\t ]*/.exec(docBlock)[0];

                docBlock = parser.parseDocBlock(docBlock);
                if (docBlock.length > 0) {
                    let snippet = parser.formatDocBlock(docBlock, this.config);
                    let wrapWidth = WrapGuideColumn-indent.length;                    

                    snippet = indent + parser
                        .wrapLines(snippet, wrapWidth)
                        .join(editor.document.eol + indent);

                    edit.replace(range, ""); // ged rid of selection
                    edit.insert(range.start, snippet); // plain text is default
                }
            });
        });
    }

    /**
     * Get user confirmation to format all docblocks
     */
    confirmFormatAll() {
        return new Promise((resolve, reject) => {
            nova.workspace.showActionPanel(
                nova.localize("Do you want to format all DocBlocks in this document?"),
                {buttons: [nova.localize("Format All"), nova.localize("Cancel")]},
                (button) => {
                    if (button === 0) {
                        resolve();
                    } else {
                        reject();
                    }
                }
            );
        });
    }
}

module.exports = CommandHandler;
