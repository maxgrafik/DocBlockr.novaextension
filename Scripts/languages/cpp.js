const LanguageParser = require("parser.js");

/**
 * C/C++ Parser
 * @extends LanguageParser
 */

class CPPParser extends LanguageParser {

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
        const validChars = "[A-Za-z_][A-Za-z0-9_]*";
        const identifier = "("+ validChars +")(::"+ validChars +")?(<"+ validChars +">)?";
        const settings = {
            language: "cpp",
            varIdentifier: "(" + identifier + ")\\s*(?:\\[(?:" + identifier + ")?\\]|\\((?:(?:\\s*,\\s*)?[a-z]+)+\\s*\\))?",
            fnIdentifier: identifier,
            clsIdentifier: identifier,
            typeInfo: null,
            tags: {
                keySummary: "brief",
                keyVar: "@var",
                keyRet: "@return"
            },
            commentStyle: config.commentStyle === 1 ? "/*!" : "/**"
        };
        super(settings);
    }

    parseClass(line) {
        const attributes = "(?:\\[\\[[^\\]]*\\]\\]\\s*)*";
        const baseClass =
            // attributes
            "(\\s*" + attributes +
            // access-specifier
            "\\s*(?:(?:virtual|private|public|protected)\\s*)*" +
            // class name
            "\\s*(?<baseClass>" + this.settings.varIdentifier + ")" +
            // comma
            "\\s*,?)";

        let regex = new RegExp(
            // class-key
            "(?:class|struct|union)" +
            // attributes
            "\\s*" + attributes +
            // class-head-name
            "\\s*" + "(?<className>" + this.settings.varIdentifier + ")" +
            // final
            "\\s*(?:final)?" +
            // base-clause
            "\\s*(?<baseClause>" +
            // colon + one or more base classes
            "\\s*:" + baseClass + "+" +
            // base-clause end
            ")?"
        );

        let match = regex.exec(line);
        if (!match) {
            return null;
        }

        const className  = match.groups.className;
        const baseClause = match.groups.baseClause;

        const classList = [];

        if (baseClause) {
            regex = new RegExp(baseClass, "g");
            while ((match = regex.exec(baseClause)) !== null) {
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
                classList.push(match.groups.baseClass);
            }
        }

        return [className, classList];
    }

    parseFunction(line) {
        const regex = new RegExp(
            "((?<rettype>" + this.settings.varIdentifier + ")[&*\\s]+)?" +
            // fnName
            "(?<name>" + this.settings.varIdentifier + ");?" +
            // (arg1, arg2)
            "\\s*\\(\\s*(?<args>.*?)\\)"
        );

        const matches = regex.exec(line);
        if(!matches) {
            return null;
        }

        const returnType = matches.groups.rettype ? matches.groups.rettype.replace(/\s/g, "") : null;

        return [
            matches.groups.name.trim(),
            null,
            (matches.groups.args ? matches.groups.args : null),
            returnType
        ];
    }

    parseVar(line) {
        return this.parseArg(line);
    }

    parseArg(line) {
        const regexName = new RegExp(this.settings.varIdentifier + "(?:\\s*=.*)?$");
        const matchName = regexName.exec(line);

        const regexArray = new RegExp(this.settings.varIdentifier + "(?:\\[[^\\]*]\\])");
        const matchArray = regexArray.exec(line);

        const regexType = new RegExp("(" + this.settings.varIdentifier + "[&*\\s]+)");
        const matchType = regexType.exec(line) || [];

        const name = matchName ? matchName[1] : "";
        const arr  = matchArray ? matchArray[1] : "";

        const type = (matchType[1] || "type").replace(/\s+/g, "");

        return [
            name || arr || "name",
            arr ? type+"[]" : type,
            null
        ];
    }

    getDocTags(line) {
        // Doxygen 'commands' - seems to be the tool to use for C/C++
        const tags = [
            ["addtogroup", "${0:name} ${1:title}"],
            ["callgraph", ""],
            ["hidecallgraph", ""],
            ["callergraph", ""],
            ["hidecallergraph", ""],
            ["showrefby", ""],
            ["hiderefby", ""],
            ["showrefs", ""],
            ["hiderefs", ""],
            ["class", "${0:name} ${1:header file} ${2:header name}"],
            ["concept", "${0:name}"],
            ["def", "${0:name}"],
            ["defgroup", "${0:name} ${1:group} ${2:title}"],
            ["dir", "${0:path} ${1:fragment}"],
            ["enum", "${0:name}"],
            ["example", "${0:lineno}, ${1:file name}"],
            ["endinternal", ""],
            ["extends", "${0:name}"],
            ["file", "${0:name}"],
            ["fn", ""],
            ["headerfile", "${1:header file} ${2:header name}"],
            ["hideinitializer", ""],
            ["idlexcept", "${0:name}"],
            ["implements", "${0:name}"],
            ["ingroup", "${0:groupname}"],
            ["interface", "${0:name} ${1:header file} ${2:header name}"],
            ["internal", ""],
            ["mainpage", "${0:title}"],
            ["memberof", "${0:name}"],
            ["name", "${0:header}"],
            ["namespace", "${0:name}"],
            ["nosubgrouping", ""],
            ["overload", "${0:function declaration}"],
            ["page", "${0:name} ${1:title}"],
            ["private", ""],
            ["privatesection", ""],
            ["property", ""],
            ["protected", ""],
            ["protectedsection", ""],
            ["protocol", "${0:name} ${1:header file} ${2:header name}"],
            ["public", ""],
            ["publicsection", ""],
            ["pure", ""],
            ["relates", "${0:name}"],
            ["related", "${0:name}"],
            ["relatesalso", "${0:name}"],
            ["relatedalso", "${0:name}"],
            ["showinitializer", ""],
            ["static", ""],
            ["struct", "${0:name} ${1:header file} ${2:header name}"],
            ["typedef", ""],
            ["union", "${0:name} ${1:header file} ${2:header name}"],
            ["var", ""],
            ["weakgroup", "${0:name} ${1:title}"],
            ["author", "${0:author}"],
            ["brief", "${0:description}"],
            ["bug", "${0:description}"],
            ["copyright", "${0:copyright}"],
            ["date", "${0:date}"],
            ["deprecated", "${0:description}"],
            ["details", "${0:description}"],
            ["noop", ""],
            ["raisewarning", ""],
            ["note", "${0:text}"],
            ["param", "${0:name} ${1:description}"],
            ["result", "${0:description}"],
            ["return", "${0:description}"],
            ["retval", "${0:description}"],
            ["see", "${0:references}"],
            ["since", "${0:text}"],
            ["throw", "${0:exception description}"],
            ["throws", "${0:exception description}"],
            ["todo", "${0:text}"],
            ["version", "${0:version}"],
            ["warning", "${0:message}"]
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

module.exports = CPPParser;
