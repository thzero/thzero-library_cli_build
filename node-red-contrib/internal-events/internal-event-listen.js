module.exports = function(RED) {
    function InternalEventListen(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const eventAddress = config.eventAddress;
        RED.events.on(eventAddress, async function(payload) {
            try {
                const msg = {
                    payload: payload
                }
                node.send(msg);
            }
            catch (err) {
                if (done)
                    done(err);
            }
        });
    }
    RED.nodes.registerType('internal-event-listen', InternalEventListen);
}