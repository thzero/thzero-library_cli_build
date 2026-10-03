import { styleText } from 'node:util';

// Reproduces colorizeDiff and stripRange from npm-check-updates'
// src/lib/version-util.ts (23.1.0). ncu bundles both without exporting them, so
// the accumulated dependency output has to carry its own copy to match what the
// ncu cli prints: the upgrade is plain up to the first part that changed and
// colored from there on, red for a major (or any change to a 0.x version), cyan
// for a minor, green for a patch.
const sections = /^[~^<>=]+/;

const stripRange = (version) => String(version).replace(sections, '');

// styleText resolves the color support of process.stdout itself, so this is
// plain text when the output is redirected or NO_COLOR is set.
function colorizeDiff(from, to) {
	to = String(to);
	from = String(from === null || from === undefined ? '' : from);

	// a leading ^ or ~ is re-attached uncolored in front of the result
	let leadingWildcard = '';
	if (/^[~^]/.test(to)) {
		leadingWildcard = to[0];
		to = to.slice(1);
	}

	const partsToColor = to.split('.');

	// the diff position comes from range-stripped copies of both versions, so an
	// upgrade that replaces the range operator outright, '<1.2.3' -> '^1.2.9',
	// does not leave the operator glued to the first numeric part
	const partsFromCompare = stripRange(from).split('.');
	const partsToCompare = stripRange(to).split('.');

	let index = partsToCompare.findIndex((part, i) => part !== partsFromCompare[i]);
	index = index >= 0 ? index : partsToCompare.length;

	const color = index === 0 || partsToCompare[0] === '0' ? 'red' : index === 1 ? 'cyan' : 'green';

	// a dot goes back in the middle when only part of the version is colored
	const middot = index > 0 && index < partsToColor.length ? '.' : '';

	const colored = partsToColor.slice(index).join('.');
	return leadingWildcard + partsToColor.slice(0, index).join('.') + middot + (colored.length > 0 ? styleText(color, colored) : '');
}

// ncu's group order and headings, from getDependencyGroups in the same file.
// Note that ncu groups a 0.x change as majorVersionZero but still colors it red
// inline, so the heading color and the version color can differ for those.
const GROUP_ORDER = [ 'patch', 'minor', 'major', 'majorVersionZero' ];

const GROUP_HEADINGS = {
	patch: { label: 'Patch', description: 'Backwards-compatible bug fixes', color: 'green' },
	minor: { label: 'Minor', description: 'Backwards-compatible features', color: 'cyan' },
	major: { label: 'Major', description: 'Potentially breaking API changes', color: 'red' },
	majorVersionZero: { label: 'Major version zero', description: 'Anything may change', color: 'magenta' }
};

// Which part of the version moved, mirroring partChanged from ncu's
// version-util.ts; the result is one of GROUP_ORDER, or 'none' when nothing
// changed.
function partChanged(from, to) {
	from = String(from === null || from === undefined ? '' : from);
	to = String(to);

	if (from === to)
		return 'none';

	const partsTo = stripRange(to).split('.');
	const partsFrom = stripRange(from).split('.');

	let index = partsTo.findIndex((part, i) => part !== partsFrom[i]);
	index = index >= 0 ? index : partsTo.length;

	return partsTo[0] === '0' ? 'majorVersionZero' : index === 0 ? 'major' : index === 1 ? 'minor' : 'patch';
}

// The heading ncu prints above each group; colored with a bold label unless
// plain is set, in which case it is the same text with no escapes.
function groupHeading(group, plain) {
	const heading = GROUP_HEADINGS[group];
	if (!heading)
		return group;

	if (plain)
		return `${heading.label}   ${heading.description}`;

	return styleText(heading.color, `${styleText('bold', heading.label)}   ${heading.description}`);
}

// Splits an upgrade map, { name: { current, upgrade } }, into ncu's groups in
// ncu's order, keeping the order the packages arrived in within each group.
// Anything that did not actually change is left out.
function dependencyGroups(upgrades) {
	const grouped = {};
	for (const property in upgrades) {
		const group = partChanged(upgrades[property].current, upgrades[property].upgrade);
		if (group === 'none')
			continue;

		if (!grouped[group])
			grouped[group] = [];
		grouped[group].push(property);
	}

	const order = Array.from(new Set(GROUP_ORDER.concat(Object.keys(grouped).sort())));
	return order.filter((group) => grouped[group]).map((group) => ({ group: group, packages: grouped[group] }));
}

export { colorizeDiff, dependencyGroups, groupHeading, partChanged, stripRange };
