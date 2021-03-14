/**
 * LanguageParser
 *
 * Base class for all language parsers
 * Handles formatting of DocBlocks
 */

class LanguageParser {

    constructor(settings) {
        this.settings = settings
    }

    getDefinition(lines) {
        let definition = "";
        let lineCounter = 0;
        let bracketCounter = 0;
        for (let line of lines) {
            line = line
                // strip one line comments
                .replace(/\/\/.*$/g, "")
                // strip block comments
                .replace(/\/\*.*\*\//g, "")
                // strip strings
                .replace(/'(?:(\\.)|[^'])*'/g, "''")
                .replace(/"(?:(\\.)|[^"])*"/g, "\"\"")
                .trim();

            for (const char of line) {
                switch(char) {
                    case "(": bracketCounter++; break;
                    case ")": bracketCounter--; break;
                }
            }
    
            if (line !== "") {
                definition += line;
                if (line.endsWith(";")) {
                    return definition;
                }
                lineCounter++;
                if (lineCounter > 10) {
                    return definition;
                }
            }

            if (bracketCounter < 0) {
                return definition;
            }
        }

        return definition;
    }

    getDocBlock(line, config) {
        let docBlock = this.parse(line);
        if (!docBlock) {
            return null;
        }
    
        let alignTags = config.alignTags;
        let maxLength = [0, 0, 0, 0];

        /**
         * Calculate max length of each column
         * Strip nova placeholders and leading backslash escapes
         */
        if (alignTags > 0) {
            docBlock.forEach(entry => {
                if (entry.length > 1) {
                    entry.forEach((e, idx) => {
                        e = e.replace(/^(\{?)(?:\$\{\d+:)?([^}]+)(?:\})?(\}?)$/, "$1"+"$2"+"$3").replace(/^[\\]/, "");
                        maxLength[idx] = Math.max(maxLength[idx], e.length);
                    });
                }
            });
        }

        let addEmptyLine = 0;
        let descSep = " ";

        switch(this.settings.language) {
        case "javascript":
            addEmptyLine = config.addEmptyLineJS;
            descSep = " - ";
            break;
        case "typescript":
            addEmptyLine = config.addEmptyLineTS;
            descSep = " - ";
            break;
        case "php":
            addEmptyLine = config.addEmptyLinePHP;
            break;
        }

        /* create snippet */
        let snippet = "/**\n";
        docBlock.forEach((entry, index) => {

            snippet += " *";
            entry.forEach((e, idx) => {
                snippet += (idx === 3 ? descSep : " ") + e;
                if (alignTags > idx) {
                    let text = e.replace(/^(\{?)(?:\$\{\d+:)?([^}]+)(?:\})?(\}?)$/, "$1"+"$2"+"$3").replace(/^[\\]/, "");
                    let padding = maxLength[idx] - text.length;
                    snippet += "".padEnd(padding);
                }
            });
            snippet += "\n";

            if (addEmptyLine > 0 && index === 0 && docBlock.length > 1) {
                snippet += " *\n";

            } else if (addEmptyLine === 2 && index < docBlock.length-1) {
                let nextTag = docBlock[index+1][0];
                if (nextTag !== entry[0]) {
                    snippet += " *\n";
                }
            }

        });
        snippet += " */";

        return snippet;
    }

    parse(line) {
        let result;

        result = this.parseClass(line);  // (name, extends)
        if (result) {
            return this.formatClass(...result);
        }

        result = this.parseFunction(line);  // (name, type, args, returnType)
        if (result) {
            return this.formatFunction(...result);
        }

        result = this.parseVar(line);  // (name, type, value)
        if (result) {
            return this.formatVar(...result);
        }

        return null;
    }

    formatClass(name, superClass) {
        let out = [];
        out.push(["${0:summary}"]);
        
        if (superClass) {
            out.push(['@extends ' + superClass]);
        }
        return out;
    }

    formatFunction(name, type, args, returnType) {
        let out = [];
        let tabOffset = 0;

        out.push(["${0:summary}"]);

        if (type === "member" || type === "getter") {
            tabOffset++;
            out.push(["@memberof ${" + tabOffset + ":parent}"]);
        }

        // if there are arguments, add a @param for each
        if (args) {

            // remove comments inside the argument list.
            args = args.replace(/\/\*.*?\*\//, "");

            let parsedArgs = this.parseArgs(args);

            parsedArgs.forEach(arg => {
                let name = arg[0].charAt(0) === "$" ? "\\$" + arg[0].slice(1) : arg[0];
                let type = arg[1];
                let value = arg[2];

                if (!type && value) {
                    type = this.guessTypeFromValue(value);
                }

                out.push([
                    "@param",
                    this.formatType((type || "type"), tabOffset+1),
                    name,
                    "${" + (tabOffset+2) + ":description}"
                ]);
                
                tabOffset += 2;
            });
        }

        if (!returnType && type !== "constructor") {
            returnType = this.guessTypeFromName(name);
        }

        tabOffset++;
        if (type === "getter") {
            out.push([
                this.settings.tags.keyVar,
                this.formatType("type", tabOffset),
                "",
                "${" + (tabOffset+1) + ":description}"
            ]);
        } else if (type === "generator") {
            out.push([
                "@yields",
                this.formatType("type", tabOffset),
                "",
                "${" + (tabOffset+1) + ":description}"
            ]);
        } else if (returnType) {
            out.push([
                this.settings.tags.keyRet,
                this.formatType(returnType, tabOffset),
                "",
                "${" + (tabOffset+1) + ":description}"
            ]);
        }

        return out;
    }

    formatVar(name, type, value) {
        let out = [];

        if (!type) {
            type = this.guessTypeFromValue(value) || this.guessTypeFromName(name) || "type";
        }

        out.push(["${0:summary}"]);
        out.push([
            this.settings.tags.keyVar + " " +
            this.formatType(type, 1)
        ]);
    
        return out;
    }

    formatType(type, tabStop) {
        type = type ? type.replaceAll("\\", "\\\\") : type;
        type = "${" + tabStop + ":" + type + "}";
        return this.settings.typeFormat.replace("%s", type);
    }

    parseArgs(raw) {
        let out = [];
        if(!raw) {
            return out;
        }

        let arg = "";
        let args = [];

        let isLiteral = false;
        let isQuote = false;
        let matchingQuote = "";
        let arrayDepth = 0;
        let objDepth = 0;
        let openQuotes = "\"'<(";
        let closeQuotes = "\"'>)";

        [...raw].forEach(char => {
            if (isLiteral) {
                arg += char;
                isLiteral = false;

            } else if (char === "\\") {
                if (isQuote) {
                    isLiteral = true;
                } else {
                    arg += char;
                }

            } else if (isQuote) {
                arg += char;
                if (char == matchingQuote) {
                    isQuote = false;
                }

            } else if (openQuotes.indexOf(char) > -1) {
                arg += char;
                matchingQuote = closeQuotes[openQuotes.indexOf(char)];
                isQuote = true;

            } else if (char === "[") {
                arg += char;
                arrayDepth++;
                
            } else if (char === "]") {
                arg += char;
                arrayDepth--;

            } else if (char === "{") {
                arg += char;
                objDepth++;
                
            } else if (char === "}") {
                arg += char;
                objDepth--;

            } else {
                if (char === "," && arrayDepth === 0 && objDepth === 0) {
                    args.push(arg.trim());
                    arg = "";
                } else {
                    arg += char;
                }
            }
        });

        args.push(arg.trim());

        args.forEach(arg => {
            if (arg !== "") {
                out.push(this.parseArg(arg));
            }
        });

        return out;
    }

    guessTypeFromName(name) {
        if (name.search("[$_]?(?:is|has)[A-Z_]") > -1) {
            return "boolean";
        }
        if (name.search("^[$_]?(?:cb|callback|done|next|fn)$") > -1) {
            return "function";
        }
        return null;
    }
    
    guessTypeFromValue(value) {
        if (!value) {
            return null;
        }
        if (!isNaN(value)) {
            if (this.settings.language === "php") {
                return (value.indexOf(".") > -1) ? "float" : "integer";
            } else {
                return "number";
            }
        }
        if ((value[0] === "'") || (value[0] === "\"")) {
            return "string";
        }
        if (value.slice(0, 5) == "array" || value[0] === "[") {
            return "Array";
        }
        if (value[0] === "{") {
            return "Object";
        }
        if ((value.toLowerCase() === "true") || (value.toLowerCase() === "false")) {
            return "boolean";
        }
        let regex = new RegExp('^RegExp|^\\/[^/*].*\\/$');
        if (regex.test(value)) {
            return "RegExp";
        }
        if (value.slice(0, 4) === "new ") {
            regex = new RegExp("new (" + this.settings.fnIdentifier + ")");
            var matches = regex.exec(value);
            return (matches[0] && matches[1]) || null;
        }
        return null;
    }

}

module.exports = LanguageParser;