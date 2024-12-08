const stations = require("./stations.js");
const { execSync } = require('child_process');
const fs = require('fs');
i = 0;
const argv = require('minimist')(process.argv.slice(2));


for(let station of Object.values(stations)){
    i++;
    if(fs.existsSync(`./dataPoints/dataPoints-${station.codeStation}.json`)){
        console.log(`[${i}/${Object.keys(stations).length}] Processing station ${station.codeStation} - ${station.libelleStation}`);
        execSync(`bun run dataAnalyser.js --station="${station.codeStation}" --taxon="7116,14664,7881"`, { stdio: 'inherit' });
    }
}