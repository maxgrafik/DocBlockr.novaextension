const CPPParser = require("languages/cpp.js");
const JavaParser = require("languages/java.js");
const JavaScriptParser = require("languages/javascript.js");
const ObjCParser = require("languages/objc.js");
const PHPParser = require("languages/php.js");
const RubyParser = require("languages/ruby.js");
const RustParser = require("languages/rust.js");
const SwiftParser = require("languages/swift.js");
const TypeScriptParser = require("languages/typescript.js");

/**
 * Completion Provider
 */

class CompletionProvider {

    constructor(config) {
        this.config = config;
        this.eol = "\n";
        this.indent = "";
        this.cursorPosition = 0;
        this.triggerChars = "";
    }

    provideCompletionItems(editor, context) {

        // skip if multiple cursors
        if (editor.selectedRanges.length > 1) {
            return [];
        }

        /**
         * Switched to 'switch' statement
         * as suggested by gwyneth (20220817)
         */

        const syntax = editor.document.syntax;

        let isEnabled = false;

        switch(syntax) {
        case "c":
        case "cpp":
        case "lsl":
            isEnabled = this.config.enableCPP;
            break;
        case "java":
            isEnabled = this.config.enableJava;
            break;
        case "javascript":
        case "jsx":
            isEnabled = this.config.enableJS;
            break;
        case "objc":
            isEnabled = this.config.enableObjC;
            break;
        case "php":
            isEnabled = this.config.enablePHP;
            break;
        case "ruby":
            isEnabled = this.config.enableRuby;
            break;
        case "rust":
            isEnabled = this.config.enableRust;
            break;
        case "swift":
            isEnabled = this.config.enableSwift;
            break;
        case "typescript":
        case "tsx":
            isEnabled = this.config.enableTS;
            break;
        default:
            isEnabled = false;
        }

        // skip if not enabled for language
        if (!isEnabled) {
            return [];
        }

        const line = context.line.trim();

        let isTagCompletion = false;

        switch(syntax) {
        case "c":
        case "cpp":
        case "lsl":
            this.triggerChars = this.config.commentStyle === 1 ? "/*!" : "/**";
            isTagCompletion = line.match(/^\*\s+[@\\]/);
            break;
        case "java":
            this.triggerChars = "/**";
            isTagCompletion = line.match(/^\*\s+@/);
            break;
        case "javascript":
        case "jsx":
            this.triggerChars = "/**";
            isTagCompletion = line.match(/^\*\s+@/);
            break;
        case "objc":
            this.triggerChars = this.config.commentStyle === 1 ? "/*!" : "/**";
            isTagCompletion = line.match(/^\*\s+[@\\]/);
            break;
        case "php":
            this.triggerChars = "/**";
            isTagCompletion = line.match(/^\*\s+@/);
            break;
        case "ruby":
            this.triggerChars = "##";
            isTagCompletion = line.match(/^#\s+@/);
            break;
        case "rust":
            this.triggerChars = "///";
            isTagCompletion = line.match(/^\/{3}[ ]#/);
            break;
        case "swift":
            this.triggerChars = "///";
            isTagCompletion = line.match(/^\/{3}[ ]-/);
            break;
        case "typescript":
        case "tsx":
            this.triggerChars = "/**";
            isTagCompletion = line.match(/^\*\s+@/);
            break;
        default:
            this.triggerChars = "";
            isTagCompletion = false;
        }

        // skip if not trigger chars
        if (!line.endsWith(this.triggerChars) && !isTagCompletion) {
            return [];
        }

        // get EOL, indentation and cursor position for creating completion items
        this.eol = editor.document.eol;
        this.indent = /^[\t ]*/.exec(context.line)[0];
        this.cursorPosition = context.position;

        // return inline comment if line NOT only contains trigger chars
        if (
            ["javascript", "jsx", "typescript", "tsx"].includes(syntax)
            && line.endsWith(this.triggerChars)
            && line !== this.triggerChars
        ) {
            return [this.provideInlineComment()];
        }


        let parser;

        switch (syntax) {
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
            parser = new RubyParser(this.config);
            break;
        case "rust":
            parser = new RustParser();
            break;
        case "swift":
            parser = new SwiftParser();
            break;
        case "typescript":
        case "tsx":
            parser = new TypeScriptParser();
            break;
        default:
            return [];
        }

        /**
         * We need to disable keydown handling for the comment extender when
         * providing completion items. Otherwise the comment extender kicks in
         * causing all kinds of problems
         */
        nova.workspace.context.set("maxgrafik.DocBlockr.evt.keyReturn", false);
        nova.workspace.context.set("maxgrafik.DocBlockr.evt.keyTab", false);


        // provide tag completion
        if (isTagCompletion) {
            this.cursorPosition = null;
            return this.provideTags(
                parser.getDocTags(line),
                syntax
            );
        }


        const completionItems = [];

        // provide header block if start of file
        const prePos  = Math.max(0, this.cursorPosition-this.triggerChars.length);
        const preText = editor.getTextInRange(new Range(0, prePos)).trim();

        if (preText === "" || preText === "<?php") {
            completionItems.push(
                this.provideHeaderBlock(parser)
            );
        }

        const text = editor.getTextInRange(new Range(this.cursorPosition, editor.document.length));

        // provide block comment if EOF
        if (text.trim() === "") {
            completionItems.push(
                this.provideBlockComment(syntax)
            );
            return completionItems;
        }

        // split text into lines
        const lines = text.split(this.eol);

        // provide block comment if next is another comment or an empty line
        if (
            text.trim().match(/^\/(\*|\/)/) ||
            text.trim().match(/^#/) ||
            (lines.length > 1 && lines[0].trim() === "" && lines[1].trim() === "")
        ) {
            completionItems.push(
                this.provideBlockComment(syntax)
            );

        } else {

            // get closest definition
            const definition = parser.getDefinition(lines);

            // provide block comment if no definition
            if (definition === "") {
                completionItems.push(this.provideBlockComment(syntax));
            }

            // parse definition and get docBlock
            if (definition !== "") {
                const docBlock = parser.parseDefinition(definition);
                if (!docBlock) {
                    // provide block comment if no docBlock returned
                    completionItems.push(this.provideBlockComment(syntax));
                } else {
                    // we finally have a docBlock, yay!
                    let snippet = "";
                    if (syntax === "ruby" && this.config.commentStyleRuby === 0) {
                        snippet = parser.formatRDocBlock(docBlock, this.config, true);
                    } else {
                        snippet = parser.formatDocBlock(docBlock, this.config, true);
                    }
                    completionItems.push(
                        this.createCompletionItem(
                            "DocBlock",
                            snippet.join(this.eol),
                            "Insert a code documentation block"
                        )
                    );
                }
            }
        }

        // Not related to DocBlockr,
        // but I'm too lazy to type ESLint disable rules
        if (
            ["javascript", "jsx", "typescript", "tsx"].includes(syntax)
            && this.config.ESLintComments
        ) {
            completionItems.push(this.provideESLintComment());
        }

        // Provide Bookmark comment
        if (this.config.bookmarkComments) {
            completionItems.push(this.provideBookmarkComment(syntax));
        }

        return completionItems;
    }

    /**
     * Creates a CompletionItem
     * @param   {string}         label         - user visible label
     * @param   {string}         text          - snippet
     * @param   {string}         documentation - documentation, if any
     * @returns {CompletionItem}
     */
    createCompletionItem(label, text, documentation) {

        /**
         * It would be nice to have our own icons for CompletionItems
         * especially for bookmark comments. Unfortunately there's no
         * official way to get Nova's bookmark icon. CompletionItemKind
         * resolves to a number and using '40' gives us the bookmark
         * icon at least in version 10.6.
         *
         * The CompletionItem prototype has a 'image' property briefly
         * mentioned in docs. Can't get it to work either.
         */

        const item = new CompletionItem(label,
            (label === "Bookmark")
                ? CompletionItemKind.TagLink // better than nothing
                : CompletionItemKind.StyleDirective
        );

        if (this.cursorPosition !== null) {
            item.filterText = this.triggerChars;
        }
        item.insertText = (this.cursorPosition === null) ? text : "";
        item.insertTextFormat = InsertTextFormat.Snippet;
        if (documentation !== null) {
            item.documentation = documentation;
        }
        if (this.cursorPosition !== null) {
            item.range = new Range(
                Math.max(0, this.cursorPosition-this.triggerChars.length),
                this.cursorPosition
            );

            /**
             * Working around Nova's weird indentation logic:
             * We insert an empty string above (insertText), replacing '/**'
             * and put the actual snippet into an additional TextEdit
             *
             * However, here's more weirdness:
             * insertPosition should be currentPosition-3, accounting for '/**'
             * but it doesn't make any difference if we use cursorPosition as is
             * or cursorPosition-3
             * Even worse, substracting e.g. 2 does not throw an error because
             * of overlapping regions, it crashes Nova immediately
             *
             * We also need to add proper indentation here (and likewise remove
             * it from commandHandler) in case automatic indentation is turned
             * off in preferences. For now, Nova seems to be clever enough to
             * handle this manual indentation correctly
             *
             * Nevertheless, I expect this to fail again anytime :P
             */

            const insertPosition = Math.max(0, this.cursorPosition);

            item.additionalTextEdits = [
                TextEdit.insert(
                    insertPosition,
                    text.split(this.eol).join(this.eol + this.indent)
                )
            ];
        }

        return item;
    }

    /**
     * Provide inline comment
     * @returns {CompletionItem}
     */
    provideInlineComment() {
        return this.createCompletionItem(
            "Comment (inline)",
            "/** ${0:comment} */",
            null
        );
    }

    /**
     * Provide block comment
     * @param   {string}         syntax - Document syntax
     * @returns {CompletionItem}
     */
    provideBlockComment(syntax) {

        let snippet = "";

        switch (syntax) {
        case "c":
        case "cpp":
        case "lsl":
        case "java":
        case "javascript":
        case "jsx":
        case "objc":
        case "php":
        case "typescript":
        case "tsx":
            snippet = [this.triggerChars, " * ${0:comment}", " */"].join(this.eol);
            break;
        case "ruby":
            snippet = ["=begin", "${0:comment}", "=end"].join(this.eol);
            break;
        default:
            return null;
        }

        return this.createCompletionItem(
            "Comment (block)",
            snippet,
            null
        );
    }

    /**
     * Provide matching @tags
     * @param   {Array}  matches - The matching doc tags from the parser
     * @param   {string} syntax  - Document syntax
     * @returns {Array}          - Array of CompletionItems
     */
    provideTags(matches, syntax) {
        const items = [];
        matches.forEach(match => {

            let snippet;
            if (
                syntax === "rust" || syntax === "swift"
            ) {
                snippet = " " + match[0] + match[1];
            } else {
                snippet = match[0] + (match[1] ? " " + match[1] : "");
            }

            items.push(
                this.createCompletionItem(
                    match[0],
                    snippet,
                    null
                )
            );
        });
        return items;
    }

    /**
     * Provide header comment
     * @param   {LanguageParser} parser - to format docBlock
     * @returns {CompletionItem}
     */
    provideHeaderBlock(parser) {
        const docBlock = [];
        const regex = new RegExp(
            /^(?<tag>[@\\][^\s]+)(?:\s*(?<remainder>.+))?$/
        );

        docBlock.push(["$FILENAME"]);
        docBlock.push(["$WORKSPACE_NAME"]);

        if (this.config.customTags && this.config.customTags.length) {

            docBlock.push([""]);

            this.config.customTags.forEach(tag => {

                // Implement $YEAR variable
                tag = tag.replaceAll(/\$YEAR(?![A-Z])/g, new Date().getFullYear());

                const match = regex.exec(tag);
                if (!match) {
                    docBlock.push([tag]);

                } else if (match && match.groups.remainder) {
                    docBlock.push([match.groups.tag, match.groups.remainder]);

                } else if (match && !match.groups.remainder) {
                    const docTags = parser.getDocTags("* " + match.groups.tag);
                    if (docTags.length > 0) {
                        docBlock.push(["@"+docTags[0][0], docTags[0][1]]);
                    } else {
                        docBlock.push([tag]);
                    }
                }
            });
        }

        let tabStop = 0;
        docBlock.forEach((row, rowIdx) => {
            row.forEach((col, colIdx) => {
                docBlock[rowIdx][colIdx] = docBlock[rowIdx][colIdx]
                    // why oh why no lookbehinds Apple?!
                    //.replaceAll(/(?<=\$\{)\d+(?=:)/g, () => tabStop++);
                    .replaceAll(/\$\{(?:\d+:)?/g, () => "${"+(tabStop++)+":");
            });
        });

        let snippet;
        if (
            (parser.settings.language === "ruby" && this.config.commentStyleRuby === 0) ||
            parser.settings.language === "rust" ||
            parser.settings.language === "swift"
        ) {
            snippet = parser.formatHeaderBlock(docBlock);
        } else {
            snippet = parser.formatDocBlock(docBlock, this.config);
        }

        return this.createCompletionItem(
            "Header",
            snippet.join(this.eol),
            "Insert a header block"
        );
    }

    /**
     * Provide bookmark comment
     * @param   {string}         syntax - Document syntax
     * @returns {CompletionItem}
     */
    provideBookmarkComment(syntax) {

        let snippet = "";

        switch (syntax) {
        case "c":
        case "cpp":
        case "lsl":
        case "java":
        case "javascript":
        case "jsx":
        case "php":
        case "typescript":
        case "tsx":
            snippet = "//! ${0:bookmark}";
            break;
        case "objc":
            snippet = "// #pragma mark ${0:bookmark}";
            break;
        case "ruby":
            snippet = "#! ${0:bookmark}";
            break;
        case "rust":
            snippet = "///! ${0:bookmark}";
            break;
        case "swift":
            snippet = "// MARK: ${0:bookmark}";
            break;
        default:
            return null;
        }

        return this.createCompletionItem(
            "Bookmark",
            snippet,
            null
        );
    }

    /**
     * Provide eslint configuration comment
     * @returns {CompletionItem}
     */
    provideESLintComment() {

        /**
         * If only Nova provided a way to read the IssueCollections
         * provided by other extensions, we could pre-fill the 'rule'
         * placeholder with some meaningful values
         */

        return this.createCompletionItem(
            "ESLint rule",
            "// eslint-disable-next-line ${0:rule}",
            null
        );
    }

}

module.exports = CompletionProvider;
