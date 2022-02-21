module.exports = function(RED) {
    function InternalEventPublish(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const eventAddress = config.eventAddress;
        node.on('input', function(msg, send, done) {
            try {
                console.log('event-address: ' + eventAddress);
                RED.events.emit(eventAddress, { payload: msg.payload });
                if (done)
                    done();
            }
            catch (err) {
                if (done)
                    done(err);
            }
        });
    }
    RED.nodes.registerType('internal-event-publish', InternalEventPublish);
}