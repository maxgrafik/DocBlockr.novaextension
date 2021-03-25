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
        this.setContext(false);
    }

    /**
     * Checks if cursor is inside a docBlock
     */
    trackPosition(editor) {
        
        // commands are disabled in extension.json when there is
        // a selection, so there should be no need to track this

        // skip if selection
        // let selectedRange = editor.selectedRange;
        // if (selectedRange.start !== selectedRange.end) {
        //     this.setContext(false);
        //     return;
        // }

        let cursorPosition = editor.selectedRange.start;

        let docBlock = this.docBlocks.find(range => {
            return cursorPosition > range.start && cursorPosition < range.end;
        });

        if (!docBlock) {
            this.setContext(false);
            return;

        } else {
            // check contents of docBlock

            let lineRange = editor.getLineRangeForRange(editor.selectedRange);
            let line = editor.getTextInRange(
                new Range(lineRange.start, cursorPosition)
            );
            
            // set state to false if text before cursor is @...
            // otherwise committing completion items won't work
            if (/@[a-zA-Z]*$/.test(line)) {
                this.setContext(false);
                return;
            }
            
            let text = editor.getTextInRange(docBlock);

            // Nova uses \uFFFC (Object Replacement Character) for
            // snippet placeholders, if so set state to false
            this.setContext(/[\uFFFC]+/.test(text) ? false : true);
        }
    }

    handleKeydown(editor, event) {

        if (event === "return") {

            let lineRange = editor.getLineRangeForRange(editor.selectedRange);
            let lineText = editor.getTextInRange(lineRange).replace(/[\n\r]+$/, "");
            
            let prevRange = new Range(lineRange.start, editor.selectedRange.start);
            let prevText = editor.getTextInRange(prevRange);

            if (/^\s*\*(?:.?|.*(?:[^*][^/]|[^*]\/|\*[^/]))\s*$/.test(prevText)) {
                lineText = lineText.replace(/^(\s*\*\s*).*$/, "$1");
                editor.insert(editor.document.eol + lineText);
            } else if (/^\s*\/\*\*.?$/.test(prevText)) {
                lineText = lineText.replace(/^(\s*)\/\*(\*\s?).*$/, "$1 $2 ");
                editor.insert(editor.document.eol + lineText);
            } else {
                editor.insert(editor.document.eol);
            }
        }

        if (event === "tab") {

            const regex = [
                new RegExp(/^\s*\*(\s*@(?:param|property)\s+\S+\s+\S+\s+)\S/),
                new RegExp(/^\s*\*(\s*@(?:returns?|define)\s+\S+\s+\S+\s+)\S/),
                new RegExp(/^\s*\*(\s*@[a-z]+\s+)\S/),
                new RegExp(/^\s*\*(\s*)/)
            ];

            let lineRange = editor.getLineRangeForRange(editor.selectedRange);
            let prevRange = editor.getLineRangeForRange(
                new Range(lineRange.start-1, lineRange.start-1)
            );
            let lineText = editor.getTextInRange(prevRange);

            let indent = editor.tabText;
            for (const rx of regex) {
                let match = rx.exec(lineText);
                if (match) {
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
     * based on 'maxgrafik.DocBlockr.evt.keyDown' custom context variable
     */
    setContext(state) {
        let currentState = nova.workspace.context.get("maxgrafik.DocBlockr.evt.keyDown");
        if (state !== currentState) {
            nova.workspace.context.set("maxgrafik.DocBlockr.evt.keyDown", state);
        }
    }

    /**
     * Get ranges of all (complete!) docBlocks in document
     */
    getDocBlockRanges(editor) {
        const regex = new RegExp(
            "^[\\t ]*\\/\\*\\*(?:(?!\\/\\*\\*).)+?\\*\\/[\\t ]*$"
        , "gms");

        let range = new Range(0, editor.document.length);
        let text = editor.getTextInRange(range);

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
}

module.exports = CommentExtender;
