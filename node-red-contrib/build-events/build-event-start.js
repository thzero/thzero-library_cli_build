module.exports = function(RED) {
    function EventBuildStart(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        RED.events.on('build:start', async function(payload) {
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
    RED.nodes.registerType('build-event-start', EventBuildStart);

    RED.httpAdmin.post('/build/start', RED.auth.needsPermission('inject.write'), function(req, res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                console.log(RED);
                console.log(RED.events);
                console.log(RED.events.emit);
                RED.events.emit('build:start', req.body);
                // if (req.body && req.body.__user_inject_props__) {
                //     node.receive(req.body);
                // } else {
                //     node.receive();
                // }
                res.sendStatus(200);
            } catch(err) {
                res.sendStatus(500);
                node.error(RED._("inject.failed", { error: err.toString() }));
            }
        } else {
            res.sendStatus(404);
        }
    });
}