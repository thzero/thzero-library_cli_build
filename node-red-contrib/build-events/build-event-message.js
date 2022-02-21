module.exports = function(RED) {
    function EventBuildMessage(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const message = config.message;
        const suffix = config.suffix;
        node.on('input', function(msg, send, done) {
            try {
                RED.events.emit('build:message:' + suffix, { payload: message });
                node.send(msg);
                if (done)
                    done();
            }
            catch (err) {
                if (done)
                    done(err);
            }
        });
    }
    RED.nodes.registerType('build-event-message', EventBuildMessage);
}