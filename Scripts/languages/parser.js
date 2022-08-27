/**
 * LanguageParser
 *
 * Base class for all language parsers
 * Handles formatting of DocBlocks
 */

class LanguageParser {

    constructor(settings) {
        this.settings = settings;
    }

    /**
     * Try to get as much text as suitable to parse a class/function/var
     *
     * @param {Array} lines - The text from editor as array of lines
     */

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
                definition += line.trim() + " ";
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

    /**
     * Parse the definition from above and see what matches
     *
     * @param {string} definition
     */

    parseDefinition(definition) {
        let result;

        result = this.parseClass(definition);  // (className, superClass)
        if (result) {
            return this.createClassBlock(...result);
        }

        result = this.parseFunction(definition);  // (fnName, fnType, fnArgs, retType [, throwArgs])
        if (result) {
            return this.createFunctionBlock(...result);
        }

        result = this.parseVar(definition);  // (varName, varType, varValue)
        if (result) {
            return this.createVarBlock(...result);
        }

        return null;
    }

    /**
     * Re-parse a DocBlock and try to guess the fields
     * @see commandHandler.js
     *
     * @param {string} docBlock
     */

    parseDocBlock(docBlock) {
        const out = [];

        // de-indent and strip all comment markers
        docBlock = docBlock
            .replace(/^[\t ]*\/\*[*!][\t ]*$/m, "")
            .replace(/^[\t ]*\*\/[\t ]*/m, "")
            .replace(/^[\t ]*\*[\t ]*/gm, "")
            .trim();

        if (docBlock === "") {
            return null;
        }

        // find either a text line, a tag line or an empty line
        let regex = new RegExp(
            /(?<text>^[^@\\\n\r].+?$)|(?<tag>^[@\\].+?$)|(?<empty>^$)/,
            "gm"
        );

        const matches = docBlock.matchAll(regex);
        if (!matches) {
            return null;
        }

        // un-wrap lines
        const lines = [];
        for (const match of matches) {
            const text = match.groups.text || false;
            const tag  = match.groups.tag  || false;

            const lastIdx = lines.length-1;
            if (lastIdx < 0 || lines[lastIdx] === "") {
                lines.push(text || tag || "");
            } else if (lastIdx === 0 && lines[lastIdx].endsWith(".")) {  // period ends summary (see specs)
                lines.push(text || tag || "");
            } else if (!tag && !text) {  // keep empty lines
                lines.push("");
            } else if (tag) {
                lines.push(tag);
            } else if (text) {
                lines[lastIdx] = lines[lastIdx] + " " + text;
            }
        }

        // The tags which we format/align
        const keywords = /^[@\\](param|property|returns?|retval|result|yields?|throws?|exception)$/;

        // The tags which have no arg column
        let skipArgs = /^[@\\](returns?|retval|result|yields?|throws?|exception)$/;

        // Except for Java which has a throws arg
        if (this.settings.language === "java") {
            skipArgs = /^[@\\](returns?)$/;
        }

        // split into @tag and remainder
        regex = new RegExp(
            /^(?<tag>[@\\][^\s]+)?(?:\s*(?<remainder>.+))?$/
        );

        lines.forEach(line => {
            const matches = regex.exec(line);
            if (line && matches) {
                const tag = matches.groups.tag;
                const remainder = (matches.groups.remainder || "")
                    .replace(/\t/g, " ")
                    .replace(/\s{2,}/g, " ");

                if (!tag) {
                    out.push([remainder]); // just a text/empty line

                } else if (!keywords.test(tag)) { // a tag we don't align
                    out.push([tag, remainder]);

                } else {
                    const splits = remainder.split(" ");
                    const skipArg = skipArgs.test(tag);

                    let type, arg , desc;

                    if (this.settings.typeInfo === null) { // skip type column
                        type = null;
                        arg = skipArg ? "" : splits[0];
                        desc = splits.slice(skipArg ? 0 : 1).join(" ");
                    } else {
                        type = splits[0];
                        arg = skipArg ? "" : splits[1];
                        desc = splits.slice(skipArg ? 1 : 2).join(" ");
                    }

                    if (arg === "-") {
                        arg = "";
                    }
                    if (desc.charAt(0) === "-") {
                        desc = desc.slice(2);
                    }

                    out.push([
                        tag,
                        type || "",
                        arg || "",
                        desc || ""
                    ]);
                }
            }
        });

        return out;
    }

    /**
     * Format DocBlock
     * @param {Array}   docBlock         - An array of docblock lines with an arry of fields each
     * @param {Object}  config           - The extension configuration
     * @param {boolean} withPlaceholders - Whether to create placeholders
     * @param {integer} wrapWidth        - Wrap width
     */

