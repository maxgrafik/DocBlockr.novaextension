const CompletionProvider = require("completionProvider.js");

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

}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
}

nova.assistants.registerCompletionAssistant(["javascript", "typescript", "php"], new CompletionProvider(config), {
    triggerChars: new Charset("*@")
});

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
