const LanguageParser = require("parser.js");

/**
 * Swift Parser
 * @extends LanguageParser
 */

class SwiftParser extends LanguageParser {

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

        // Constant and variable names CAN contain almost any character, including Unicode characters
        // Constant and variable names CANNOT contain whitespace, mathematical symbols, arrows,
        // private-use Unicode scalar values, or line- and box-drawing characters, nor can they begin
        // with a number, although numbers may be included elsewhere within the name
        //
        // How much do we care?

        const settings = {
            language: "swift",
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
        // class className: classType (, protocol)*

        const regex = new RegExp(
            // class name
            "class\\s*(?<name>" + this.settings.clsIdentifier + ")" +
            // class type
            "(?:\\s*:\\s*(?<type>" + this.settings.varIdentifier + "))?"
        );

        const match = regex.exec(line);
        if (!match) {
            return null;
        }

        return [match.groups.name, null];
    }

    parseFunction(line) {
        // Functions with nested functions will fail
        // This is too much to handle with RegExp
        const regex = new RegExp(
            // func
            "func\\s+(?<fnName>" + this.settings.fnIdentifier + ")" +
            // generic
            "(?:<[^>]*?>)?" +
            // arguments with nested parentheses (1 level)
            "\\s*\\((?<args>(?:[^)(]+|\\((?:[^)(]+)*\\))*)?\\)" +
            // throws
            "\\s*(?<throws>throws)?" +
            // return type
            "(?:\\s*->\\s*(?<rettype>[^{]))?"
        );

        const matches = regex.exec(line);
        if(!matches) {
            return null;
        }

        let retType = matches.groups.rettype;

        if (retType) {
            const regexReturn = new RegExp(
                "(?:(?<type>" + this.settings.varIdentifier + ")|(?<tuple>\\([^)]*\\)))(?<optional>\\?)?"
            );
            const retMatch = regexReturn.exec(retType.trim());
            if(!retMatch) {
                retType = "type"; // probably a function return
            } else {
                retType = retMatch.groups.type || "Tuple";
                if (retMatch.groups.optional) {
                    retType = "Optional(" + retType + ")";
                }
            }
        }

        return [
            matches.groups.name || "",
            null,
            (matches.groups.args ? matches.groups.args.trim() : null),
            retType || null,
            matches.groups.throws ? ["type"] : null
        ];
    }

    parseVar() {
        return null;
    }

    parseArg(line) {
        const regex = new RegExp(
            // label or _
            "(?<label>" + this.settings.varIdentifier + "|_)" +
            // name
            "\\s+(?<name>" + this.settings.varIdentifier + ")" +
            // colon
            "\\s*:\\s*" +
            // inout
            "(?<inout>inout)?" +
            // type
            "\\s*(?<type>" +
            // - simple/generic type
            this.settings.varIdentifier + "(?:<[^>]+>)?" + "|" +
            // array
            "\\[" + this.settings.varIdentifier + "\\]" + "|" +
            // variadic
            this.settings.varIdentifier + "\\.{3}" + "|" +
            // function
            "(?:@escaping)?\\s*\\([^)]*\\)(?:\\s*->\\s*" + this.settings.varIdentifier + ")" +
            // end of type group
            ")" +
            // optional
            "(?<optional>\\?)?" +
            // default value
            "(?:\\s*=\\s*(?<defaultValue>.+))?"
        );

        const match = regex.exec(line);
        if(!match) {
            return ["arg", null, null];
        }

        let type = match.groups.type || "";
        if (match.groups.optional) {
            type = "Optional(" + type + ")";
        }

        return [
            match.groups.name || "",
            type,
            null
        ];
    }

    // IMPORTANT!
    // Overrides LanguageParser's formatDocBlock()
    // because it's essentially Markdown here

    formatDocBlock(docBlock) {
        const out = [];

        let tabStop = 0;

        out.push("/// " + this.formatPlaceholder(this.settings.tags.keySummary, tabStop));

        const list = docBlock.filter(entry => {
            return entry[0].charAt(0) === "@"
                && entry[0] !== "@param"
                && entry[0] !== "@throws"
                && entry[0] !== "@returns";
        });

        const paramList = docBlock.filter(entry => {
            return entry[0] === "@param";
        });

        const throwsList = docBlock.filter(entry => {
            return entry[0] === "@throws";
        });

        const returnList = docBlock.filter(entry => {
            return entry[0] === "@returns";
        });

        if (list.length) {
            out.push("///");
            list.forEach(entry => {
                out.push(
                    "/// - " + entry[0].slice(1) + ": " + entry[1]
                );
            });
        }

        if (paramList.length) {
            out.push("///");
            out.push("/// - Parameters:");
            paramList.forEach(entry => {
                tabStop++;
                out.push(
                    "///   - " + entry[2] + ": " + this.formatPlaceholder("description", tabStop)
                );
            });
        }

        if (throwsList.length) {
            tabStop++;
            out.push("///");
            out.push("/// - Throws: " + this.formatPlaceholder("description", tabStop));
        }

        if (returnList.length) {
            tabStop++;
            out.push("///");
            out.push("/// - Returns: " + this.formatPlaceholder("description", tabStop));
        }

        if (out.length > 1) {
            out.push("///");
        }

        return out;
    }

    formatHeaderBlock(docBlock) {
        const out = [];

        docBlock.forEach((entry, idx) => {
            if (entry[0].charAt(0) === "@") {
                entry[0] = entry[0]
                    .toLowerCase()
                    .replace(/\b\w/g, s => s.toUpperCase())
                    .replace(/^@(.+)/, "- $1:");
            }

            out.push("/// " + entry.join(" "));
            if (idx === 0) {
                out.push("///");
            }
        });

        return out;
    }

    getDocTags(line) {
        const tags = [
            ["attention", "${0:description}"],
            ["author", "${0:description}"],
            ["authors", "${0:description}"],
            ["bug", "${0:description}"],
            ["complexity", "${0:description}"],
            ["copyright", "${0:description}"],
            ["date", "${0:description}"],
            ["example", "${0:description}"],
            ["experiment", "${0:description}"],
            ["important", "${0:description}"],
            ["invariant", "${0:description}"],
            ["note", "${0:description}"],
            ["parameter", "${0:name} ${1:description}"],
            ["postcondition", "${0:description}"],
            ["precondition", "${0:description}"],
            ["remark", "${0:description}"],
            ["remarks", "${0:description}"],
            ["requires", "${0:description}"],
            ["returns", "${0:description}"],
            ["see", "${0:description}"],
            ["since", "${0:description}"],
            ["throws", "${0:description}"],
            ["todo", "${0:description}"],
            ["version", "${0:description}"],
            ["warning", "${0:description}"]
        ];

        const regex = new RegExp(
            /^\/{3}\s+-(?<tag>.*)/
        );

        const match = regex.exec(line);
        if (!match) {
            return [];
        }

        const matches = [];
        const typed = match.groups.tag;

        tags.forEach(tag => {
            if (tag[0].includes(typed)) {
                matches.push(tag);
            }
        });

        return matches;
    }
}

module.exports = SwiftParser;