    formatDocBlock(docBlock, config, withPlaceholders, wrapWidth) {
        const out = [];
        const alignTags = config.alignTags;
        const maxLength = [];

        const keywords = /^[@\\](param|property|returns?|retval|result|yields?|throws?|exception|var|type)$/;

        /**
         * Calculate max width of each column
         * - col 1: only entries with more than 1 field => [@tag, text, ...]
         * - col 2+: only for tags we align (see keywords)
         */

        if (alignTags > 0) {
            docBlock.forEach(entry => {
                // only entries with more than 1 field
                (entry.length > 1) && entry.forEach((e, idx) => {
                    if (
                        e !== null &&             // field is not null AND
                        (idx === 0 ||             // it's either the first column OR
                        keywords.test(entry[0]) ) // first column is in keywords
                    ) {
                        if (idx > maxLength.length-1) { // expand array as needed
                            maxLength.push(0);
                        }
                        maxLength[idx] = Math.max(maxLength[idx], e.length);
                    }
                });
            });
        }

        let addEmptyLine = 0;
        let descSep = " ";

        switch(this.settings.language) {
        case "cpp": // This is the language specified by the parser, not the editor’s syntax!
            addEmptyLine = config.addEmptyLineCPP;
            break;
        case "java":
            addEmptyLine = config.addEmptyLineJava;
            break;
        case "javascript":
        case "jsx":
            addEmptyLine = config.addEmptyLineJS;
            descSep = " - ";
            break;
        case "objc":
            addEmptyLine = config.addEmptyLineObjC;
            break;
        case "php":
            addEmptyLine = config.addEmptyLinePHP;
            break;
        case "rust":
            // RustParser overrides formatDocBlock!!!
            break;
        case "typescript":
        case "tsx":
            addEmptyLine = config.addEmptyLineTS;
            descSep = " - ";
            break;
        }

        let tabStop = 0;

        out.push(this.settings.commentStyle);

        docBlock.forEach((entry, index) => {

            let line = " *";
            let wrapStart = 0;

            entry.forEach((e, idx) => {

                // whether to skip the 'type' column
                const skipCol = keywords.test(entry[0])
                    && (this.settings.typeInfo === null)
                    && (idx === 1);

                if (e !== null && !skipCol) {

                    let padding = 0;

                    if (alignTags > idx) {
                        padding = maxLength[idx] - e.length;
                    }

                    line += (idx === 3) ? descSep : " ";

                    // leading dollar signs need to be escaped e.g. PHP vars
                    // if it's not a placeholder
                    if (/^\$[^{]/.test(e) && !this.isNovaPlaceholder(e)) {
                        e = "\\" + e;
                    }

                    if (withPlaceholders) {
                        switch(e) {
                        case this.settings.tags.keySummary:
                            e = this.formatPlaceholder(e, tabStop);
                            tabStop++;
                            break;
                        case "description":
                            e = this.formatPlaceholder(e, tabStop);
                            tabStop++;
                            break;
                        case this.formatType("type"):
                            e = this.formatPlaceholder("type", tabStop);
                            e = this.formatType(e);
                            tabStop++;
                            break;
                        }
                    }

                    // the last column is most likely the description
                    // store the starting point for wrapping lines
                    if (idx > 0 && idx === entry.length-1) {
                        wrapStart = line.length;
                    }

                    /**
                     * For C languages replace @-sign with backslash \
                     * if comments are configured to be Qt style
                     */
                    if (
                        e.charAt(0) === "@" &&
                        (this.settings.language === "cpp" ||
                        this.settings.language === "objc") &&
                        this.settings.commentStyle === "/*!"
                    ) {
                        e = e.replace(/^@/, "\\");
                    }


                    line += e + "".padEnd(padding);
                }
            });

            line = line.replace(/\s+$/, "");

            // wrap lines
            if (wrapWidth && wrapWidth > 0) {
                let tmp = "";
                const words = line.split(" ");
                words.forEach(word => {
                    if (tmp.length + word.length <= wrapWidth) {
                        tmp += word + " ";
                    } else {
                        out.push(tmp.replace(/\s+$/, ""));
                        tmp = " * ".padEnd(wrapStart) + word + " ";
                    }
                });
                out.push(tmp.replace(/\s+$/, ""));
            } else {
                out.push(line);
            }

            // add empty lines as configured
            if (addEmptyLine > 0 && index === 0 && docBlock.length > 1) {
                out.push(" *");

            } else if (addEmptyLine === 2 && index < docBlock.length-1) {
                const nextTag = docBlock[index+1][0];
                if (nextTag !== entry[0]) {
                    out.push(" *");
                }
            }

        });

        out.push(" */");

        return out;
    }

    /**
     * Creates a class block
     */

    createClassBlock(className, superClass) {
        const out = [];
        out.push([this.settings.tags.keySummary]);

        if (superClass) {
            if (typeof superClass === "string") {
                out.push(["@extends", superClass]);
            } else if (Array.isArray(superClass)) {
                superClass.forEach(cls => {
                    out.push(["@extends", cls]);
                });
            }
        }
        return out;
    }

    /**
     * Creates a function block
     */

    createFunctionBlock(fnName, fnType, fnArgs, retType, throwArgs) {

        if (this.isStatement(fnName)) {
            return null;
        }

        const out = [];
        out.push([this.settings.tags.keySummary]);

        // if there are arguments, add a @param for each
        if (fnArgs) {

            // remove comments inside the argument list.
            let args = fnArgs.replace(/\/\*.*?\*\//, "");

            args = this.parseArgs(args);

            args.forEach(arg => {

                const name = arg[0];
                const type = arg[1] ||
                    this.guessTypeFromValue(arg[2]) ||
                    this.guessTypeFromName(arg[0]) ||
                    "type";

                out.push([
                    "@param",
                    this.formatType(type),
                    name,
                    "description"
                ]);
            });
        }

        if (!retType && fnType !== "constructor") {
            retType = this.guessTypeFromName(fnName);
        }

        if (fnType === "getter") {
            out.push([
                this.settings.tags.keyVar,
                this.formatType("type"),
                "",
                "description"
            ]);
        } else if (fnType === "generator") {
            out.push([
                "@yields",
                this.formatType("type"),
                "",
                "description"
            ]);
        } else if (retType) {
            if (this.settings.typeInfo === null && retType === "void") {
                // skip void return for languages without type info
            } else {
                out.push([
                    this.settings.tags.keyRet,
                    this.formatType(retType),
                    "",
                    "description"
                ]);
            }
        }

        if (throwArgs) {
            throwArgs.forEach(arg => {
                out.push([
                    "@throws",
                    this.formatType("type"),
                    arg,
                    "description"
                ]);
            });
        }

        return out;
    }

    /**
     * Creates a var block
     */

    createVarBlock(varName, varType, varValue) {

        if (this.isStatement(varName)) {
            return null;
        }

        const out = [];

        out.push([this.settings.tags.keySummary]);

        varType = varType ||
            this.guessTypeFromValue(varValue) ||
            this.guessTypeFromName(varName) ||
            "type";

        out.push([
            this.settings.tags.keyVar,
            this.formatType(varType),
            null //varName
        ]);

        return out;
    }

    /**
     * Format 'type' field according to parser settings
     */

    formatType(type) {
        if (this.settings.typeInfo === null) {
            return type;
        }
        return this.settings.typeInfo.replace("%s", type);
    }

    /**
     * Format text as Nova placeholder
     */

    formatPlaceholder(text, tabStop) {
        return "${" + tabStop + ":" + text + "}";
    }

    /**
     * Parse argument string and return array of args
     */

    parseArgs(raw) {
        const out = [];
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
                if (char === matchingQuote) {
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

    /**
     * Guess argument/function return type from name
     */

    guessTypeFromName(name) {
        if (!name) {
            return null;
        }
        if (name.search("[$_]?(?:is|has)[A-Z_]") > -1) {
            return "boolean";
        }
        if (name.search("^[$_]?(?:cb|callback|done|next|fn)$") > -1) {
            return "function";
        }
        return null;
    }

    /**
     * Guess argument type from its value
     */

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
        /* eslint-disable-next-line eqeqeq */
        if (value.slice(0, 5) == "array" || value[0] === "[") {
            return "Array";
        }
        if (value[0] === "{") {
            return "Object";
        }
        if ((value.toLowerCase() === "true") || (value.toLowerCase() === "false")) {
            return "boolean";
        }
        let regex = new RegExp(/^RegExp|^\/.*\/([a-z]*)?$/);
        if (regex.test(value)) {
            return "RegExp";
        }
        if (value.slice(0, 4) === "new ") {
            regex = new RegExp("new (" + this.settings.fnIdentifier + ")");
            const matches = regex.exec(value);
            return (matches[0] && matches[1]) || null;
        }
        return null;
    }

    /**
     * False Positives
     * statements which look like functions to DocBlockr
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

    isNovaPlaceholder(text) {
        return [
            "$SELECTED_TEXT",
            "$DATE",
            "$FILENAME",
            "$FILE_PATH",
            "$PARENT_FOLDER",
            "$WORKSPACE_NAME",
            "$AUTHOR_NAME",
            "$SCM_REVISION",
            "$PREVIOUS_TEXT",
            "$PASTEBOARD_TEXT"
        ].includes(text);
    }
}

module.exports = LanguageParser;
