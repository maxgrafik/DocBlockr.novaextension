/**
 * Comment Extender
 *
 * Will try to insert a leading asterisk and maintain indentation
 * when pressing return inside a docBlock. When writing multiline
 * descriptions, pressing tab will try to move the indentation to
 * the correct position.
 *
 * This is an awful piece of code, which constantly tracks cursor
 * position and contents of the docBlock currently in. But I have
 * no better idea how to solve this with the API provided by Nova.
 * Any suggestions are welcome!
 */
class CommentExtender {

    constructor(editor) {
        this.events = new CompositeDisposable();
        this.docBlocks = this.getDocBlockRanges(editor);

        this.events.add(editor.onDidChangeSelection(() => {
            this.trackPosition(editor);
        }));

        this.events.add(editor.onDidStopChanging(() => {
            this.docBlocks = this.getDocBlockRanges(editor);
            this.trackPosition(editor);
        }));
    }

    dispose() {
        this.events.dispose();
        this.docBlocks = null;
        this.setContext({"return": false, "tab": false});
    }

    /**
     * Checks if cursor is inside a docBlock
     */
    trackPosition(editor) {

        const cursorPosition = editor.selectedRange.start;

        const docBlock = this.docBlocks.find(range => {
            return cursorPosition > range.start && cursorPosition < range.end;
        });

        if (!docBlock) {
            this.setContext({"return": false, "tab": false});
            return;

        } else {
            // check contents of docBlock
            // we may have an invalid range here
            // so wrap in try ... catch block
            let text = "";
            try {
                text = editor.getTextInRange(docBlock);
            } catch(e) {
                this.setContext({"return": true, "tab": true});
            }

            // Nova uses \uFFFC (Object Replacement Character) for
            // snippet placeholders, if so set tab event to false
            this.setContext({"return": true, "tab": (/[\uFFFC]+/.test(text) ? false : true)});
        }
    }

    handleKeydown(editor, event) {

        if (event === "return") {

            const cursorPosition = editor.selectedRange.start;

            const lineRange = editor.getLineRangeForRange(
                new Range(cursorPosition, cursorPosition)
            );

            const preText = editor.getTextInRange(
                new Range(lineRange.start, cursorPosition)
            );

            // cursor is inside docblock range but before asterisk
            // - just insert a linebreak
            if (preText.trim() === "") {
                editor.insert(editor.document.eol);
                return;
            }

            const lineText = editor.getTextInRange(lineRange).replace(/[\n\r]+$/, "");

            let indent = "";

            if (/^\s*\/\*[*!]]/.test(lineText)) {
                // cursor on docblock start line (/**)
                indent = lineText.replace(/^(\s*).*$/m, "$1 * ");
            } else if (/^\s*\*(?!\/)/.test(lineText)) {
                // cursor on line starting with asterisk
                indent = lineText.replace(/^(\s*)\*(\s*).*$/m, "$1*$2");
            } else {
                // any other line
                indent = lineText.replace(/^(\s*).*$/m, "$1");
            }

            editor.insert(editor.document.eol + indent);
        }

        else if (event === "tab") {

            const cursorPosition = editor.selectedRange.start;

            const lineRange = editor.getLineRangeForRange(
                new Range(cursorPosition, cursorPosition)
            );

            const preText = editor.getTextInRange(
                new Range(lineRange.start, cursorPosition)
            );

            // cursor is inside docblock range but before asterisk
            // - just insert tabText
            if (preText.trim() === "") {
                editor.insert(editor.tabText);
                return;
            }

            const regex = [
                new RegExp(/^\s*\*\s*([@\\](?:param|property)\s+\S+\s+\S+\s+(?:-\s)?)\S/),
                new RegExp(/^\s*\*\s*([@\\](?:returns?|retval|result|yields?|throws?|exception)\s+\S+\s+(?:-\s)?)\S/),
                new RegExp(/^\s*\*\s*([@\\][a-z]+\s+)\S/),
                new RegExp(/^\s*\*\s*/)
            ];

            const prevRange = editor.getLineRangeForRange(
                new Range(lineRange.start-1, lineRange.start-1)
            );
            const prevText = editor.getTextInRange(prevRange);

            let indent = editor.tabText;
            for (const rx of regex) {
                const match = rx.exec(prevText);
                if (match && match[1]) {
                    indent = "".padEnd(match[1].length);
                    break;
                }
            }
            editor.insert(indent);
        }

        this.docBlocks = this.getDocBlockRanges(editor);
        this.trackPosition(editor);
    }

    /**
     * Sets Nova context
     * Commands for insertLinebreak and insertTab are conditionally enabled
     * based on 'maxgrafik.DocBlockr.evt.keyXXX' custom context variables
     */
    setContext(events) {
        Object.keys(events).forEach(key => {
            const eventName = "maxgrafik.DocBlockr.evt.key" + key.charAt(0).toUpperCase() + key.slice(1);
            const current = nova.workspace.context.get(eventName);
            if (current !== events[key]) {
                nova.workspace.context.set(eventName, events[key]);
            }
        });
    }

    /**
     * Get ranges of all docBlocks in document (including incomplete blocks)
     */
    getDocBlockRanges(editor) {
        const regex = new RegExp(
            /^[\t ]*\/\*[*!](?:.)+?\*\/[\t ]*$/,
            "gms"
        );

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
}

module.exports = CommentExtender;
