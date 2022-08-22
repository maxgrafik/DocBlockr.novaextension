const LanguageParser = require("parser.js");

/**
 * ObjC/ObjC++ Parser
 * @extends LanguageParser
 */

class ObjCParser extends LanguageParser {

    constructor(config) {
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
            language: "objc",
            varIdentifier: validChars,
            fnIdentifier: validChars,
            clsIdentifier: validChars,
            typeInfo: null,
            tags: {
                keySummary: "summary",
                keyVar: "@var",
                keyRet: "@return"
            },
            commentStyle: config.commentStyle === 1 ? "/*!" : "/**"
        };
        super(settings);
    }

    parseClass() {
        return null;
    }

    parseFunction(line) {
        const typeRegex = "[A-Za-z_$][A-Za-z0-9_$]*\\s*\\**";
        let regex = new RegExp(
            "[-+]\\s+\\(\\s*(?<rettype>" + typeRegex + ")\\s*\\)\\s*" +
            "(?<name>[A-Za-z_$][A-Za-z0-9_$]*)" +
            "\\s*(?::(?<args>[^{;]*))?"
        );

        const matches = regex.exec(line);
        if (!matches) {
            return null;
        }

        let name = matches.groups.name;

        const argStr = matches.groups.args;
        const args = [];

        if (argStr) {
            regex = /\s*:\s*/g;
            let result;
            const groups = argStr.split(regex);
            const numGroups = groups.length;
            for (let i = 0; i < numGroups; i++) {
                let group = groups[i];
                if (i < (numGroups - 1)) {
                    regex = /\s+(\S*)$/g;
                    result = regex.exec(group);
                    name += ":" + result[1];
                    group = group.slice(0, result.index);
                }
                args.push(group);
            }
            if (numGroups) { name += ":"; }
        }

        return [
            name,
            null,
            args.join("|||"),
            matches.groups.rettype
        ];
    }

    parseVar() {
        return null;
    }

    /**
     * Override LanguageParser parseArgs()
     * because args are completely different
     */

    parseArgs(args) {
        const out = [];
        const argList = args.split("|||");
        argList.forEach(arg => {
            const lastParen = arg.lastIndexOf(")");
            out.push([
                arg.slice(lastParen + 1).trim(),
                arg.slice(1, lastParen).trim(),
                ""
            ]);
        });
        return out;
    }

    getDocTags(line) {
        // Should we use appledoc or Doxygen???
        const tags = [
            ["abstract", "${0:description}"],
            ["apiuid", "${0:description}"],
            ["attribute", ""],
            ["attributelist", ""],
            ["attributeblock", ""],
            ["availability", "${0:description}"],
            ["brief", "${0:description}"],
            ["discussion", "${0:description}"],
            ["indexgroup", "${0:name}"],
            ["internal", ""],
            ["link", "${0:link}"],
            ["namespace", "${0:namespace}"],
            ["see", "${0:link}"],
            ["seealso", "${0:link}"],
            ["updated", "${0:description}"],
            ["frameworkcopyright", "${0:year} ${1:description}"],
            ["frameworkpath", "${0:path}"],
            ["frameworkuid", "${0:UID}"],
            ["headerpath", "${0:path}"],
            ["author", "${0:author}"],
            ["charset", "${0:charset}"],
            ["compilerflag", "${0:flags}"],
            ["copyright", "${0:copyright}"],
            ["CFBundleIdentifier", "${0:bundle}"],
            ["encoding", "${0:charset}"],
            ["flag", "${0:flags}"],
            ["ignore", "${0:description}"],
            ["ignorefuncmacro", "${0:description}"],
            ["preprocinfo", ""],
            ["related", "${0:description}"],
            ["unsorted", ""],
            ["version", "${0:version}"],
            ["whyinclude", "${0:description}"],
            ["classdesign", "${0:description}"],
            ["coclass", "${0:class} ${1:description}"],
            ["dependency", "${0:description}"],
            ["deprecated", "${0:description}"],
            ["helper", "${0:class}"],
            ["helperclass", "${0:class}"],
            ["helps", "${0:description}"],
            ["instancesize", "${0:description}"],
            ["ownership", "${0:description}"],
            ["performance", "${0:description}"],
            ["security", "${0:description}"],
            ["superclass", "${0:class}"],
            ["templatefield", "${0:field} ${1:description}"],
            ["var", "${0:var}"],
            ["param", "${0:name} ${1:description}"],
            ["result", "${0:description}"],
            ["return", "${0:description}"],
            ["throws", "${0:description}"],
            ["callback", "${0:function} ${1:description}"],
            ["field", "${0:field} ${1:description}"],
            ["constant", "${0:name} ${1:description}"],
            ["const", "${0:name} ${1:description}"],
            ["define", "${0:name}"],
            ["defined", "${0:name}"],
            ["noParse", ""],
            ["parseOnly", ""]
        ];

        const regex = new RegExp(
            /^\*\s+[@\\](?<tag>.*)/
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

module.exports = ObjCParser;
