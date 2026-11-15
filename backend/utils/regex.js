// Escapes user input so it is matched literally inside a MongoDB $regex
// (otherwise e.g. "(" crashes the query and ".*" matches everything).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };
