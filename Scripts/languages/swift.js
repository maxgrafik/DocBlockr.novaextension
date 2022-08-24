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
        const regex = new RegExp(
            // func
            "func\\s+(?<fnName>" + this.settings.fnIdentifier + ")" +
            // generic
            "(?:<[^>]*?>)?" +
            // arguments with nested parentheses (2 levels)
            // https://stackoverflow.com/a/17759264
            "\\s*\\((?<args>(?:[^()]*|\\([^()]*\\))*)\\)" +
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
            // label or _ (optional)
            "(?:(?<label>" + this.settings.varIdentifier + "|_)\\s+)?" +
            // name
            "(?<name>" + this.settings.varIdentifier + ")" +
            // colon
            "\\s*:\\s*" +
            // inout (optional)
            "(?<inout>inout)?" +
            // type
            "\\s*(?<type>" +
            // - simple/generic type
            this.settings.varIdentifier + "(?:<[^>]+>)?" + "|" +
            // - array
            "\\[" + this.settings.varIdentifier + "\\]" + "|" +
            // - variadic
            this.settings.varIdentifier + "\\.{3}" + "|" +
            // - function
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

        const returnList = docBlock.filter(entry => {
            return entry[0] === "@returns";
        });

        const throwsList = docBlock.filter(entry => {
            return entry[0] === "@throws";
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

        if (returnList.length) {
            tabStop++;
            out.push("///");
            out.push("/// - Returns: " + this.formatPlaceholder("description", tabStop));
        }

        if (throwsList.length) {
            tabStop++;
            out.push("///");
            out.push("/// - Throws: " + this.formatPlaceholder("description", tabStop));
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
            ["Attention", ": ${0:description}"],
            ["Author", ": ${0:description}"],
            ["Authors", ": ${0:description}"],
            ["Bug", ": ${0:description}"],
            ["Complexity", ": ${0:description}"],
            ["Copyright", ": ${0:description}"],
            ["Date", ": ${0:description}"],
            ["Example", ": ${0:description}"],
            ["Experiment", ": ${0:description}"],
            ["Important", ": ${0:description}"],
            ["Invariant", ": ${0:description}"],
            ["Note", ": ${0:description}"],
            ["Parameter", " ${0:name}: ${1:description}"],
            ["Postcondition", ": ${0:description}"],
            ["Precondition", ": ${0:description}"],
            ["Remark", ": ${0:description}"],
            ["Remarks", ": ${0:description}"],
            ["Requires", ": ${0:description}"],
            ["Returns", ": ${0:description}"],
            ["See", ": ${0:description}"],
            ["SeeAlso", ": ${0:description}"],
            ["Since", ": ${0:description}"],
            ["Throws", ": ${0:description}"],
            ["Todo", ": ${0:description}"],
            ["Version", ": ${0:description}"],
            ["Warning", ": ${0:description}"]
        ];

        const regex = new RegExp(
            /^\/{3}[ ]-(?<tag>.*)/
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
}

module.exports = SwiftParser;
