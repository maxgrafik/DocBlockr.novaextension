const LanguageParser = require("parser.js");

/**
 * Java Parser
 * @extends LanguageParser
 */

class JavaParser extends LanguageParser {

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
        const validChars = "[a-zA-Z_$][a-zA-Z_$0-9]*";
        const settings = {
            language: "java",
            varIdentifier: validChars,
            fnIdentifier: validChars,
            clsIdentifier: validChars,
            typeInfo: null,
            tags: {
                keySummary: "summary",
                keyVar: null,
                keyRet: "@return"
            },
            commentStyle: "/**"
        };
        super(settings);
    }

    parseClass() {
        return null;
    }

    parseFunction(line) {
        const regex = new RegExp(
            // modifiers
            "(?:(public|protected|private|static|abstract|final|transient|synchronized|native|strictfp)\\s+)*" +
            // return type
            "(?:(?<rettype>[a-zA-Z_$][\\<\\>\\., a-zA-Z_$0-9\\[\\]]+)\\s+)?" +
            // method name
            "(?<name>" + this.settings.fnIdentifier + ")\\s*" +
            // args
            "\\((?<args>.*?)\\)\\s*" +
            // throws
            "(?:throws\\s*(?<throws>[a-zA-Z_$0-9\\.,\\s]*))?"
        );

        const matches = regex.exec(line);
        if(!matches) {
            return null;
        }

        const returnType = matches.groups.rettype ? matches.groups.rettype.replace(/\s/g, "") : null;
        const throwsType = matches.groups.throws ? matches.groups.throws.split(/\s*,\s*/) : null;

        return [
            matches.groups.name || "",
            null,
            (matches.groups.args ? matches.groups.args.trim() : null),
            returnType || null,
            throwsType
        ];
    }

    parseVar() {
        return null;
    }

    parseArg(line) {
        const arg = line.trim().split(/\s/);
        return [
            arg.pop(),
            arg.shift(),
            null
        ];
    }

    getDocTags(line) {
        const tags = [
            ["author", "${0:name}"],
            ["version", "${0:version}"],
            ["since", "${0:version}"],
            ["see", "${0:reference}"],
            ["serial", ""],
            ["serialField", ""],
            ["param", "${0:name} ${1:description}"],
            ["return", "${0:description}"],
            ["exception", "${0:classname} ${1:description}"],
            ["throws", "${0:classname} ${1:description}"],
            ["deprecated", "${0:description}"],
            ["inheritDoc", ""],
            ["link", "${0:reference}"],
            ["linkPlain", "${0:reference}"],
            ["value", ""],
            ["docRoot", ""],
            ["code", ""],
            ["literal", ""]
        ];

        const regex = new RegExp(
            /^\*\s+@(?<tag>.*)/
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

module.exports = JavaParser;
