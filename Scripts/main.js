const CompletionProvider = require("completionProvider.js");

let config = {
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
         * Get workspace config - if none is set, get current from global and update
         * BUG: Does not work as expected :P
         */
        config[key] = nova.workspace.config.get("maxgrafik.DocBlockr.workspace."+key);
        if (config[key] === null) {
            config[key] = nova.config.get("maxgrafik.DocBlockr.config."+key);
            nova.workspace.config.set("maxgrafik.DocBlockr.workspace."+key, config[key]);
        }

        /**
         * Register listeners for config changes
         */
        nova.workspace.config.onDidChange("maxgrafik.DocBlockr.workspace."+key, setConfig, key);
    });

}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
}

nova.assistants.registerCompletionAssistant(["javascript", "typescript", "php"], new CompletionProvider(config), {
    triggerChars: new Charset("*")
});

function setConfig(newVal) {
    let key = this;
    config[key] = newVal;
}
