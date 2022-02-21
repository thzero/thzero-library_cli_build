module.exports = function(RED) {
    function EventBuildComplete(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.on('input', function(msg, send, done) {
            try {
                node.status({fill: 'green', shape: 'dot', text: 'running' });
                RED.events.emit('build:complete', { payload: msg.payload });
                if (done)
                    done();
                node.status({});
            }
            catch (err) {
                node.status({});
                this.status({fill: 'red', shape: 'ring', text: 'error'});
                if (done)
                    done(err);
            }
        });
    }
    RED.nodes.registerType('build-event-complete', EventBuildComplete);
}