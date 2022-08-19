"use strict";

const CompletionProvider = require("completionProvider.js");
const CommentExtender = require("commentExtender.js");
const CommandHandler = require("commandHandler.js");

const config = {
    enableJS  : true,
    enableTS  : false,
    enablePHP : true,
    enableCPP : true,
    addEmptyLineJS  : 0,
    addEmptyLineTS  : 0,
    addEmptyLinePHP : 2,
    addEmptyLineCPP : 1,
    alignTags : 0,
    extendComments : false,
    ESLintComments : false
};

exports.activate = function() {

    Object.keys(config).forEach(key => {
        /**
         * Get workspace config - if none is set, get current from global
         */
        config[key] = nova.workspace.config.get("maxgrafik.DocBlockr.workspace."+key);
        if (config[key] === null) {
            config[key] = nova.config.get("maxgrafik.DocBlockr.config."+key);
        }

        /**
         * Register listeners for config changes
         */
        nova.workspace.config.onDidChange("maxgrafik.DocBlockr.workspace."+key, updateConfigFromWorkspace, key);
        nova.config.onDidChange("maxgrafik.DocBlockr.config."+key, updateConfigFromGlobal, key);
    });

    /**
     * Get custom header tags
     */
    getCustomTags();

    /**
     * Register listeners for tag changes
     */
    nova.workspace.config.onDidChange("maxgrafik.DocBlockr.workspace.useWorkspaceTags", getCustomTags);
    nova.workspace.config.onDidChange("maxgrafik.DocBlockr.workspace.customTags", getCustomTags);
    nova.config.onDidChange("maxgrafik.DocBlockr.config.customTags", getCustomTags);


    /**
     * Register Completion Assistant
     */
    nova.assistants.registerCompletionAssistant(
        ["javascript", "typescript", "php", "jsx", "tsx", "cpp", "c", "lsl"],
        new CompletionProvider(config),
        {
            triggerChars: new Charset("*@")
        }
    );

    /**
     * Register Command Handlers
     */
    nova.commands.register("maxgrafik.DocBlockr.cmd.insertDocBlock", editor => {
        const commandHandler = new CommandHandler(config);
        commandHandler.insertDocBlock(editor);
    });
    nova.commands.register("maxgrafik.DocBlockr.cmd.formatDocBlock", editor => {
        const commandHandler = new CommandHandler(config);
        commandHandler.formatDocBlock(editor);
    });

    /**
     * Register Comment Extender
     */
    if (config.extendComments) {
        registerCommentExtender();
    }
};

exports.deactivate = function() {
    unregisterCommentExtender();
};


/**
 * Helper functions
 */

const events = new CompositeDisposable();
const extenders = new Map();

function registerCommentExtender() {

    events.add(
        nova.commands.register("maxgrafik.DocBlockr.cmd.insertLinebreak", editor => {
            const commentExtender = extenders.get(editor.document.uri);
            if (commentExtender) {
                commentExtender.handleKeydown(editor, "return");
            }
        })
    );

    events.add(
        nova.commands.register("maxgrafik.DocBlockr.cmd.insertTab", editor => {
            const commentExtender = extenders.get(editor.document.uri);
            if (commentExtender) {
                commentExtender.handleKeydown(editor, "tab");
            }
        })
    );

    events.add(
        nova.workspace.onDidAddTextEditor(editor => {

            const syntax = editor.document.syntax;

            // skip if not enabled for language
            if (!["javascript", "typescript", "php", "jsx", "tsx", "cpp", "c", "lsl"].includes(syntax)) {
                return;
            }
            if ((syntax === "javascript" || syntax === "jsx") && !config.enableJS) {
                return;
            }
            if ((syntax === "typescript" || syntax === "tsx") && !config.enableTS) {
                return;
            }
            if (syntax === "php" && !config.enablePHP) {
                return;
            }
            if (["cpp", "c", "lsl"].includes(syntax) && !config.enableCPP) {
                return;
            }

            const commentExtender = new CommentExtender(editor);
            extenders.set(editor.document.uri, commentExtender);

            events.add(
                editor.onDidDestroy(() => {
                    const extender = extenders.get(editor.document.uri);
                    if (extender) {
                        extender.dispose();
                        extenders.delete(editor.document.uri);
                    }
                })
            );
        })
    );
}

function unregisterCommentExtender() {
    // dispose registered comment extenders
    extenders.forEach(extender => {
        extender.dispose();
    });
    extenders.clear();

    // dispose event listeners
    events.dispose();
}

function updateConfigFromWorkspace(newVal) {
    const key = this;
    if (newVal === null) {
        config[key] = nova.config.get("maxgrafik.DocBlockr.config."+key);
    } else {
        config[key] = newVal;
    }
}

function updateConfigFromGlobal(newVal) {
    const key = this;
    const workspaceConfig = nova.workspace.config.get("maxgrafik.DocBlockr.workspace."+key);
    if (workspaceConfig === null) {
        config[key] = newVal;
    }

    if (key === "extendComments") {
        if (newVal) {
            registerCommentExtender();
        } else {
            unregisterCommentExtender();
        }
    }
}

function getCustomTags() {
    const useWorkspaceTags = nova.workspace.config.get("maxgrafik.DocBlockr.workspace.useWorkspaceTags");
    if (useWorkspaceTags === null) {
        config.customTags = nova.config.get("maxgrafik.DocBlockr.config.customTags");
    } else {
        config.customTags = nova.workspace.config.get("maxgrafik.DocBlockr.workspace.customTags");
    }
}
