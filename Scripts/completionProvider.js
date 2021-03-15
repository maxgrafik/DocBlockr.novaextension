const JavaScriptParser = require("languages/javascript.js");
const TypeScriptParser = require("languages/typescript.js");
const PHPParser = require("languages/php.js");

class CompletionProvider {

    constructor(config) {
        this.config = config;
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

        // skip if not trigger chars
        const line = context.line.trim();
        if (!line.endsWith("/**") && !line.match(/^\*\s+@/)) {
            return [];
        }

        const cursorPosition = context.position;

        // return inline comment if line contains not only trigger chars
        if (line.endsWith("/**") && line !== "/**") {
            return this.provideInlineComment(cursorPosition);
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

        const text = editor.getTextInRange(new Range(cursorPosition, editor.document.length));
        
        // provide block comment if EOF
        const nextLine = text.match(/^[\t ]*(.+)$/m);
        if (!nextLine) {
            return this.provideBlockComment(cursorPosition);
        }

        // split text into lines and get closest definition
        const lines = text.split(editor.document.eol);
        const definition = parser.getDefinition(lines);

        // provide block comment if no definition
        if (definition === "") {
            return this.provideBlockComment(cursorPosition);
        }

        // parse definition and get formatted docblock
        // provide block comment if no docblock returned
        const snippet = parser.getDocBlock(definition, this.config);
        if (!snippet) {
            return this.provideBlockComment(cursorPosition);
        }

        // we finally have a formatted docblock
        let item = new CompletionItem("/** DocBlock */", CompletionItemKind.StyleDirective);
        item.insertText = snippet;
        item.insertTextFormat = InsertTextFormat.Snippet;
        item.documentation = "Inserts a code documentation block";
        item.range = new Range(cursorPosition-3, cursorPosition);
        return [item];
    }

    /**
     * Returns an inline comment
     * @param {number} cursorPosition - to calc the replacement range
     */
    provideInlineComment(cursorPosition) {
        let item = new CompletionItem("/** comment */", CompletionItemKind.StyleDirective);
        item.insertText = "/** ${0:comment} */";
        item.insertTextFormat = InsertTextFormat.Snippet;
        item.range = new Range(cursorPosition-3, cursorPosition);
        return [item];
    }

    /**
     * Returns a block comment
     * @param {number} cursorPosition - to calc the replacement range
     */
    provideBlockComment(cursorPosition) {
        let item = new CompletionItem("/** comment */", CompletionItemKind.StyleDirective);
        item.insertText = "/**\n * ${0:comment}\n */";
        item.insertTextFormat = InsertTextFormat.Snippet;
        item.range = new Range(cursorPosition-3, cursorPosition);
        return [item];
    }

    /**
     * Returns matching doc tags
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
}

module.exports = CompletionProvider;
