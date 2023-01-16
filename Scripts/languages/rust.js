const LanguageParser = require("parser.js");

/**
 * Rust Parser
 * @extends LanguageParser
 */

class RustParser extends LanguageParser {

    constructor() {
        /**
         * Language specific settings
         * @type Object
         * @property {string} language
         * @property {string} varIdentifier - Valid chars for vars/args
         * @property {string} fnIdentifier  - Valid chars for functions
         * @property {string} clsIdentifier - Valid chars for classes
         * @property {string} typeInfo      - Format of param type
         * @property {Object} tags          - Language specific tags
         */
        const settings = {
            language: "rust",
            varIdentifier: "[A-Za-z_][A-Za-z0-9_]*",
            fnIdentifier: "[A-Za-z_][A-Za-z0-9_]*",
            clsIdentifier: "[A-Z_][A-Za-z0-9]*",
            typeInfo: null,
            tags: {
                keySummary: "description",
                keyVar: null,
                keyRet: "@returns"
            },
            commentStyle: "///"
        };
        super(settings);
    }

    parseClass(line) {
        // preamble looks for #[derive] and or pub if any
        const preamble = "^[\\s*\\n]*(#\\[.+\\])?[\\s\\n]*(\\bpub([(].+[)])?)?";
        const regex = new RegExp(
            preamble + "\\s*(struct|trait|enum)\\s+(?<name>" + this.settings.clsIdentifier + ")"
        );

        const match = regex.exec(line);
        if (!match) {
            return null;
        }

        return [match.groups.name, ""];
    }

    parseFunction(line) {
        const preamble = "^[\\s*\\n]*(#\\[.+\\])?[\\s\\n]*(\\bpub([(].+[)])?)?";
        const regex = new RegExp(
            preamble +
            "\\s*fn\\s+(?<name>" + this.settings.fnIdentifier + ")" +
            "([<][a-zA-Z, _]+[>])?" +              // Type parameters if any
            "\\s*\\(\\s*(?<args>.*?)\\)" +         // List of parameters
            "(\\s*[-][>]\\s*(?<rettype>[^{]+))?" + // Return value if any
            "\\s*[{;]?"                            // closing brace if any
        );

        const matches = regex.exec(line);
        if(!matches || !matches.groups.name) {
            return null;
        }

        return [
            matches.groups.name,
            null,
            (matches.groups.args ? matches.groups.args.trim() : null),
            (matches.groups.rettype ? matches.groups.rettype.trim() : null)
        ];
    }

    parseVar(line) {
        const preamble = "^[\\s\\n]*(#\\[.+\\])?[\\s\\n]*";
        const regex = new RegExp(
            preamble +
            "\\s*let\\s+(mut\\s+)?(?<name>" + this.settings.varIdentifier + ")"
        );

        const matches = regex.exec(line);
        if(!matches || !matches.groups.name) {
            return null;
        }

        return [matches.groups.name, null, null];
    }

    parseArg(line) {
        const args = line.trim().split(/\s*:\s*/);
        const name = args.shift().split(/\s+/).pop();
        const type = args.length ? args.pop().split(/\s+/).pop() : null;
        return [
            name,
            type,
            null
        ];
    }

    // IMPORTANT!
    // Overrides LanguageParser's formatDocBlock()
    // because it's essentially Markdown here

    // @see https://doc.rust-lang.org/rust-by-example/meta/doc.html

    formatDocBlock(docBlock) {
        const out = [];

        let tabStop = 0;

        out.push("/// " + this.formatPlaceholder(this.settings.tags.keySummary, tabStop));

        const paramList = docBlock.filter(entry => {
            return entry[0] === "@param";
        });

        const returnList = docBlock.filter(entry => {
            return entry[0] === "@returns";
        });

        if (paramList.length) {
            out.push("///");
            out.push("/// # Arguments");
            out.push("///");
            paramList.forEach(entry => {
                tabStop++;
                out.push(
                    "/// * `" + entry[2] + "` - " + this.formatPlaceholder("description", tabStop)
                );
            });
        }

        if (returnList.length) {
            tabStop++;
            out.push("///");
            out.push("/// # Returns");
            out.push("///");
            out.push("/// " + this.formatPlaceholder("description", tabStop));
        }

        return out;
    }

    formatHeaderBlock(docBlock) {
        const out = [];

        docBlock.forEach(entry => {
            out.push("//! " + entry.join(" ").replace(/^@/, ""));
        });

        return out;
    }

    // Updated 2022-08-25
    //
    // @see https://github.com/rust-lang/rfcs/blob/master/text/1574-more-api-documentation-conventions.md

    getDocTags(line) {
        const tagDefault = ["", "${0:description}"];
        const tagExample = ["", "```", "${0:description}", "```"];

        const tags = [
            ["Aborts", this.formatTag(tagDefault)],
            ["Errors", this.formatTag(tagDefault)],
            ["Examples", this.formatTag(tagExample)],
            ["Panics", this.formatTag(tagDefault)],
            ["Safety", this.formatTag(tagDefault)],
            ["Undefined Behavior", this.formatTag(tagDefault)]
        ];

        const regex = new RegExp(
            /^\/{3}[ ]#(?<tag>.*)/
        );

        const match = regex.exec(line);
        if (!match) {
            return [];
        }

        const matches = [];
        const typed = match.groups.tag
            .toLowerCase()
            .replace(/\b\w/g, s => s.toUpperCase());

        tags.forEach(tag => {
            if (tag[0].includes(typed)) {
                matches.push(tag);
            }
        });

        return matches;
    }

    formatTag(block) {
        // Yep, slightly hacky
        const eol = nova.workspace.activeTextEditor.document.eol;

        let out = "";

        block.forEach(line => {
            out += eol + "///" + (line ? " " + line : "");
        });

        return out;
    }
}

module.exports = RustParser;
