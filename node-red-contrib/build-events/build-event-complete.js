module.exports = function(RED) {
    function EventBuildComplete(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', function(msg, send, done) {
            try {
                RED.events.emit('build:complete', { payload: msg.payload });
                if (done)
                    done();
            }
            catch (err) {
                if (done)
                    done(err);
            }
        });
    }
    RED.nodes.registerType('build-event-complete', EventBuildComplete);
}