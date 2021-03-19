const JavaScriptParser = require("languages/javascript.js");
const TypeScriptParser = require("languages/typescript.js");
const PHPParser = require("languages/php.js");

/**
 * Completion Provider
 */

class CompletionProvider {

    constructor(config) {
        this.config = config;
    }

    provideCompletionItems(editor, context) {

        this.config.eol = editor.document.eol;

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

        const cursorPosition = context.position;

        // return inline comment if line NOT only contains trigger chars
        if (line.endsWith("/**") && line !== "/**") {
            return [this.provideInlineComment(cursorPosition)];
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
            const matches = parser.getDocTags(line);
            return this.provideTags(matches);
        }

        let completionItems = [];

        const text = editor.getTextInRange(new Range(cursorPosition, editor.document.length));

        // provide block comment if EOF
        if (!text.match(/^[\t ]*(.+)$/m)) {
            return [this.provideBlockComment(cursorPosition)];
        }

        // split text into lines and get closest definition
        const lines = text.split(editor.document.eol);
        const definition = parser.getDefinition(lines);

        // provide block comment if no definition
        if (definition === "") {
            completionItems.push(
                this.provideBlockComment(cursorPosition)
            );
        }

        // parse and get formatted docblock if definition
        if (definition !== "") {
            const snippet = parser.getDocBlock(definition, this.config);
            if (!snippet) {
                // provide block comment if no snippet returned
                completionItems.push(
                    this.provideBlockComment(cursorPosition)
                );
            } else {
                // we finally have a formatted docblock, yay!
                let item = new CompletionItem("/** DocBlock */", CompletionItemKind.StyleDirective);
                item.insertText = snippet;
                item.insertTextFormat = InsertTextFormat.Snippet;
                item.documentation = "Insert a code documentation block";
                item.range = new Range(
                    Math.max(0, cursorPosition-3),
                    cursorPosition
                );
                completionItems.push(item);
            }
        }

        const prePos  = Math.max(0, cursorPosition-3);
        const preText = editor.getTextInRange(new Range(0, prePos)).trim();

        // provide file/header block if start of file
        if (preText === "" || preText === "<?php") {
            completionItems.push(
                this.provideFileBlock(cursorPosition)
            );
        }

        return completionItems;
    }

    /**
     * Provide inline comment  
     * @param   {number} cursorPosition - to calc the replacement range  
     * @returns {CompletionItem}
     */
    provideInlineComment(cursorPosition) {
        let item = new CompletionItem("/** comment */", CompletionItemKind.StyleDirective);
        item.insertText = "/** ${0:comment} */";
        item.insertTextFormat = InsertTextFormat.Snippet;
        item.range = new Range(
            Math.max(0, cursorPosition-3),
            cursorPosition
        );
        return item;
    }

    /**
     * Provide block comment  
     * @param   {number} cursorPosition - to calc the replacement range  
     * @returns {CompletionItem}
     */
    provideBlockComment(cursorPosition) {
        let item = new CompletionItem("/** comment */", CompletionItemKind.StyleDirective);
        item.insertText = 
            "/**" + this.config.eol +
            " * ${0:comment}" + this.config.eol + 
            " */";
        item.insertTextFormat = InsertTextFormat.Snippet;
        item.range = new Range(
            Math.max(0, cursorPosition-3),
            cursorPosition
        );
        return item;
    }

    /**
     * Provide matching doc tags
     * @returns {Array}
     */
    provideTags(matches) {
        let items = [];
        matches.forEach(match => {
            let item = new CompletionItem(match[0], CompletionItemKind.StyleDirective);
            item.insertText = match[0] + (match[1] ? " " + match[1] : "");
            item.insertTextFormat = InsertTextFormat.Snippet;
            items.push(item);
        });
        return items;
    }

    /**
     * Provide file/header comment
     * @param   {Number} cursorPosition - to calc the replacement range
     * @returns {CompletionItem}
     */
    provideFileBlock(cursorPosition) {
        let item = new CompletionItem("/** Header */", CompletionItemKind.StyleDirective);

        // TODO: augment with user configurable tags (e.g. author, copyright)
        item.insertText = 
            "/**" + this.config.eol +
            " * ${0:summary}" + this.config.eol + 
            " */";
        item.insertTextFormat = InsertTextFormat.Snippet;
        item.documentation = "Insert a file documentation block";
        item.range = new Range(
            Math.max(0, cursorPosition-3),
            cursorPosition
        );
        return item;
    }

}

module.exports = CompletionProvider;
