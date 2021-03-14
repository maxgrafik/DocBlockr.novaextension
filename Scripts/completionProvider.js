const JavaScriptParser = require("languages/javascript.js");
const TypeScriptParser = require("languages/typescript.js");
const PHPParser = require("languages/php.js");

class CompletionProvider {

    constructor(config) {
        this.config = config;
    }

    provideCompletionItems(editor, context) {

        let syntax = editor.document.syntax;
        
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
        let line = context.line;
        if (!line.trim().endsWith("/**")) {
            return [];
        }

        // skip if multiple cursors
        if (editor.selectedRanges.length > 1) {
            return [];
        }

        let cursorPosition = context.position;

        // return inline comment if line contains not only trigger chars
        if (line.trim() !== "/**") {
            return this.provideInlineComment(cursorPosition);
        }

        let text = editor.getTextInRange(new Range(cursorPosition, editor.document.length));
        
        let nextLine = text.match(/^[\t ]*(.+)$/m);
        if (!nextLine) { // end of file
            return this.provideBlockComment(cursorPosition);
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

        // split text into lines and get closest definition
        let lines = text.split(editor.document.eol);
        let definition = parser.getDefinition(lines);

        // provide block comment if no definition
        if (definition === "") {
            return this.provideBlockComment(cursorPosition);
        }

        // parse definition and get formatted docblock
        // provide block comment if no docblock returned
        let snippet = parser.getDocBlock(definition, this.config);
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

}

module.exports = CompletionProvider;
