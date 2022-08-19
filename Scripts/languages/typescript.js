const LanguageParser = require("parser.js");

/**
 * TypeScript Parser
 * @extends LanguageParser
 */

class TypeScriptParser extends LanguageParser {

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
            language: "typescript",
            varIdentifier: validChars,
            fnIdentifier: validChars,
            clsIdentifier: validChars,
            typeInfo: "{%s}", // shouldn’t this be null?
            tags: {
                keySummary: "summary",
                keyVar: "@type",
                keyRet: "@returns"
            }
        };
        super(settings);

        const baseType = validChars + "(\\." + validChars + ")*(\\[\\])?";
        this.parametricType = baseType + "(\\s*<\\s*" + baseType + "(\\s*,\\s*" + baseType + "\\s*)*>)?";
    }

    parseClass(line) {
        const regex = new RegExp(
            "^\\s*class\\s+" +
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
            // Modifiers
            "(?:public|private|static)?\\s*" +
            // Method name
            "(?<name>" + this.settings.fnIdentifier + ")\\s*" +
            // Type parameter
            "(?<typeparam><[^>]+>)?\\s*" +
            // Params
            "\\((?<args>.*?)\\)\\s*" +
            // Return value
            "(:\\s*(?<rettype>" + this.parametricType + "(?:\\s*\\|\\s*" + this.parametricType + ")*))?"
        );

        const matches = regex.exec(line);
        if (matches === null) {
            return null;
        }

        let type = null;
        let returnType = matches.groups.rettype ? matches.groups.rettype.replace(/\s/g, "") : null;

        if (returnType && returnType.endsWith("|null")) {
            returnType = "?" + returnType.replace(/\|null/, ""); // nullable type
        }
        if (returnType && returnType.indexOf("|") > -1) {
            returnType = "(" + returnType + ")"; // union type in parentheses
        }

        if (matches.groups.name === "constructor") {
            type = "constructor";
            returnType = null;
        }

        return [
            matches.groups.name,
            type,
            matches.groups.args,
            returnType
        ];
    }

    parseVar(line) {
        const regex = new RegExp(
            // Modifiers
            "((public|private|static|readonly|var|let|const)\\s+)*" +
            // Name
            "(?<name>" + this.settings.varIdentifier + ")[?!]?\\s*" +
            // Parametric type
            "(:\\s*(?<type>" + this.parametricType + "))?" +
            // Value
            "(\\s*=\\s*(?<value>.*?))?([;,]|$)"
        );

        const match = regex.exec(line);
        if (!match) {
            return null;
        }

        return [
            match.groups.name,
            match.groups.type,
            match.groups.value
        ];
    }

    parseArg(line) {
        let name = line;
        let type = null;

        if (line.indexOf(":") > -1) {
            name = line.split(":")[0];
            type = line.split(":").slice(1).join(":").trim().replace(/\s/g, "");
            if (type && type.endsWith("|null")) {
                type = "?" + type.replace(/\|null/, ""); // nullable type
            } else if (type && type.indexOf("|") > -1) {
                type = "(" + type + ")"; // union type in parentheses
            } else if (type && type.charAt(0) === "[") {
                type = "Array";
            } else if (type && type.charAt(0) === "{") {
                type = "Object";
            } else if (type && type.charAt(0) === "(") {
                type = "Function"; // most likely
            }
        }

        name = name.replace(/\b(public|private)\s+|/g, "");
        name = name.replace(/[ ?]/g, "");
        name = name.replace(/^\.{3}/, "");

        return [name, type, null];
    }

    getDocTags(line) {
        const tags = [
            ["abstract", ""],
            ["access", "${0:package|private|protected|public}"],
            ["alias", "${0:aliasNamepath}"],
            ["async", ""],
            ["author", "${0:name} ${1:email}"],
            ["borrows", "${0:namepath} as ${1:namepath}"],
            ["callback", "${0:namepath}"],
            ["class", "${0:name}"],
            ["classdesc", "${0:description}"],
            ["const", "{${0:type}}"],
            ["constructs", "${0:name}"],
            ["copyright", "${0:copyright}"],
            ["default", "${0:value}"],
            ["deprecated", "${0:description}"],
            ["desc", "${0:description}"],
            ["enum", "{${0:type}}"],
            ["event", "${0:eventName}"],
            ["example", "${0:example}"],
            ["exports", "${0:moduleName}"],
            ["extends", "${0:namepath}"],
            ["external", "${0:name}"],
            ["file", "${0:description}"],
            ["fires", "${0:eventName}"],
            ["function", "${0:functionName}"],
            ["generator", ""],
            ["global", ""],
            ["hideconstructor", ""],
            ["ignore", ""],
            ["implements", "{${0:typeExpression}}"],
            ["inheritdoc", ""],
            ["inner", ""],
            ["instance", ""],
            ["interface", "${0:name}"],
            ["kind", "${0:kindName}"],
            ["lends", "${0:namepath}"],
            ["license", "${0:identifier}"],
            ["listens", "${0:eventName}"],
            ["memberof", "${0:parentNamepath}"],
            ["mixes", "${0:otherObjectPath}"],
            ["mixin", "${0:MixinName}"],
            ["module", "${0:moduleName}"],
            ["name", "${0:namepath}"],
            ["namespace", "${0:name}"],
            ["override", ""],
            ["package", ""],
            ["param", "{${0:type}} ${1:name} - ${2:description}"],
            ["private", ""],
            ["property", "{${0:type}} ${1:name} - ${2:description}"],
            ["protected", ""],
            ["public", ""],
            ["readonly", ""],
            ["requires", "${0:moduleName}"],
            ["returns", "{${0:type}} - ${1:description}"],
            ["see", "${0:namepath}"],
            ["since", "${0:versionDescription}"],
            ["static", ""],
            ["this", "${0:namePath}"],
            ["throws", "{${0:type}} - ${1:description}"],
            ["todo", "${0:description}"],
            ["tutorial", "${0:description}"],
            ["type", "{${0:type}}"],
            ["typedef", "{${0:type}} ${1:namepath}"],
            ["variation", "${0:variationNumber}"],
            ["version", "${0:version}"],
            ["yields", "{${0:type}} - ${1:description}"]
        ];

        const regex = new RegExp(
            "^\\*\\s+@(?<tag>.*)"
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

module.exports = TypeScriptParser;
