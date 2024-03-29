const CPPParser = require("languages/cpp.js");
const JavaParser = require("languages/java.js");
const JavaScriptParser = require("languages/javascript.js");
const ObjCParser = require("languages/objc.js");
const PHPParser = require("languages/php.js");
const RubyParser = require("languages/ruby.js");
const TypeScriptParser = require("languages/typescript.js");
const CompletionProvider = require("completionProvider.js");

/**
 * Command Handler
 */

class CommandHandler {

    constructor(config) {
        this.config = config;
    }

    insertDocBlock(editor) {

        let triggerChars = "";

        const syntax = editor.document.syntax;

        switch(syntax) {
        case "c":
        case "cpp":
        case "lsl":
            triggerChars = this.config.commentStyle === 1 ? "/*!" : "/**";
            break;
        case "java":
            triggerChars = "/**";
            break;
        case "javascript":
        case "jsx":
            triggerChars = "/**";
            break;
        case "objc":
            triggerChars = this.config.commentStyle === 1 ? "/*!" : "/**";
            break;
        case "php":
            triggerChars = "/**";
            break;
        case "ruby":
            triggerChars = "##";
            break;
        case "rust":
            triggerChars = "///";
            break;
        case "swift":
            triggerChars = "///";
            break;
        case "typescript":
        case "tsx":
            triggerChars = "/**";
            break;
        default:
            triggerChars = "";
        }

        // get current line
        const selectedRange = editor.selectedRange;
        const lineRange = editor.getLineRangeForRange(selectedRange);
        const currentLine = editor.getTextInRange(lineRange);

        const completionProvider = new CompletionProvider(this.config);
        const items = completionProvider.provideCompletionItems(editor,
            {
                line: currentLine + triggerChars,
                position: editor.selectedRange.start
            }
        );

        if (!items.length || !items[0].additionalTextEdits.length) {
            return;
        }

        // snippet is already properly indented!
        // see bugfix in completionProvider -> createCompletionItem
        const snippet = items[0].insertText || items[0].additionalTextEdits[0].newText;

        editor.insert(snippet, InsertTextFormat.Snippet);
    }

    formatDocBlock(editor) {

        const docBlockRanges = this.getDocBlockRanges(editor);

        if (!docBlockRanges) {
            return;
        }

        const selectedRanges = editor.selectedRanges;
        const adjustedRanges = [];

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
     * Get ranges of all (complete!) docblocks in document
     */
    getDocBlockRanges(editor) {

        let regex;
        const syntax = editor.document.syntax;

        switch(syntax) {
        case "c":
        case "cpp":
        case "lsl":
        case "objc":
            // negative lookahead (?!/*[*!]) to not match unfinished docblocks
            regex = new RegExp(/^[\t ]*\/\*[*!](?:(?!\/\*[*!]).)+?\*\/[\t ]*$/, "gms");
            break;
        case "java":
        case "javascript":
        case "jsx":
        case "php":
        case "typescript":
        case "tsx":
            // negative lookahead (?!/**) to not match unfinished docblocks
            regex = new RegExp(/^[\t ]*\/\*\*(?:(?!\/\*\*).)+?\*\/[\t ]*$/, "gms");
            break;
        case "ruby":
            // this one is tricky - we MUST NOT match the final eol
            regex = new RegExp(/^(?:[\t ]*##[\n\r](?:[\t ]*#[^\n\r]*[\n\r])+(?:[\t ]*#[^\n\r]*))/, "gm");
            break;
        default:
            return null;
        }


        const range = new Range(0, editor.document.length);
        const text = editor.getTextInRange(range);

        const matches = text.matchAll(regex);
        if (!matches) {
            return null;
        }

        const ranges = [];
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

        let parser;
        switch (editor.document.syntax) {
        case "c":
        case "cpp":
        case "lsl":
            parser = new CPPParser(this.config);
            break;
        case "java":
            parser = new JavaParser();
            break;
        case "javascript":
        case "jsx":
            parser = new JavaScriptParser();
            break;
        case "objc":
            parser = new ObjCParser(this.config);
            break;
        case "php":
            parser = new PHPParser();
            break;
        case "ruby":
            // There's no point in reparsing a Ruby comment if it's RDoc
            if (this.config.commentStyleRuby === 0) {
                return;
            }
            parser = new RubyParser(this.config);
            break;
        case "rust":
            // There's no point in reparsing a Rust comment
            return;
        case "swift":
            // There's no point in reparsing a Swift comment
            return;
        case "typescript":
        case "tsx":
            parser = new TypeScriptParser();
            break;
        default:
            return;
        }

        // do everything in one edit so we can undo in one step
        editor.edit((edit) => {
            const ranges = selectedRanges.reverse(); // backwards
            ranges.forEach(range => {
                let docBlock = editor.getTextInRange(range);
                let indent = /^[\t ]*/.exec(docBlock)[0];

                docBlock = parser.parseDocBlock(docBlock);
                if (docBlock.length > 0) {
                    const wrapWidth = WrapGuideColumn-indent.length;
                    let snippet = parser.formatDocBlock(docBlock, this.config, false, wrapWidth);
                    snippet = indent + snippet.join(editor.document.eol + indent);

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
