module.exports = function(RED) {
    function EventBuildStartTest(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', function(msg, send, done) {
            try {
                RED.events.emit('build:start', { payload: msg.payload });
                if (done)
                    done();
            }
            catch (err) {
                if (done)
                    done(err);
            }
        });
    }
    RED.nodes.registerType('build-event-start-test', EventBuildStartTest);
}