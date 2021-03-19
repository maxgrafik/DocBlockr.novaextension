const CompletionProvider = require("completionProvider.js");
const CommandHandler = require("commandHandler.js");

const config = {
    enableJS  : true,
    enableTS  : false,
    enablePHP : true,
    addEmptyLineJS  : 0,
    addEmptyLineTS  : 0,
    addEmptyLinePHP : 2,
    alignTags : 0
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

    updateCustomTags();

    nova.workspace.config.onDidChange("maxgrafik.DocBlockr.workspace.useWorkspaceTags", updateCustomTags);
    nova.workspace.config.onDidChange("maxgrafik.DocBlockr.workspace.customTags", updateCustomTags);
    nova.config.onDidChange("maxgrafik.DocBlockr.config.customTags", updateCustomTags);
}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
}

/**
 * Register Completion Assistant
 */

nova.assistants.registerCompletionAssistant(["javascript", "typescript", "php"], new CompletionProvider(config), {
    triggerChars: new Charset("*@")
});


/**
 * Register Command Handlers
 */

nova.commands.register("insertDocBlock", editor => {
    const handler = new CommandHandler(config);
    handler.insertDocBlock(editor);
});

nova.commands.register("formatDocBlock", editor => {
    const handler = new CommandHandler(config);
    handler.formatDocBlock(editor);
});


/**
 * Helper functions
 */

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
}

function updateCustomTags() {
    const useWorkspaceTags = nova.workspace.config.get("maxgrafik.DocBlockr.workspace.useWorkspaceTags");
    if (useWorkspaceTags === null) {
        config.customTags = nova.config.get("maxgrafik.DocBlockr.config.customTags");
    } else {
        config.customTags = nova.workspace.config.get("maxgrafik.DocBlockr.workspace.customTags");
    }
}