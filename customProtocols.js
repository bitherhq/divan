const { protocol } = require('electron');


protocol.registerHttpProtocol('divan', (request, callback) => {
    // callback({mimeType: 'text/html', data: new Buffer('<h5>Response</h5>')});

    console.log((request.url.indexOf('divan://interface') !== -1) ? global.interfaceAppUrl + request.url.replace('divan://interface', '') : '');

    const call = {
        url: (request.url.indexOf('divan://interface') !== -1) ? global.interfaceAppUrl + request.url.replace('divan://interface', '') : '', // 'http://localhost:3050/' + request.url.replace('divan://',''),
        method: request.method,
        referrer: request.referrer,
    };

    console.log(call);
    // console.log(call);

    callback(call);
}, (error) => {
    if (error) {
        console.error('Failed to register protocol');
    }
});


// protocol.registerProtocol('eth', function(request) {
//     var url = request.url.substr(7)
//     return new protocol.RequestStringJob({data: 'Hello'});
// });

// protocol.registerProtocol('bzz', function(request) {
//     var url = request.url.substr(7)
//     return new protocol.RequestStringJob({data: 'Hello'});
// });


// protocol.registerStandardSchemes(['divan','eth', 'bzz']); //'eth', 'bzz'
