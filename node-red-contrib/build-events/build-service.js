module.exports = function(RED) {
    function EventBuildService(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const message = config.message;
        const service = config.service;
        node.on('input', function(msg, send, done) {
            try {
                node.status({fill: 'green', shape: 'dot', text: 'running' });
                const test = RED.util.injector.getService(service);
                node.send(msg);
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
    RED.nodes.registerType('build-service', EventBuildService);
}