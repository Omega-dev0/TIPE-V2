const stations = require("./stations.js");
const { execSync } = require('child_process');
const fs = require('fs');
i = 0;
const argv = require('minimist')(process.argv.slice(2));

let stationsList = Object.values(stations)

let start = argv.start || 1;
let end = argv.end || stations.length;

stationsList = stationsList.slice(start, end);

for (let station of stationsList) {
    i++;
    if(fs.existsSync(`./dataPoints/dataPoints-${station.codeStation}.json`)){
        console.log(`[${i}/${Object.keys(stations).length}] Skipping station ${station.codeStation} - ${station.libelleStation}`);
        continue;
    }
    console.log(`[${i}/${Object.keys(stations).length}] Processing station ${station.codeStation} - ${station.libelleStation}                                                                               `);
    execSync(`bun run dataGatherer.js --station "${station.codeStation}" -f`, { stdio: 'inherit' });
}