const CPPParser = require("languages/cpp.js");
const JavaParser = require("languages/java.js");
const JavaScriptParser = require("languages/javascript.js");
const ObjCParser = require("languages/objc.js");
const PHPParser = require("languages/php.js");
const RustParser = require("languages/rust.js");
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

        let isEnabled = false;

        switch(editor.document.syntax) {
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
        case "rust":
            isEnabled = this.config.enableRust;
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

        // skip if not trigger chars
        if (!line.endsWith("/**") && !line.match(/^\*\s+[@\\]/)) {
            return [];
        }

        // get EOL, indentation and cursor position for creating completion items
        this.eol = editor.document.eol;
        this.indent = /^[\t ]*/.exec(context.line)[0];
        this.cursorPosition = context.position;

        // return inline comment if line NOT only contains trigger chars
        if (line.endsWith("/**") && line !== "/**") {
            return [this.provideInlineComment()];
        }

        const text = editor.getTextInRange(new Range(this.cursorPosition, editor.document.length));

        // provide block comment if EOF
        if (!text.match(/^[\t ]*(.+)$/m)) {
            return [this.provideBlockComment()];
        }

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
        case "rust":
            parser = new RustParser();
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


        // provide tag completion if "@" (or "\" as for C/C++)
        if (line.match(/^\*\s+[@\\]/)) {
            this.cursorPosition = null;
            return this.provideTags(
                parser.getDocTags(line)
            );
        }


        const completionItems = [];

        // provide header block if start of file
        const prePos  = Math.max(0, this.cursorPosition-3);
        const preText = editor.getTextInRange(new Range(0, prePos)).trim();

        if (preText === "" || preText === "<?php") {
            completionItems.push(
                this.provideHeaderBlock(parser)
            );
        }


        // split text into lines
        const lines = text.split(this.eol);

        // provide block comment if next is another comment or an empty line
        if (
            text.trim().match(/^\/(\*|\/)/) ||
            (lines.length > 1 && lines[0].trim() === "" && lines[1].trim() === "")
        ) {
            completionItems.push(
                this.provideBlockComment()
            );

        } else {

            // get closest definition
            const definition = parser.getDefinition(lines);

            // provide block comment if no definition
            if (definition === "") {
                completionItems.push(this.provideBlockComment());
            }

            // parse definition and get docBlock
            if (definition !== "") {
                const docBlock = parser.parseDefinition(definition);
                if (!docBlock) {
                    // provide block comment if no docBlock returned
                    completionItems.push(this.provideBlockComment());
                } else {
                    // we finally have a docBlock, yay!
                    const snippet = parser.formatDocBlock(docBlock, this.config, true);
                    completionItems.push(
                        this.createCompletionItem(
                            "/** DocBlock */",
                            snippet.join(this.eol),
                            "Insert a code documentation block"
                        )
                    );
                }
            }
        }

        // Not related to DocBlockr,
        // but I'm too lazy to type ESLint disable rules
        if (this.config.ESLintComments) {
            completionItems.push(this.provideESLintComment());
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
        const item = new CompletionItem(label, CompletionItemKind.StyleDirective);
        item.insertText = (this.cursorPosition === null) ? text : "";
        item.insertTextFormat = InsertTextFormat.Snippet;
        if (documentation !== null) {
            item.documentation = documentation;
        }
        if (this.cursorPosition !== null) {
            item.range = new Range(
                Math.max(0, this.cursorPosition-3),
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

            const insertPosition = Math.max(0, this.cursorPosition /* -3 */);

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
            "/** comment */",
            "/** ${0:comment} */",
            null
        );
    }

    /**
     * Provide block comment
     * @returns {CompletionItem}
     */
    provideBlockComment() {
        return this.createCompletionItem(
            "/** comment */",
            ["/**", " * ${0:comment}", " */"].join(this.eol),
            null
        );
    }

    /**
     * Provide matching @tags
     * @returns {Array}
     */
    provideTags(matches) {
        const items = [];
        matches.forEach(match => {
            items.push(
                this.createCompletionItem(
                    match[0],
                    match[0] + (match[1] ? " " + match[1] : ""),
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
            /^(?<tag>[@\\][^\s]+)?(?:\s*(?<remainder>.+))?$/
        );

        docBlock.push(["${WORKSPACE_NAME} - ${FILENAME}"]);

        if (this.config.customTags && this.config.customTags.length) {
            this.config.customTags.forEach(tag => {
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
                    .replaceAll(/\$\{\d+:/g, () => "${"+(tabStop++)+":");
            });
        });

        let snippet;
        if (parser.settings.language === "rust") {
            snippet = parser.formatHeaderBlock(docBlock);
        } else {
            snippet = parser.formatDocBlock(docBlock, this.config);
        }

        return this.createCompletionItem(
            "/** Header */",
            snippet.join(this.eol),
            "Insert a header block"
        );
    }

    /**
     * Provide eslint configuration comment
     * @returns {CompletionItem}
     */
    provideESLintComment() {
        return this.createCompletionItem(
            "/* ESLint comment */",
            "/* eslint-disable-next-line ${0:rule} */",
            "ESLint configuration comment"
        );
    }

}

module.exports = CompletionProvider;
