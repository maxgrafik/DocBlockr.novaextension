const JavaScriptParser = require("languages/javascript.js");
const TypeScriptParser = require("languages/typescript.js");
const PHPParser = require("languages/php.js");

/**
 * Completion Provider
 */

class CompletionProvider {

    constructor(config) {
        this.config = config;
        this.eol = "\n";
        this.cursorPosition = 0;
    }

    provideCompletionItems(editor, context) {

        // skip if multiple cursors
        if (editor.selectedRanges.length > 1) {
            return [];
        }

        const syntax = editor.document.syntax;
        
        // skip if not enabled for language
        if (syntax === "javascript" && !this.config.enableJS) {
            return [];
        }
        if (syntax === "typescript" && !this.config.enableTS) {
            return [];
        }
        if (syntax === "php" && !this.config.enablePHP) {
            return [];
        }

        const line = context.line.trim();

        // skip if not trigger chars
        if (!line.endsWith("/**") && !line.match(/^\*\s+@/)) {
            return [];
        }

        this.eol = editor.document.eol;
        this.cursorPosition = context.position;

        // return inline comment if line NOT only contains trigger chars
        if (line.endsWith("/**") && line !== "/**") {
            return [this.provideInlineComment()];
        }

        let parser;
        
        switch (syntax) {
        case "javascript":
            parser = new JavaScriptParser();
            break;
        case "typescript":
            parser = new TypeScriptParser();
            break;
        case "php":
            parser = new PHPParser();
            break;
        default:
            return [];
        }

        // provide tag completion if "@"
        if (line.match(/^\*\s+@/)) {
            this.cursorPosition = null;
            return this.provideTags(
                parser.getDocTags(line)
            );
        }

        let completionItems = [];

        const text = editor.getTextInRange(new Range(this.cursorPosition, editor.document.length));

        // provide block comment if EOF
        if (!text.match(/^[\t ]*(.+)$/m)) {
            return [this.provideBlockComment()];
        }

        // split text into lines and get closest definition
        const lines = text.split(this.eol);
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
                const snippet = parser.formatDocBlock(docBlock, this.config);
                completionItems.push(
                    this.createCompletionItem(
                        "/** DocBlock */",
                        snippet.join(this.eol),
                        "Insert a code documentation block"
                    )
                );
            }
        }

        const prePos  = Math.max(0, this.cursorPosition-3);
        const preText = editor.getTextInRange(new Range(0, prePos)).trim();

        // provide header block if start of file
        if (preText === "" || preText === "<?php") {
            completionItems.push(
                this.provideHeaderBlock(parser)
            );
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
        let item = new CompletionItem(label, CompletionItemKind.StyleDirective);
        item.insertText = text;
        item.insertTextFormat = InsertTextFormat.Snippet;
        if (documentation !== null) {
            item.documentation = documentation;
        }
        if (this.cursorPosition !== null) {
            item.range = new Range(
                Math.max(0, this.cursorPosition-3),
                this.cursorPosition
            );
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
        let items = [];
        matches.forEach(match => {
            items.push(
                this.createCompletionItem(
                    match[0],
                    match[0] + (match[1] ? " " + match[1] : ""),
                    null
                )
            )
        });
        return items;
    }

    /**
     * Provide header comment
     * @param   {LanguageParser} parser - to format docBlock
     * @returns {CompletionItem}
     */
    provideHeaderBlock(parser) {
        let docBlock = [];
        let regex = new RegExp(
            "^(?<tag>@[^\\s]+)?" +
            "(?:\\s*(?<remainder>.+))?$"
        );
        
        docBlock.push(["${WORKSPACE_NAME} - ${FILENAME}"]);

        if (this.config.customTags && this.config.customTags.length) {
            this.config.customTags.forEach(tag => {
                let match = regex.exec(tag);
                if (!match) {
                    docBlock.push([tag]);

                } else if (match && match.groups.remainder) {
                    docBlock.push([match.groups.tag, match.groups.remainder]);

                } else if (match && !match.groups.remainder) {
                    let docTags = parser.getDocTags("* " + match.groups.tag);
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
        
        const snippet = parser.formatDocBlock(docBlock, this.config);

        return this.createCompletionItem(
            "/** Header */",
            snippet.join(this.eol),
            "Insert a header block"
        );
    }

}

module.exports = CompletionProvider;
