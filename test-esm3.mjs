import electron from 'electron';
console.log('type:', typeof electron);
console.log('value:', typeof electron === 'string' ? electron : 'object with keys: ' + Object.keys(electron).slice(0,10).join(','));
