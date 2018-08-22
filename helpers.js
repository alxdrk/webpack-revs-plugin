/**
 * @param  {*} data
 * @return {array}
 */
const arrayWrapper = data => (Array.isArray(data) ? data : [data]);

module.exports = {
  arrayWrapper,
};
