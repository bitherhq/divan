
module.exports = () => {
    window.prompt = () => {
        console.warn('Divan doesn\'t support window.prompt()');
    };
};
