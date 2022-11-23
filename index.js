import BootMain from './boot/index.js';

import BuildPlugin from './boot/plugins/build.js';

(async () => {
	const response = await (new BootMain()).start(BuildPlugin);
	if (response.success)
		return response;

	process.exit(1);
})();
