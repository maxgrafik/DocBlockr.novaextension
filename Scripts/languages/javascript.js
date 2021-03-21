const LanguageParser = require("parser.js");

/**
 * JavaScript Parser
 * @extends LanguageParser
 */

class JavaScriptParser extends LanguageParser {

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
            language: "javascript",
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
        // quotes indicate what will be matched in each line
        let preFunction = "^" +
            // "  "var foo = function bar (baz, quaz) {}
            "\\s*" +
            "(?:" +
                // "return" foo = function bar (baz, quaz) {}
                "return\\s+" +
                "|" +
                // "export default "var foo = function bar (baz, quaz) {}
                "(?:export\\s+(?:default\\s+)?)?" +
                //  export default "var "foo = function bar (baz, quaz) {}
                "(?:(?:var|let|const)\\s+)?" +
            ")?" +
            "(?:" +
                // var "bar.prototype."foo = function bar (baz, quaz) {}
                "(?:[a-zA-Z_$][a-zA-Z_$0-9.]*\\.)?" +
                // var "foo = "function bar (baz, quaz) {}
                "(?<name1>" + this.settings.varIdentifier + ")\\s*[:=]\\s*" +
            ")?";
        
        let modifiers = "(?:\\bstatic\\s+)?(?<promise>\\basync\\s+)?";
        
        let functionRegex = new RegExp(
            preFunction +
            modifiers +
            // var foo = "function "bar (baz, quaz) {}
            "(?:function(?<generator>\\s*\\*)?)\\s*" +
            // var foo = function "bar "(baz, quaz) {}
            "(?:\\b(?<name2>" + this.settings.fnIdentifier + "))?\\s*" +
            // var foo = function bar "(baz, quaz)" {}
            "\\(\\s*(?<args>.*?)\\)"
        );
        
        let methodRegex = new RegExp(
            "^" +
            "\\s*" +
            modifiers +
            "(?<generator>\\*)?\\s*" +
            "(?<name2>" + this.settings.fnIdentifier + ")\\s*" +
            "\\(\\s*(?<args>.*?)\\)\\s*" +
            "{"
        );
        
        let getterSetterMethodRegex = new RegExp(
            "^" +
            "\\s*" +
            "(?<getter>get|set)\\s+" +
            "(?<name2>" + this.settings.fnIdentifier + ")\\s*" +
            "\\(\\s*(?<args>.*?)\\)\\s*" +
            "{"
        );
        
        let arrowFunctionRegex = new RegExp(
            preFunction +
            "(?<promise>async\\s+)?" +
            "(?:"+
                // var foo = "bar" => {}
                "(?<arg>" + this.settings.varIdentifier + ")" +
                "|" +
                // var foo = "(bar, baz)" => {}
                "\\(\\s*(?<args>.*?)\\)" +
            ")\\s*" +
            // var foo = bar "=>" {}
            "=>\\s*"
        );
        
        let functionMatch = null;
        let methodMatch = null;
        let getterMatch = null;

        let matches = (
            (functionMatch = functionRegex.exec(line)) || 
            (methodMatch = methodRegex.exec(line)) || 
            (getterMatch = getterSetterMethodRegex.exec(line)) || 
            arrowFunctionRegex.exec(line)
        );
        
        if (matches === null) {
            return null;
        }

        // grab the name out of "name1 = function name2(foo)" preferring name1
        let name = matches.groups.name1 || matches.groups.name2 || "";
        let args = matches.groups.args || matches.groups.arg || null;
        
        let type = null;
        let returnType = null;

        if (functionMatch) {
            type = (name.length && name[0] === name[0].toUpperCase()) ? "class" : null;
        }
        if (methodMatch) {
            type = (name === "constructor") ? "constructor" : "member";
            //returnType = (type === "constructor" ? null : returnType);
        }
        if (getterMatch) {
            type = (matches.groups.getter === "get") ? "getter" : null;
        }
        if (matches.groups.generator) {
            type = "generator";
        }
        if (matches.groups.promise) {
            returnType = "Promise";
        }
        
        return [name, type, args, returnType];
    }

    parseVar(line) {
        let regex = new RegExp(
            "(?<name>" + this.settings.varIdentifier + ")\\s*[=:]\\s*(?<value>.*?)(?:[;,]|$)"
        );

        let match = regex.exec(line);
        if (!match) {
            return null;
        }
        
        return [match.groups.name, null, match.groups.value];
    }

    parseArg(line) {
        // rest parameter
        let regex = new RegExp(
            "\\.{3}(?<name>" + this.settings.varIdentifier + ")"
        );
        
        let match = regex.exec(line);
        if (match) {
            return [match.groups.name, "Array", null];
        }
        
        // destructuring assignment
        regex = new RegExp(
            "^(?<object>\\{.*\\})|^(?<array>\\[.*\\])"
        );

        match = regex.exec(line);
        if (match) {
            if (match.groups.object) {
                return ["", "Object", null]; // extract every property here?
            } else if (match.groups.array) {
                return ["", "Array", null]; // extract every param here?
            }
        }

        regex = new RegExp(
            "(?<name>" + this.settings.varIdentifier + ")(\\s*=\\s*(?<value>.*))?"
        );

        match = regex.exec(line);
        if (match) {
            return [match.groups.name, null,  match.groups.value];
        }

        return [line, null, null];
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

        let regex = new RegExp(
            "^\\*\\s+@(?<tag>.*)"
        );

        let match = regex.exec(line);
        if (!match) {
            return [];
        }

        let matches = [];
        let typed = match.groups.tag;
        
        tags.forEach(tag => {
            if (tag[0].substr(0, typed.length) === typed) {
                matches.push(tag);
            }
        });

        return matches;
    }

}

module.exports = JavaScriptParser;
