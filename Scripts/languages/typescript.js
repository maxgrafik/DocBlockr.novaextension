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
         * @property {string} typeFormat    - Format of param types
         * @property {Object} tags          - Language specific tags
         */
        let validChars = "[a-zA-Z_$][a-zA-Z_$0-9]*";
        let settings = {
            language: "typescript",
            varIdentifier: validChars,
            fnIdentifier: validChars,
            clsIdentifier: validChars,
            typeFormat: "{%s}",
            tags: {
                keyVar: "@type",
                keyRet: "@returns"
            }
        };
        super(settings);

        let baseType = validChars + '(\\.' + validChars + ')*(\\[\\])?';
        this.parametricType = baseType + '(\\s*<\\s*' + baseType + '(\\s*,\\s*' + baseType + '\\s*)*>)?';
    }

    parseClass(line) {
        let regex = new RegExp(
            "^\\s*class\\s+" +
            "(?<name>" + this.settings.clsIdentifier + ")" +
            "(:?\\s+extends\\s+(?<extends>" + this.settings.clsIdentifier + "))?"
        );
        
        let match = regex.exec(line);
        if (!match) {
            return null;
        }
        
        return [match.groups.name, match.groups.extends];
    }

    parseFunction(line) {
        let regex = new RegExp(
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

        let matches = regex.exec(line);
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
        let regex = new RegExp(
            // Modifiers
            "((public|private|static|readonly|var|let|const)\\s+)*" +
            // Name
            "(?<name>" + this.settings.varIdentifier + ")[?!]?\\s*" + 
            // Parametric type
            "(:\\s*(?<type>" + this.parametricType + "))?" + 
            // Value
            "(\\s*=\\s*(?<value>.*?))?([;,]|$)"
        );

        let match = regex.exec(line);
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

}

module.exports = TypeScriptParser;