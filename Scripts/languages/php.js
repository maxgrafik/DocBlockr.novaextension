const LanguageParser = require("parser.js");

/**
 * PHP Parser
 * @extends LanguageParser
 */

class PHPParser extends LanguageParser {

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
        const validChars = "[a-zA-Z_$\\x7f-\\xff][a-zA-Z0-9_$\\x7f-\\xff]*";
        const settings = {
            language: "php",
            varIdentifier : validChars + "(?:->" + validChars + ")*",
            fnIdentifier : validChars,
            clsIdentifier : validChars,
            typeInfo: "%s",
            tags: {
                keySummary: "summary",
                keyVar: "@var",
                keyRet: "@return"
            },
            commentStyle: "/**"
        };
        super(settings);
    }

    parseClass(line) {
        const regex = new RegExp(
            "^\\s*(?:abstract\\s+)?class\\s+" +
            "(?<name>" + this.settings.clsIdentifier + ")" +
            "(:?\\s+extends\\s+(?<extends>" + this.settings.clsIdentifier + "))?"
        );

        const match = regex.exec(line);
        if (!match) {
            return null;
        }

        return [match.groups.name, match.groups.extends];
    }

    parseFunction(line) {
        const regex = new RegExp(
            "^\\s*(?:(?<modifier>(?:(?:(?:final|abstract)\\s+)?(?:public|protected|private)\\s+)?(?:final\\s+)?(?:static\\s+)?))?" +
            "function\\s+&?(?:\\s+)?" +
            "(?<name>" + this.settings.fnIdentifier + ")\\s*" +

            // https://github.com/maxgrafik/DocBlockr.novaextension/issues/2
            // Does not match nested parentheses ...
            "\\(\\s*(?<args>.*?)\\)" +

            // ... but recursion is not (yet) supported :(
            //"(?<parentheses>\\((?<args>(?:(?>[^()]+)|(?&parentheses))*)\\))" +

            "(?:\\s*\\:\\s*(?<nullable>\\?)?(?<rettype>[a-zA-Z0-9_\\x5c]*))?"
        );

        const matches = regex.exec(line);
        if(!matches) {
            return null;
        }

        let type = null;
        let returnType = matches.groups.rettype ? matches.groups.rettype.replace(/\s/g, "") : "void";

        if (matches.groups.name === "__construct") {
            type = "constructor";
            returnType = null;
        }

        if (matches.groups.nullable) {
            returnType += "|null";
        }

        return [
            matches.groups.name,
            type,
            (matches.groups.args ? matches.groups.args : null),
            returnType
        ];
    }

    parseVar(line) {
        const regex = new RegExp(
            "^\\s*(?:(?<modifier>var|static|const|(?:final)(?:public|private|protected)(?:\\s+final)(?:\\s+static)?)\\s+)?" +
            "(?<name>" + this.settings.varIdentifier + ")" +
            "(?:\\s*=>?\\s*(?<value>.*?)(?:[;,]|$))?"
        );

        const match = regex.exec(line);
        if (!match) {
            return null;
        }

        return [
            match.groups.name,
            null,
            (match.groups.value ? match.groups.value : null)
        ];
    }

    parseArg(line) {
        const clsIdentifier = "[a-zA-Z_$\\\\x7f-\\xff][a-zA-Z0-9_$\\\\x7f-\\xff]*";
        const keywords = "string|integer|int|boolean|bool|float|double|object|mixed|array|resource|void|null|callable|false|true|self|scalar";
        let regex = new RegExp(
            "(?:(?<type>" + keywords + ")|(?<class>" + clsIdentifier + "))\\s+(?<splat>\\.{3})?(?<name>" + this.settings.varIdentifier + ")"
        );

        let match = regex.exec(line);
        if (match) {
            return [
                match.groups.name,
                (match.groups.type || match.groups.class) + (match.groups.splat ? "[]" : ""),
                null
            ];
        }

        regex = new RegExp(
            "(?<splat>\\.{3})(?<name>" + this.settings.varIdentifier + ")"
        );

        match = regex.exec(line);
        if (match) {
            return [match.groups.name, "Array", null];
        }

        regex = new RegExp(
            "(?<name>" + this.settings.varIdentifier + ")(\\s*=\\s*(?<value>.*))?"
        );

        match = regex.exec(line);
        if (match) {
            return [match.groups.name, null, match.groups.value];
        }

        return [line, null, null];
    }

    getDocTags(line) {
        const tags = [
            ["api", ""],
            ["author", "${0:name} ${1:email}"],
            ["deprecated", "${0:version} ${1:description}"],
            ["copyright", "${0:description}"],
            ["example", "${0:example}"],
            ["filesource", ""],
            ["ignore", "${0:description}"],
            ["internal", "${0:description}"],
            ["license", "${0:name}"],
            ["link", "${0:URI} ${1:description}"],
            ["method", "${0:description}"],
            ["package", "${0:description}"],
            ["param", "${0:type} ${1:name} ${2:description}"],
            ["property", "${0:type} ${1:name} ${2:description}"],
            ["return", "${0:type} ${1:description}"],
            ["see", "${0:URI|FQSEN} ${1:description}"],
            ["since", "${0:version} ${1:description}"],
            ["throws", "${0:type} ${1:description}"],
            ["todo", "${0:description}"],
            ["uses", "${0:FQSEN} ${1:description}"],
            ["var", "${0:type}"],
            ["version", "${0:version} ${1:description}"]
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

module.exports = PHPParser;
