import BootMain from './boot';

import BuildPlugin from './boot/plugins/build';

(async () => {
	const response = await (new BootMain()).start(BuildPlugin);
	if (response.success)
		return response;

	process.exit(1);
})();
