const LanguageParser = require("parser.js");

/**
 * Ruby Parser
 * @extends LanguageParser
 */

class RubyParser extends LanguageParser {

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
        const settings = {
            language: "ruby",
            varIdentifier: "[a-z_][A-Za-z0-9_]*",
            fnIdentifier: "[a-z_][A-Za-z0-9_]*[!?=]?",
            clsIdentifier: "[A-Z_][A-Za-z0-9_]*",
            typeInfo: "[%s]",
            tags: {
                keySummary: "description",
                keyVar: null,
                keyRet: "@return"
            },
            commentStyle: "##"
        };
        super(settings);
    }

    parseClass(line) {
        const regex = new RegExp(
            "\\s*(class)\\s+(?<name>" + this.settings.clsIdentifier + ")"
        );

        const match = regex.exec(line);
        if (!match) {
            return null;
        }

        return [match.groups.name, ""];
    }

    parseFunction(line) {
        const regex = new RegExp(
            "\\s*def\\s+(?<name>" + this.settings.fnIdentifier + ")" +
            "\\s*\\(\\s*(?<args>.*?)\\)" // List of parameters
        );

        const matches = regex.exec(line);
        if(!matches || !matches.groups.name) {
            return null;
        }

        return [
            matches.groups.name,
            null,
            (matches.groups.args ? matches.groups.args.trim() : null),
            (matches.groups.name.endsWith("?") ? "boolean" : null)
        ];
    }

    parseVar(line) {
        return null;
    }

    parseArg(line) {
        const args = line.trim().split(/\s*[:=]\s*/);
        const name = args.shift().split(/\s+/).pop();
        const value = args.length ? args.pop().split(/\s+/).pop() : null;

        const isArray = name.startsWith("*");
        const isBlock = name.startsWith("&");

        return [
            name.replace(/^[*&]/, ""),
            (isArray ? "Array" : (isBlock ? "Block" : null)),
            value
        ];
    }


    // Alternative to LanguageParser's formatDocBlock()
    // because RDoc is (kind of) Markdown
    // http://blog.firsthand.ca/2010/09/ruby-rdoc-example.html

    formatRDocBlock(docBlock) {
        const out = [];

        let tabStop = 0;

        out.push("##");
        out.push("# " + this.formatPlaceholder(this.settings.tags.keySummary, tabStop));

        const paramList = docBlock.filter(entry => {
            return entry[0] === "@param";
        });

        const returnList = docBlock.filter(entry => {
            return entry[0] === "@returns";
        });

        if (paramList.length) {
            out.push("#");
            out.push("# == Parameters:");
            out.push("#");
            paramList.forEach(entry => {
                tabStop++;
                out.push(
                    "# +" + entry[2] + "+:: " + this.formatPlaceholder("description", tabStop)
                );
            });
        }

        if (returnList.length) {
            tabStop++;
            out.push("#");
            out.push("# == Returns:");
            out.push("# " + this.formatPlaceholder("description", tabStop));
        }

        return out;
    }

    formatHeaderBlock(docBlock) {
        const out = [];

        docBlock.forEach(entry => {
            if (entry[0].charAt(0) === "@") {
                entry[0] = entry[0]
                    .toLowerCase()
                    .replace(/\b\w/g, s => s.toUpperCase())
                    .replace(/^@(.+)/, "$1::");
            }

            out.push("# " + entry.join(" "));
        });

        return out;
    }

    // @see https://rubydoc.info/gems/yard/file/docs/Tags.md#taglist

    getDocTags(line) {
        const tags = [
            ["abstract", "${0:description}"],
            ["api", "${0:description}"],
            ["author", "${0:description}"],
            ["deprecated", "${0:description}"],
            ["example", ""],
            ["note", "${0:description}"],
            ["option", "[${0:type}] ${1:name} ${2:description}"],
            ["overload", "${0:description}"],
            ["param", "[${0:type}] ${1:name} ${2:description}"],
            ["private", ""],
            ["raise", "[${0:type}] ${1:description}"],
            ["return", "[${0:type}] ${1:description}"],
            ["see", "${0:name} ${1:description}"],
            ["since", "${0:description}"],
            ["todo", "${0:description}"],
            ["version", "${0:description}"],
            ["yield", "[${0:parameters}] ${1:description}"],
            ["yieldparam", "[${0:type}] ${1:name} ${2:description}"],
            ["yieldreturn", "[${0:type}] ${1:description}"]
        ];

        const regex = new RegExp(
            /^#\s+@(?<tag>.*)/
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

module.exports = RubyParser;
