const fs = require('fs');
const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2),{
    string: ['station'],
    boolean: ['f'],
    alias: {
        f: 'fetch'
    }
});
const stations = require('./stations.js');
const calculateCorrelation = require("calculate-correlation");

let taxonsOfInterest = argv.taxon.split(',');


async function main() {
    let station = stations[argv.station]
    let rawDataPoints = fs.readFileSync(`./dataPoints/dataPoints-${station.codeStation}.json`, 'utf8');

    if(rawDataPoints == undefined){
        console.log(chalk.red(`Data points for station ${station.codeStation} not found`));
        return
    }

    let dataPoints = JSON.parse(rawDataPoints);
    console.log(chalk.blue(`Got ${Object.keys(dataPoints).length} data points for station ${station.codeStation}-${station.libelleStation}`));
    console.log(chalk.blue(`Calculating correlation coefficients for taxons ${taxonsOfInterest.join(', ')}`));
    let correlationCoefficients = {}

    let taxonInformation = {}
    let parameterInformation = {}

    for(let taxon of taxonsOfInterest){
        correlationCoefficients[taxon] = {}

        
        Y = {}
        parameterValues = {}
        

        for(let date in dataPoints){
            let dataPoint = dataPoints[date]
            if(dataPoint[taxon] == undefined || dataPoint[taxon].taxon == undefined){
                continue
            }else{
                if(taxonInformation[taxon] == undefined){
                    console.log(dataPoint[taxon]);
                    taxonInformation[taxon] = dataPoint[taxon].taxon.libelle
                }
            }
            Y[date] = dataPoint[taxon].resultat.value
            for(let key in dataPoint){
                let entry = dataPoint[key]
                if(entry.parametre != undefined){
                    if(parameterValues[key] == undefined){
                        parameterValues[key] = {}
                    }
                    parameterValues[key][date] = entry.resultat.value
                    if(parameterInformation[key] == undefined){
                        parameterInformation[key] = entry.parametre.libelle
                    }
                }
            }
        }
        console.log(chalk.blue(`Calculating correlation coefficients for taxon ${taxon} and ${Object.keys(parameterValues).length} parameters`));
        for(let parameter in parameterValues){
            y = []
            x = []
            for(let date in parameterValues[parameter]){
                y.push(parseFloat(Y[date]))
                x.push(parseFloat(parameterValues[parameter][date]))
            }
            correlationCoefficients[taxon][parameter] = {
                correlationCoefficient: calculateCorrelation(x, y),
                x: x,
                y: y
            }
        }
    }

    let report = {
        station: station,
        taxons: taxonsOfInterest.map(taxon => { return {taxon: taxon, libelle: taxonInformation[taxon]} }),
        correlationCoefficients: correlationCoefficients,
    }

    let topCorrelations = {}
    for(let taxon in correlationCoefficients){
        for(let parameter in correlationCoefficients[taxon]){
            let correlation = correlationCoefficients[taxon][parameter].correlationCoefficient
            if(Math.abs(correlation) > 0.7 && correlationCoefficients[taxon][parameter].x.length > 8){
                if(topCorrelations[taxon] == undefined){
                    topCorrelations[taxon] = {}
                }
                topCorrelations[taxon][parameterInformation[parameter]] = `${correlation}; ${correlationCoefficients[taxon][parameter].x.length} data points`
            }
        }

        topCorrelations[taxonInformation[taxon]] = topCorrelations[taxon]
        delete topCorrelations[taxon]
    }

    report.topCorrelations = topCorrelations
    report.translationTable = {
        taxons: taxonInformation,
        parameters: parameterInformation
    }




    fs.writeFileSync(`./reports/report-${station.codeStation}.json`, JSON.stringify(report), 'utf8');
}

main()