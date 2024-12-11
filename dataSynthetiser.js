const fs = require('fs');
let chalk = require('chalk');
chalk = chalk.default;
const argv = require('minimist')(process.argv.slice(2), {
    string: ['station'],
    boolean: ['f'],
    alias: {
        f: 'fetch'
    }
});

const stations = require('./stations.js');
const { report } = require('process');


let Parameters = {}
let translationTable = {}
for (let station of Object.values(stations)) {
    if (fs.existsSync(`./reports/report-${station.codeStation}.json`) == false) {
        continue
    }
    let report = JSON.parse(fs.readFileSync(`./reports/report-${station.codeStation}.json`, 'utf8'))
    let dataPoints = JSON.parse(fs.readFileSync(`./dataPoints/dataPoints-${station.codeStation}.json`, 'utf8'));

    if(Object.keys(dataPoints).length < 8){
        continue
    }

    for (let taxon in report.translationTable.taxons) {
        translationTable[taxon] = report.translationTable.taxons[taxon]
    }
    for (let parameter in report.translationTable.parameters) {
        translationTable[parameter] = report.translationTable.parameters[parameter]
    }
    for (let taxon in report.correlationCoefficients) {
        if (Parameters[taxon] == undefined) {
            Parameters[taxon] = {}
        }


        for (let parameter in report.correlationCoefficients[taxon]) {
            if (Parameters[taxon][parameter]) {

            }
            if (Parameters[taxon][parameter] == undefined) {
                Parameters[taxon][parameter] = []
            }

            Parameters[taxon][parameter].push(report.correlationCoefficients[taxon][parameter])
        }
    }
}
function add(accumulator, a) {
    return accumulator + a;
}
let results = {}
for (let taxon in Parameters) {
    results[translationTable[taxon]] = []
    for (let parameter in Parameters[taxon]) {
        Parameters[taxon][parameter] = Parameters[taxon][parameter].filter(x => x.correlationCoefficient != undefined)
        //console.log(Parameters[taxon][parameter])
        Parameters[taxon][parameter] = Parameters[taxon][parameter].filter(x => x.x.length >= 8)
        let values = Parameters[taxon][parameter].map(x => x.correlationCoefficient.toFixed(3))
        if (values.length <= 8) {
            continue
        }
        let avg = 0
        for(let v of values){
            avg += parseFloat(v)
        }
        avg = avg / values.length
        results[translationTable[taxon]].push({
            avg: avg.toFixed(3),
            list: values,
            topValue: values.sort((a, b) => Math.abs(b) - Math.abs(a))[0],
            count: Parameters[taxon][parameter].length,
            name: translationTable[parameter]
        })
    }
    results[translationTable[taxon]].sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg))
}

for (let taxon in results) {
    let csv = []
    csv.push('Parametre;Coefficient de corellation;Count;Top;List')

    for (let result of results[taxon]) {
        csv.push(`${result.name};${result.avg};${result.count};${result.topValue};${result.list.join(',')}`)
    }

    fs.writeFileSync(`./results/${taxon}.csv`, csv.join('\n'))
}

fs.writeFileSync('./results/results.json', JSON.stringify(results, null, 2))
