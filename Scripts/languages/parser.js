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

    parseDefinition(definition) {
        let result;

        result = this.parseClass(definition);  // (name, extends)
        if (result) {
            return this.formatClass(...result);
        }

        result = this.parseFunction(definition);  // (name, type, args, returnType)
        if (result) {
            return this.formatFunction(...result);
        }

        result = this.parseVar(definition);  // (name, type, value)
        if (result) {
            return this.formatVar(...result);
        }

        return null;
    }

    parseDocBlock(docBlock) {
        let out = [];
        let keywords = ["@param", "@property", "@return", "@returns", "@throws", "@yields"];
    
        // de-indent and strip all comment markers
        docBlock = docBlock
            .replace(/^[\t ]*\/\*\*[\t ]*$/m, "")
            .replace(/^[\t ]*\*\/[\t ]*/m, "")
            .replace(/^[\t ]*\*[\t ]*/gm, "")
            .trim();

        if (docBlock === "") {
            return null;
        }

        let regex = new RegExp(
            // find either a text line, a tag line or an empty line
            "(?<text>^[^@\\n\\r].+?$)|(?<tag>^@.+?$)|(?<empty>^$)"
        , "gm");

        const matches = docBlock.matchAll(regex);
        if (!matches) {
            return null;
        }

        // add continuations to preceding line
        let lines = [];
        for (const match of matches) {
            let text = match.groups.text || false;
            let tag  = match.groups.tag  || false;

            let lastIdx = lines.length-1;
            if (lastIdx < 0 || lines[lastIdx] === "") {
                lines.push(text || tag || "");
            } else if (lastIdx === 0 && lines[lastIdx].endsWith(".")) {
                lines.push(text || tag || ""); // period ends summary (see specs)
            } else if (!tag && !text) {
                lines.push(""); // keep empty lines
            } else if (tag) {
                lines.push(tag);
            } else if (text) {
                lines[lastIdx] = lines[lastIdx] + " " + text;
            }
        }

        regex = new RegExp(
            "^(?<tag>@[^\\s]+)?" +
            "(?:\\s*(?<remainder>.+))?$"
        );
    
        lines.forEach(line => {
            let matches = regex.exec(line);
            if (line && matches) {
                let tag = matches.groups.tag;
                let remainder = (matches.groups.remainder || "")
                    .replace(/\t/g, " ")
                    .replace(/\s{2,}/g, " ");

                if (!tag) {
                    out.push([remainder]);

                } else if (keywords.indexOf(tag) < 0) {
                    out.push([tag, remainder]);

                } else if (keywords.indexOf(tag) > -1) {
                    let splits = remainder.split(" ");
                    let type = splits[0];
                    let arg = splits[1];
                    let desc = splits.slice(2).join(" ");
                    if (arg === "-") {
                        arg = "";
                    }
                    if (desc.charAt(0) === "-") {
                        desc = desc.slice(2);
                    }
                    out.push([
                        tag,
                        type || "",
                        arg  || "",
                        desc || ""
                    ]);
                }
            }
        });

        return out;
    }

    formatDocBlock(docBlock, config) {
        let out = [];
        let alignTags = config.alignTags;
        let maxLength = [0, 0, 0, 0];

        /**
         * Calculate max width of each column
         * Strip Nova placeholders and leading backslash escapes
         */
        if (alignTags > 0) {
            docBlock.forEach(entry => {
                entry.forEach((e, idx) => {
                    if (entry.length > 2 || (entry.length === 2 && idx === 0)) {
                        e = e.replace(/^(\{?)(?:\$\{\d+:)?([^}]+)(?:\})?(\}?)$/, "$1"+"$2"+"$3").replace(/^[\\]/, "");
                        maxLength[idx] = Math.max(maxLength[idx], e.length);
                    }
                });
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

        out.push("/**");
        docBlock.forEach((entry, index) => {

            let line = " *";
            entry.forEach((e, idx) => {
                line += (idx === 3 ? descSep : " ") + e;
                if (alignTags > idx) {
                    let text = e.replace(/^(\{?)(?:\$\{\d+:)?([^}]+)(?:\})?(\}?)$/, "$1"+"$2"+"$3").replace(/^[\\]/, "");
                    let padding = maxLength[idx] - text.length;
                    line += "".padEnd(padding);
                }
            });
            out.push(line.replace(/\s+$/, ""));

            if (addEmptyLine > 0 && index === 0 && docBlock.length > 1) {
                out.push(" *");

            } else if (addEmptyLine === 2 && index < docBlock.length-1) {
                let nextTag = docBlock[index+1][0];
                if (nextTag !== entry[0]) {
                    out.push(" *");
                }
            }

        });
        out.push(" */");

        return out;
    }

    wrapLines(lines, wrapWidth) {
        let out = [];

        for (const line of lines) {
            
            if (line === "/**" || line === " */") {
                out.push(line);
                continue;
            }

            let tagPart;
            let txtPart;

            let match = line.match(/^(\s\*\s+@(?:[^ ]+\s+){3}(?:-\s)?)(.+)$/);
            if (match) {
                tagPart = match[1];
                txtPart = match[2];
            } else {
                tagPart = " * ";
                txtPart = line.slice(3);
            }

            let tmp = tagPart;
            let words = txtPart.split(" ");
            words.forEach(word => {
                if (tmp.length + word.length <= wrapWidth) {
                    tmp += word + " ";
                } else {
                    out.push(tmp.replace(/\s+$/, ""));
                    tmp = " * ".padEnd(tagPart.length) + word + " ";
                }
            });
            out.push(tmp.replace(/\s+$/, ""));
        }
        return out;
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

        if (this.isStatement(name)) {
            return null;
        }

        out.push(["${0:summary}"]);

        // if there are arguments, add a @param for each
        if (args) {

            // remove comments inside the argument list.
            args = args.replace(/\/\*.*?\*\//, "");

            let parsedArgs = this.parseArgs(args);

            parsedArgs.forEach(arg => {
                let name = (arg[0].charAt(0) === "$" ? "\\" : "") + arg[0];
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

        if (this.isStatement(name)) {
            return null;
        }

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

    /**
     * false positives
     * statements which look like functions to docblockr
     */
    isStatement(name) {
        const statements = [
            "for",
            "foreach",
            "if",
            "switch",
            "while"
        ];
        return statements.includes(name);
    }
}

module.exports = LanguageParser;
